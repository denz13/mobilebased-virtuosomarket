import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import type { AuthError } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  CARD_OVERLAP_TEAL,
  CARD_SHIFT_DOWN,
  HERO_GRADIENT,
  MUTED,
  PRIMARY,
  SCREEN_HEIGHT,
  TEXT_DARK,
  WHITE,
  styles,
} from "./auth-styles";

const RESEND_COOLDOWN_AFTER_SEND_SEC = 60;
const COOLDOWN_AFTER_RATE_LIMIT_SEC = 120;

function isAuthEmailRateLimitError(error: AuthError): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const code = String(
    (error as AuthError & { code?: string }).code ?? ""
  ).toLowerCase();
  return (
    error.status === 429 ||
    code === "over_email_send_rate_limit" ||
    msg.includes("email rate limit") ||
    msg.includes("rate limit exceeded") ||
    msg.includes("too many emails")
  );
}

type Step = "email" | "otp" | "newPassword";

type Banner = {
  tone: "info" | "error" | "success";
  message: string;
  link?: { label: string; url: string };
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [heroBlockHeight, setHeroBlockHeight] = useState(0);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const t = setTimeout(() => setResendCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldownSec]);

  const sendRecoveryEmail = useCallback(async () => {
    setBanner(null);
    if (!isSupabaseConfigured) {
      setBanner({
        tone: "error",
        message:
          "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or publishable) in .env, then restart with npx expo start -c.",
      });
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setBanner({
        tone: "error",
        message: "Please enter your email address.",
      });
      return;
    }
    if (step === "otp" && resendCooldownSec > 0) {
      setBanner({
        tone: "info",
        message: `You can request another code in ${resendCooldownSec}s.`,
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: Linking.createURL("/"),
    });
    setBusy(false);
    if (error) {
      if (isAuthEmailRateLimitError(error)) {
        setResendCooldownSec(COOLDOWN_AFTER_RATE_LIMIT_SEC);
        setBanner({
          tone: "error",
          message:
            "Hindi kaya ng app na i-bypass ito: ang Supabase project mo ay umabot na sa limit ng pagpapadala ng auth email (reset/OTP). Karaniwan ito sa built-in email o mababang hourly cap.\n\nAno ang gawin: (1) Maghintay ng ~1 oras, subukan ulit. (2) Sa Supabase Dashboard → Authentication → iyong SMTP / Email settings: mag-set ng Custom SMTP (Resend, SendGrid, SES, atbp.) para mas mataas ang quota. (3) Tingnan ang Authentication → Rate Limits kung may maa-adjust.",
          link: {
            label: "Gabay: Custom SMTP sa Supabase (docs)",
            url: "https://supabase.com/docs/guides/auth/auth-smtp",
          },
        });
        return;
      }
      setBanner({ tone: "error", message: error.message });
      return;
    }
    setOtp("");
    setStep("otp");
    setResendCooldownSec(RESEND_COOLDOWN_AFTER_SEND_SEC);
    setBanner({
      tone: "success",
      message:
        "If an account exists for that email, you should get a code shortly. Check spam too.",
    });
  }, [email, resendCooldownSec, step]);

  const verifyOtpAndContinue = useCallback(async () => {
    setBanner(null);
    const trimmed = email.trim();
    const code = otp.replace(/\D/g, "");
    if (!trimmed) {
      setBanner({
        tone: "error",
        message: "Go back and enter your email.",
      });
      return;
    }
    if (code.length < 6) {
      setBanner({
        tone: "error",
        message: "Enter the 6-digit code from your email.",
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code,
      type: "recovery",
    });
    setBusy(false);
    if (error) {
      setBanner({ tone: "error", message: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setBanner(null);
    setStep("newPassword");
  }, [email, otp]);

  const saveNewPassword = useCallback(async () => {
    setBanner(null);
    if (newPassword.length < 6) {
      setBanner({
        tone: "error",
        message: "Use at least 6 characters for your new password.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setBanner({
        tone: "error",
        message: "Passwords do not match.",
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      setBusy(false);
      setBanner({ tone: "error", message: error.message });
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    router.replace("/auth/login");
  }, [confirmPassword, newPassword, router]);

  const goBackToEmail = useCallback(() => {
    setBanner(null);
    setStep("email");
    setOtp("");
    setResendCooldownSec(0);
  }, []);

  const onHeroLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setHeroBlockHeight(h);
  }, []);

  const cardTop =
    heroBlockHeight > 0
      ? heroBlockHeight - CARD_OVERLAP_TEAL + CARD_SHIFT_DOWN
      : Math.round(SCREEN_HEIGHT * 0.36) - CARD_OVERLAP_TEAL + CARD_SHIFT_DOWN;

  const heroSubtitle =
    step === "email"
      ? "We’ll email you a code to reset your password."
      : step === "otp"
        ? "Enter the code we sent to your email."
        : "Choose a new password for your account.";

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
            <Text style={styles.heroTitle}>{heroSubtitle}</Text>
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
            <Text style={styles.cardTitle}>
              {step === "email"
                ? "Forgot password"
                : step === "otp"
                  ? "Enter code"
                  : "New password"}
            </Text>
            <Text style={[styles.signUpMuted, forgotStyles.subtitle]}>
              {step === "email" &&
                "Enter the email for your account. We’ll send a one-time code you can paste here."}
              {step === "otp" &&
                `We sent a 6-digit code to ${email.trim() || "your email"}. If the email only has a link, add {{ .Token }} to the Reset password template (Supabase → Authentication → Email templates).`}
              {step === "newPassword" &&
                "Your code was verified. Set a new password below."}
            </Text>

            {banner ? (
              <View
                style={[
                  forgotStyles.banner,
                  banner.tone === "error" && forgotStyles.bannerError,
                  banner.tone === "success" && forgotStyles.bannerSuccess,
                  banner.tone === "info" && forgotStyles.bannerInfo,
                ]}
                accessibilityLiveRegion="polite"
              >
                <Text
                  style={[
                    forgotStyles.bannerText,
                    banner.tone === "error" && forgotStyles.bannerTextError,
                    banner.tone === "success" && forgotStyles.bannerTextSuccess,
                    banner.tone === "info" && forgotStyles.bannerTextInfo,
                  ]}
                >
                  {banner.message}
                </Text>
                {banner.link ? (
                  <Pressable
                    onPress={() => Linking.openURL(banner.link!.url)}
                    style={forgotStyles.bannerLinkWrap}
                    accessibilityRole="link"
                    accessibilityLabel={banner.link.label}
                  >
                    <Text style={forgotStyles.bannerLink}>{banner.link.label}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {step === "email" ? (
              <>
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
                    editable={!busy}
                  />
                </View>

                <Pressable
                  style={[styles.primaryBtn, busy && forgotStyles.btnDisabled]}
                  onPress={sendRecoveryEmail}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send code</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            {step === "otp" ? (
              <>
                <View style={styles.field}>
                  <MaterialCommunityIcons
                    name="numeric"
                    size={26}
                    color={MUTED}
                  />
                  <TextInput
                    placeholder="6-digit code"
                    placeholderTextColor={MUTED}
                    style={[styles.input, forgotStyles.otpInput]}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    editable={!busy}
                  />
                </View>

                <Pressable
                  style={[styles.primaryBtn, busy && forgotStyles.btnDisabled]}
                  onPress={verifyOtpAndContinue}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify code</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.primaryBtn,
                    forgotStyles.secondaryBtn,
                    (busy || resendCooldownSec > 0) && forgotStyles.btnDisabled,
                  ]}
                  onPress={sendRecoveryEmail}
                  disabled={busy || resendCooldownSec > 0}
                >
                  <Text style={forgotStyles.secondaryBtnText}>
                    {resendCooldownSec > 0
                      ? `Resend code (${resendCooldownSec}s)`
                      : "Resend code"}
                  </Text>
                </Pressable>

                <Pressable onPress={goBackToEmail} disabled={busy}>
                  <Text style={[styles.signUpLink, forgotStyles.linkCenter]}>
                    Use a different email
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === "newPassword" ? (
              <>
                <View style={styles.field}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={26}
                    color={MUTED}
                  />
                  <TextInput
                    placeholder="New password"
                    placeholderTextColor={MUTED}
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    editable={!busy}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    style={forgotStyles.eyeBtn}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={24}
                      color={MUTED}
                    />
                  </Pressable>
                </View>

                <View style={styles.field}>
                  <MaterialCommunityIcons
                    name="lock-check-outline"
                    size={26}
                    color={MUTED}
                  />
                  <TextInput
                    placeholder="Confirm new password"
                    placeholderTextColor={MUTED}
                    style={styles.input}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!busy}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword((v) => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    style={forgotStyles.eyeBtn}
                  >
                    <MaterialCommunityIcons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={24}
                      color={MUTED}
                    />
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.primaryBtn, busy && forgotStyles.btnDisabled]}
                  onPress={saveNewPassword}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Update password</Text>
                  )}
                </Pressable>
              </>
            ) : null}

            <View style={styles.signUpRow}>
              <Text style={styles.signUpMuted}>Remember your password? </Text>
              <Link href="/auth/login" asChild>
                <Pressable>
                  <Text style={styles.signUpLink}>Back to login</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const forgotStyles = StyleSheet.create({
  subtitle: {
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 4,
    color: TEXT_DARK,
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: PRIMARY,
    marginBottom: 16,
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontSize: 17,
    fontWeight: "700",
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  linkCenter: {
    textAlign: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  bannerSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  bannerInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  bannerText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  bannerTextError: {
    color: "#B91C1C",
  },
  bannerTextSuccess: {
    color: "#047857",
  },
  bannerTextInfo: {
    color: "#1D4ED8",
  },
  bannerLinkWrap: {
    marginTop: 12,
    alignSelf: "center",
  },
  bannerLink: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
