function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Supabase server configuration is missing.");
  return value;
}

const supabaseUrl = requiredEnvironmentValue("SUPABASE_URL");
const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");

export async function databaseRequest<T>(
  table: string,
  query: string,
  options: { method?: string; body?: unknown; returnRepresentation?: boolean; prefer?: string } = {},
): Promise<T> {
  const headers = new Headers({
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  });
  if (options.returnRepresentation) headers.set("Prefer", "return=representation");
  if (options.prefer) headers.set("Prefer", options.prefer);

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    console.error(`Database request failed for ${table} (${response.status}).`);
    throw new Error("Application data could not be saved. Please try again.");
  }

  const responseBody = await response.text();
  if (!responseBody) return [] as T;
  return JSON.parse(responseBody) as T;
}

export async function signUploadToken(applicationId: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + 30 * 60;
  const payload = `${applicationId}.${expiry}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(serviceRoleKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${payload}.${hex}`;
}

export async function verifyUploadToken(applicationId: string, token: string): Promise<boolean> {
  const [tokenApplicationId, rawExpiry, signature, extra] = token.split(".");
  if (extra !== undefined || tokenApplicationId !== applicationId || !rawExpiry || !signature) return false;

  const expiry = Number(rawExpiry);
  if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(serviceRoleKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const payload = `${applicationId}.${expiry}`;
  const signatureBytes = new Uint8Array(signature.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
  if (signatureBytes.length !== 32) return false;
  return await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payload));
}
