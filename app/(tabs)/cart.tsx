import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { loadIsCustomer } from "@/lib/user-role";
import { useToast } from "@/lib/toast";

/**
 * Storage: public bucket `receipts` — run `scripts/receipts-bucket-supabase.sql` in SQL Editor.
 * Checkout row: table `public.payments` (columns items_to_cart, receipt, status, …).
 */
const PAYMENTS_TABLE = "payments";
const RECEIPT_STORAGE_BUCKET = "receipts";

const RECEIPT_ROW_STATUS = "under_verification";

type CartRow = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  product_id: string | null;
  qty: string | null;
  total_amount: string | null;
  status: string | null;
};

type ProductLite = {
  id: number;
  product_name: string | null;
  product_image: string | null;
  product_price: string | null;
};

function parsePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Format an ISO timestamp into a date-only string (e.g. "May 15, 2026"). */
function formatCartDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type StatusFilterKey = "all" | "pending" | "under_verification" | "approved" | "to_ship" | "cancelled";

const STATUS_FILTER_OPTIONS: { key: StatusFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "under_verification", label: "Under verification" },
  { key: "approved", label: "Approved" },
  { key: "to_ship", label: "To ship" },
  { key: "cancelled", label: "Cancelled" },
];

function normalizeStatus(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Cart lines that can be edited, removed, and checked out. */
function isPendingRow(row: CartRow): boolean {
  const n = normalizeStatus(row.status);
  return n === "" || n === "pending";
}

/** Map DB value to a filter bucket (legacy `ordered` → under verification). */
function logicalStatusKey(row: CartRow): string {
  const n = normalizeStatus(row.status);
  if (n === "ordered") return "under_verification";
  return n;
}

function matchesStatusFilter(row: CartRow, filter: StatusFilterKey): boolean {
  const s = logicalStatusKey(row);
  if (filter === "cancelled") return s === "cancelled";
  // "All" tab hides cancelled items — they belong only in the Cancelled tab
  if (filter === "all") return s !== "cancelled";
  if (filter === "pending") return s === "" || s === "pending";
  if (filter === "under_verification") {
    return s === "under_verification" || s === "under_veriification";
  }
  if (filter === "approved") return s === "approved";
  if (filter === "to_ship") return s === "to_ship" || s === "toship";
  return true;
}

function formatStatusLabel(row: CartRow): string {
  const key = logicalStatusKey(row);
  if (key === "" || key === "pending") return "Pending";
  if (key === "under_verification" || key === "under_veriification") return "Under verification";
  if (key === "approved") return "Approved";
  if (key === "to_ship" || key === "toship") return "To ship";
  if (key === "cancelled") return "Cancelled";
  return key.replace(/_/g, " ");
}

export default function MyCartScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [roleReady, setRoleReady] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<CartRow[]>([]);
  const [productsById, setProductsById] = useState<Record<number, ProductLite>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [registrationAddress, setRegistrationAddress] = useState("");
  const [savedPhone, setSavedPhone] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [qtyDraftById, setQtyDraftById] = useState<Record<number, string>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [removingRowId, setRemovingRowId] = useState<number | null>(null);
  const [cancellingRowId, setCancellingRowId] = useState<number | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"details" | "receipt">("details");
  const [useRegAddress, setUseRegAddress] = useState(true);
  const [shipAddress, setShipAddress] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [receiptAsset, setReceiptAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("pending");

  const [reorderRow, setReorderRow] = useState<CartRow | null>(null);
  const [reorderReceiptAsset, setReorderReceiptAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [reorderSubmitting, setReorderSubmitting] = useState(false);

  const palette = {
    bg: isDark ? "#0B1220" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    accent: "#00AEEF",
    inputBg: isDark ? "#0F172A" : "#F1F5F9",
  };

  const loadCart = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setProductsById({});
      setUserId(null);
      setLoading(false);
      return;
    }

    const customer = await loadIsCustomer();
    setIsCustomer(customer);
    setRoleReady(true);

    if (!customer) {
      setRows([]);
      setProductsById({});
      setUserId(null);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    const meta = userData.user?.user_metadata as Record<string, unknown> | undefined;
    const addr =
      typeof meta?.address === "string" ? meta.address.trim() : "";
    const phoneMeta =
      typeof meta?.phone === "string" ? meta.phone.trim() : "";
    setRegistrationAddress(addr);
    setSavedPhone(phoneMeta);

    if (!uid) {
      setRows([]);
      setProductsById({});
      setLoading(false);
      return;
    }

    const { data: cartData, error } = await supabase
      .from("items_to_cart")
      .select("id, created_at, updated_at, product_id, qty, total_amount, status")
      .eq("users_id", uid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !cartData) {
      setRows([]);
      setProductsById({});
      setLoading(false);
      return;
    }

    const typed = cartData as CartRow[];
    setRows(typed);

    const ids = [
      ...new Set(
        typed
          .map((r) => (r.product_id ? Number(r.product_id) : NaN))
          .filter((n) => Number.isFinite(n))
      ),
    ] as number[];

    if (ids.length === 0) {
      setProductsById({});
      setLoading(false);
      return;
    }

    const { data: prodData } = await supabase
      .from("product")
      .select("id, product_name, product_image, product_price")
      .in("id", ids);

    const map: Record<number, ProductLite> = {};
    for (const p of prodData ?? []) {
      map[(p as ProductLite).id] = p as ProductLite;
    }
    setProductsById(map);
    setLoading(false);
  }, []);

  const displayRows = useMemo(
    () => rows.filter((r) => matchesStatusFilter(r, statusFilter)),
    [rows, statusFilter]
  );

  const pendingInDisplay = useMemo(
    () => displayRows.filter(isPendingRow),
    [displayRows]
  );

  const hasPendingRows = useMemo(() => rows.some(isPendingRow), [rows]);

  useEffect(() => {
    const visible = new Set(displayRows.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (!visible.has(id)) return;
        const row = rows.find((r) => r.id === id);
        if (row && isPendingRow(row)) next.add(id);
      });
      return next;
    });
    setQtyDraftById((prev) => {
      const valid = new Set(displayRows.map((r) => r.id));
      const next: Record<number, string> = {};
      for (const k of Object.keys(prev)) {
        const id = Number(k);
        if (valid.has(id)) next[id] = prev[id]!;
      }
      return next;
    });
  }, [displayRows, rows]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCart();
    }, [loadCart])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  }, [loadCart]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadCart();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadCart]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const row = rows.find((r) => r.id === id);
      if (!row || !isPendingRow(row)) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [rows]);

  const toggleSelectAll = useCallback(() => {
    const pendingIds = pendingInDisplay.map((r) => r.id);
    setSelectedIds((prev) => {
      const allSelected =
        pendingIds.length > 0 && pendingIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        pendingIds.forEach((id) => next.delete(id));
      } else {
        pendingIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [pendingInDisplay]);

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const r of rows) {
      if (!selectedIds.has(r.id) || !isPendingRow(r)) continue;
      sum += parseAmount(r.total_amount);
    }
    return sum;
  }, [rows, selectedIds]);

  const getQtyDisplay = useCallback(
    (row: CartRow) => {
      const d = qtyDraftById[row.id];
      if (d !== undefined) return d;
      return String(row.qty ?? "1");
    },
    [qtyDraftById]
  );

  const persistQty = useCallback(
    async (row: CartRow) => {
      if (!userId || !isPendingRow(row)) return;
      const raw = (qtyDraftById[row.id] ?? String(row.qty ?? "1")).replace(/\D/g, "");
      const qty = Math.max(1, Math.floor(Number(raw) || 1));
      const pid = row.product_id ? Number(row.product_id) : NaN;
      const prod = Number.isFinite(pid) ? productsById[pid] : undefined;
      let unit = parsePrice(prod?.product_price);
      if (unit <= 0 && row.total_amount) {
        const oldQty = Math.max(1, Math.floor(Number(String(row.qty ?? "1").replace(/\D/g, "")) || 1));
        unit = parseAmount(row.total_amount) / oldQty;
      }
      const totalStr = unit > 0 ? String((unit * qty).toFixed(2)) : String(parseAmount(row.total_amount) || 0);

      setSavingRowId(row.id);
      const { error } = await supabase
        .from("items_to_cart")
        .update({
          qty: String(qty),
          total_amount: totalStr,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("users_id", userId);

      setSavingRowId(null);

      if (error) {
        toast.error(error.message, "Could not update qty");
        return;
      }

      setQtyDraftById((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setRows((list) =>
        list.map((r) =>
          r.id === row.id ? { ...r, qty: String(qty), total_amount: totalStr } : r
        )
      );
      toast.success("Quantity updated.", "Cart");
    },
    [qtyDraftById, productsById, toast, userId]
  );

  const removeRow = useCallback(
    (row: CartRow) => {
      if (!userId || !isPendingRow(row)) return;
      Alert.alert("Remove item", "Remove this product from your cart?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingRowId(row.id);
            const now = new Date().toISOString();
            const { error } = await supabase
              .from("items_to_cart")
              .update({ deleted_at: now, updated_at: now })
              .eq("id", row.id)
              .eq("users_id", userId);
            setRemovingRowId(null);
            if (error) {
              toast.error(error.message, "Remove failed");
              return;
            }
            setRows((list) => list.filter((r) => r.id !== row.id));
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
            toast.success("Removed from cart.", "Cart");
          },
        },
      ]);
    },
    [toast, userId]
  );

  const cancelOrder = useCallback(
    (row: CartRow) => {
      if (!userId) return;
      const isCancelled = normalizeStatus(row.status) === "cancelled";
      if (isCancelled) return;
      Alert.alert(
        "Cancel order",
        "Are you sure you want to cancel this order? This action cannot be undone.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, cancel",
            style: "destructive",
            onPress: async () => {
              setCancellingRowId(row.id);
              const now = new Date().toISOString();
              let error: { message: string } | null = null;
              if (isPendingRow(row)) {
                // Pending: soft-delete only (no payment row yet)
                const res = await supabase
                  .from("items_to_cart")
                  .update({ deleted_at: now, updated_at: now })
                  .eq("id", row.id)
                  .eq("users_id", userId);
                error = res.error;
                if (!error) {
                  setRows((list) => list.filter((r) => r.id !== row.id));
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(row.id);
                    return next;
                  });
                }
              } else {
                // Submitted (under_verification, approved, etc.):
                // 1. Mark cart item as cancelled
                const cartRes = await supabase
                  .from("items_to_cart")
                  .update({ status: "cancelled", updated_at: now })
                  .eq("id", row.id)
                  .eq("users_id", userId);
                error = cartRes.error;

                if (!error) {
                  setRows((list) =>
                    list.map((r) =>
                      r.id === row.id ? { ...r, status: "cancelled", updated_at: now } : r
                    )
                  );

                  // 2. Find the payment row whose items_to_cart CSV contains this cart ID
                  //    Broad LIKE then exact client-side check avoids PostgREST comma parsing issues
                  const id = String(row.id);
                  const { data: allPayments } = await supabase
                    .from(PAYMENTS_TABLE)
                    .select("id, items_to_cart, status")
                    .like("items_to_cart", `%${id}%`)
                    .neq("status", "order_cancelled")
                    .limit(20);

                  const paymentRows = (allPayments ?? []).filter((p: { items_to_cart: string | null }) =>
                    String(p.items_to_cart ?? "").split(",").map((s) => s.trim()).includes(id)
                  );

                  if (paymentRows.length > 0) {
                    await supabase
                      .from(PAYMENTS_TABLE)
                      .update({ status: "order_cancelled", updated_at: now })
                      .in("id", paymentRows.map((p: { id: number }) => p.id));
                  }
                }
              }
              setCancellingRowId(null);
              if (error) {
                toast.error(error.message, "Cancel failed");
                return;
              }
              toast.success("Order cancelled successfully.", "Cancelled");
            },
          },
        ]
      );
    },
    [toast, userId]
  );

  const pickReorderReceipt = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning("Allow photo library access to upload a receipt.", "Permission");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets[0]) return;
    setReorderReceiptAsset(res.assets[0]);
  }, [toast]);

  const submitReorder = useCallback(async () => {
    if (!reorderRow || !userId) return;
    if (!reorderReceiptAsset?.base64) {
      toast.warning("Please choose a receipt image first.", "Receipt");
      return;
    }
    const ext = reorderReceiptAsset.mimeType?.includes("png")
      ? "png"
      : reorderReceiptAsset.mimeType?.includes("webp")
        ? "webp"
        : "jpg";
    const mime = reorderReceiptAsset.mimeType ?? "image/jpeg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const body = base64ToUint8Array(reorderReceiptAsset.base64);
    const now = new Date().toISOString();

    setReorderSubmitting(true);

    // 1. Upload new receipt image
    const { error: upErr } = await supabase.storage
      .from(RECEIPT_STORAGE_BUCKET)
      .upload(path, body, { contentType: mime, upsert: false });

    if (upErr) {
      setReorderSubmitting(false);
      toast.error(
        `${upErr.message}\n\nMake sure the "${RECEIPT_STORAGE_BUCKET}" bucket exists in Supabase Storage.`,
        "Upload failed"
      );
      return;
    }

    const { data: pub } = supabase.storage.from(RECEIPT_STORAGE_BUCKET).getPublicUrl(path);
    const receiptUrl = pub.publicUrl;

    // 2. Find the linked payment row — broad LIKE then client-side exact match
    const id = String(reorderRow.id);
    const { data: allPayments, error: payFindErr } = await supabase
      .from(PAYMENTS_TABLE)
      .select("id, items_to_cart")
      .like("items_to_cart", `%${id}%`)
      .limit(20);

    if (payFindErr) {
      setReorderSubmitting(false);
      toast.error(payFindErr.message, "Could not find payment");
      return;
    }

    const paymentRows = (allPayments ?? []).filter((p: { items_to_cart: string | null }) =>
      String(p.items_to_cart ?? "").split(",").map((s) => s.trim()).includes(id)
    );

    let payErr: { message: string } | null = null;

    if (paymentRows.length > 0) {
      const { error } = await supabase
        .from(PAYMENTS_TABLE)
        .update({ receipt: receiptUrl, status: RECEIPT_ROW_STATUS, updated_at: now })
        .in(
          "id",
          paymentRows.map((p: { id: number }) => p.id)
        );
      payErr = error;
    } else {
      // Old payment may be hidden by RLS (e.g. status order_cancelled) or missing — create a new payment row.
      const { error } = await supabase.from(PAYMENTS_TABLE).insert({
        items_to_cart: id,
        receipt: receiptUrl,
        status: RECEIPT_ROW_STATUS,
        created_at: now,
        updated_at: now,
      });
      payErr = error;
    }

    if (payErr) {
      setReorderSubmitting(false);
      toast.error(
        payErr.message,
        paymentRows.length > 0 ? "Payment update failed" : "Payment save failed"
      );
      return;
    }

    // 4. Reset cart item status back to under_verification
    const { error: cartErr } = await supabase
      .from("items_to_cart")
      .update({ status: "under_verification", updated_at: now })
      .eq("id", reorderRow.id)
      .eq("users_id", userId);

    if (cartErr) {
      setReorderSubmitting(false);
      toast.error(cartErr.message, "Cart update failed");
      return;
    }

    setRows((list) =>
      list.map((r) =>
        r.id === reorderRow.id
          ? { ...r, status: "under_verification", updated_at: now }
          : r
      )
    );

    setReorderSubmitting(false);
    setReorderRow(null);
    setReorderReceiptAsset(null);
    toast.success("Order re-submitted. Receipt is under verification.", "Done");
  }, [reorderRow, reorderReceiptAsset, toast, userId]);

  const openCheckout = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.warning("Select at least one item to buy.", "Cart");
      return;
    }
    const useReg = Boolean(registrationAddress?.trim());
    setUseRegAddress(useReg);
    setShipAddress(useReg ? registrationAddress : "");
    setShipPhone(savedPhone);
    setCheckoutStep("details");
    setReceiptAsset(null);
    setCheckoutOpen(true);
  }, [registrationAddress, savedPhone, selectedIds.size, toast]);

  const goReceiptStep = useCallback(() => {
    const addr = shipAddress.trim();
    const phone = shipPhone.trim();
    if (!addr) {
      toast.warning("Enter a delivery address.", "Address");
      return;
    }
    if (!phone) {
      toast.warning("Enter your phone number.", "Phone");
      return;
    }
    setCheckoutStep("receipt");
  }, [shipAddress, shipPhone, toast]);

  const pickReceipt = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.warning("Allow photo library access to upload a receipt.", "Permission");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets[0]) return;
    setReceiptAsset(res.assets[0]);
  }, [toast]);

  const completePurchase = useCallback(async () => {
    if (!userId || selectedIds.size === 0) return;
    if (!receiptAsset?.base64) {
      toast.warning("Could not read the image. Try another photo.", "Receipt");
      return;
    }

    const addr = shipAddress.trim();
    const phone = shipPhone.trim();
    if (!addr || !phone) {
      setCheckoutStep("details");
      toast.warning("Address and phone are required.", "Checkout");
      return;
    }

    const ids = [...selectedIds].sort((a, b) => a - b);
    const itemsToCartValue = ids.join(",");

    const ext =
      receiptAsset.mimeType?.includes("png")
        ? "png"
        : receiptAsset.mimeType?.includes("webp")
          ? "webp"
          : "jpg";
    const mime = receiptAsset.mimeType ?? "image/jpeg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const body = base64ToUint8Array(receiptAsset.base64);

    setSubmittingOrder(true);

    const { error: upErr } = await supabase.storage
      .from(RECEIPT_STORAGE_BUCKET)
      .upload(path, body, { contentType: mime, upsert: false });

    if (upErr) {
      setSubmittingOrder(false);
      toast.error(
        `${upErr.message}\n\nCreate a public bucket "${RECEIPT_STORAGE_BUCKET}" in Supabase Storage and add upload policies for authenticated users.`,
        "Upload failed"
      );
      return;
    }

    const { data: pub } = supabase.storage.from(RECEIPT_STORAGE_BUCKET).getPublicUrl(path);
    const receiptUrl = pub.publicUrl;

    const now = new Date().toISOString();
    const { error: recErr } = await supabase.from(PAYMENTS_TABLE).insert({
      items_to_cart: itemsToCartValue,
      receipt: receiptUrl,
      status: RECEIPT_ROW_STATUS,
      created_at: now,
      updated_at: now,
    });

    if (recErr) {
      setSubmittingOrder(false);
      toast.error(recErr.message, "Payment save failed");
      return;
    }

    const { error: cartErr } = await supabase
      .from("items_to_cart")
      .update({ status: "under_verification", updated_at: now })
      .eq("users_id", userId)
      .in("id", ids);

    if (cartErr) {
      setSubmittingOrder(false);
      toast.error(cartErr.message, "Cart update failed");
      return;
    }

    await supabase.auth.updateUser({
      data: {
        phone,
        last_shipping_address: addr,
      },
    });

    setSubmittingOrder(false);
    setCheckoutOpen(false);
    setReceiptAsset(null);
    setSelectedIds(new Set());
    await loadCart();
    toast.success("Order submitted. Receipt is under verification.", "Thank you");
  }, [
    loadCart,
    receiptAsset,
    selectedIds,
    shipAddress,
    shipPhone,
    toast,
    userId,
  ]);

  useEffect(() => {
    if (useRegAddress && registrationAddress) {
      setShipAddress(registrationAddress);
    }
  }, [useRegAddress, registrationAddress]);

  if (!roleReady && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
        <Text style={[styles.title, { color: palette.text }]}>My Cart</Text>
        <Text style={[styles.muted, { color: palette.muted }]}>
          Configure Supabase in your environment to load your cart.
        </Text>
      </SafeAreaView>
    );
  }

  if (!isCustomer) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
        <Text style={[styles.title, { color: palette.text }]}>My Cart</Text>
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <MaterialCommunityIcons name="cart-off" size={48} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Store accounts</Text>
          <Text style={[styles.muted, { color: palette.muted, textAlign: "center" }]}>
            The cart tab is only available for customer accounts.
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
          >
            <Text style={styles.primaryBtnText}>Go to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>My Cart</Text>
        <Pressable
          onPress={() => router.push("/products")}
          style={styles.browseLink}
          accessibilityRole="button"
          accessibilityLabel="Browse products"
        >
          <Text style={[styles.browseLinkText, { color: palette.accent }]}>Browse</Text>
          <IconSymbol name="chevron.right" size={18} color={palette.accent} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterScroll}
        keyboardShouldPersistTaps="handled"
      >
        {STATUS_FILTER_OPTIONS.map((opt) => {
          const active = statusFilter === opt.key;
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
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {pendingInDisplay.length > 0 ? (
        <Pressable
          onPress={toggleSelectAll}
          style={[styles.selectAllRow, { borderColor: palette.border }]}
        >
          <MaterialCommunityIcons
            name={
              pendingInDisplay.length > 0 &&
              pendingInDisplay.every((r) => selectedIds.has(r.id))
                ? "checkbox-marked"
                : "checkbox-blank-outline"
            }
            size={24}
            color={palette.accent}
          />
          <Text style={[styles.selectAllText, { color: palette.text }]}>Select all (pending)</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.flexCenter}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            style={styles.flatFlex}
            data={displayRows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={displayRows.length === 0 ? styles.listEmpty : styles.listPadded}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
            }
            ListEmptyComponent={
              <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
                <MaterialCommunityIcons name="cart-outline" size={52} color={palette.muted} />
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                  {rows.length === 0 ? "Your cart is empty" : "No items for this filter"}
                </Text>
                <Text style={[styles.muted, { color: palette.muted, textAlign: "center" }]}>
                  {rows.length === 0
                    ? "Add items from the Products screen. Pull down to refresh after you add something."
                    : "Try another status tab, or pull down to refresh."}
                </Text>
                {rows.length === 0 ? (
                  <Pressable
                    onPress={() => router.push("/products")}
                    style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
                  >
                    <Text style={styles.primaryBtnText}>Go to products</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const pid = item.product_id ? Number(item.product_id) : NaN;
              const prod = Number.isFinite(pid) ? productsById[pid] : undefined;
              const name = prod?.product_name ?? `Product #${item.product_id ?? "—"}`;
              const img = prod?.product_image;
              const canEdit = isPendingRow(item);
              const checked = selectedIds.has(item.id);
              const busy = savingRowId === item.id || removingRowId === item.id;

              const ts = isPendingRow(item)
                ? formatCartDateTime(item.created_at)
                : formatCartDateTime(item.updated_at ?? item.created_at);

              return (
                <View style={styles.cardOuter}>
                  {ts ? (
                    <View style={styles.rowTimestampRow}>
                      <MaterialCommunityIcons name="clock-outline" size={12} color={palette.muted} />
                      <Text style={[styles.rowTimestamp, { color: palette.muted }]}>{ts}</Text>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.row,
                      { borderColor: palette.border, backgroundColor: palette.card },
                    ]}
                  >
                    {canEdit ? (
                      <Pressable onPress={() => toggleSelect(item.id)} style={styles.checkHit} hitSlop={8}>
                        <MaterialCommunityIcons
                          name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
                          size={26}
                          color={palette.accent}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.checkSpacer} />
                    )}

                    <View style={[styles.thumbWrap, { backgroundColor: isDark ? "#1F2937" : "#E2E8F0" }]}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <MaterialCommunityIcons name="image-off-outline" size={28} color={palette.muted} />
                      )}
                    </View>

                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={2}>
                        {name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: palette.muted }]}>
                        {item.total_amount ? `PHP ${item.total_amount}` : "—"} · Qty {item.qty ?? "—"}
                      </Text>

                      <View style={[styles.badge, { borderColor: palette.border }]}>
                        <Text style={[styles.badgeText, { color: palette.muted }]}>{formatStatusLabel(item)}</Text>
                      </View>

                      {canEdit ? (
                        <>
                          <View style={styles.qtyRow}>
                            <Text style={[styles.qtyLabel, { color: palette.muted }]}>Qty</Text>
                            <TextInput
                              value={getQtyDisplay(item)}
                              onChangeText={(t) =>
                                setQtyDraftById((prev) => ({ ...prev, [item.id]: t.replace(/[^\d]/g, "") }))
                              }
                              keyboardType="number-pad"
                              style={[
                                styles.qtyInput,
                                {
                                  borderColor: palette.border,
                                  color: palette.text,
                                  backgroundColor: palette.inputBg,
                                },
                              ]}
                            />
                            <Pressable
                              onPress={() => void persistQty(item)}
                              disabled={busy}
                              style={[styles.saveQtyBtn, { backgroundColor: palette.accent, opacity: busy ? 0.5 : 1 }]}
                            >
                              {savingRowId === item.id ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <Text style={styles.saveQtyBtnText}>Save</Text>
                              )}
                            </Pressable>
                          </View>

                          <Pressable
                            onPress={() => removeRow(item)}
                            disabled={busy}
                            style={styles.removeBtn}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                            <Text style={styles.removeBtnText}>Remove</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>

                    {/* Right-side action button */}
                    {normalizeStatus(item.status) === "cancelled" ? (
                      // Order Again — only on cancelled items
                      <Pressable
                        onPress={() => {
                          setReorderRow(item);
                          setReorderReceiptAsset(null);
                        }}
                        disabled={busy}
                        style={styles.orderAgainBtn}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Order again"
                      >
                        <MaterialCommunityIcons name="refresh" size={20} color={palette.accent} />
                        <Text style={[styles.orderAgainText, { color: palette.accent }]}>Order{"\n"}again</Text>
                      </Pressable>
                    ) : (
                      // Cancel — on all non-cancelled items
                      <Pressable
                        onPress={() => cancelOrder(item)}
                        disabled={busy || cancellingRowId === item.id}
                        style={styles.cancelBtn}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel order"
                      >
                        {cancellingRowId === item.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <MaterialCommunityIcons
                            name="close-circle-outline"
                            size={24}
                            color="#EF4444"
                          />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {hasPendingRows ? (
            <View
              style={[
                styles.footerBar,
                {
                  backgroundColor: palette.card,
                  borderTopColor: palette.border,
                  paddingBottom: Math.max(16, insets.bottom + 10),
                },
              ]}
            >
              <View style={styles.footerTotals}>
                <Text style={[styles.footerLabel, { color: palette.muted }]}>Selected total</Text>
                <Text style={[styles.footerAmount, { color: palette.text }]}>
                  PHP {selectedTotal.toFixed(2)}
                </Text>
              </View>
              <Pressable
                onPress={openCheckout}
                disabled={selectedIds.size === 0}
                style={[
                  styles.buyNowBtn,
                  { backgroundColor: palette.accent, opacity: selectedIds.size === 0 ? 0.45 : 1 },
                ]}
              >
                <Text style={styles.buyNowText}>Buy now</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      <Modal visible={checkoutOpen} animationType="slide" transparent onRequestClose={() => setCheckoutOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => !submittingOrder && setCheckoutOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>
                {checkoutStep === "details" ? "Delivery details" : "Upload receipt"}
              </Text>
              <Pressable onPress={() => !submittingOrder && setCheckoutOpen(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={26} color={palette.muted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {checkoutStep === "details" ? (
                <View style={styles.modalBody}>
                  {registrationAddress ? (
                    <Pressable
                      onPress={() => {
                        setUseRegAddress((v) => {
                          const next = !v;
                          if (next && registrationAddress) setShipAddress(registrationAddress);
                          return next;
                        });
                      }}
                      style={styles.regToggle}
                    >
                      <MaterialCommunityIcons
                        name={useRegAddress ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={22}
                        color={palette.accent}
                      />
                      <Text style={[styles.regToggleText, { color: palette.text }]}>
                        Use address from registration
                      </Text>
                    </Pressable>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>Delivery address</Text>
                  <TextInput
                    value={shipAddress}
                    onChangeText={setShipAddress}
                    editable={!(useRegAddress && registrationAddress)}
                    multiline
                    placeholder="Street, barangay, city"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.textArea,
                      {
                        borderColor: palette.border,
                        color: palette.text,
                        backgroundColor: palette.inputBg,
                        opacity: useRegAddress && registrationAddress ? 0.75 : 1,
                      },
                    ]}
                  />

                  <Text style={[styles.fieldLabel, { color: palette.muted }]}>Phone number</Text>
                  <TextInput
                    value={shipPhone}
                    onChangeText={setShipPhone}
                    keyboardType="phone-pad"
                    placeholder="09xx xxx xxxx"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.textInput,
                      { borderColor: palette.border, color: palette.text, backgroundColor: palette.inputBg },
                    ]}
                  />

                  <Pressable
                    onPress={goReceiptStep}
                    style={[styles.primaryBtn, { backgroundColor: palette.accent, marginTop: 20 }]}
                  >
                    <Text style={styles.primaryBtnText}>Continue to receipt</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.modalBody}>
                  <Text style={[styles.helper, { color: palette.muted }]}>
                    Upload a photo of your payment receipt. Your order will be marked{" "}
                    <Text style={{ fontWeight: "700" }}>{RECEIPT_ROW_STATUS.replace(/_/g, " ")}</Text>.
                  </Text>

                  <Pressable
                    onPress={pickReceipt}
                    style={[styles.pickReceiptBtn, { borderColor: palette.accent }]}
                  >
                    <MaterialCommunityIcons name="camera-plus" size={22} color={palette.accent} />
                    <Text style={[styles.pickReceiptText, { color: palette.accent }]}>Choose image</Text>
                  </Pressable>

                  {receiptAsset?.uri ? (
                    <Image source={{ uri: receiptAsset.uri }} style={styles.receiptPreview} contentFit="contain" />
                  ) : null}

                  <Pressable
                    onPress={() => void completePurchase()}
                    disabled={submittingOrder || !receiptAsset?.base64}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: palette.accent,
                        marginTop: 16,
                        opacity: submittingOrder || !receiptAsset?.base64 ? 0.5 : 1,
                      },
                    ]}
                  >
                    {submittingOrder ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Submit order</Text>
                    )}
                  </Pressable>

                  <Pressable onPress={() => setCheckoutStep("details")} style={styles.backLink}>
                    <Text style={{ color: palette.accent, fontWeight: "600" }}>Back</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Order Again — receipt upload modal */}
      <Modal
        visible={reorderRow !== null}
        animationType="slide"
        transparent
        onRequestClose={() => !reorderSubmitting && setReorderRow(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !reorderSubmitting && setReorderRow(null)}
          />
          <View style={[styles.modalSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Order again</Text>
              <Pressable onPress={() => !reorderSubmitting && setReorderRow(null)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={26} color={palette.muted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                <Text style={[styles.helper, { color: palette.muted }]}>
                  Upload a new payment receipt to re-submit this order. It will be marked{" "}
                  <Text style={{ fontWeight: "700" }}>under verification</Text> again.
                </Text>

                <Pressable
                  onPress={pickReorderReceipt}
                  disabled={reorderSubmitting}
                  style={[styles.pickReceiptBtn, { borderColor: palette.accent }]}
                >
                  <MaterialCommunityIcons name="camera-plus" size={22} color={palette.accent} />
                  <Text style={[styles.pickReceiptText, { color: palette.accent }]}>
                    {reorderReceiptAsset ? "Change image" : "Choose receipt image"}
                  </Text>
                </Pressable>

                {reorderReceiptAsset?.uri ? (
                  <Image
                    source={{ uri: reorderReceiptAsset.uri }}
                    style={styles.receiptPreview}
                    contentFit="contain"
                  />
                ) : null}

                <Pressable
                  onPress={() => void submitReorder()}
                  disabled={reorderSubmitting || !reorderReceiptAsset?.base64}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: palette.accent,
                      marginTop: 16,
                      opacity: reorderSubmitting || !reorderReceiptAsset?.base64 ? 0.5 : 1,
                    },
                  ]}
                >
                  {reorderSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Submit order</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  flexCenter: { flex: 1, justifyContent: "center", alignItems: "center" },
  listWrap: { flex: 1, position: "relative" },
  flatFlex: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterScroll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexGrow: 0,
    paddingTop: 4,
    paddingBottom: 10,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectAllText: { fontSize: 16, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700" },
  browseLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  browseLinkText: { fontSize: 16, fontWeight: "600" },
  muted: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  listPadded: { paddingBottom: 140 },
  listEmpty: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  row: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    alignItems: "flex-start",
  },
  checkHit: { paddingTop: 4 },
  checkSpacer: { width: 26, paddingTop: 4 },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  rowBody: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowMeta: { fontSize: 14 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  qtyLabel: { fontSize: 14, fontWeight: "600" },
  qtyInput: {
    minWidth: 56,
    maxWidth: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
  },
  saveQtyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveQtyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  removeBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
  cancelBtn: {
    paddingTop: 2,
    paddingLeft: 4,
    alignSelf: "flex-start",
  },
  orderAgainBtn: {
    paddingLeft: 4,
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 2,
  },
  orderAgainText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  cardOuter: { marginBottom: 14 },
  rowTimestampRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4, paddingLeft: 2 },
  rowTimestamp: { fontSize: 11, fontWeight: "500" },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  footerTotals: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { fontSize: 15, fontWeight: "600" },
  footerAmount: { fontSize: 20, fontWeight: "800" },
  buyNowBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buyNowText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  primaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", flex: 1 },
  modalBody: { paddingHorizontal: 18, paddingBottom: 24 },
  regToggle: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  regToggleText: { fontSize: 15, fontWeight: "600", flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 100,
    padding: 12,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  helper: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  pickReceiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 12,
  },
  pickReceiptText: { fontWeight: "700", fontSize: 16 },
  receiptPreview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#0f172a22" },
  backLink: { alignSelf: "center", marginTop: 16, padding: 8 },
});
