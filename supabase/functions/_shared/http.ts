export function jsonResponse(body: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  const configuredOrigin = Deno.env.get("APP_ORIGIN");
  return origin && configuredOrigin && origin === configuredOrigin ? origin : null;
}

export function requireAllowedOrigin(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    const origin = allowedOrigin(request);
    return origin
      ? new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Vary": "Origin",
        },
      })
      : jsonResponse({ error: "Origin not allowed." }, 403);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const origin = allowedOrigin(request);
  return origin ? null : jsonResponse({ error: "Origin not allowed." }, 403);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 12_000) throw new Error("Request is too large.");

  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid request body.");
  }
  return value as Record<string, unknown>;
}
