import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SidebarNavigation from "@/components/sidebar-navigation";
import { useColorScheme } from "@/hooks/use-color-scheme";
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

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

/**
 * Customer-facing home (shown on the Home tab when user_metadata.role === "customer").
 */
export default function CustomerDashboard() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const categorySlideWidth = windowWidth - 32;
  const isDark = colorScheme === "dark";
  const menuBounce = useRef(new Animated.Value(0)).current;
  const drawerSlide = useRef(new Animated.Value(-320)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [firstName, setFirstName] = useState("Shopper");
  const [refreshing, setRefreshing] = useState(false);
  const [categoryCarouselIndex, setCategoryCarouselIndex] = useState(0);

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

  const onCategoryViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: { index: number | null }[];
    }) => {
      const idx = viewableItems[0]?.index;
      if (typeof idx === "number") setCategoryCarouselIndex(idx);
    },
    []
  );

  const categoryViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
  }).current;

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

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const [userRes, categoryResult, productResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("categories")
        .select("id, category_name, image")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("product")
        .select("id, product_name, product_price, product_stock, product_image")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const metadata = userRes.data.user?.user_metadata;
    const nameFromMetadata =
      typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
    const nameFromEmail = userRes.data.user?.email?.split("@")[0] ?? "";
    setFirstName(nameFromMetadata || nameFromEmail || "Shopper");

    if (!categoryResult.error) setCategories(categoryResult.data ?? []);
    if (!productResult.error) setProducts(productResult.data ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (categories.length === 0) {
      setCategoryCarouselIndex(0);
      return;
    }
    setCategoryCarouselIndex((i) => Math.min(i, categories.length - 1));
  }, [categories.length]);

  useEffect(() => {
    const menuAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(menuBounce, {
          toValue: -5,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(menuBounce, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    );
    menuAnimation.start();
    return () => menuAnimation.stop();
  }, [menuBounce]);

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]} edges={["top"]}>
        <View style={styles.configNotice}>
          <Text style={[styles.configNoticeText, { color: palette.muted }]}>
            Add Supabase keys in .env to load the shop.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
              accessibilityLabel="Open menu"
            >
              <Animated.View style={{ transform: [{ translateY: menuBounce }] }}>
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={26}
                  color="#FFFFFF"
                />
              </Animated.View>
            </Pressable>
            <View>
              <Text style={styles.heroWelcome}>
                Hello, {getTimeGreeting().toLowerCase()}
              </Text>
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
              placeholder="Search products & deals"
              placeholderTextColor={palette.searchPlaceholder}
              style={[styles.searchInput, { color: palette.text }]}
            />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#00AEEF"
            colors={["#00AEEF", "#0077C8"]}
          />
        }
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Browse</Text>
          <View style={styles.quickRow}>
            <Pressable
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => router.push("/(tabs)/categories")}
            >
              <MaterialCommunityIcons name="shape-outline" size={28} color="#00AEEF" />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Categories</Text>
              <Text style={[styles.quickHint, { color: palette.muted }]}>Explore collections</Text>
            </Pressable>
            <Pressable
              style={[styles.quickCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => router.push("/(tabs)/products")}
            >
              <MaterialCommunityIcons name="shopping-outline" size={28} color="#00AEEF" />
              <Text style={[styles.quickTitle, { color: palette.text }]}>Products</Text>
              <Text style={[styles.quickHint, { color: palette.muted }]}>Shop inventory</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Categories</Text>
          {categories.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                No categories to show yet.
              </Text>
            </View>
          ) : (
            <View>
              <FlatList
                data={categories}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                onViewableItemsChanged={onCategoryViewableItemsChanged}
                viewabilityConfig={categoryViewabilityConfig}
                getItemLayout={(_, index) => ({
                  length: categorySlideWidth,
                  offset: categorySlideWidth * index,
                  index,
                })}
                renderItem={({ item: category }) => (
                  <View style={{ width: categorySlideWidth }}>
                    <View
                      style={[
                        styles.carouselCard,
                        { backgroundColor: palette.card, borderColor: palette.border },
                      ]}
                    >
                      <View
                        style={[styles.carouselImageWrap, { backgroundColor: palette.thumb }]}
                      >
                        {category.image ? (
                          <Image
                            source={{ uri: category.image }}
                            style={styles.carouselImage}
                            contentFit="cover"
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="shape-outline"
                            size={48}
                            color="#0077C8"
                          />
                        )}
                      </View>
                      <Text
                        style={[styles.carouselTitle, { color: palette.text }]}
                        numberOfLines={2}
                      >
                        {category.category_name || "Category"}
                      </Text>
                    </View>
                  </View>
                )}
              />
              <View style={styles.carouselDots}>
                {categories.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.carouselDot,
                      {
                        backgroundColor:
                          i === categoryCarouselIndex ? "#00AEEF" : palette.border,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Featured picks</Text>
          {products.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[styles.emptyText, { color: palette.muted }]}>
                Products will appear here when available.
              </Text>
            </View>
          ) : (
            products.map((item) => (
              <View
                key={item.id}
                style={[styles.productCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              >
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
                    {item.product_name || "Product"}
                  </Text>
                  <Text style={[styles.productMeta, { color: palette.muted }]}>
                    Stock: {item.product_stock || "—"}
                  </Text>
                </View>
                <Text style={styles.productPrice}>
                  Price: {item.product_price || "—"}
                </Text>
              </View>
            ))
          )}
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
  root: { flex: 1 },
  configNotice: { flex: 1, justifyContent: "center", padding: 24 },
  configNoticeText: { textAlign: "center", fontSize: 15 },
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
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
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
  heroWelcome: { color: "#DBEAFE", fontSize: 14 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  logo: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.2)" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  searchWrap: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12 },
  content: { paddingBottom: 24 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  quickRow: { flexDirection: "row", gap: 12 },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  quickTitle: { fontSize: 16, fontWeight: "700" },
  quickHint: { fontSize: 13 },
  carouselCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  carouselImageWrap: {
    height: 140,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  carouselImage: { width: "100%", height: "100%" },
  carouselTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  carouselDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  carouselDot: { width: 8, height: 8, borderRadius: 4 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  productCard: {
    borderRadius: 14,
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  productThumbImage: { width: "100%", height: "100%" },
  productBody: { flex: 1 },
  productName: { fontSize: 15, fontWeight: "600" },
  productMeta: { fontSize: 13, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "700", color: "#0077C8" },
});
