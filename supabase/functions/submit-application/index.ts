import { databaseRequest, signUploadToken } from "../_shared/database.ts";
import { allowedOrigin, jsonResponse, readJson, requireAllowedOrigin } from "../_shared/http.ts";
import { sendApplicationNotifications } from "../_shared/notifications.ts";

const registrationFee = 150_000;

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

    if (fullName.length < 2 || fullName.length > 120) {
      return jsonResponse({ error: "Enter your full name (2–120 characters)." }, 400, origin);
    }
    if (!/^\+256[0-9]{9}$/.test(phone)) {
      return jsonResponse({ error: "Enter a valid Ugandan mobile number." }, 400, origin);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return jsonResponse({ error: "Enter a valid email address for your payment receipt." }, 400, origin);
    }
    if (experience.length > 2000) return jsonResponse({ error: "Experience details must be under 2,000 characters." }, 400, origin);
    if (!feeAcknowledged) return jsonResponse({ error: "Please acknowledge the registration and paperwork fee before continuing." }, 400, origin);

    const siteContent = await databaseRequest<Array<{ content: {
      paymentTermsUrl?: string;
      opportunities?: { roles?: Array<{ label?: string }> };
    } }>>(
      "site_content",
      "?id=eq.public&select=content&limit=1",
    );
    const publishedRoles = siteContent[0]?.content?.opportunities?.roles ?? [];
    const roles = new Set([
      "Other",
      ...publishedRoles
        .map((opportunity) => opportunity.label?.trim())
        .filter((label): label is string => typeof label === "string" && label.length > 0),
    ]);
    if (role.length > 120 || !roles.has(role)) {
      return jsonResponse({ error: "Select a valid work area." }, 400, origin);
    }

    const flutterwaveKey = Deno.env.get("FLW_SECRET_KEY");
    const siteUrl = Deno.env.get("APP_SITE_URL");
    const paymentTermsUrl = siteContent[0]?.content?.paymentTermsUrl?.trim();
    let validTermsUrl = false;
    try {
      const parsedTermsUrl = new URL(paymentTermsUrl ?? "");
      validTermsUrl = parsedTermsUrl.protocol === "https:" && Boolean(parsedTermsUrl.hostname);
    } catch {
      validTermsUrl = false;
    }
    if (!flutterwaveKey || !siteUrl || !paymentTermsUrl || !validTermsUrl) {
      console.error("Flutterwave, application URL, or published fee terms are missing.");
      return jsonResponse({ error: "Online applications are temporarily unavailable. Please contact the agency." }, 503, origin);
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
        amount: registrationFee,
        currency: "UGX",
      }],
    });

    const checkoutResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flutterwaveKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: registrationFee,
        currency: "UGX",
        redirect_url: `${siteUrl.replace(/\/$/, "")}/payment-result?tx_ref=${encodeURIComponent(txRef)}`,
        payment_options: "mobilemoneyuganda",
        customer: { name: fullName, email, phonenumber: phone },
        customizations: {
          title: "Real Hustlers Agency",
          description: "Registration and paperwork",
        },
        meta: { application_id: applicationId },
      }),
    });
    const checkoutPayload = await checkoutResponse.json().catch(() => null);
    const checkoutUrl = checkoutPayload?.data?.link;
    if (!checkoutResponse.ok || checkoutPayload?.status !== "success" ||
        typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://checkout.flutterwave.com/")) {
      console.error(`Flutterwave checkout initialization failed (${checkoutResponse.status}).`);
      await databaseRequest("application_payments", `?tx_ref=eq.${encodeURIComponent(txRef)}`, {
        method: "PATCH",
        body: { status: "failed" },
      });
      return jsonResponse({ error: "We couldn't start your payment. Your application details were not lost; please contact the agency before trying again." }, 502, origin);
    }

    await databaseRequest("application_payments", `?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: { checkout_url: checkoutUrl },
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
      amount: registrationFee,
      currency: "UGX",
      notificationWarnings,
    }, 201, origin);
  } catch (error) {
    console.error("Application submission failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "We couldn't safely process your application. Please try again or contact the agency." }, 500, origin);
  }
});
