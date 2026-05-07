import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ProfileUser = {
  email: string | null;
  fullName: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
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
      });
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Configuration",
        "Add EXPO_PUBLIC_SUPABASE_URL and a key in .env, then restart the app."
      );
      return;
    }
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      Alert.alert("Sign out failed", error.message);
      return;
    }
    router.replace("/auth/login");
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

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.actionPrimaryText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              activeOpacity={0.8}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="logout-variant"
                    size={18}
                    color={palette.accent}
                  />
                  <Text
                    style={[
                      styles.actionSecondaryText,
                      { color: palette.accent },
                    ]}
                  >
                    Sign out
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Account overview
          </Text>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={22}
                color={palette.muted}
              />
              <View>
                <Text style={[styles.rowTitle, { color: palette.text }]}>
                  Orders
                </Text>
                <Text style={[styles.rowSubtitle, { color: palette.muted }]}>
                  Track your recent orders and returns.
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={palette.muted}
            />
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={22}
                color={palette.muted}
              />
              <View>
                <Text style={[styles.rowTitle, { color: palette.text }]}>
                  Addresses
                </Text>
                <Text style={[styles.rowSubtitle, { color: palette.muted }]}>
                  Manage delivery addresses and defaults.
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={palette.muted}
            />
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={22}
                color={palette.muted}
              />
              <View>
                <Text style={[styles.rowTitle, { color: palette.text }]}>
                  Security
                </Text>
                <Text style={[styles.rowSubtitle, { color: palette.muted }]}>
                  Update password and secure your account.
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={palette.muted}
            />
          </View>
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
  actionsRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  actionPrimary: {
    backgroundColor: "#00AEEF",
  },
  actionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  actionSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#00AEEF",
  },
  actionSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1F2937",
    opacity: 0.4,
    marginVertical: 4,
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

