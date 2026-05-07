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

type Category = {
  id: number;
  category_name: string | null;
  category_description: string | null;
  image: string | null;
  status: string | null;
};

export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const isDark = colorScheme === "dark";
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [image, setImage] = useState("");
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

  const loadCategories = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("categories")
      .select("id, category_name, category_description, image, status")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      toast.error(error.message, "Could not load categories");
      return;
    }

    setCategories(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const resetForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setImage("");
  };

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
        "Please allow photo access to choose a category image.",
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
      setImage(result.assets[0]?.uri ?? "");
    }
  };

  const saveCategory = async () => {
    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      toast.warning("Please enter category name.", "Missing category name");
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
      category_name: trimmedName,
      category_description: categoryDescription.trim() || null,
      image: image.trim() || null,
      status: "active",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("categories")
      .insert(payload)
      .select("id, category_name, category_description, image, status")
      .single();

    setSaving(false);
    if (error) {
      toast.error(
        `${error.message}\n\nIf this is an RLS error, add an insert/select policy for public.categories in Supabase.`,
        "Could not add category"
      );
      return;
    }

    setCategories((current) => [
      data,
      ...current.filter((item) => item.id > 0),
    ]);
    setModalVisible(false);
    resetForm();
    toast.success("Category added successfully.", "Saved");
  };

  const filteredCategories = categories.filter((category) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      category.category_name,
      category.category_description,
      category.status,
      String(category.id),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: palette.bg }]}
      edges={["top"]}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.text }]}>
              Categories
            </Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              Manage product categories.
            </Text>
          </View>

          <Pressable
            style={[styles.addButton, { backgroundColor: palette.accent }]}
            onPress={openAddModal}
            accessibilityRole="button"
            accessibilityLabel="Add category"
          >
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>
              Loading categories...
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
            placeholder="Search categories"
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
        {!loading && categories.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <MaterialCommunityIcons
              name="database-search-outline"
              size={38}
              color={palette.accent}
            />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              No categories yet
            </Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Data will show here only from the public.categories table. Tap Add
              to create your first category.
            </Text>
          </View>
        ) : filteredCategories.length === 0 ? (
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
              No matching categories
            </Text>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Try another keyword or clear the search.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredCategories.map((category) => (
              <View
                key={category.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={[styles.categoryHero, { backgroundColor: palette.iconBg }]}>
                  {category.image ? (
                    <Image
                      source={{ uri: category.image }}
                      style={styles.categoryHeroImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.categoryHeroPlaceholder}>
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
                      styles.featuredBadge,
                      {
                        backgroundColor:
                          category.status === "inactive"
                            ? "rgba(249,115,22,0.86)"
                            : "rgba(16,185,129,0.86)",
                      },
                    ]}
                  >
                    <Text style={styles.featuredBadgeText}>
                      {category.status || "active"}
                    </Text>
                  </View>

                  <View style={styles.categoryHeroText}>
                    <Text style={styles.categoryHeroTitle}>
                      {category.category_name || "Untitled category"}
                    </Text>
                    <Text style={styles.categoryHeroSubtitle} numberOfLines={2}>
                      {category.category_description || "No description yet."}
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="identifier"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Category ID: {category.id}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="image-outline"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Image: {category.image ? "Selected" : "No image"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="checkbox-marked-outline"
                      size={18}
                      color={palette.muted}
                    />
                    <Text style={[styles.detailText, { color: palette.muted }]}>
                      Status: {category.status || "active"}
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
              Add Category
            </Text>

            <TextInput
              placeholder="Category name"
              placeholderTextColor={palette.muted}
              style={[
                styles.input,
                {
                  backgroundColor: palette.input,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              value={categoryName}
              onChangeText={setCategoryName}
              editable={!saving}
            />

            <TextInput
              placeholder="Category description"
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
              value={categoryDescription}
              onChangeText={setCategoryDescription}
              editable={!saving}
              multiline
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
              {image ? (
                <Image source={{ uri: image }} style={styles.imagePreview} />
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
                <Text style={[styles.imagePickerTitle, { color: palette.text }]}>
                  {image ? "Change image" : "Choose image"}
                </Text>
                <Text style={[styles.imagePickerHint, { color: palette.muted }]}>
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
                onPress={saveCategory}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
            </View>
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
  list: {
    gap: 16,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
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
  categoryHero: {
    height: 188,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  categoryHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryHeroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  categoryHeroText: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 2,
  },
  categoryHeroTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  categoryHeroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  categoryDetails: {
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
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
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 13,
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
