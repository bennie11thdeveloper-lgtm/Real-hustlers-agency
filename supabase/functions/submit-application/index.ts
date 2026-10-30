import { databaseRequest, signUploadToken } from "../_shared/database.ts";
import { allowedOrigin, jsonResponse, readJson, requireAllowedOrigin } from "../_shared/http.ts";
import { sendApplicationNotifications } from "../_shared/notifications.ts";
import { createProviderCheckout } from "../_shared/payment-providers.ts";
import { validPaymentProvider } from "../_shared/payment-credentials.ts";

type Provider = "flutterwave" | "paypal" | "pesapal" | "mtn_momo" | "airtel_money";
type Currency = "UGX" | "USD";

function isProvider(value: unknown): value is Provider {
  return value === "flutterwave" || validPaymentProvider(value);
}

function isSafeCheckoutUrl(rawUrl: string, provider: Provider, siteUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "flutterwave") return url.hostname === "checkout.flutterwave.com";
    if (provider === "paypal") return url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com");
    if (provider === "pesapal") return url.hostname === "pesapal.com" || url.hostname.endsWith(".pesapal.com");
    return url.origin === new URL(siteUrl).origin && url.pathname === "/payment-result";
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  const rejected = requireAllowedOrigin(request);
  if (rejected) return rejected;
  const origin = allowedOrigin(request)!;

  try {
    const body = await readJson(request);
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const rawPhone = typeof body.phone === "string" ? body.phone.replace(/[\s()-]/g, "") : "";
    const phone = rawPhone.startsWith("0") ? `+256${rawPhone.slice(1)}` : rawPhone;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const experience = typeof body.experience === "string" ? body.experience.trim() : "";
    const feeAcknowledged = body.feeAcknowledged === true;
    const provider = body.provider;
    const currency = body.currency;

    if (fullName.length < 2 || fullName.length > 120) {
      return jsonResponse({ error: "Enter your full name (2–120 characters)." }, 400, origin);
    }
    if (!/^\+256[0-9]{9}$/.test(phone)) {
      return jsonResponse({ error: "Enter a valid Ugandan mobile number." }, 400, origin);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return jsonResponse({ error: "Enter a valid email address for your payment receipt." }, 400, origin);
    }
    if (experience.length > 2000) {
      return jsonResponse({ error: "Experience details must be under 2,000 characters." }, 400, origin);
    }
    if (!feeAcknowledged) {
      return jsonResponse({ error: "Please acknowledge the fee and terms before continuing." }, 400, origin);
    }
    if (!isProvider(provider) || (currency !== "UGX" && currency !== "USD")) {
      return jsonResponse({ error: "Select an available payment method and currency." }, 400, origin);
    }

    const siteContent = await databaseRequest<Array<{ content: {
      paymentTermsUrl?: string;
      payments?: { feeUgx?: number; enabledProviders?: string[] };
      opportunities?: { roles?: Array<{ label?: string }> };
    } }>>("site_content", "?id=eq.public&select=content&limit=1");
    const publishedContent = siteContent[0]?.content;
    const publishedRoles = publishedContent?.opportunities?.roles ?? [];
    const roles = new Set([
      "Other",
      ...publishedRoles
        .map((opportunity) => opportunity.label?.trim())
        .filter((label): label is string => typeof label === "string" && label.length > 0),
    ]);
    if (role.length > 120 || !roles.has(role)) {
      return jsonResponse({ error: "Select a valid work area." }, 400, origin);
    }

    const feeUgx = publishedContent?.payments?.feeUgx;
    const enabledProviders = publishedContent?.payments?.enabledProviders ?? ["flutterwave"];
    if (typeof feeUgx !== "number" || !Number.isSafeInteger(feeUgx) || feeUgx < 1 || feeUgx > 1_000_000_000 ||
        !enabledProviders.includes(provider)) {
      return jsonResponse({ error: "The selected payment method is not currently available." }, 400, origin);
    }
    if ((provider === "flutterwave" || provider === "mtn_momo" || provider === "airtel_money") && currency !== "UGX") {
      return jsonResponse({ error: "The selected mobile-money method only accepts UGX." }, 400, origin);
    }
    if (provider === "paypal" && currency !== "USD") {
      return jsonResponse({ error: "PayPal checkout requires USD." }, 400, origin);
    }

    const siteUrl = Deno.env.get("APP_SITE_URL");
    const paymentTermsUrl = publishedContent?.paymentTermsUrl?.trim();
    let validTermsUrl = false;
    try {
      const parsedTermsUrl = new URL(paymentTermsUrl ?? "");
      validTermsUrl = parsedTermsUrl.protocol === "https:" && Boolean(parsedTermsUrl.hostname);
    } catch {
      validTermsUrl = false;
    }
    if (!siteUrl || !paymentTermsUrl || !validTermsUrl) {
      console.error("Application URL or published fee terms are missing.");
      return jsonResponse({ error: "Online applications are temporarily unavailable. Please contact the agency." }, 503, origin);
    }

    let amount = feeUgx;
    let exchangeRate: number | null = null;
    if (currency === "USD") {
      let rateResponse: Response;
      let rateData: {
        result?: unknown;
        rates?: { UGX?: unknown };
        time_last_update_unix?: unknown;
      } | null;
      try {
        rateResponse = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: AbortSignal.timeout(8_000),
        });
        const payload: unknown = await rateResponse.json().catch(() => null);
        rateData = payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload as {
            result?: unknown;
            rates?: { UGX?: unknown };
            time_last_update_unix?: unknown;
          }
          : null;
      } catch (error) {
        console.error("Currency conversion service request failed.", error instanceof Error ? error.message : "Unknown error.");
        return jsonResponse({ error: "The USD fee could not be calculated right now. Please try UGX or try again later." }, 503, origin);
      }
      const ugxPerUsd = Number(rateData?.rates?.UGX);
      const updatedAt = Number(rateData?.time_last_update_unix);
      const now = Date.now() / 1000;
      const rateIsFresh = Number.isFinite(updatedAt) && updatedAt <= now + 300 && now - updatedAt <= 48 * 60 * 60;
      if (!rateResponse.ok || rateData?.result !== "success" || !Number.isFinite(ugxPerUsd) ||
          ugxPerUsd <= 0 || !rateIsFresh) {
        console.error(`Currency conversion service failed (${rateResponse.status}).`);
        return jsonResponse({ error: "The USD fee could not be calculated right now. Please try UGX or try again later." }, 503, origin);
      }
      exchangeRate = ugxPerUsd;
      amount = Math.round((feeUgx / ugxPerUsd) * 100) / 100;
      if (amount < 0.01) {
        return jsonResponse({ error: "The configured fee is too small to charge in USD." }, 400, origin);
      }
    }

    if (provider === "flutterwave" && !Deno.env.get("FLW_SECRET_KEY")) {
      console.error("Flutterwave server configuration is missing.");
      return jsonResponse({ error: "The selected payment method is temporarily unavailable." }, 503, origin);
    }

    const applicationId = crypto.randomUUID();
    const txRef = `rh-${crypto.randomUUID()}`;
    const applicant = { full_name: fullName, phone, email, role };

    await databaseRequest("applications", "?select=id", {
      method: "POST",
      body: [{ id: applicationId, full_name: fullName, phone, email, role, experience }],
    });
    await databaseRequest("application_payments", "?select=id", {
      method: "POST",
      body: [{
        application_id: applicationId,
        tx_ref: txRef,
        amount,
        currency,
        provider,
        base_amount_ugx: feeUgx,
        exchange_rate: exchangeRate,
      }],
    });

    let checkoutUrl: string;
    let providerOrderId: string;
    try {
      if (provider === "flutterwave") {
        const checkoutResponse = await fetch("https://api.flutterwave.com/v3/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("FLW_SECRET_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tx_ref: txRef,
            amount,
            currency,
            redirect_url: `${siteUrl.replace(/\/$/, "")}/payment-result?tx_ref=${encodeURIComponent(txRef)}`,
            payment_options: "mobilemoneyuganda",
            customer: { name: fullName, email, phonenumber: phone },
            customizations: { title: "Real Hustlers Agency", description: "Registration and paperwork" },
            meta: { application_id: applicationId },
          }),
        });
        const payload = await checkoutResponse.json().catch(() => null);
        checkoutUrl = payload?.data?.link;
        providerOrderId = txRef;
        if (!checkoutResponse.ok || payload?.status !== "success" ||
            typeof checkoutUrl !== "string" || !isSafeCheckoutUrl(checkoutUrl, provider, siteUrl)) {
          throw new Error(`Flutterwave checkout initialization failed (${checkoutResponse.status}).`);
        }
      } else {
        const checkout = await createProviderCheckout(provider, {
          txRef,
          amount,
          currency,
          siteUrl,
          applicant: { fullName, phone, email },
        });
        checkoutUrl = checkout.checkoutUrl;
        providerOrderId = checkout.providerOrderId;
        if (!isSafeCheckoutUrl(checkoutUrl, provider, siteUrl)) {
          throw new Error("Payment provider returned an unsafe checkout URL.");
        }
      }
    } catch (error) {
      console.error("Payment checkout initialization failed.", error instanceof Error ? error.message : "Unknown error.");
      await databaseRequest("application_payments", `?tx_ref=eq.${encodeURIComponent(txRef)}`, {
        method: "PATCH",
        body: { status: "failed" },
      });
      return jsonResponse({ error: "We couldn't start your payment. Your application details were not lost; please contact the agency before trying again." }, 502, origin);
    }

    await databaseRequest("application_payments", `?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: { checkout_url: checkoutUrl, provider_order_id: providerOrderId },
    });

    const notificationWarnings = await sendApplicationNotifications(
      applicant,
      checkoutUrl,
      Deno.env.get("AGENCY_NOTIFICATION_EMAIL"),
      paymentTermsUrl,
    );

    return jsonResponse({
      applicationId,
      txRef,
      uploadToken: await signUploadToken(applicationId),
      checkoutUrl,
      amount,
      currency,
      provider,
      notificationWarnings,
    }, 201, origin);
  } catch (error) {
    console.error("Application submission failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "We couldn't safely process your application. Please try again or contact the agency." }, 500, origin);
  }
});
