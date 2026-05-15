import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadIsCustomer } from "@/lib/user-role";

/** Matches your Supabase table name (singular). */
export const NOTIFICATION_TABLE = "notification";

/** List of store/admin auth UUIDs (see scripts/notification-full-setup.sql). */
export const STORE_RECIPIENTS_TABLE = "store_notify_recipients";

const UNREAD_STATUS = "unread";
const LOG_PREFIX = "[notifications]";

const RPC_CREATE_FOR_USERS = "create_notifications_for_users";
const RPC_NOTIFY_FROM_TABLE = "notify_store_staff_from_table";
const RPC_NOTIFY_PRODUCT_OWNERS = "notify_product_owners";
const RPC_NOTIFY_STORE_LEGACY = "notify_store_staff";
const RPC_REGISTER_STORE = "register_store_notifier";

function logDebug(step: string, data?: Record<string, unknown>) {
  if (data !== undefined) {
    console.log(LOG_PREFIX, step, data);
  } else {
    console.log(LOG_PREFIX, step);
  }
}

function logWarn(step: string, data?: Record<string, unknown>) {
  if (data !== undefined) {
    console.warn(LOG_PREFIX, step, data);
  } else {
    console.warn(LOG_PREFIX, step);
  }
}

/**
 * Comma-separated auth user UUIDs (store / admin). Set in `.env`, e.g.:
 * EXPO_PUBLIC_STORE_NOTIFY_USER_IDS=uuid1,uuid2
 * Restart Expo after changing: npx expo start -c
 */
export function getStoreNotifyRecipientIdsFromEnv(): string[] {
  const raw = process.env.EXPO_PUBLIC_STORE_NOTIFY_USER_IDS ?? "";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

export type NotificationRow = {
  id: number;
  created_at: string | null;
  description: string | null;
  status: string | null;
};

/** SQL test rows and debug copy — hide from the notifications inbox. */
export function isTestNotificationDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  return /delete me later/i.test(desc) || /test notification from sql/i.test(desc);
}

export type FetchMyNotificationsResult = {
  rows: NotificationRow[];
  userId: string | null;
  error: string | null;
};

export const NOTIFICATION_BACKEND_SETUP_HINT =
  "Sa Supabase → SQL Editor, i-copy ang BUONG file scripts/RUN-IN-SUPABASE.sql (huwag isang linya lang), i-Run, tapos Settings → API → Reload schema. Subukan ulit ang Order again / Buy now.";

/** True when security-definer RPCs exist (required for customers to notify stores). */
export async function isNotificationBackendReady(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.rpc(RPC_CREATE_FOR_USERS, {
    p_user_ids: [],
    p_description: "",
  });

  if (!error) return true;

  return !(
    error.code === "PGRST202" ||
    error.message.includes("Could not find the function") ||
    error.message.includes("schema cache")
  );
}

/** Notifications for the currently signed-in user (`notification.users_id`). */
export async function fetchMyNotifications(
  limit = 100
): Promise<FetchMyNotificationsResult> {
  if (!isSupabaseConfigured) {
    return { rows: [], userId: null, error: null };
  }

  const { data: userRes, error: authErr } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;
  if (!uid) {
    return {
      rows: [],
      userId: null,
      error: authErr?.message ?? null,
    };
  }

  const { data, error } = await supabase
    .from(NOTIFICATION_TABLE)
    .select("id, created_at, description, status")
    .eq("users_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = ((data ?? []) as NotificationRow[]).filter(
    (row) => !isTestNotificationDescription(row.description)
  );

  return {
    rows,
    userId: uid,
    error: error?.message ?? null,
  };
}

export async function markNotificationRead(
  notificationId: number,
  userId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase
    .from(NOTIFICATION_TABLE)
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("users_id", userId);

  return { ok: !error, error: error?.message ?? null };
}

export type NotifyResult = {
  ok: boolean;
  error: string | null;
  recipientCount: number;
  hint?: string;
  /** Extra detail for console debugging (not shown in UI). */
  debug?: Record<string, unknown>;
};

const NO_RECIPIENTS_HINT =
  "Walang store sa listahan ng notifications.\n\n" +
  "• Mag-login ng STORE account sa app (isang beses) — auto-register ang UUID, o\n" +
  "• Sa Supabase SQL:\n" +
  "  insert into store_notify_recipients (users_id) values ('STORE-UUID');\n\n" +
  "Kung RPC error: run scripts/notification-full-setup.sql o scripts/create-store-notify-recipients.sql";

/**
 * Call when a store/admin user opens the app — fills `store_notify_recipients` with their UUID.
 */
export async function registerCurrentUserAsStoreNotifier(): Promise<void> {
  if (!isSupabaseConfigured) {
    logWarn("registerCurrentUserAsStoreNotifier: Supabase not configured");
    return;
  }
  const isCustomer = await loadIsCustomer();
  if (isCustomer) {
    logDebug("registerCurrentUserAsStoreNotifier: skipped (customer role)");
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  logDebug("registerCurrentUserAsStoreNotifier: store user", {
    userId: userData.user?.id ?? null,
  });

  const { error } = await supabase.rpc(RPC_REGISTER_STORE);
  if (error) {
    logWarn("register_store_notifier RPC failed, trying direct upsert", {
      message: error.message,
      code: (error as { code?: string }).code,
    });
    const uid = userData.user?.id;
    if (!uid) return;
    const { error: upsertErr } = await supabase.from(STORE_RECIPIENTS_TABLE).upsert(
      { users_id: uid, created_at: new Date().toISOString() },
      { onConflict: "users_id" }
    );
    if (upsertErr) {
      logWarn("store_notify_recipients upsert failed", { message: upsertErr.message });
    } else {
      logDebug("store_notify_recipients upsert ok", { users_id: uid });
    }
  } else {
    logDebug("register_store_notifier RPC ok");
  }
}

/** Env IDs + rows from `store_notify_recipients` table. */
export async function getStoreNotifyRecipientIds(): Promise<string[]> {
  const fromEnv = getStoreNotifyRecipientIdsFromEnv();
  const fromTable: string[] = [];

  logDebug("getStoreNotifyRecipientIds: env", {
    count: fromEnv.length,
    ids: fromEnv.length > 0 ? fromEnv : "(empty — set EXPO_PUBLIC_STORE_NOTIFY_USER_IDS)",
  });

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from(STORE_RECIPIENTS_TABLE).select("users_id");
    if (error) {
      logWarn("getStoreNotifyRecipientIds: table read failed", {
        table: STORE_RECIPIENTS_TABLE,
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
      });
    } else {
      for (const row of data ?? []) {
        const r = row as { users_id?: string | null };
        if (typeof r.users_id === "string" && r.users_id.trim()) {
          fromTable.push(r.users_id.trim());
        }
      }
      logDebug("getStoreNotifyRecipientIds: table", {
        count: fromTable.length,
        ids: fromTable,
      });
    }
  }

  const merged = [...new Set([...fromEnv, ...fromTable])];
  logDebug("getStoreNotifyRecipientIds: merged total", { count: merged.length });
  return merged;
}

async function insertViaRpc(
  userIds: string[],
  description: string
): Promise<NotifyResult | null> {
  logDebug("insertViaRpc: calling RPC", {
    rpc: RPC_CREATE_FOR_USERS,
    recipientCount: userIds.length,
    descriptionPreview: description.slice(0, 80),
  });

  const { data, error } = await supabase.rpc(RPC_CREATE_FOR_USERS, {
    p_user_ids: userIds,
    p_description: description,
  });

  logDebug("insertViaRpc: RPC response", {
    data,
    error: error
      ? { message: error.message, code: (error as { code?: string }).code }
      : null,
  });

  if (error) {
    if (
      error.message.includes("Could not find the function") ||
      error.message.includes("schema cache")
    ) {
      logWarn("insertViaRpc: RPC not deployed — will try direct insert", {
        message: error.message,
      });
      return null;
    }
    return {
      ok: false,
      error: error.message,
      recipientCount: userIds.length,
      hint: "Run scripts/notification-full-setup.sql in Supabase SQL Editor.",
      debug: { step: "insertViaRpc", rpc: RPC_CREATE_FOR_USERS },
    };
  }

  const count = typeof data === "number" ? data : 0;
  if (count === 0) {
    logWarn("insertViaRpc: RPC returned 0 — trying direct insert", { userIds });
    return null;
  }

  return { ok: true, error: null, recipientCount: count };
}

/**
 * Inserts one row per recipient into `notification`.
 */
export async function insertNotificationsForRecipients(
  recipientUserIds: string[],
  description: string
): Promise<NotifyResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: "Supabase is not configured.",
      recipientCount: 0,
      debug: { step: "insertNotificationsForRecipients" },
    };
  }

  if (recipientUserIds.length === 0) {
    return {
      ok: false,
      error: null,
      recipientCount: 0,
      hint: NO_RECIPIENTS_HINT,
      debug: { step: "insertNotificationsForRecipients", reason: "no_recipient_ids" },
    };
  }

  const viaRpc = await insertViaRpc(recipientUserIds, description);
  if (viaRpc?.ok) return viaRpc;

  logDebug("insertNotificationsForRecipients: direct insert", {
    table: NOTIFICATION_TABLE,
    rowCount: recipientUserIds.length,
  });

  const now = new Date().toISOString();
  const rows = recipientUserIds.map((users_id) => ({
    users_id,
    description,
    status: UNREAD_STATUS,
    created_at: now,
    updated_at: now,
  }));

  const { data: insertData, error } = await supabase.from(NOTIFICATION_TABLE).insert(rows).select("id");

  logDebug("insertNotificationsForRecipients: direct insert response", {
    insertedIds: insertData,
    error: error
      ? { message: error.message, code: (error as { code?: string }).code }
      : null,
  });

  if (error) {
    const rls =
      error.message.includes("row-level security") ||
      error.message.includes("new row violates");
    return {
      ok: false,
      error: error.message,
      recipientCount: recipientUserIds.length,
      hint: rls ? NOTIFICATION_BACKEND_SETUP_HINT : undefined,
      debug: { step: "directInsert", rls },
    };
  }

  return { ok: true, error: null, recipientCount: recipientUserIds.length };
}

function parseProductId(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Notifies each product's `users_id` (seller who added the listing).
 * Uses security-definer RPC when available (works for customers).
 * Falls back to `notifyStoreStaff` when owners are unknown.
 */
export async function notifyProductOwners(
  productIds: number[],
  description: string
): Promise<NotifyResult> {
  const uniqueProductIds = [
    ...new Set(
      productIds
        .map((id) => parseProductId(id))
        .filter((id): id is number => id != null)
    ),
  ];

  logDebug("notifyProductOwners: start", {
    productIds: uniqueProductIds,
    descriptionPreview: description.slice(0, 120),
  });

  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: "Supabase is not configured.",
      recipientCount: 0,
      debug: { step: "notifyProductOwners" },
    };
  }

  if (uniqueProductIds.length > 0) {
    const { data: rpcCount, error: rpcErr } = await supabase.rpc(RPC_NOTIFY_PRODUCT_OWNERS, {
      p_product_ids: uniqueProductIds,
      p_description: description,
    });

    logDebug("notifyProductOwners: RPC", {
      rpc: RPC_NOTIFY_PRODUCT_OWNERS,
      count: rpcCount,
      error: rpcErr?.message ?? null,
    });

    if (!rpcErr) {
      const count = typeof rpcCount === "number" ? rpcCount : 0;
      if (count > 0) {
        return { ok: true, error: null, recipientCount: count };
      }
    } else if (
      !rpcErr.message.includes("Could not find the function") &&
      !rpcErr.message.includes("schema cache")
    ) {
      logWarn("notifyProductOwners: RPC failed", { message: rpcErr.message });
    }

    const { data: products, error } = await supabase
      .from("product")
      .select("id, product_name, users_id")
      .in("id", uniqueProductIds);

    if (error) {
      logWarn("notifyProductOwners: product lookup failed", { message: error.message });
    } else {
      const ownerIds = [
        ...new Set(
          (products ?? [])
            .map((p) => {
              const row = p as { users_id?: string | null };
              return typeof row.users_id === "string" ? row.users_id.trim() : "";
            })
            .filter(Boolean)
        ),
      ];

      logDebug("notifyProductOwners: resolved owners (client)", {
        ownerCount: ownerIds.length,
        ownerIds,
      });

      if (ownerIds.length > 0) {
        const viaInsert = await insertNotificationsForRecipients(ownerIds, description);
        if (viaInsert.ok) return viaInsert;
        logWarn("notifyProductOwners: insert for owners failed", viaInsert);
      }
    }
  } else {
    logWarn("notifyProductOwners: no product ids — using store notify list");
  }

  return notifyStoreStaff(description);
}

export async function notifyStoreStaff(description: string): Promise<NotifyResult> {
  logDebug("notifyStoreStaff: start", {
    descriptionPreview: description.slice(0, 120),
    supabaseConfigured: isSupabaseConfigured,
  });

  if (!isSupabaseConfigured) {
    const result: NotifyResult = {
      ok: false,
      error: "Supabase is not configured.",
      recipientCount: 0,
      debug: { step: "notifyStoreStaff" },
    };
    logWarn("notifyStoreStaff: failed", result);
    return result;
  }

  const { data: authData } = await supabase.auth.getUser();
  logDebug("notifyStoreStaff: caller", {
    callerUserId: authData.user?.id ?? null,
    callerRole: authData.user?.user_metadata?.role ?? null,
  });

  const ids = await getStoreNotifyRecipientIds();

  if (ids.length > 0) {
    const viaCreateRpc = await insertViaRpc(ids, description);
    if (viaCreateRpc?.ok) {
      logDebug("notifyStoreStaff: success via create_notifications_for_users", viaCreateRpc);
      return viaCreateRpc;
    }
    if (viaCreateRpc && !viaCreateRpc.ok) {
      logWarn("notifyStoreStaff: create_notifications_for_users failed", viaCreateRpc);
    }
  }

  logDebug("notifyStoreStaff: trying RPC", { rpc: RPC_NOTIFY_FROM_TABLE });
  const { data: tableCount, error: tableRpcErr } = await supabase.rpc(RPC_NOTIFY_FROM_TABLE, {
    p_description: description,
  });

  logDebug("notifyStoreStaff: RPC notify_store_staff_from_table", {
    tableCount,
    error: tableRpcErr
      ? {
          message: tableRpcErr.message,
          code: (tableRpcErr as { code?: string }).code,
          hint: (tableRpcErr as { hint?: string }).hint,
        }
      : null,
  });

  if (!tableRpcErr && typeof tableCount === "number" && tableCount > 0) {
    const result: NotifyResult = { ok: true, error: null, recipientCount: tableCount };
    logDebug("notifyStoreStaff: success via table RPC", result);
    return result;
  }

  if (tableRpcErr?.message?.includes("Could not find the function")) {
    logDebug("notifyStoreStaff: trying legacy RPC", { rpc: RPC_NOTIFY_STORE_LEGACY });
    const { error: legacyErr } = await supabase.rpc(RPC_NOTIFY_STORE_LEGACY, {
      description,
    });
    logDebug("notifyStoreStaff: legacy notify_store_staff", { error: legacyErr?.message ?? null });
    if (!legacyErr) {
      const count = ids.length > 0 ? ids.length : 1;
      return { ok: true, error: null, recipientCount: count };
    }
  }

  if (ids.length > 0) {
    const result = await insertNotificationsForRecipients(ids, description);
    logDebug("notifyStoreStaff: finished via direct insert path", result);
    return result;
  }

  const result: NotifyResult = {
    ok: false,
    error: tableRpcErr?.message ?? null,
    recipientCount: 0,
    hint:
      tableRpcErr?.message?.includes("Could not find the function")
        ? NOTIFICATION_BACKEND_SETUP_HINT
        : NO_RECIPIENTS_HINT,
    debug: {
      step: "notifyStoreStaff",
      tableRpcCount: tableCount,
      tableRpcError: tableRpcErr?.message ?? null,
      recipientIdsFound: ids.length,
      envIds: getStoreNotifyRecipientIdsFromEnv(),
    },
  };
  logWarn("notifyStoreStaff: failed", result);
  return result;
}

export async function notifyCustomer(userId: string, description: string): Promise<NotifyResult> {
  if (!userId) {
    return { ok: false, error: "Missing user id.", recipientCount: 0 };
  }
  return insertNotificationsForRecipients([userId], description);
}

/** Log full diagnostic snapshot (call from cart on failure). */
export async function debugNotificationSetup(): Promise<void> {
  logDebug("=== notification setup snapshot ===");
  logDebug("env EXPO_PUBLIC_STORE_NOTIFY_USER_IDS", {
    configured: Boolean(process.env.EXPO_PUBLIC_STORE_NOTIFY_USER_IDS?.trim()),
    count: getStoreNotifyRecipientIdsFromEnv().length,
  });
  if (!isSupabaseConfigured) {
    logWarn("Supabase not configured");
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  logDebug("current user", { id: auth.user?.id, role: auth.user?.user_metadata?.role });

  const { data: recipients, error: recErr } = await supabase
    .from(STORE_RECIPIENTS_TABLE)
    .select("users_id, created_at");
  logDebug("store_notify_recipients rows", { rows: recipients, error: recErr?.message });

  const uid = auth.user?.id;
  const { count, error: notifErr } = uid
    ? await supabase
        .from(NOTIFICATION_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("users_id", uid)
    : { count: 0, error: null };
  logDebug("my notification count", { count, userId: uid, error: notifErr?.message });

  const backendReady = await isNotificationBackendReady();
  logDebug("notification RPC ready", { backendReady });
  logDebug("=== end snapshot ===");
}
