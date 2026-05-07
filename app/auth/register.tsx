import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const DEFAULT_DOB = new Date(2000, 0, 1);

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [heroBlockHeight, setHeroBlockHeight] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const createAccount = useCallback(async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        "Configuration",
        "Add EXPO_PUBLIC_SUPABASE_URL and a key. If sign-up fails with invalid API key, set EXPO_PUBLIC_SUPABASE_ANON_KEY (legacy anon JWT from API Keys). Restart: npx expo start -c"
      );
      return;
    }
    const trimmedEmail = email.trim();
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing fields", "Please enter your first and last name.");
      return;
    }
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please confirm your password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          middle_name: middleName.trim() || undefined,
          last_name: lastName.trim(),
          suffix: suffix.trim() || undefined,
          date_of_birth: dob ? formatLocalYmd(dob) : undefined,
          address: address.trim() || undefined,
        },
      },
    });
    if (error) {
      setLoading(false);
      Alert.alert("Sign up failed", error.message);
      return;
    }
    if (data.session) {
      setLoading(false);
      router.replace("/(tabs)");
      return;
    }
    // Kapag naka-off ang "Confirm email" sa Supabase, minsan walang session sa signUp
    // pero puwede pa ring mag-login; subukan bago ipakitang kailangan ng email confirm.
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
    setLoading(false);
    if (!signInError && signInData.session) {
      router.replace("/(tabs)");
      return;
    }
    Alert.alert(
      "Check your email",
      "Confirm your address to finish creating your account, then log in."
    );
    router.replace("/auth/login");
  }, [
    email,
    password,
    confirmPassword,
    firstName,
    middleName,
    lastName,
    suffix,
    dob,
    address,
    router,
  ]);

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
              Create your account and start shopping smarter.
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
            <Text style={styles.cardTitle}>Sign Up</Text>
            <View style={styles.signUpRow}>
              <Text style={styles.signUpMuted}>Already Have An Account? </Text>
              <Link href="/auth/login" asChild>
                <Pressable>
                  <Text style={styles.signUpLink}>Login</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="account-outline"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="First name"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="account-outline"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="Middle name"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                value={middleName}
                onChangeText={setMiddleName}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="account-outline"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="Last name"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons
                name="format-letter-case-upper"
                size={26}
                color={MUTED}
              />
              <TextInput
                placeholder="Suffix (e.g. Jr., III)"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="characters"
                autoCorrect={false}
                value={suffix}
                onChangeText={setSuffix}
                editable={!loading}
              />
            </View>

            <Pressable
              style={styles.field}
              onPress={() => !loading && setShowDobPicker(true)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Date of birth"
            >
              <MaterialCommunityIcons
                name="calendar-outline"
                size={26}
                color={MUTED}
              />
              <Text
                style={[
                  styles.input,
                  { color: dob ? TEXT_DARK : MUTED },
                ]}
              >
                {dob ? formatLocalYmd(dob) : "Date of birth"}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={22}
                color={MUTED}
              />
            </Pressable>

            {Platform.OS === "android" && showDobPicker ? (
              <DateTimePicker
                value={dob ?? DEFAULT_DOB}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  setShowDobPicker(false);
                  if (event.type === "set" && date) setDob(date);
                }}
              />
            ) : null}

            <Modal
              visible={Platform.OS === "ios" && showDobPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowDobPicker(false)}
            >
              <Pressable
                style={registerStyles.dobModalBackdrop}
                onPress={() => setShowDobPicker(false)}
              >
                <View style={registerStyles.dobModalSheet}>
                  <DateTimePicker
                    value={dob ?? DEFAULT_DOB}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    themeVariant="light"
                    onChange={(_: DateTimePickerEvent, date?: Date) => {
                      if (date) setDob(date);
                    }}
                    style={registerStyles.dobIosPicker}
                  />
                  <Pressable
                    style={registerStyles.dobModalDone}
                    onPress={() => setShowDobPicker(false)}
                  >
                    <Text style={registerStyles.dobModalDoneText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>

            <View style={[styles.field, registerStyles.fieldMultiline]}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={26}
                color={MUTED}
                style={registerStyles.fieldIconTop}
              />
              <TextInput
                placeholder="Address"
                placeholderTextColor={MUTED}
                style={[styles.input, registerStyles.inputMultiline]}
                autoCapitalize="sentences"
                multiline
                textAlignVertical="top"
                value={address}
                onChangeText={setAddress}
                editable={!loading}
              />
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
                style={registerStyles.eyeBtn}
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
                placeholder="Confirm password"
                placeholderTextColor={MUTED}
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
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
                style={registerStyles.eyeBtn}
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
              style={[styles.primaryBtn, loading && registerStyles.btnDisabled]}
              onPress={createAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const registerStyles = StyleSheet.create({
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  dobModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  dobModalSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    alignItems: "center",
  },
  dobIosPicker: {
    height: 200,
    width: "100%",
  },
  dobModalDone: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dobModalDoneText: {
    fontSize: 17,
    fontWeight: "600",
    color: PRIMARY,
  },
  fieldMultiline: {
    alignItems: "flex-start",
    paddingTop: Platform.OS === "ios" ? 14 : 12,
    paddingBottom: Platform.OS === "ios" ? 14 : 12,
  },
  fieldIconTop: {
    marginTop: 2,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 0,
  },
});
