import { databaseRequest } from "./database.ts";

export type PaymentProvider = "paypal" | "pesapal" | "mtn_momo" | "airtel_money";
export type PaymentEnvironment = "sandbox" | "live";
type JsonRecord = Record<string, unknown>;

type StoredCredential = {
  provider: PaymentProvider;
  encrypted_config: string;
  environment: PaymentEnvironment;
};

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

const keyFields: Record<PaymentProvider, string[]> = {
  paypal: ["clientId", "clientSecret"],
  pesapal: ["consumerKey", "consumerSecret"],
  mtn_momo: ["subscriptionKey", "apiUser", "apiKey"],
  airtel_money: ["clientId", "clientSecret"],
};

function encryptionKeyBytes(): ArrayBuffer {
  const encoded = Deno.env.get("PAYMENT_CREDENTIALS_ENCRYPTION_KEY");
  if (!encoded) throw new Error("Payment credential encryption is not configured.");
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new Error("Payment credential encryption key is invalid.");
  }
  if (decoded.length !== 32) throw new Error("Payment credential encryption key must be 32 bytes.");
  const buffer = new ArrayBuffer(32);
  const key = new Uint8Array(buffer);
  for (let index = 0; index < decoded.length; index += 1) {
    key[index] = decoded.charCodeAt(index);
  }
  return buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptConfig(config: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(config)),
  );
  return JSON.stringify({ iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) });
}

export async function getPaymentCredentials(
  provider: PaymentProvider,
): Promise<{ environment: PaymentEnvironment; config: Record<string, string> } | null> {
  const rows = await databaseRequest<StoredCredential[]>(
    "payment_provider_credentials",
    `?provider=eq.${provider}&select=provider,encrypted_config,environment&limit=1`,
  );
  const stored = rows[0];
  if (!stored) return null;

  const envelope = asRecord(JSON.parse(stored.encrypted_config));
  if (typeof envelope?.iv !== "string" || typeof envelope.ciphertext !== "string") {
    throw new Error("Stored payment credentials are invalid.");
  }
  const encodedIv = envelope.iv;
  const encodedCiphertext = envelope.ciphertext;
  const iv = Uint8Array.from(atob(encodedIv), (character) => character.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encodedCiphertext), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const config = asRecord(JSON.parse(new TextDecoder().decode(plaintext)));
  if (!config || !Object.values(config).every((value) => typeof value === "string")) {
    throw new Error("Decrypted payment credentials are invalid.");
  }
  return {
    environment: stored.environment,
    config: config as Record<string, string>,
  };
}

export async function savePaymentCredentials(
  provider: PaymentProvider,
  environment: PaymentEnvironment,
  config: Record<string, string>,
): Promise<void> {
  const encryptedConfig = await encryptConfig(config);
  await databaseRequest("payment_provider_credentials", "?on_conflict=provider", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{ provider, encrypted_config: encryptedConfig, environment, updated_at: new Date().toISOString() }],
  });
}

export async function deletePaymentCredentials(provider: PaymentProvider): Promise<void> {
  await databaseRequest("payment_provider_credentials", `?provider=eq.${provider}`, { method: "DELETE" });
}

export function validPaymentProvider(value: unknown): value is PaymentProvider {
  return value === "paypal" || value === "pesapal" || value === "mtn_momo" || value === "airtel_money";
}

export function validateProviderConfig(
  provider: PaymentProvider,
  value: unknown,
): { environment: PaymentEnvironment; config: Record<string, string> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const environment = input.environment;
  if (environment !== "sandbox" && environment !== "live") return null;

  const config: Record<string, string> = {};
  for (const field of keyFields[provider]) {
    const secret = input[field];
    if (typeof secret !== "string" || secret.trim().length < 1 || secret.length > 2048) return null;
    config[field] = secret.trim();
  }
  return { environment, config };
}
