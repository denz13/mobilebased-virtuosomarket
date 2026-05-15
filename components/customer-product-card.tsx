import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

const REACTION_EMOJIS = ["👍", "❤️", "😆", "😮", "😢", "😡"] as const;

export type CustomerProductCardPalette = {
  card: string;
  border: string;
  text: string;
  muted: string;
  input: string;
  iconBg: string;
  accent: string;
};

export type CustomerProduct = {
  id: number;
  categories_id: number | null;
  product_name: string | null;
  product_description: string | null;
  product_price: string | null;
  product_stock: string | null;
  product_image: string | null;
  status: string | null;
};

function parsePrice(raw: string | null): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatTimeLabel(): string {
  const d = new Date();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type CommentItem = { id: string; body: string; at: string };

type CustomerProductCardProps = {
  product: CustomerProduct;
  categoryLabel: string;
  palette: CustomerProductCardPalette;
  userId: string | null;
};

export default function CustomerProductCard({
  product,
  categoryLabel,
  palette,
  userId,
}: CustomerProductCardProps) {
  const toast = useToast();
  const [reaction, setReaction] = useState<string | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [qtyStr, setQtyStr] = useState("1");
  const [savingCart, setSavingCart] = useState(false);

  const unitPrice = parsePrice(product.product_price);
  const qtyNum = Math.max(1, Math.floor(Number(qtyStr.replace(/\D/g, "")) || 1));
  const lineTotal = unitPrice * qtyNum;

  const openReactionPicker = useCallback(() => {
    setReactionPickerOpen(true);
  }, []);

  const pickReaction = useCallback((emoji: string) => {
    setReaction(emoji);
    setReactionPickerOpen(false);
  }, []);

  const onReactPress = useCallback(() => {
    setReaction((prev) => (prev === "👍" ? null : "👍"));
  }, []);

  const postComment = useCallback(() => {
    const body = commentDraft.trim();
    if (!body) {
      toast.warning("Type a comment first.", "Empty");
      return;
    }
    setComments((list) => [
      {
        id: `${Date.now()}`,
        body,
        at: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...list,
    ]);
    setCommentDraft("");
    toast.success("Comment added (saved on this device for now).", "Posted");
  }, [commentDraft, toast]);

  const saveToCart = useCallback(async () => {
    if (!userId) {
      toast.error("You need to be signed in to add items to the cart.", "Sign in");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.warning("Configure Supabase in .env first.", "Configuration");
      return;
    }

    const now = new Date().toISOString();
    const productId = String(product.id);
    const amountStr =
      lineTotal > 0 ? String(lineTotal.toFixed(2)) : (product.product_price ?? "0");

    setSavingCart(true);

    const { data: existing, error: selectError } = await supabase
      .from("items_to_cart")
      .select("id, qty")
      .eq("users_id", userId)
      .eq("product_id", productId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .maybeSingle();

    if (selectError) {
      setSavingCart(false);
      const hint =
        selectError.message.includes("row-level security") ||
        selectError.message.includes("new row violates")
          ? "\n\nIn Supabase SQL Editor: add a SELECT policy on items_to_cart (e.g. users_id = auth.uid()::text)."
          : "";
      toast.error(`${selectError.message}${hint}`, "Cart");
      return;
    }

    let error: { message: string } | null = null;

    if (existing?.id != null) {
      const prevQty = Math.max(
        1,
        Math.floor(Number(String(existing.qty ?? "1").replace(/\D/g, "")) || 1)
      );
      const mergedQty = prevQty + qtyNum;
      const mergedTotal =
        unitPrice > 0 ? String((unitPrice * mergedQty).toFixed(2)) : amountStr;

      const res = await supabase
        .from("items_to_cart")
        .update({
          qty: String(mergedQty),
          total_amount: mergedTotal,
          updated_at: now,
        })
        .eq("id", existing.id);
      error = res.error;
    } else {
      const res = await supabase.from("items_to_cart").insert({
        users_id: userId,
        product_id: productId,
        qty: String(qtyNum),
        total_amount: amountStr,
        status: "pending",
        created_at: now,
        updated_at: now,
      });
      error = res.error;
    }

    setSavingCart(false);

    if (error) {
      const rls =
        error.message.includes("row-level security") ||
        error.message.includes("new row violates");
      const hint = rls
        ? "\n\nIn Supabase: add RLS policies for INSERT and UPDATE on public.items_to_cart for the signed-in user (e.g. users_id = auth.uid()::text)."
        : "";
      toast.error(`${error.message}${hint}`, "Could not add to cart");
      return;
    }

    toast.success(
      existing?.id != null ? "Cart quantity updated." : "Added to your cart.",
      "Saved"
    );
    setCartModalOpen(false);
    setQtyStr("1");
  }, [lineTotal, product.id, product.product_price, qtyNum, toast, unitPrice, userId]);

  const isDarkText = palette.text === "#E5E7EB";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: palette.iconBg }]}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.avatarImg}
            contentFit="contain"
          />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.posterName, { color: palette.text }]} numberOfLines={1}>
            {product.product_name || "Product"}
          </Text>
          <Text style={[styles.metaLine, { color: palette.muted }]} numberOfLines={2}>
            Virtuoso Market · {categoryLabel} · {formatTimeLabel()}
          </Text>
        </View>
        <MaterialCommunityIcons name="dots-horizontal" size={22} color={palette.muted} />
      </View>

      {product.product_description ? (
        <Text style={[styles.bodyText, { color: palette.text }]} numberOfLines={4}>
          {product.product_description}
        </Text>
      ) : null}

      <View style={[styles.mediaWrap, { backgroundColor: palette.iconBg }]}>
        {product.product_image ? (
          <Image
            source={{ uri: product.product_image }}
            style={styles.mediaImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <MaterialCommunityIcons name="image-off-outline" size={48} color={palette.accent} />
          </View>
        )}
      </View>

      <View style={[styles.priceStockRow, { borderColor: palette.border }]}>
        <Text style={[styles.priceStockText, { color: palette.text }]}>
          {product.product_price ? `Price: ${product.product_price}` : "Price: —"}
        </Text>
        <Text style={[styles.priceStockText, { color: palette.muted }]}>
          Stock: {product.product_stock ?? "—"}
        </Text>
      </View>

      <View style={[styles.statsRow, { borderColor: palette.border }]}>
        <View style={styles.statsLeft}>
          {reaction ? (
            <Text style={styles.reactionStat}>
              <Text style={styles.reactionEmoji}>{reaction}</Text>
              <Text style={[styles.statsMuted, { color: palette.muted }]}> You</Text>
            </Text>
          ) : (
            <Text style={[styles.statsMuted, { color: palette.muted }]}>Be the first to react</Text>
          )}
        </View>
        <Text style={[styles.statsMuted, { color: palette.muted }]}>
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={[styles.actionBar, { borderColor: palette.border }]}>
        <Pressable
          style={styles.actionBtn}
          onPress={onReactPress}
          onLongPress={openReactionPicker}
          delayLongPress={380}
          accessibilityRole="button"
          accessibilityLabel="React. Long press for more reactions."
        >
          <MaterialCommunityIcons
            name={reaction ? "emoticon-happy-outline" : "thumb-up-outline"}
            size={22}
            color={reaction ? palette.accent : palette.muted}
          />
          <Text style={[styles.actionLabel, { color: palette.muted }]}>React</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => setCommentModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Comment"
        >
          <MaterialCommunityIcons name="comment-outline" size={22} color={palette.muted} />
          <Text style={[styles.actionLabel, { color: palette.muted }]}>Comment</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            setQtyStr("1");
            setCartModalOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Add to cart"
        >
          <MaterialCommunityIcons name="cart-plus" size={22} color={palette.accent} />
          <Text style={[styles.actionLabel, { color: palette.accent }]}>Add to cart</Text>
        </Pressable>
      </View>

      <Modal
        visible={reactionPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionPickerOpen(false)}
      >
        <Pressable
          style={styles.reactionBackdrop}
          onPress={() => setReactionPickerOpen(false)}
        >
          <View
            style={[
              styles.reactionBubble,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.reactionEmojiBtn}
                onPress={() => pickReaction(emoji)}
              >
                <Text style={styles.reactionEmojiLarge}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={commentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.commentModalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.commentBackdrop}
            onPress={() => setCommentModalOpen(false)}
          />
          <View
            style={[
              styles.commentSheet,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Comments</Text>
            <Text style={[styles.sheetSubtitle, { color: palette.muted }]} numberOfLines={1}>
              {product.product_name}
            </Text>
            <ScrollView style={styles.commentList} keyboardShouldPersistTaps="handled">
              {comments.length === 0 ? (
                <Text style={[styles.emptyComments, { color: palette.muted }]}>
                  No comments yet. Say something!
                </Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <Text style={[styles.commentBody, { color: palette.text }]}>{c.body}</Text>
                    <Text style={[styles.commentAt, { color: palette.muted }]}>{c.at}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={[styles.commentInputRow, { borderColor: palette.border }]}>
              <TextInput
                style={[
                  styles.commentInput,
                  { color: palette.text, backgroundColor: palette.input },
                ]}
                placeholder="Write a comment…"
                placeholderTextColor={palette.muted}
                value={commentDraft}
                onChangeText={setCommentDraft}
                multiline
              />
              <Pressable
                style={[styles.postCommentBtn, { backgroundColor: palette.accent }]}
                onPress={postComment}
              >
                <Text style={styles.postCommentBtnText}>Post</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setCommentModalOpen(false)} style={styles.sheetClose}>
              <Text style={[styles.sheetCloseText, { color: palette.muted }]}>Close</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={cartModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !savingCart && setCartModalOpen(false)}
      >
        <View style={styles.cartModalRoot}>
          <Pressable
            style={styles.cartModalBackdrop}
            onPress={() => !savingCart && setCartModalOpen(false)}
          />
          <View
            style={[
              styles.cartDialog,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Add to cart</Text>
            <Text style={[styles.sheetSubtitle, { color: palette.muted }]} numberOfLines={2}>
              {product.product_name}
            </Text>
            <Text style={[styles.priceLine, { color: palette.text }]}>
              Unit price: {product.product_price ?? "—"}
            </Text>
            <Text style={[styles.fieldLabel, { color: palette.muted }]}>Quantity</Text>
            <TextInput
              style={[
                styles.qtyInput,
                { color: palette.text, borderColor: palette.border, backgroundColor: palette.input },
              ]}
              keyboardType="number-pad"
              value={qtyStr}
              onChangeText={setQtyStr}
            />
            <Text style={[styles.totalLine, { color: palette.accent }]}>
              Total:{" "}
              {lineTotal > 0
                ? `PHP ${lineTotal.toFixed(2)}`
                : product.product_price ?? "—"}
            </Text>
            <View style={styles.cartDialogActions}>
              <Pressable
                style={[styles.dialogBtn, { borderColor: palette.border }]}
                onPress={() => !savingCart && setCartModalOpen(false)}
                disabled={savingCart}
              >
                <Text style={[styles.dialogBtnText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogBtnPrimary, { backgroundColor: palette.accent }]}
                onPress={saveToCart}
                disabled={savingCart}
              >
                {savingCart ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogBtnPrimaryText}>Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: 34, height: 34 },
  headerTextCol: { flex: 1, minWidth: 0 },
  posterName: { fontSize: 15, fontWeight: "700" },
  metaLine: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  mediaWrap: {
    aspectRatio: 1.15,
    width: "100%",
  },
  mediaImage: { width: "100%", height: "100%" },
  mediaPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  priceStockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  priceStockText: { fontSize: 14, fontWeight: "600", flex: 1 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statsLeft: { flex: 1, marginRight: 8 },
  reactionStat: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  reactionEmoji: { fontSize: 16 },
  statsMuted: { fontSize: 13 },
  actionBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: "600" },
  reactionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  reactionBubble: {
    flexDirection: "row",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  reactionEmojiBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  reactionEmojiLarge: { fontSize: 28 },
  commentModalRoot: { flex: 1, justifyContent: "flex-end" },
  commentBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  commentSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "72%",
  },
  cartDialog: {
    zIndex: 2,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  sheetSubtitle: { marginTop: 4, fontSize: 14 },
  commentList: { maxHeight: 220, marginTop: 12 },
  emptyComments: { textAlign: "center", paddingVertical: 20, fontSize: 14 },
  commentRow: { marginBottom: 12 },
  commentBody: { fontSize: 15, lineHeight: 21 },
  commentAt: { fontSize: 12, marginTop: 2 },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  commentInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 88,
    fontSize: 15,
  },
  postCommentBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postCommentBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  sheetClose: { alignItems: "center", marginTop: 12 },
  sheetCloseText: { fontSize: 14, fontWeight: "700" },
  priceLine: { marginTop: 12, fontSize: 15, fontWeight: "600" },
  fieldLabel: { marginTop: 14, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  qtyInput: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: "700",
  },
  totalLine: { marginTop: 12, fontSize: 16, fontWeight: "800" },
  cartDialogActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  dialogBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dialogBtnText: { fontWeight: "800", fontSize: 15 },
  dialogBtnPrimary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dialogBtnPrimaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  cartModalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cartModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
