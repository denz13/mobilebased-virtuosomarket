import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import SidebarNavigation from "@/components/sidebar-navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Category = {
  id: number;
  category_name: string | null;
  image: string | null;
};

type Product = {
  id: number;
  product_name: string | null;
  product_price: string | null;
  product_stock: string | null;
  product_image: string | null;
};

const orders = [
  { id: "#VM-1092", status: "To Ship", amount: "PHP 2,098" },
  { id: "#VM-1091", status: "Delivered", amount: "PHP 799" },
] as const;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const cartBounce = useRef(new Animated.Value(0)).current;
  const messageBounce = useRef(new Animated.Value(0)).current;
  const drawerSlide = useRef(new Animated.Value(-320)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [firstName, setFirstName] = useState("User");
  const [refreshing, setRefreshing] = useState(false);
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

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerSlide, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerSlide, {
      toValue: -320,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  };

  const loadDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const [categoryResult, productResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, category_name, image")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("product")
        .select("id, product_name, product_price, product_stock, product_image")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (!categoryResult.error) setCategories(categoryResult.data ?? []);
    if (!productResult.error) setProducts(productResult.data ?? []);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const { data } = await supabase.auth.getUser();
    const metadata = data.user?.user_metadata;
    const nameFromMetadata =
      typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
    const nameFromEmail = data.user?.email?.split("@")[0] ?? "";

    setFirstName(nameFromMetadata || nameFromEmail || "User");
  }, []);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardData(), loadCurrentUser()]);
    setRefreshing(false);
  }, [loadDashboardData, loadCurrentUser]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const createBounce = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: -5,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
        ])
      );

    const cartAnimation = createBounce(cartBounce, 0);
    const messageAnimation = createBounce(messageBounce, 350);
    cartAnimation.start();
    messageAnimation.start();

    return () => {
      cartAnimation.stop();
      messageAnimation.stop();
    };
  }, [cartBounce, messageBounce]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
      <LinearGradient
        colors={["#00AEEF", "#0077C8", "#004A99"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.welcomeRow}>
            <Pressable
              onPress={openDrawer}
              style={styles.menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Open side navigation"
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={26}
                color="#FFFFFF"
              />
            </Pressable>
            <View>
              <Text style={styles.heroWelcome}>Welcome back</Text>
              <Text style={styles.heroTitle}>{firstName}</Text>
            </View>
          </View>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            contentFit="cover"
          />
        </View>
        <View style={styles.searchRow}>
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
          <View style={styles.searchActions}>
            <Animated.View
              style={[
                styles.searchActionBtn,
                {
                  backgroundColor: palette.searchBg,
                  transform: [{ translateY: cartBounce }],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="cart-outline"
                size={22}
                color={palette.text}
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.searchActionBtn,
                {
                  backgroundColor: palette.searchBg,
                  transform: [{ translateY: messageBounce }],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="message-outline"
                size={22}
                color={palette.text}
              />
            </Animated.View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDashboard}
            tintColor="#00AEEF"
            colors={["#00AEEF", "#0077C8"]}
          />
        }
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {products.length}
              </Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Products</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>
                {categories.length}
              </Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Categories</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.statValue, { color: palette.text }]}>86</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Orders</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Categories</Text>
          {categories.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                No categories found. Add categories from the sidebar.
              </Text>
            </View>
          ) : (
            <View style={styles.categoryRow}>
            {categories.map((category) => (
              <View
                key={category.id}
                style={[styles.categoryCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
                <View style={[styles.categoryImageShell, { backgroundColor: palette.thumb }]}>
                  {category.image ? (
                    <Image
                      source={{ uri: category.image }}
                      style={styles.categoryImage}
                      contentFit="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="shape-outline"
                      size={22}
                      color="#0077C8"
                    />
                  )}
                </View>
                <Text style={[styles.categoryText, { color: palette.text }]}>
                  {category.category_name || "Untitled"}
                </Text>
              </View>
            ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Featured Products</Text>
          {products.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                No products found. Add products from the sidebar.
              </Text>
            </View>
          ) : (
            products.map((item) => (
            <View key={item.id} style={[styles.productCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.productThumb, { backgroundColor: palette.thumb }]}>
                {item.product_image ? (
                  <Image
                    source={{ uri: item.product_image }}
                    style={styles.productThumbImage}
                    contentFit="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="image-outline" size={24} color={palette.muted} />
                )}
              </View>
              <View style={styles.productBody}>
                <Text style={[styles.productName, { color: palette.text }]}>
                  {item.product_name || "Untitled product"}
                </Text>
                <Text style={[styles.productMeta, { color: palette.muted }]}>
                  Stock: {item.product_stock || "N/A"}
                </Text>
              </View>
              <Text style={styles.productPrice}>
                Price: {item.product_price || "N/A"}
              </Text>
            </View>
          ))
          )}
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

      <SidebarNavigation
        visible={drawerOpen}
        slideAnim={drawerSlide}
        palette={palette}
        onClose={closeDrawer}
      />
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
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
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
    flex: 1,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
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
  categoryImageShell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryText: {
    color: "#0F172A",
    fontWeight: "600",
    textAlign: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
    overflow: "hidden",
  },
  productThumbImage: {
    width: "100%",
    height: "100%",
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
