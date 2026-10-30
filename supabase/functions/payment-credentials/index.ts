import { databaseRequest } from "../_shared/database.ts";
import { deletePaymentCredentials, getPaymentCredentials, savePaymentCredentials, validPaymentProvider, validateProviderConfig } from "../_shared/payment-credentials.ts";
import { allowedOrigin, jsonResponse, readJson, requireAllowedOrigin } from "../_shared/http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function requireSiteAdmin(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization || !supabaseUrl || !serviceRoleKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (typeof user?.id !== "string") return null;
  const admins = await databaseRequest<Array<{ user_id: string }>>(
    "site_admins",
    `?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,
  );
  return admins.length ? user.id : null;
}

Deno.serve(async (request) => {
  const rejected = requireAllowedOrigin(request);
  if (rejected) return rejected;
  const origin = allowedOrigin(request)!;

  try {
    if (!await requireSiteAdmin(request)) {
      return jsonResponse({ error: "Admin access is required." }, 403, origin);
    }

    const body = await readJson(request);
    if (body.action === "status") {
      const providers = await databaseRequest<Array<{ provider: string; environment: string }>>(
        "payment_provider_credentials",
        "?select=provider,environment",
      );
      for (const provider of providers) {
        if (validPaymentProvider(provider.provider)) {
          await getPaymentCredentials(provider.provider);
        }
      }
      if (Deno.env.get("FLW_SECRET_KEY")) {
        providers.push({ provider: "flutterwave", environment: "live" });
      }
      return jsonResponse({
        providers: providers.map(({ provider, environment }) => ({ provider, environment, configured: true })),
      }, 200, origin);
    }

    if (!validPaymentProvider(body.provider)) {
      return jsonResponse({ error: "Choose a supported payment provider." }, 400, origin);
    }

    if (body.action === "delete") {
      await deletePaymentCredentials(body.provider);
      return jsonResponse({ configured: false }, 200, origin);
    }

    if (body.action !== "save") {
      return jsonResponse({ error: "Choose a valid credential action." }, 400, origin);
    }
    const validated = validateProviderConfig(body.provider, body.credentials);
    if (!validated) {
      return jsonResponse({ error: "Complete every required credential and choose an environment." }, 400, origin);
    }
    await savePaymentCredentials(body.provider, validated.environment, validated.config);
    return jsonResponse({ configured: true, environment: validated.environment }, 200, origin);
  } catch (error) {
    console.error("Payment credential update failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Payment settings could not be updated. Check the secure credential setup." }, 500, origin);
  }
});
