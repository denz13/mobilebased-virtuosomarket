import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { loadIsCustomer } from "@/lib/user-role";
import { useToast } from "@/lib/toast";
import {
  customerDisplayLabel,
  fetchOrdersForStoreVerification,
  formatOrderStatusLabel,
  isRowPendingVerification,
  normalizeOrderStatus,
  rowStatusValues,
  verifyCartOrder,
  type StoreVerifyOrderRow,
} from "@/lib/verify-orders";
import { isSupabaseConfigured } from "@/lib/supabase";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ListItem =
  | { type: "header"; key: string; label: string; count: number }
  | { type: "order"; key: string; order: StoreVerifyOrderRow };

type StatusFilterKey =
  | "all"
  | "under_verification"
  | "approved"
  | "declined"
  | "order_cancelled"
  | "cancelled";

const STATUS_FILTERS: { key: StatusFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "under_verification", label: "Under verification" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "order_cancelled", label: "Order cancelled" },
  { key: "cancelled", label: "Cancelled" },
];

function statusMatchesFilter(status: string, filter: StatusFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "under_verification") {
    return status === "under_verification" || status === "under_veriification";
  }
  if (filter === "order_cancelled") return status === "order_cancelled";
  if (filter === "cancelled") return status === "cancelled";
  return status === filter;
}

function matchesStatusFilter(row: StoreVerifyOrderRow, filter: StatusFilterKey): boolean {
  if (filter === "all") return true;
  return rowStatusValues(row).some((s) => statusMatchesFilter(s, filter));
}

function countForFilter(allRows: StoreVerifyOrderRow[], filter: StatusFilterKey): number {
  return allRows.filter((r) => matchesStatusFilter(r, filter)).length;
}

function statusBadgeColors(
  status: string | null | undefined,
  isDark: boolean
): { bg: string; text: string } {
  const s = normalizeOrderStatus(status);
  if (s === "approved") return { bg: isDark ? "#14532D" : "#DCFCE7", text: isDark ? "#86EFAC" : "#166534" };
  if (s === "declined") return { bg: isDark ? "#450A0A" : "#FEE2E2", text: isDark ? "#FCA5A5" : "#B91C1C" };
  if (s === "under_verification" || s === "under_veriification") {
    return { bg: isDark ? "#422006" : "#FEF3C7", text: isDark ? "#FCD34D" : "#92400E" };
  }
  if (s === "cancelled" || s === "order_cancelled") {
    return { bg: isDark ? "#1F2937" : "#F3F4F6", text: isDark ? "#9CA3AF" : "#4B5563" };
  }
  return { bg: isDark ? "#0F172A" : "#E0F2FE", text: isDark ? "#7DD3FC" : "#0369A1" };
}

function buildListItems(rows: StoreVerifyOrderRow[]): ListItem[] {
  const byCustomer = new Map<string, StoreVerifyOrderRow[]>();
  for (const row of rows) {
    const key = row.customer_users_id || "unknown";
    const list = byCustomer.get(key) ?? [];
    list.push(row);
    byCustomer.set(key, list);
  }

  const items: ListItem[] = [];
  for (const [customerId, orders] of byCustomer) {
    const label = customerDisplayLabel(orders[0]);
    items.push({
      type: "header",
      key: `h-${customerId}`,
      label,
      count: orders.length,
    });
    for (const order of orders) {
      items.push({ type: "order", key: `o-${order.payment_id}-${order.cart_id}`, order });
    }
  }
  return items;
}

export default function VerifyOrdersScreen() {
  const router = useRouter();
  const toast = useToast();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isCustomer, setIsCustomer] = useState<boolean | null>(null);
  const [rows, setRows] = useState<StoreVerifyOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [busyCartId, setBusyCartId] = useState<number | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");

  const palette = {
    bg: isDark ? "#020617" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    accent: "#00AEEF",
    danger: "#EF4444",
    headerBg: isDark ? "#0F172A" : "#E0F2FE",
  };

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesStatusFilter(r, statusFilter)),
    [rows, statusFilter]
  );

  const listItems = useMemo(() => buildListItems(filteredRows), [filteredRows]);

  const load = useCallback(async () => {
    const customer = await loadIsCustomer();
    setIsCustomer(customer);
    if (customer) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const { rows: next, error, emptyHint: hint } = await fetchOrdersForStoreVerification();
    setRows(next);
    setLoadError(error);
    setEmptyHint(hint);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onVerify = useCallback(
    (row: StoreVerifyOrderRow, status: "approved" | "declined") => {
      const who = customerDisplayLabel(row);
      const verb = status === "approved" ? "Approve" : "Decline";
      Alert.alert(
        `${verb} order?`,
        `${who} — ${row.product_name ?? "Product"}\n${verb} this order?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: verb,
            style: status === "approved" ? "default" : "destructive",
            onPress: async () => {
              setBusyCartId(row.cart_id);
              const { ok, error } = await verifyCartOrder(row.cart_id, status);
              setBusyCartId(null);
              if (!ok) {
                toast.error(error ?? "Could not update order.", verb);
                return;
              }
              setRows((list) =>
                list.filter(
                  (r) => !(r.cart_id === row.cart_id && r.payment_id === row.payment_id)
                )
              );
              toast.success(
                status === "approved" ? "Order approved." : "Order declined.",
                "Done"
              );
            },
          },
        ]
      );
    },
    [toast]
  );

  const renderOrderCard = (item: StoreVerifyOrderRow) => {
    const busy = busyCartId === item.cart_id;
    const who = customerDisplayLabel(item);
    const pending = isRowPendingVerification(item);
    const payStatus = normalizeOrderStatus(item.payment_status);
    const cartStatus = normalizeOrderStatus(item.cart_status);
    const payLabel = formatOrderStatusLabel(item.payment_status);
    const cartLabel = formatOrderStatusLabel(item.cart_status);
    const payColors = statusBadgeColors(item.payment_status, isDark);
    const cartColors = statusBadgeColors(item.cart_status, isDark);

    return (
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.orderBadgeRow}>
          <View style={[styles.orderBadge, { backgroundColor: palette.headerBg }]}>
            <Text style={[styles.orderBadgeText, { color: palette.accent }]}>
              Payment #{item.payment_id} · Cart #{item.cart_id}
            </Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: payColors.bg }]}>
            <Text style={[styles.statusPillText, { color: payColors.text }]}>Pay: {payLabel}</Text>
          </View>
          {cartStatus && cartStatus !== payStatus ? (
            <View style={[styles.statusPill, { backgroundColor: cartColors.bg }]}>
              <Text style={[styles.statusPillText, { color: cartColors.text }]}>
                Cart: {cartLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.whenInline, { color: palette.muted, marginBottom: 8 }]}>
          {formatWhen(item.cart_updated_at)}
        </Text>

        <View style={styles.cardTop}>
          {item.product_image ? (
            <Image source={{ uri: item.product_image }} style={styles.thumb} contentFit="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: palette.border }]}>
              <MaterialCommunityIcons name="package-variant" size={28} color={palette.muted} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={[styles.productName, { color: palette.text }]} numberOfLines={2}>
              {item.product_name ?? `Product #${item.product_id}`}
            </Text>
            <View style={styles.customerRow}>
              <MaterialCommunityIcons name="account-circle-outline" size={18} color={palette.accent} />
              <Text style={[styles.customerName, { color: palette.text }]}>{who}</Text>
            </View>
            {item.customer_email ? (
              <Text style={[styles.meta, { color: palette.muted }]}>{item.customer_email}</Text>
            ) : null}
            <Text style={[styles.meta, { color: palette.muted }]}>
              Qty {item.qty ?? "—"} · PHP {item.total_amount ?? "—"}
            </Text>
          </View>
        </View>

        {item.receipt_url ? (
          <Pressable
            onPress={() => setReceiptPreview(item.receipt_url)}
            style={[styles.receiptBtn, { borderColor: palette.border }]}
          >
            <MaterialCommunityIcons name="receipt" size={20} color={palette.accent} />
            <Text style={[styles.receiptBtnText, { color: palette.accent }]}>View payment receipt</Text>
          </Pressable>
        ) : (
          <Text style={[styles.noReceipt, { color: palette.muted }]}>No receipt uploaded</Text>
        )}

        {pending ? (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => onVerify(item, "declined")}
              style={[styles.actionBtn, styles.declineBtn, { opacity: busy ? 0.5 : 1 }]}
            >
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => onVerify(item, "approved")}
              style={[styles.actionBtn, styles.approveBtn, { opacity: busy ? 0.5 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.approveText}>Approve</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.doneHint, { color: palette.muted }]}>
            Pay: {payLabel}
            {cartStatus && cartStatus !== payStatus ? ` · Cart: ${cartLabel}` : ""}
          </Text>
        )}
      </View>
    );
  };

  if (isCustomer === true) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <Text style={[styles.title, { color: palette.text }]}>Verify orders</Text>
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <MaterialCommunityIcons name="store-off-outline" size={48} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Store only</Text>
          <Text style={[styles.emptySub, { color: palette.muted }]}>
            This screen is for store accounts to review customer orders.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
            onPress={() => router.replace("/cart")}
          >
            <Text style={styles.primaryBtnText}>Go to My Cart</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <Text style={[styles.title, { color: palette.text }]}>Verify orders</Text>
        <Text style={[styles.muted, { color: palette.muted }]}>Configure Supabase to load orders.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Customer orders</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {rows.length > 0
            ? `${rows.length} order${rows.length === 1 ? "" : "s"} — under verification, approved, declined, cancelled`
            : "payments ⋈ items_to_cart (lahat ng status)"}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterScroll}
      >
        {STATUS_FILTERS.map((opt) => {
          const active = statusFilter === opt.key;
          const count = countForFilter(rows, opt.key);
          return (
            <Pressable
              key={opt.key}
              onPress={() => setStatusFilter(opt.key)}
              style={[
                styles.filterChip,
                {
                  borderColor: active ? palette.accent : palette.border,
                  backgroundColor: active ? palette.accent : palette.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? "#FFFFFF" : palette.text, fontWeight: active ? "800" : "600" },
                ]}
              >
                {opt.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loadError ? (
        <View style={[styles.hintBox, { borderColor: palette.danger, backgroundColor: isDark ? "#450a0a" : "#FEF2F2" }]}>
          <Text style={[styles.hintText, { color: isDark ? "#FECACA" : "#991B1B" }]}>{loadError}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={listItems.length === 0 ? styles.listEmpty : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={palette.muted} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                {rows.length > 0 ? "No orders for this filter" : "No customer orders yet"}
              </Text>
              <Text style={[styles.emptySub, { color: palette.muted }]}>
                {rows.length > 0
                  ? "Try another status tab."
                  : emptyHint ??
                    "Lahat ng payment na may items_to_cart ay lalabas dito (under_verification, approved, declined, order_cancelled, …)."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <View style={[styles.customerHeader, { backgroundColor: palette.headerBg }]}>
                  <MaterialCommunityIcons name="account-group-outline" size={22} color={palette.accent} />
                  <Text style={[styles.customerHeaderText, { color: palette.text }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.customerHeaderCount, { color: palette.muted }]}>
                    {item.count} {item.count === 1 ? "order" : "orders"}
                  </Text>
                </View>
              );
            }
            return renderOrderCard(item.order);
          }}
        />
      )}

      <Modal visible={receiptPreview !== null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setReceiptPreview(null)}>
          <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
            {receiptPreview ? (
              <Image source={{ uri: receiptPreview }} style={styles.receiptFull} contentFit="contain" />
            ) : null}
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: palette.accent, marginTop: 12 }]}
              onPress={() => receiptPreview && void Linking.openURL(receiptPreview)}
            >
              <Text style={styles.primaryBtnText}>Open in browser</Text>
            </Pressable>
            <Pressable onPress={() => setReceiptPreview(null)} style={styles.modalClose}>
              <Text style={{ color: palette.muted, fontWeight: "600" }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  header: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  muted: { fontSize: 14 },
  hintBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  hintText: { fontSize: 13, lineHeight: 19 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingBottom: 24 },
  listEmpty: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  primaryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  customerHeaderText: { flex: 1, fontSize: 16, fontWeight: "800" },
  customerHeaderCount: { fontSize: 13, fontWeight: "600" },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  filterBar: { marginBottom: 12, maxHeight: 44 },
  filterScroll: { gap: 8, paddingRight: 8 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipText: { fontSize: 13 },
  orderBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  orderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexShrink: 1 },
  orderBadgeText: { fontSize: 11, fontWeight: "800" },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  whenInline: { fontSize: 11 },
  doneHint: { marginTop: 12, fontSize: 13, fontStyle: "italic" },
  cardTop: { flexDirection: "row", gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  productName: { fontSize: 17, fontWeight: "700" },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  customerName: { fontSize: 15, fontWeight: "700" },
  meta: { marginTop: 4, fontSize: 14 },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  receiptBtnText: { fontSize: 14, fontWeight: "700" },
  noReceipt: { marginTop: 12, fontSize: 13, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  declineBtn: { backgroundColor: "#FEE2E2" },
  declineText: { color: "#B91C1C", fontWeight: "800", fontSize: 15 },
  approveBtn: { backgroundColor: "#16A34A" },
  approveText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { borderRadius: 16, padding: 12, maxHeight: "90%" },
  receiptFull: { width: "100%", height: 360, borderRadius: 8 },
  modalClose: { alignItems: "center", padding: 12 },
});
