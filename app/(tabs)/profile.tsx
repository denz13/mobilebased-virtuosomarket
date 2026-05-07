import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useToast } from "@/lib/toast";

type ProfileUser = {
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  dateOfBirth: string | null;
  address: string | null;
  userId: string | null;
  createdAt: string | null;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type InfoItem = {
  icon: MaterialIconName;
  label: string;
  value: string | null | undefined;
  kind: "email" | "metadata" | "password";
  metadataKey?: string;
  localKey?: keyof ProfileUser;
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const toast = useToast();
  const isDark = colorScheme === "dark";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<InfoItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [user, setUser] = useState<ProfileUser | null>(null);

  const palette = {
    bg: isDark ? "#020617" : "#F8FAFC",
    card: isDark ? "#020617" : "#FFFFFF",
    cardBorder: isDark ? "#1F2937" : "#E2E8F0",
    muted: isDark ? "#9CA3AF" : "#6B7280",
    text: isDark ? "#E5E7EB" : "#0F172A",
    accent: "#00AEEF",
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const fullName =
        (data.user.user_metadata.first_name || "") +
        (data.user.user_metadata.last_name
          ? ` ${data.user.user_metadata.last_name}`
          : "");
      setUser({
        email: data.user.email ?? null,
        fullName: fullName.trim() || null,
        firstName: data.user.user_metadata.first_name ?? null,
        middleName: data.user.user_metadata.middle_name ?? null,
        lastName: data.user.user_metadata.last_name ?? null,
        suffix: data.user.user_metadata.suffix ?? null,
        dateOfBirth: data.user.user_metadata.date_of_birth ?? null,
        address: data.user.user_metadata.address ?? null,
        userId: data.user.id ?? null,
        createdAt: data.user.created_at ?? null,
      });
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const personalInfo: InfoItem[] = [
    { icon: "email-outline", label: "Email", value: user?.email, kind: "email" },
    {
      icon: "lock-outline",
      label: "Password",
      value: "Hidden for security",
      kind: "password",
    },
    {
      icon: "account-outline",
      label: "First name",
      value: user?.firstName,
      kind: "metadata",
      metadataKey: "first_name",
      localKey: "firstName",
    },
    {
      icon: "account-outline",
      label: "Middle name",
      value: user?.middleName,
      kind: "metadata",
      metadataKey: "middle_name",
      localKey: "middleName",
    },
    {
      icon: "account-outline",
      label: "Last name",
      value: user?.lastName,
      kind: "metadata",
      metadataKey: "last_name",
      localKey: "lastName",
    },
    {
      icon: "badge-account-outline",
      label: "Suffix",
      value: user?.suffix,
      kind: "metadata",
      metadataKey: "suffix",
      localKey: "suffix",
    },
    {
      icon: "calendar-outline",
      label: "Date of birth",
      value: user?.dateOfBirth,
      kind: "metadata",
      metadataKey: "date_of_birth",
      localKey: "dateOfBirth",
    },
    {
      icon: "map-marker-outline",
      label: "Address",
      value: user?.address,
      kind: "metadata",
      metadataKey: "address",
      localKey: "address",
    },
  ];

  const openEdit = (item: InfoItem) => {
    setEditTarget(item);
    setEditValue(item.kind === "password" ? "" : item.value ?? "");
  };

  const closeEdit = () => {
    if (saving) return;
    setEditTarget(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!isSupabaseConfigured) {
      toast.warning(
        "Add EXPO_PUBLIC_SUPABASE_URL and a key in .env, then restart the app.",
        "Configuration"
      );
      return;
    }
    const nextValue = editValue.trim();
    if ((editTarget.kind === "email" || editTarget.kind === "password") && !nextValue) {
      toast.warning(
        `Enter a new ${editTarget.label.toLowerCase()}.`,
        "Missing value"
      );
      return;
    }
    if (editTarget.kind === "password" && nextValue.length < 6) {
      toast.warning(
        "Password must be at least 6 characters.",
        "Password too short"
      );
      return;
    }

    setSaving(true);
    const { error } =
      editTarget.kind === "email"
        ? await supabase.auth.updateUser({ email: nextValue })
        : editTarget.kind === "password"
          ? await supabase.auth.updateUser({ password: nextValue })
          : await supabase.auth.updateUser({
              data: { [editTarget.metadataKey ?? ""]: nextValue || null },
            });
    setSaving(false);

    if (error) {
      toast.error(error.message, "Update failed");
      return;
    }

    setUser((current) => {
      if (!current) return current;
      if (editTarget.kind === "email") return { ...current, email: nextValue };
      if (editTarget.kind === "password" || !editTarget.localKey) return current;
      const updated = { ...current, [editTarget.localKey]: nextValue || null };
      return {
        ...updated,
        fullName:
          `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim() || null,
      };
    });
    toast.success(`${editTarget.label} updated successfully.`, "Updated");
    closeEdit();
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
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.avatarShell}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.avatarImage}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.name, { color: palette.text }]}>
                {user?.fullName ?? "Your account"}
              </Text>
              <Text style={[styles.email, { color: palette.muted }]}>
                {user?.email ?? "Signed in"}
              </Text>
            </View>
          </View>

        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Personal information
          </Text>
          {personalInfo.map((item) => (
            <View key={item.label}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={22}
                  color={palette.muted}
                />
                <View style={styles.infoTextWrap}>
                  <Text style={[styles.infoLabel, { color: palette.muted }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.infoValue, { color: palette.text }]}>
                    {item.value || "Not provided"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.rowEditBtn,
                    { borderColor: palette.cardBorder },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => openEdit(item)}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={18}
                    color={palette.accent}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.rowDivider} />
            </View>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.muted }]}>
              Loading account details…
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(editTarget)}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: palette.card, borderColor: palette.cardBorder },
            ]}
          >
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              Update {editTarget?.label}
            </Text>
            <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
              {editTarget?.kind === "password"
                ? "Enter your new password."
                : `Change your ${editTarget?.label.toLowerCase()} here.`}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: palette.text,
                  borderColor: palette.cardBorder,
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                },
              ]}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={`New ${editTarget?.label.toLowerCase() ?? "value"}`}
              placeholderTextColor={palette.muted}
              secureTextEntry={editTarget?.kind === "password"}
              autoCapitalize="none"
              keyboardType={editTarget?.kind === "email" ? "email-address" : "default"}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: palette.cardBorder }]}
                activeOpacity={0.8}
                onPress={closeEdit}
                disabled={saving}
              >
                <Text style={[styles.modalCancelText, { color: palette.muted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                activeOpacity={0.8}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarShell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
  },
  email: {
    marginTop: 4,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  rowEditBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1F2937",
    opacity: 0.4,
    marginVertical: 4,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  modalCard: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveButton: {
    borderColor: "#00AEEF",
    backgroundColor: "#00AEEF",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "800",
  },
  modalSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 13,
  },
});

