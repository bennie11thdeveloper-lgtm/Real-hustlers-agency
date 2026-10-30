import { databaseRequest } from "../_shared/database.ts";
import { allowedOrigin, jsonResponse, readJson, requireAllowedOrigin } from "../_shared/http.ts";
import { checkProviderPayment } from "../_shared/payment-providers.ts";
import { validPaymentProvider } from "../_shared/payment-credentials.ts";
import { sendPaymentConfirmation } from "../_shared/notifications.ts";

Deno.serve(async (request) => {
  const rejected = requireAllowedOrigin(request);
  if (rejected) return rejected;
  const origin = allowedOrigin(request)!;

  try {
    const body = await readJson(request);
    const txRef = typeof body.txRef === "string" ? body.txRef : "";
    if (!/^rh-[0-9a-f-]{36}$/.test(txRef)) {
      return jsonResponse({ error: "Invalid payment reference." }, 400, origin);
    }

    const rows = await databaseRequest<Array<{
      id: string;
      application_id: string;
      status: string;
      amount: number;
      currency: string;
      provider: string;
      provider_order_id: string | null;
      provider_transaction_id: string | null;
    }>>(
      "application_payments",
      `?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,application_id,status,amount,currency,provider,provider_order_id,provider_transaction_id&limit=1`,
    );
    const payment = rows[0];
    if (!payment) return jsonResponse({ error: "Payment reference not found." }, 404, origin);

    let status = payment.status;
    let providerTransactionId = payment.provider_transaction_id;
    if (status === "pending" && payment.provider !== "flutterwave" && payment.provider_order_id) {
      if (!validPaymentProvider(payment.provider)) {
        return jsonResponse({ error: "Unsupported payment provider." }, 500, origin);
      }
      const verified = await checkProviderPayment(
        payment.provider,
        payment.provider_order_id,
        { amount: Number(payment.amount), currency: payment.currency },
      );
      if (verified.status !== "pending") {
        const update = await databaseRequest<Array<{ id: string }>>(
          "application_payments",
          `?id=eq.${encodeURIComponent(payment.id)}&status=eq.pending&select=id`,
          {
            method: "PATCH",
            returnRepresentation: true,
            body: {
              status: verified.status,
              provider_transaction_id: verified.transactionId ?? payment.provider_order_id,
              ...(verified.status === "paid" ? { paid_at: new Date().toISOString() } : {}),
            },
          },
        );
        if (update.length && verified.status === "paid") {
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
          status = verified.status;
          providerTransactionId = verified.transactionId ?? payment.provider_order_id;
        } else if (update.length && verified.status !== "paid") {
          status = verified.status;
        }
      }
    }

    return jsonResponse({
      status,
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      providerTransactionId,
    }, 200, origin);
  } catch (error) {
    console.error("Payment status lookup failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Payment status is temporarily unavailable." }, 503, origin);
  }
});
