import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/use-color-scheme";

const categories = [
  { name: "Fashion", icon: "hanger" },
  { name: "Beauty", icon: "lipstick" },
  { name: "Gadgets", icon: "cellphone" },
  { name: "Home", icon: "sofa-outline" },
] as const;

const products = [
  { name: "Wireless Earbuds Pro", price: "PHP 1,299", sold: "120 sold" },
  { name: "Minimalist Tote Bag", price: "PHP 799", sold: "64 sold" },
  { name: "Hydrating Skin Set", price: "PHP 999", sold: "89 sold" },
] as const;

const orders = [
  { id: "#VM-1092", status: "To Ship", amount: "PHP 2,098" },
  { id: "#VM-1091", status: "Delivered", amount: "PHP 799" },
] as const;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const palette = {
    bg: isDark ? "#0B1220" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    thumb: isDark ? "#1F2937" : "#E2E8F0",
    searchBg: isDark ? "#0F172A" : "#FFFFFF",
    searchPlaceholder: isDark ? "#6B7280" : "#94A3B8",
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#00AEEF", "#0077C8", "#004A99"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroWelcome}>Welcome back</Text>
              <Text style={styles.heroTitle}>Virtuoso Market</Text>
            </View>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              contentFit="cover"
            />
          </View>
          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: palette.searchBg,
                borderWidth: 1,
                borderColor: isDark ? "#1F2937" : "#E2E8F0",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={palette.searchPlaceholder}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search products, brands, deals"
              placeholderTextColor={palette.searchPlaceholder}
              style={[styles.searchInput, { color: palette.text }]}
            />
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>1,248</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Products</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>PHP 12.8k</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Revenue</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>86</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Orders</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Categories</Text>
          <View style={styles.categoryRow}>
            {categories.map((category) => (
              <View
                key={category.name}
                style={[styles.categoryCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <MaterialCommunityIcons
                  name={category.icon}
                  size={22}
                  color="#0077C8"
                />
                <Text style={[styles.categoryText, { color: palette.text }]}>{category.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Featured Products</Text>
          {products.map((item) => (
            <View key={item.name} style={[styles.productCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.productThumb, { backgroundColor: palette.thumb }]}>
                <MaterialCommunityIcons name="image-outline" size={24} color={palette.muted} />
              </View>
              <View style={styles.productBody}>
                <Text style={[styles.productName, { color: palette.text }]}>{item.name}</Text>
                <Text style={[styles.productMeta, { color: palette.muted }]}>{item.sold}</Text>
              </View>
              <Text style={styles.productPrice}>{item.price}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent Orders</Text>
          {orders.map((order) => (
            <View key={order.id} style={[styles.orderCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View>
                <Text style={[styles.orderId, { color: palette.text }]}>{order.id}</Text>
                <Text style={[styles.orderStatus, { color: palette.muted }]}>{order.status}</Text>
              </View>
              <Text style={styles.orderAmount}>{order.amount}</Text>
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
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingBottom: 24,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  heroWelcome: {
    color: "#DBEAFE",
    fontSize: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  searchWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 12,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  categoryText: {
    color: "#0F172A",
    fontWeight: "600",
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  productThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  productBody: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  productMeta: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0077C8",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderId: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  orderStatus: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F766E",
  },
});
