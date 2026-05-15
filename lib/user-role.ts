import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function isCustomerUser(user: User | null | undefined): boolean {
  const role = user?.user_metadata?.role;
  return typeof role === "string" && role.toLowerCase() === "customer";
}

export async function loadIsCustomer(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase.auth.getUser();
  return isCustomerUser(data.user);
}
