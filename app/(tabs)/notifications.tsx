import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  NOTIFICATION_BACKEND_SETUP_HINT,
  NOTIFICATION_TABLE,
  fetchMyNotifications,
  isNotificationBackendReady,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/notifications";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function iconForDescription(
  desc: string | null
): ComponentProps<typeof MaterialCommunityIcons>["name"] {
  const d = (desc ?? "").toLowerCase();
  if (d.includes("declined")) return "close-circle-outline";
  if (d.includes("approved")) return "check-decagram";
  if (d.includes("buy now") || d.includes("submitted an order")) return "cart-arrow-up";
  if (d.includes("add to cart") || d.includes("cart updated")) return "cart-plus";
  if (d.includes("order again") || d.includes("re-submitted")) return "refresh";
  return "bell-outline";
}

/** Name after "Buy now:" / "Order again:" and before submitted/re-submitted. */
function customerNameFromDescription(desc: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(
    /^(?:Buy now|Order again):\s+(.+?)\s+(?:submitted an order|re-submitted)/i
  );
  const name = m?.[1]?.trim();
  if (!name || /^a customer$/i.test(name)) return null;
  return name;
}

function titleFromDescription(desc: string | null): string {
  const d = desc ?? "";
  const who = customerNameFromDescription(d);
  if (/declined/i.test(d)) return "Order declined";
  if (/approved/i.test(d)) return "Order approved";
  if (/buy now/i.test(d)) return who ? `New order from ${who}` : "New order (Buy now)";
  if (/add to cart|cart updated/i.test(d)) return "Cart activity";
  if (/order again|re-submitted/i.test(d)) return who ? `Order again — ${who}` : "Order re-submitted";
  return "Notification";
}

/** User-facing body: no cart IDs or "a customer" placeholder. */
function messageFromDescription(desc: string | null): string {
  if (!desc) return "—";
  const who = customerNameFromDescription(desc) ?? "Customer";
  let text = desc.replace(/\ba customer\b/gi, who);
  text = text.replace(/\s*\[IDs:\s*[\d,\s]+\]\.?/gi, ".");
  text = text.replace(/\s+for \d+ cart line\(s\)/gi, "");
  text = text.replace(/cancelled cart line #\d+/gi, "a cancelled item");
  text = text.replace(/cart line #\d+/gi, "an item");
  text = text.replace(/New order: cart line #\d+/gi, "New order");
  return text.replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim();
}

function isUnread(status: string | null): boolean {
  return (status ?? "").toLowerCase() === "unread";
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);

  const palette = {
    bg: isDark ? "#020617" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    iconBg: isDark ? "#0F172A" : "#E0F2FE",
    accent: "#00AEEF",
  };

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setUserId(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const [inbox, ready] = await Promise.all([
      fetchMyNotifications(),
      isNotificationBackendReady(),
    ]);
    setUserId(inbox.userId);
    setLoadError(inbox.error);
    setRows(inbox.rows);
    setBackendReady(ready);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void load();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`notification-inbox-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: NOTIFICATION_TABLE,
          filter: `users_id=eq.${userId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onOpenNotification = useCallback(
    async (item: NotificationRow) => {
      if (!userId || !isUnread(item.status)) return;

      setRows((list) =>
        list.map((r) => (r.id === item.id ? { ...r, status: "read" } : r))
      );

      const { ok, error } = await markNotificationRead(item.id, userId);
      if (!ok && error) {
        setRows((list) =>
          list.map((r) => (r.id === item.id ? { ...r, status: item.status } : r))
        );
        setLoadError(error);
      }
    },
    [userId]
  );

  const unreadCount = rows.filter((r) => isUnread(r.status)).length;

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <View style={styles.centered}>
          <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Configure Supabase to load notifications from the `{NOTIFICATION_TABLE}` table.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !userId) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
        </View>
        <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <MaterialCommunityIcons name="account-lock-outline" size={48} color={palette.muted} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Sign in required</Text>
          <Text style={[styles.emptySub, { color: palette.muted }]}>
            Log in to see notifications for your account only.
          </Text>
          <Pressable
            style={[styles.loginBtn, { backgroundColor: palette.accent }]}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.loginBtnText}>Go to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            Messages for your account only — orders, cart, and updates.
          </Text>
        </View>
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: palette.accent }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        ) : null}
      </View>

      {loadError ? (
        <Text style={[styles.errorText, { color: "#EF4444" }]}>{loadError}</Text>
      ) : null}

      {backendReady === false ? (
        <View style={[styles.setupBanner, { borderColor: "#F59E0B", backgroundColor: isDark ? "#422006" : "#FFFBEB" }]}>
          <MaterialCommunityIcons name="database-alert-outline" size={22} color="#D97706" />
          <Text style={[styles.setupBannerText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
            {NOTIFICATION_BACKEND_SETUP_HINT}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={rows.length === 0 ? styles.listEmpty : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={palette.muted} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySub, { color: palette.muted }]}>
                {backendReady === false
                  ? "Walang ma-save na notification hanggang ma-run ang SQL setup sa Supabase (tingnan ang banner sa itaas)."
                  : "New orders and order status updates for this login will show up here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const unread = isUnread(item.status);
            const icon = iconForDescription(item.description);
            return (
              <Pressable
                onPress={() => void onOpenNotification(item)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: unread ? palette.accent : palette.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={[styles.iconShell, { backgroundColor: palette.iconBg }]}>
                  <MaterialCommunityIcons name={icon} size={24} color={palette.accent} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, { color: palette.text }]}>
                      {titleFromDescription(item.description)}
                    </Text>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={[styles.cardMessage, { color: palette.muted }]}>
                    {messageFromDescription(item.description)}
                  </Text>
                  <Text style={[styles.cardTime, { color: palette.muted }]}>
                    {formatRelativeTime(item.created_at)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  badge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14,
  },
  setupBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  setupBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    paddingBottom: 24,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  loginBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  iconShell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#00AEEF",
  },
  cardMessage: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTime: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
});
