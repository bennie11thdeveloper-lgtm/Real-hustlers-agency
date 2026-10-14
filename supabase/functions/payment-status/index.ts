import { databaseRequest } from "../_shared/database.ts";
import { allowedOrigin, jsonResponse, readJson, requireAllowedOrigin } from "../_shared/http.ts";

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

    const rows = await databaseRequest<Array<{ status: string }>>(
      "application_payments",
      `?tx_ref=eq.${encodeURIComponent(txRef)}&select=status&limit=1`,
    );
    if (!rows.length) return jsonResponse({ error: "Payment reference not found." }, 404, origin);

    return jsonResponse({ status: rows[0].status }, 200, origin);
  } catch (error) {
    console.error("Payment status lookup failed.", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({ error: "Payment status is temporarily unavailable." }, 503, origin);
  }
});
