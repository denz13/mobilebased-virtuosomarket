import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
    CARD_OVERLAP_TEAL,
    CARD_SHIFT_DOWN,
    HERO_GRADIENT,
    MUTED,
    SCREEN_HEIGHT,
    WHITE,
    styles
} from "./auth-styles";

export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const [remember, setRemember] = useState(false);
  const [heroBlockHeight, setHeroBlockHeight] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const signIn = useCallback(async () => {
    if (!isSupabaseConfigured) {
      toast.warning(
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY or publishable key. Restart: npx expo start -c",
        "Configuration"
      );
      return;
    }
    const trimmed = email.trim();
    if (!trimmed || !password) {
      toast.warning("Please enter email and password.", "Missing fields");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message, "Login failed");
      return;
    }
    router.replace("/(tabs)");
  }, [email, password, router, toast]);

  const onHeroLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setHeroBlockHeight(h);
  }, []);

  const cardTop =
    heroBlockHeight > 0
      ? heroBlockHeight - CARD_OVERLAP_TEAL + CARD_SHIFT_DOWN
      : Math.round(SCREEN_HEIGHT * 0.36) - CARD_OVERLAP_TEAL + CARD_SHIFT_DOWN;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...HERO_GRADIENT]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar style="light" />
      <SafeAreaView
        style={styles.safeTop}
        edges={["top"]}
        onLayout={onHeroLayout}
      >
        <View style={styles.hero}>
          <View style={styles.heroDecor} pointerEvents="none">
            <MaterialCommunityIcons
              name="tag-outline"
              size={72}
              color={WHITE}
              style={[
                styles.decorIcon,
                { top: "12%", right: "8%", opacity: 0.12 },
              ]}
            />
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={88}
              color={WHITE}
              style={[
                styles.decorIcon,
                { bottom: "18%", left: "4%", opacity: 0.1 },
              ]}
            />
            <MaterialCommunityIcons
              name="gift-outline"
              size={64}
              color={WHITE}
              style={[
                styles.decorIcon,
                { top: "38%", left: "14%", opacity: 0.08 },
              ]}
            />
            <MaterialCommunityIcons
              name="shopping-outline"
              size={120}
              color={WHITE}
              style={[
                styles.decorIcon,
                { bottom: "8%", right: "-4%", opacity: 0.06 },
              ]}
            />
          </View>

          <View style={styles.heroContent}>
            <View style={styles.logoShell}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.logoImage}
                contentFit="contain"
                accessibilityLabel="Virtuoso Market"
              />
            </View>
            <Text style={styles.brandName}>Virtuoso Market</Text>
            <Text style={styles.heroTitle}>
              Log in to discover the best deals and fresh finds.
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={[styles.cardWrapAbsolute, { top: cardTop }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.card}>
          <ScrollView
            style={styles.cardScrollView}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.cardScroll,
              {
                paddingHorizontal: 28,
                paddingTop: 32,
                paddingBottom: 36 + insets.bottom,
              },
            ]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
          >
            <Text style={styles.cardTitle}>Login</Text>
            <View style={styles.signUpRow}>
              <Text style={styles.signUpMuted}>
                Don&apos;t Have An Account?{" "}
              </Text>
              <Link href="/auth/register" asChild>
                <Pressable>
                  <Text style={styles.signUpLink}>Sign Up</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="email-outline"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="Email"
                placeholderTextColor={MUTED}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={MUTED}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={loginStyles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={24}
                  color={MUTED}
                />
              </Pressable>
            </View>

            <View style={styles.rowBetween}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRemember((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
              >
                <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                  {remember ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color={WHITE}
                    />
                  ) : null}
                </View>
                <Text style={styles.rememberLabel}>Remember Me</Text>
              </Pressable>
              <Link href="/auth/forgotpassword" asChild>
                <Pressable>
                  <Text style={styles.link}>Forgot Password?</Text>
                </Pressable>
              </Link>
            </View>

            <Pressable
              style={[styles.primaryBtn, loading && loginStyles.btnDisabled]}
              onPress={signIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.primaryBtnText}>Login</Text>
              )}
            </Pressable>

            <Text style={styles.dividerText}>Or Continue With</Text>

            <View style={styles.socialRow}>
              <Pressable
                style={[styles.socialBtn, styles.appleBtn]}
                onPress={() => {}}
              >
                <MaterialCommunityIcons name="apple" size={26} color={WHITE} />
                <Text style={styles.appleBtnText}>Apple</Text>
              </Pressable>
              <Pressable
                style={[styles.socialBtn, styles.googleBtn]}
                onPress={() => {}}
              >
                <MaterialCommunityIcons
                  name="google"
                  size={26}
                  color="#EA4335"
                />
                <Text style={styles.googleBtnText}>Google</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const loginStyles = StyleSheet.create({
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  btnDisabled: {
    opacity: 0.75,
  },
});
