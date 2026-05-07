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
