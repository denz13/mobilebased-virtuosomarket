import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type StoreVerifyOrderRow = {
  cart_id: number;
  payment_id: number;
  customer_users_id: string;
  customer_name: string | null;
  customer_email: string | null;
  product_id: number;
  product_name: string | null;
  product_image: string | null;
  qty: string | null;
  total_amount: string | null;
  cart_updated_at: string | null;
  receipt_url: string | null;
  payment_status: string | null;
  cart_status: string | null;
};

type ProductLite = {
  id: number;
  product_name: string | null;
  product_image: string | null;
};

type PaymentRow = {
  id: number;
  items_to_cart: string | null;
  receipt: string | null;
  updated_at: string | null;
  status: string | null;
};

const RPC_LIST = "list_orders_for_store_verification";
const RPC_VERIFY = "verify_cart_order";
const PAYMENTS_TABLE = "payments";

const SETUP_HINT =
  "Run scripts/store-verify-orders-rls.sql in Supabase SQL Editor, then reload API schema.";

export function normalizeOrderStatus(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function formatOrderStatusLabel(raw: string | null | undefined): string {
  const s = normalizeOrderStatus(raw);
  if (!s) return "Unknown";
  if (s === "under_verification" || s === "under_veriification") return "Under verification";
  if (s === "approved") return "Approved";
  if (s === "declined") return "Declined";
  if (s === "order_cancelled") return "Order cancelled";
  if (s === "cancelled") return "Cancelled";
  if (s === "pending") return "Pending";
  if (s === "to_ship") return "To ship";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function rowDisplayStatus(row: StoreVerifyOrderRow): string | null {
  return row.payment_status ?? row.cart_status;
}

/** Payment or cart status (either can differ after partial updates). */
export function rowStatusValues(row: StoreVerifyOrderRow): string[] {
  const values = [row.payment_status, row.cart_status]
    .map((v) => normalizeOrderStatus(v))
    .filter((s) => s.length > 0);
  return [...new Set(values)];
}

export function isRowPendingVerification(row: StoreVerifyOrderRow): boolean {
  return rowStatusValues(row).some(
    (s) => s === "under_verification" || s === "under_veriification"
  );
}

function parseCartIdsFromPayment(itemsToCart: string | null): number[] {
  return String(itemsToCart ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function loadProductMap(productIds: number[]): Promise<Map<number, ProductLite>> {
  const unique = [...new Set(productIds.filter((n) => Number.isFinite(n)))];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("product")
    .select("id, product_name, product_image")
    .in("id", unique)
    .is("deleted_at", null);

  return new Map(
    (data ?? []).map((p) => {
      const row = p as ProductLite;
      return [row.id, row];
    })
  );
}

export function customerDisplayLabel(row: StoreVerifyOrderRow): string {
  const name = row.customer_name?.trim();
  if (name) return name;
  const email = row.customer_email?.trim();
  if (email) return email.split("@")[0] ?? email;
  const id = row.customer_users_id?.trim();
  if (id && id.length > 10) return `Customer ${id.slice(0, 8)}…`;
  return "Customer";
}

async function fetchFromPaymentsTable(): Promise<{
  rows: StoreVerifyOrderRow[];
  error: string | null;
}> {
  const { data: payments, error: payErr } = await supabase
    .from(PAYMENTS_TABLE)
    .select("id, items_to_cart, receipt, updated_at, status")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (payErr) {
    return { rows: [], error: `${payErr.message}\n\n${SETUP_HINT}` };
  }

  const paymentList = (payments ?? []) as PaymentRow[];
  if (paymentList.length === 0) {
    return { rows: [], error: null };
  }

  const allCartIds = new Set<number>();
  for (const pay of paymentList) {
    for (const id of parseCartIdsFromPayment(pay.items_to_cart)) {
      allCartIds.add(id);
    }
  }

  if (allCartIds.size === 0) {
    return { rows: [], error: null };
  }

  const { data: cartRows, error: cartErr } = await supabase
    .from("items_to_cart")
    .select("id, users_id, product_id, qty, total_amount, updated_at, status")
    .is("deleted_at", null)
    .in("id", [...allCartIds]);

  if (cartErr) {
    return { rows: [], error: `${cartErr.message}\n\n${SETUP_HINT}` };
  }

  if ((cartRows ?? []).length === 0 && allCartIds.size > 0) {
    return {
      rows: [],
      error: `${SETUP_HINT}\n\nMay payment pero hindi mabasa ang items_to_cart (RLS).`,
    };
  }

  const cartById = new Map(
    (cartRows ?? []).map((raw) => {
      const c = raw as {
        id: number;
        users_id: string;
        product_id: string;
        qty: string | null;
        total_amount: string | null;
        updated_at: string | null;
        status: string | null;
      };
      return [c.id, c] as const;
    })
  );

  const productIds: number[] = [];
  for (const c of cartById.values()) {
    const pid = Number(c.product_id);
    if (Number.isFinite(pid)) productIds.push(pid);
  }
  const productMap = await loadProductMap(productIds);

  const rows: StoreVerifyOrderRow[] = [];

  for (const pay of paymentList) {
    for (const cartId of parseCartIdsFromPayment(pay.items_to_cart)) {
      const c = cartById.get(cartId);
      if (!c) continue;

      const pid = Number(c.product_id);
      const prod = Number.isFinite(pid) ? productMap.get(pid) : undefined;

      rows.push({
        cart_id: c.id,
        payment_id: pay.id,
        customer_users_id: c.users_id,
        customer_name: null,
        customer_email: null,
        product_id: Number.isFinite(pid) ? pid : 0,
        product_name: prod?.product_name ?? (Number.isFinite(pid) ? `Product #${pid}` : "Product"),
        product_image: prod?.product_image ?? null,
        qty: c.qty,
        total_amount: c.total_amount,
        cart_updated_at: pay.updated_at ?? c.updated_at,
        receipt_url: pay.receipt,
        payment_status: pay.status,
        cart_status: c.status,
      });
    }
  }

  rows.sort((a, b) => {
    const ta = a.cart_updated_at ? new Date(a.cart_updated_at).getTime() : 0;
    const tb = b.cart_updated_at ? new Date(b.cart_updated_at).getTime() : 0;
    return tb - ta;
  });

  return { rows, error: null };
}

async function fetchViaRpc(): Promise<{
  rows: StoreVerifyOrderRow[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc(RPC_LIST);
  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: (data ?? []) as StoreVerifyOrderRow[], error: null };
}

export async function fetchOrdersForStoreVerification(): Promise<{
  rows: StoreVerifyOrderRow[];
  error: string | null;
  emptyHint: string | null;
  usedRpc: boolean;
}> {
  if (!isSupabaseConfigured) {
    return { rows: [], error: null, emptyHint: null, usedRpc: false };
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user?.id) {
    return { rows: [], error: "Not signed in.", emptyHint: null, usedRpc: false };
  }

  const rpc = await fetchViaRpc();
  if (!rpc.error && rpc.rows.length > 0) {
    return { rows: rpc.rows, error: null, emptyHint: null, usedRpc: true };
  }

  const fromPayments = await fetchFromPaymentsTable();
  if (fromPayments.error) {
    return { rows: [], error: fromPayments.error, emptyHint: null, usedRpc: false };
  }
  if (fromPayments.rows.length > 0) {
    return { rows: fromPayments.rows, error: null, emptyHint: null, usedRpc: false };
  }

  const rpcMissing =
    rpc.error?.includes("Could not find the function") ||
    rpc.error?.includes("schema cache");

  return {
    rows: [],
    error: rpc.error && !rpcMissing ? rpc.error : null,
    emptyHint: rpcMissing ? SETUP_HINT : "Walang row sa payments / items_to_cart.",
    usedRpc: false,
  };
}

async function updatePaymentStatusForCart(
  cartId: number,
  status: "approved" | "declined"
): Promise<void> {
  const { data: payments } = await supabase
    .from(PAYMENTS_TABLE)
    .select("id, items_to_cart")
    .is("deleted_at", null);

  const ids = (payments ?? [])
    .filter((p) =>
      parseCartIdsFromPayment((p as PaymentRow).items_to_cart).includes(cartId)
    )
    .map((p) => (p as PaymentRow).id);

  if (ids.length === 0) return;

  const now = new Date().toISOString();
  await supabase.from(PAYMENTS_TABLE).update({ status, updated_at: now }).in("id", ids);
}

export async function verifyCartOrder(
  cartId: number,
  status: "approved" | "declined"
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error: rpcErr } = await supabase.rpc(RPC_VERIFY, {
    p_cart_id: cartId,
    p_status: status,
  });

  if (!rpcErr) return { ok: true, error: null };

  const now = new Date().toISOString();
  const { error: cartErr } = await supabase
    .from("items_to_cart")
    .update({ status, updated_at: now })
    .eq("id", cartId);

  if (cartErr) {
    return { ok: false, error: cartErr.message ?? SETUP_HINT };
  }

  await updatePaymentStatusForCart(cartId, status);
  return { ok: true, error: null };
}
