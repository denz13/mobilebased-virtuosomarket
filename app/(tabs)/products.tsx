import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

type Product = {
  id: number;
  categories_id: number | null;
  product_name: string | null;
  product_description: string | null;
  product_price: string | null;
  product_stock: string | null;
  product_image: string | null;
  status: string | null;
};

type CategoryOption = {
  id: number;
  category_name: string | null;
};

export default function ProductsScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const isDark = colorScheme === "dark";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryOption | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productImage, setProductImage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const palette = {
    bg: isDark ? "#020617" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    border: isDark ? "#1F2937" : "#E2E8F0",
    input: isDark ? "#0F172A" : "#FFFFFF",
    text: isDark ? "#E5E7EB" : "#0F172A",
    muted: isDark ? "#9CA3AF" : "#64748B",
    iconBg: isDark ? "#0F172A" : "#E0F2FE",
    accent: "#00AEEF",
  };

  const loadProducts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("product")
      .select(
        "id, categories_id, product_name, product_description, product_price, product_stock, product_image, status",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      toast.error(error.message, "Could not load products");
      return;
    }

    setProducts(data ?? []);
    setLoading(false);
  }, [toast]);

  const loadCategories = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name")
      .is("deleted_at", null)
      .order("category_name", { ascending: true });

    if (error) {
      toast.error(error.message, "Could not load categories");
      return;
    }

    setCategories(data ?? []);
  }, [toast]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [loadCategories, loadProducts]);

  const resetForm = () => {
    setSelectedCategory(null);
    setCategoryDropdownOpen(false);
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setProductStock("");
    setProductImage("");
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "None";
    const category = categories.find((item) => item.id === categoryId);
    return category?.category_name || "Unknown category";
  };

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const categoryName = getCategoryName(product.categories_id).toLowerCase();
    return [
      product.product_name,
      product.product_description,
      product.product_price,
      product.product_stock,
      categoryName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const closeAddModal = () => {
    if (saving) return;
    setModalVisible(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.warning(
        "Please allow photo access to choose a product image.",
        "Permission needed"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProductImage(result.assets[0]?.uri ?? "");
    }
  };

  const saveProduct = async () => {
    const trimmedName = productName.trim();
    if (!trimmedName) {
      toast.warning("Please enter product name.", "Missing product name");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.warning(
        "Add Supabase URL and key in .env, then restart Expo.",
        "Configuration"
      );
      return;
    }

    setSaving(true);
    const payload = {
      categories_id: selectedCategory?.id ?? null,
      product_name: trimmedName,
      product_description: productDescription.trim() || null,
      product_price: productPrice.trim() || null,
      product_stock: productStock.trim() || null,
      product_image: productImage.trim() || null,
      status: "active",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("product")
      .insert(payload)
      .select(
        "id, categories_id, product_name, product_description, product_price, product_stock, product_image, status",
      )
      .single();

    setSaving(false);
    if (error) {
      toast.error(
        `${error.message}\n\nIf this is an RLS error, add an insert/select policy for public.product in Supabase.`,
        "Could not add product"
      );
      return;
    }

    setProducts((current) => [data, ...current]);
    setModalVisible(false);
    resetForm();
    toast.success("Product added successfully.", "Saved");
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.bg }]}
      edges={["top"]}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.text }]}>
              Products
            </Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Manage product inventory.
            </Text>
          </View>

          <Pressable
            style={[styles.addButton, { backgroundColor: palette.accent }]}
            onPress={openAddModal}
            accessibilityRole="button"
            accessibilityLabel="Add product"
          >
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>
              Loading products...
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: palette.input,
              borderColor: palette.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={palette.muted}
          />
          <TextInput
            placeholder="Search products"
            placeholderTextColor={palette.muted}
            style={[styles.searchInput, { color: palette.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={palette.muted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {!loading && products.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={38}
              color={palette.accent}
            />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No products yet
            </Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Products will show here from the public.product table. Tap Add to
              create your first product.
            </Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify-close"
              size={38}
              color={palette.accent}
            />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No matching products
            </Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Try another keyword or clear the search.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredProducts.map((product) => (
              <View
                key={product.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={[styles.productHero, { backgroundColor: palette.iconBg }]}>
                  {product.product_image ? (
                    <Image
                      source={{ uri: product.product_image }}
                      style={styles.productHeroImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.productHeroPlaceholder}>
                      <MaterialCommunityIcons
                        name="image-off-outline"
                        size={46}
                        color={palette.accent}
                      />
                    </View>
                  )}
                  <LinearGradient
                    colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.82)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          product.status === "inactive"
                            ? "rgba(249,115,22,0.86)"
                            : "rgba(16,185,129,0.86)",
                      },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {product.status || "active"}
                    </Text>
                  </View>

                  <View style={styles.productHeroText}>
                    <Text style={styles.productHeroTitle}>
                      {product.product_name || "Untitled product"}
                    </Text>
                    <Text style={styles.productHeroSubtitle} numberOfLines={2}>
                      {product.product_description || "No description yet."}
                    </Text>
                  </View>
                </View>

                <View style={styles.productDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="cash"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Price: {product.product_price || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="layers-outline"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Stock: {product.product_stock || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="shape-outline"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Category: {getCategoryName(product.categories_id)}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.cardActions,
                    { borderTopColor: palette.border },
                  ]}
                >
                  <Pressable style={[styles.cardAction, styles.previewAction]}>
                    <MaterialCommunityIcons
                      name="eye-outline"
                      size={17}
                      color={palette.accent}
                    />
                    <Text
                      style={[styles.cardActionText, { color: palette.accent }]}
                    >
                      Preview
                    </Text>
                  </Pressable>

                  <Pressable style={styles.cardAction}>
                    <MaterialCommunityIcons
                      name="checkbox-marked-outline"
                      size={17}
                      color={palette.text}
                    />
                    <Text style={[styles.cardActionText, { color: palette.text }]}>
                      Edit
                    </Text>
                  </Pressable>

                  <Pressable style={styles.cardAction}>
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={17}
                      color="#EF4444"
                    />
                    <Text style={[styles.cardActionText, { color: "#EF4444" }]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Add Product
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                style={[
                  styles.dropdownButton,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                  },
                ]}
                onPress={() => setCategoryDropdownOpen((open) => !open)}
                disabled={saving}
              >
                <View style={styles.dropdownTextWrap}>
                  <Text
                    style={[
                      styles.dropdownLabel,
                      { color: selectedCategory ? palette.text : palette.muted },
                    ]}
                  >
                    {selectedCategory?.category_name ||
                      "Select category"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={categoryDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={palette.muted}
                />
              </Pressable>

              {categoryDropdownOpen ? (
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: palette.input,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {categories.length === 0 ? (
                    <Text
                      style={[styles.dropdownEmpty, { color: palette.muted }]}
                    >
                      No categories found. Add categories first.
                    </Text>
                  ) : (
                    categories.map((category) => (
                      <Pressable
                        key={category.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedCategory(category);
                          setCategoryDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            { color: palette.text },
                          ]}
                        >
                          {category.category_name || "Untitled category"}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}

              <TextInput
                placeholder="Product name"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={productName}
                onChangeText={setProductName}
                editable={!saving}
              />

              <TextInput
                placeholder="Product description"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  styles.multilineInput,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={productDescription}
                onChangeText={setProductDescription}
                editable={!saving}
                multiline
              />

              <TextInput
                placeholder="Product price"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={productPrice}
                onChangeText={setProductPrice}
                editable={!saving}
                keyboardType="decimal-pad"
              />

              <TextInput
                placeholder="Product stock"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.text,
                  },
                ]}
                value={productStock}
                onChangeText={setProductStock}
                editable={!saving}
                keyboardType="number-pad"
              />

              <Pressable
                style={[
                  styles.imagePicker,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                  },
                ]}
                onPress={pickImage}
                disabled={saving}
              >
                {productImage ? (
                  <Image
                    source={{ uri: productImage }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View
                    style={[
                      styles.imagePlaceholder,
                      { backgroundColor: palette.iconBg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="image-plus"
                      size={28}
                      color={palette.accent}
                    />
                  </View>
                )}
                <View style={styles.imagePickerTextWrap}>
                  <Text
                    style={[styles.imagePickerTitle, { color: palette.text }]}
                  >
                    {productImage ? "Change image" : "Choose image"}
                  </Text>
                  <Text
                    style={[styles.imagePickerHint, { color: palette.muted }]}
                  >
                    Open photo gallery
                  </Text>
                </View>
              </Pressable>

              <View style={styles.modalActions}>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    { borderColor: palette.border },
                  ]}
                  onPress={closeAddModal}
                  disabled={saving}
                >
                  <Text
                    style={[styles.cancelButtonText, { color: palette.text }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: palette.accent },
                  ]}
                  onPress={saveProduct}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
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
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 13,
  },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  list: {
    gap: 16,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  productHero: {
    height: 188,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  productHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  productHeroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  productHeroText: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 2,
  },
  productHeroTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  productHeroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  productDetails: {
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 9,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardActions: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  cardAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 16,
  },
  previewAction: {
    marginLeft: 0,
    marginRight: "auto",
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "88%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  dropdownHint: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: -6,
    marginBottom: 12,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "700",
  },
  dropdownItemHint: {
    marginTop: 3,
    fontSize: 12,
  },
  dropdownEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  imagePicker: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  imagePreview: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  imagePlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerTextWrap: {
    flex: 1,
  },
  imagePickerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  imagePickerHint: {
    marginTop: 3,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
