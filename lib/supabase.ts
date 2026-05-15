import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const supabaseUrl = normalizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? ""
);

const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * GoTrue (Auth) often still expects the legacy **anon** JWT (`eyJ...`).
 * If you only set `sb_publishable_...` and get "Invalid API key", add
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` from Dashboard → API Keys → *Legacy anon, service_role*.
 */
const supabaseKey = anonKey || publishableKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** True when GoTrue rejects the stored refresh token (rotated JWT secret, revoked session, stale install). */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const message =
    "message" in error && typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  if (!message) return false;
  return (
    message.includes("refresh token") &&
    (message.includes("invalid") || message.includes("not found"))
  );
}

/**
 * Clears local auth only (no server call). Run on startup so a bad refresh token
 * does not spam errors — user signs in again.
 */
export async function clearLocalSessionIfRefreshTokenInvalid(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.auth.getSession();
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (e) {
    if (isInvalidRefreshTokenError(e)) {
      await supabase.auth.signOut({ scope: "local" });
    }
  }
}
