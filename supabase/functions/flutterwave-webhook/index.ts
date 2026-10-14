import { databaseRequest } from "../_shared/database.ts";
import { jsonResponse } from "../_shared/http.ts";
import { sendPaymentConfirmation } from "../_shared/notifications.ts";

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("FLW_WEBHOOK_SECRET_HASH");
  const suppliedSecret = request.headers.get("verif-hash");
  if (!webhookSecret || !suppliedSecret || !constantTimeEqual(suppliedSecret, webhookSecret)) {
    return jsonResponse({ error: "Invalid webhook signature." }, 401);
  }

  try {
    const payload = await request.json();
    const transactionId = payload?.data?.id;
    const event = payload?.event;
    if (event !== "charge.completed" || !Number.isSafeInteger(transactionId)) {
      return jsonResponse({ received: true });
    }

    const secretKey = Deno.env.get("FLW_SECRET_KEY");
    if (!secretKey) throw new Error("Flutterwave server configuration is missing.");

    const verificationResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const verification = await verificationResponse.json().catch(() => null);
    const transaction = verification?.data;
    if (!verificationResponse.ok || verification?.status !== "success" ||
        transaction?.status !== "successful" || typeof transaction?.tx_ref !== "string") {
      console.error(`Flutterwave transaction verification failed (${verificationResponse.status}).`);
      return jsonResponse({ error: "Transaction could not be verified." }, 400);
    }

    const payments = await databaseRequest<Array<{
      id: string;
      application_id: string;
      amount: number;
      currency: string;
      status: string;
    }>>(
      "application_payments",
      `?tx_ref=eq.${encodeURIComponent(transaction.tx_ref)}&select=id,application_id,amount,currency,status&limit=1`,
    );
    const payment = payments[0];
    if (!payment) return jsonResponse({ error: "Payment reference not found." }, 404);
    if (Number(transaction.amount) !== payment.amount || transaction.currency !== payment.currency) {
      console.error("Flutterwave transaction amount or currency did not match the payment record.");
      return jsonResponse({ error: "Transaction amount or currency mismatch." }, 400);
    }
    if (payment.status === "paid") return jsonResponse({ received: true });

    const updated = await databaseRequest<Array<{ id: string }>>(
      "application_payments",
      `?id=eq.${encodeURIComponent(payment.id)}&status=neq.paid&select=id`,
      {
        method: "PATCH",
        returnRepresentation: true,
        body: {
          status: "paid",
          provider_transaction_id: String(transactionId),
          paid_at: new Date().toISOString(),
        },
      },
    );

    if (updated.length) {
      const applications = await databaseRequest<Array<{
        full_name: string;
        phone: string;
        email: string;
      }>>(
        "applications",
        `?id=eq.${encodeURIComponent(payment.application_id)}&select=full_name,phone,email&limit=1`,
      );
      if (applications[0]) {
        const warnings = await sendPaymentConfirmation(
          applications[0],
          Deno.env.get("AGENCY_NOTIFICATION_EMAIL"),
        );
        if (warnings.length) console.error("One or more payment confirmation notifications were not delivered.");
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("Flutterwave webhook processing failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Webhook processing failed." }, 500);
  }
});
