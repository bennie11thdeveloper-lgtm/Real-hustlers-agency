import { getPaymentCredentials, savePaymentCredentials, type PaymentProvider } from "./payment-credentials.ts";

type CheckoutDetails = {
  txRef: string;
  amount: number;
  currency: "UGX" | "USD";
  siteUrl: string;
  applicant: { fullName: string; phone: string; email: string };
};

type ProviderStatus = "pending" | "paid" | "failed" | "cancelled";
type JsonRecord = Record<string, unknown>;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function providerUrl(provider: PaymentProvider, environment: "sandbox" | "live"): string {
  if (provider === "paypal") return environment === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  if (provider === "pesapal") return environment === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";
  if (provider === "mtn_momo") return environment === "sandbox"
    ? "https://sandbox.momodeveloper.mtn.com"
    : "https://momodeveloper.mtn.com";
  return environment === "sandbox"
    ? "https://openapiuat.airtel.africa"
    : "https://openapi.airtel.africa";
}

async function readJson(response: Response): Promise<JsonRecord> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`Payment provider request failed (${response.status}).`);
  }
  return body as JsonRecord;
}

async function getAccessToken(
  cacheKey: string,
  requestToken: () => Promise<{ token: string; expiresIn: number }>,
): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 10_000) return cached.token;
  const result = await requestToken();
  const expiresIn = Number.isFinite(result.expiresIn) ? result.expiresIn : 240;
  tokenCache.set(cacheKey, { token: result.token, expiresAt: Date.now() + Math.max(30, expiresIn - 30) * 1000 });
  return result.token;
}

async function paypalToken(config: Record<string, string>, baseUrl: string): Promise<string> {
  return await getAccessToken(`paypal:${baseUrl}:${config.clientId}`, async () => {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const result = await readJson(response);
    if (typeof result.access_token !== "string") throw new Error("PayPal did not return an access token.");
    return { token: result.access_token, expiresIn: Number(result.expires_in) };
  });
}

async function pesapalToken(config: Record<string, string>, baseUrl: string): Promise<string> {
  return await getAccessToken(`pesapal:${baseUrl}:${config.consumerKey}`, async () => {
    const response = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ consumer_key: config.consumerKey, consumer_secret: config.consumerSecret }),
    });
    const result = await readJson(response);
    if (typeof result.token !== "string") throw new Error("Pesapal did not return an access token.");
    return { token: result.token, expiresIn: 240 };
  });
}

function mtnTargetEnvironment(environment: "sandbox" | "live"): string {
  return environment === "sandbox" ? "sandbox" : "mtnuganda";
}

async function mtnToken(
  config: Record<string, string>,
  baseUrl: string,
  environment: "sandbox" | "live",
): Promise<string> {
  return await getAccessToken(`mtn_momo:${baseUrl}:${config.apiUser}`, async () => {
    const response = await fetch(`${baseUrl}/collection/token/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.apiUser}:${config.apiKey}`)}`,
        "Ocp-Apim-Subscription-Key": config.subscriptionKey,
        "X-Target-Environment": mtnTargetEnvironment(environment),
      },
    });
    const result = await readJson(response);
    if (typeof result.access_token !== "string") throw new Error("MTN MoMo did not return an access token.");
    return { token: result.access_token, expiresIn: Number(result.expires_in) };
  });
}

async function airtelToken(config: Record<string, string>, baseUrl: string): Promise<string> {
  return await getAccessToken(`airtel_money:${baseUrl}:${config.clientId}`, async () => {
    const response = await fetch(`${baseUrl}/auth/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
      }),
    });
    const result = await readJson(response);
    if (typeof result.access_token !== "string") throw new Error("Airtel Money did not return an access token.");
    return { token: result.access_token, expiresIn: Number(result.expires_in) };
  });
}

function completedPaypalCapture(
  order: JsonRecord,
  expected: { amount: number; currency: string },
): string | null {
  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  for (const value of units) {
    const unit = asRecord(value);
    const payments = asRecord(unit?.payments);
    const captures = Array.isArray(payments?.captures) ? payments.captures : [];
    for (const captureValue of captures) {
      const capture = asRecord(captureValue);
      const amount = asRecord(capture?.amount);
      if (capture?.status === "COMPLETED" &&
          Number(amount?.value) === expected.amount &&
          amount?.currency_code === expected.currency &&
          typeof capture.id === "string") {
        return capture.id;
      }
    }
  }
  return null;
}

function paypalCaptureStatus(order: JsonRecord): string | null {
  const units = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  for (const value of units) {
    const unit = asRecord(value);
    const payments = asRecord(unit?.payments);
    const captures = Array.isArray(payments?.captures) ? payments.captures : [];
    for (const captureValue of captures) {
      const capture = asRecord(captureValue);
      if (typeof capture?.status === "string") return capture.status;
    }
  }
  return null;
}

export async function createProviderCheckout(
  provider: PaymentProvider,
  details: CheckoutDetails,
): Promise<{ checkoutUrl: string; providerOrderId: string }> {
  const stored = await getPaymentCredentials(provider);
  if (!stored) throw new Error(`${provider} credentials have not been configured.`);
  const baseUrl = providerUrl(provider, stored.environment);
  const returnUrl = `${details.siteUrl.replace(/\/$/, "")}/payment-result?tx_ref=${encodeURIComponent(details.txRef)}`;

  if (provider === "paypal") {
    if (details.currency !== "USD") throw new Error("PayPal checkout requires USD.");
    const token = await paypalToken(stored.config, baseUrl);
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: details.txRef,
          custom_id: details.txRef,
          amount: { currency_code: details.currency, value: details.amount.toFixed(2) },
          description: "Registration and paperwork",
        }],
        application_context: {
          return_url: returnUrl,
          cancel_url: returnUrl,
          user_action: "PAY_NOW",
        },
      }),
    });
    const order = await readJson(response);
    const links = Array.isArray(order.links) ? order.links : [];
    const approval = links.map(asRecord).find((link) =>
      link?.rel === "approve" && typeof link.href === "string",
    );
    if (typeof order.id !== "string" || typeof approval?.href !== "string") {
      throw new Error("PayPal did not return a checkout link.");
    }
    return { checkoutUrl: approval.href, providerOrderId: order.id };
  }

  if (provider === "pesapal") {
    const token = await pesapalToken(stored.config, baseUrl);
    let ipnId = stored.config.ipnId;
    if (!ipnId) {
      const ipnResponse = await fetch(`${baseUrl}/api/URLSetup/RegisterIPN`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/pesapal-ipn`,
          ipn_notification_type: "POST",
        }),
      });
      const ipn = await readJson(ipnResponse);
      if (typeof ipn.ipn_id !== "string") throw new Error("Pesapal did not register the payment notification.");
      ipnId = ipn.ipn_id;
      await savePaymentCredentials("pesapal", stored.environment, { ...stored.config, ipnId });
    }
    const names = details.applicant.fullName.trim().split(/\s+/);
    const response = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: details.txRef,
        currency: details.currency,
        amount: details.amount,
        description: "Registration and paperwork",
        callback_url: returnUrl,
        notification_id: ipnId,
        billing_address: {
          email_address: details.applicant.email,
          phone_number: details.applicant.phone,
          first_name: names[0],
          last_name: names.slice(1).join(" ") || names[0],
          country_code: "UG",
        },
      }),
    });
    const order = await readJson(response);
    if (typeof order.order_tracking_id !== "string" || typeof order.redirect_url !== "string") {
      throw new Error("Pesapal did not return a checkout link.");
    }
    return { checkoutUrl: order.redirect_url, providerOrderId: order.order_tracking_id };
  }

  if (details.currency !== "UGX") throw new Error("Ugandan mobile-money checkout requires UGX.");
  if (provider === "mtn_momo") {
    const token = await mtnToken(stored.config, baseUrl, stored.environment);
    const requestId = crypto.randomUUID();
    const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": stored.config.subscriptionKey,
        "X-Target-Environment": mtnTargetEnvironment(stored.environment),
        "X-Reference-Id": requestId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(Math.round(details.amount)),
        currency: "UGX",
        externalId: details.txRef,
        payer: { partyIdType: "MSISDN", partyId: details.applicant.phone.replace(/^\+/, "") },
        payerMessage: "Real Hustlers Agency registration",
        payeeNote: "Registration and paperwork",
      }),
    });
    if (response.status !== 202) await readJson(response);
    return { checkoutUrl: returnUrl, providerOrderId: requestId };
  }

  const token = await airtelToken(stored.config, baseUrl);
  const response = await fetch(`${baseUrl}/merchant/v1/payments/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "*/*",
      "X-Country": "UG",
      "X-Currency": "UGX",
    },
    body: JSON.stringify({
      reference: details.txRef,
      subscriber: { country: "UG", currency: "UGX", msisdn: details.applicant.phone.replace(/^\+/, "") },
      transaction: {
        amount: Math.round(details.amount),
        country: "UG",
        currency: "UGX",
        id: details.txRef,
      },
    }),
  });
  await readJson(response);
  return { checkoutUrl: returnUrl, providerOrderId: details.txRef };
}

export async function checkProviderPayment(
  provider: PaymentProvider,
  orderId: string,
  expected: { amount: number; currency: string },
): Promise<{ status: ProviderStatus; transactionId?: string }> {
  const stored = await getPaymentCredentials(provider);
  if (!stored) throw new Error(`${provider} credentials have not been configured.`);
  const baseUrl = providerUrl(provider, stored.environment);

  if (provider === "paypal") {
    const token = await paypalToken(stored.config, baseUrl);
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const order = await readJson(orderResponse);
    if (order.status === "APPROVED") {
      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const capture = await readJson(captureResponse);
      const transactionId = completedPaypalCapture(capture, expected);
      if (transactionId) return { status: "paid", transactionId };
      if (paypalCaptureStatus(capture) === "DECLINED") return { status: "failed" };
    }
    if (order.status === "COMPLETED") {
      const transactionId = completedPaypalCapture(order, expected);
      if (transactionId) return { status: "paid", transactionId };
      console.error("PayPal marked an order completed but its captured amount or currency did not match.");
      return { status: "pending" };
    }
    if (order.status === "VOIDED") return { status: "cancelled" };
    return { status: "pending" };
  }

  if (provider === "pesapal") {
    const token = await pesapalToken(stored.config, baseUrl);
    const response = await fetch(
      `${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    const status = await readJson(response);
    const description = String(status.payment_status_description ?? "").toLowerCase();
    if (description === "completed" &&
        Number(status.amount) === expected.amount &&
        status.currency === expected.currency) {
      return { status: "paid", transactionId: String(status.confirmation_code ?? orderId) };
    }
    if (["failed", "invalid", "reversed"].includes(description)) return { status: "failed" };
    if (description === "cancelled") return { status: "cancelled" };
    return { status: "pending" };
  }

  if (provider === "mtn_momo") {
    const token = await mtnToken(stored.config, baseUrl, stored.environment);
    const response = await fetch(
      `${baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": stored.config.subscriptionKey,
          "X-Target-Environment": mtnTargetEnvironment(stored.environment),
        },
      },
    );
    const result = await readJson(response);
    if (result.status === "SUCCESSFUL" &&
        Number(result.amount) === expected.amount &&
        result.currency === expected.currency) {
      return { status: "paid", transactionId: String(result.financialTransactionId ?? orderId) };
    }
    if (result.status === "FAILED" || result.status === "REJECTED") return { status: "failed" };
    return { status: "pending" };
  }

  const token = await airtelToken(stored.config, baseUrl);
  const response = await fetch(`${baseUrl}/standard/v1/payments/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*", "X-Country": "UG", "X-Currency": "UGX" },
  });
  const result = await readJson(response);
  const data = asRecord(result.data);
  const transaction = asRecord(data?.transaction);
  if (transaction?.status === "TS" &&
      Number(transaction.amount) === expected.amount &&
      transaction.currency === expected.currency) {
    return { status: "paid", transactionId: String(transaction.id ?? orderId) };
  }
  if (transaction?.status === "TF" || transaction?.status === "TE") return { status: "failed" };
  return { status: "pending" };
}
