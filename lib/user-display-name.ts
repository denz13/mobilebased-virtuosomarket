import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

/** Full name from signup metadata, else email local-part, else "Customer". */
export function displayNameFromUser(
  user: Pick<User, "email" | "user_metadata"> | null | undefined
): string {
  if (!user) return "Customer";

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const first = typeof meta?.first_name === "string" ? meta.first_name.trim() : "";
  const last = typeof meta?.last_name === "string" ? meta.last_name.trim() : "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (full) return full;

  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }

  return "Customer";
}

export async function getCurrentUserDisplayName(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return displayNameFromUser(data.user ?? undefined);
}
