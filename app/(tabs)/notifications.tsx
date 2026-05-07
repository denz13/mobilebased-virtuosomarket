import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";

const notifications = [
  {
    id: "1",
    icon: "truck-delivery-outline",
    title: "Order is on the way",
    message: "Your order #VM-1092 has been picked up by the courier.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: "2",
    icon: "tag-outline",
    title: "Flash sale starts now",
    message: "Get up to 50% off on selected fashion and beauty items.",
    time: "1 hr ago",
    unread: true,
  },
  {
    id: "3",
    icon: "check-circle-outline",
    title: "Payment confirmed",
    message: "We received your payment for order #VM-1091.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "4",
    icon: "gift-outline",
    title: "Voucher available",
    message: "You have a new free shipping voucher waiting for checkout.",
    time: "2 days ago",
    unread: false,
  },
] as const;

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const palette = {
    bg: isDark ? "#020617" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    iconBg: isDark ? "#0F172A" : "#E0F2FE",
    accent: "#00AEEF",
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.bg }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: palette.text }]}>
              Notifications
            </Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Updates from your orders, promos, and account.
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: palette.accent }]}>
            <Text style={styles.badgeText}>2</Text>
          </View>
        </View>

        <View style={styles.list}>
          {notifications.map((item) => (
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: item.unread ? palette.accent : palette.border,
                },
              ]}
            >
              <View style={[styles.iconShell, { backgroundColor: palette.iconBg }]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={24}
                  color={palette.accent}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  {item.unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={[styles.cardMessage, { color: palette.muted }]}>
                  {item.message}
                </Text>
                <Text style={[styles.cardTime, { color: palette.muted }]}>
                  {item.time}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    maxWidth: 280,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
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
