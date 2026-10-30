import { databaseRequest } from "../_shared/database.ts";
import { jsonResponse } from "../_shared/http.ts";
import { checkProviderPayment } from "../_shared/payment-providers.ts";
import { sendPaymentConfirmation } from "../_shared/notifications.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST" && request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const url = new URL(request.url);
    const payload = request.method === "POST"
      ? await request.json().catch(() => ({}))
      : {};
    const trackingId = url.searchParams.get("OrderTrackingId") ??
      (typeof payload?.OrderTrackingId === "string" ? payload.OrderTrackingId : "");
    const txRef = url.searchParams.get("OrderMerchantReference") ??
      (typeof payload?.OrderMerchantReference === "string" ? payload.OrderMerchantReference : "");
    if (!trackingId || !/^rh-[0-9a-f-]{36}$/.test(txRef)) {
      return jsonResponse({ error: "Invalid Pesapal notification." }, 400);
    }

    const rows = await databaseRequest<Array<{
      id: string;
      application_id: string;
      amount: number;
      currency: string;
      status: string;
    }>>(
      "application_payments",
      `?provider=eq.pesapal&tx_ref=eq.${encodeURIComponent(txRef)}&provider_order_id=eq.${encodeURIComponent(trackingId)}&select=id,application_id,amount,currency,status&limit=1`,
    );
    const payment = rows[0];
    if (!payment) return jsonResponse({ error: "Pesapal order was not found." }, 404);
    if (payment.status !== "pending") return jsonResponse({ received: true });

    const verified = await checkProviderPayment("pesapal", trackingId, {
      amount: Number(payment.amount),
      currency: payment.currency,
    });
    if (verified.status === "pending") return jsonResponse({ received: true });

    const updated = await databaseRequest<Array<{ id: string }>>(
      "application_payments",
      `?id=eq.${encodeURIComponent(payment.id)}&status=eq.pending&select=id`,
      {
        method: "PATCH",
        returnRepresentation: true,
        body: {
          status: verified.status,
          provider_transaction_id: verified.transactionId ?? trackingId,
          ...(verified.status === "paid" ? { paid_at: new Date().toISOString() } : {}),
        },
      },
    );
    if (updated.length && verified.status === "paid") {
      const applications = await databaseRequest<Array<{ full_name: string; phone: string; email: string }>>(
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
    console.error("Pesapal notification could not be reconciled.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Payment notification could not be verified." }, 503);
  }
});
