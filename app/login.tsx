// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabaseClient";

const toMemberEmail = (raw: string) => {
  const e = String(raw || "")
    .trim()
    .toLowerCase();

  // user should NOT type _member, but if they did, tolerate it
  if (e.endsWith("_member")) return e;

  // match your signup behavior
  if (e.endsWith(".com")) return e.replace(/\.com$/i, ".com_member");

  return e + "_member";
};

export default function Login() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentMinHeight = Math.max(0, height - insets.top - insets.bottom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch branding from Supabase (guard against stale/broken refresh tokens)
  useEffect(() => {
    (async () => {
      // 1) If there is a broken/old session stored, clear it.
      // This prevents "Invalid Refresh Token" from crashing any supabase query.
      try {
        const { data, error } = await supabase.auth.getSession();

        const msg = String(error?.message || "").toLowerCase();
        if (msg.includes("refresh token")) {
          await supabase.auth.signOut({ scope: "local" });
        }

        // If session exists but is weird/empty, just proceed.
        void data?.session;
      } catch (e: any) {
        const msg = String(e?.message || "").toLowerCase();
        if (msg.includes("refresh token")) {
          await supabase.auth.signOut({ scope: "local" });
        }
      }

      // 2) Now it's safe to query branding
      const { data: brand, error: brandErr } = await supabase
        .from("ui_settings")
        .select("*")
        .single();

      if (brandErr) console.error("❌ Branding fetch error:", brandErr);
      else setBranding(brand);
    })();
  }, []);

  // Dynamic colors and logo
  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const tertiary = branding?.tertiary_color || "#7ac29d";

  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  const systemName = branding?.system_name || "E-ELYON";

  // Animations
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(50);

  useEffect(() => {
    logoScale.value = withSequence(
      withTiming(1.25, { duration: 700, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );
    logoOpacity.value = withTiming(1, { duration: 700 });
    formOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    formTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [formOpacity, formTranslateY, logoOpacity, logoScale]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const formAnimStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  // Email/password login
  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // User should NOT type _member / .com_member, but tolerate it.
      const raw = email.trim().toLowerCase();
      const plainEmail = raw
        .replace(/\.com_member$/i, ".com")
        .replace(/_member$/i, "");

      // 1) Auth login (plain email only)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: plainEmail,
        password,
      });

      if (signInError) {
        setIsLoading(false);
        alert("Invalid Login Credentials");
        return;
      }

      // 2) Now authenticated -> fetch CURRENT user's member row (RLS-safe)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user?.id) {
        setIsLoading(false);
        alert("Unable to read authenticated user.");
        return;
      }

      const authId = authData.user.id;

      // IMPORTANT: filter by role so 2 rows won't break it
      const { data: memberRow, error: memberErr } = await supabase
        .from("users")
        .select("user_id, email, is_active, role")
        .eq("auth_user_id", authId)
        .eq("role", "member")
        .maybeSingle();

      if (memberErr) {
        setIsLoading(false);
        alert("A system error occurred: " + memberErr.message);
        return;
      }

      if (!memberRow) {
        // user exists in auth but not in your app users table (or wrong role)
        await supabase.auth.signOut();
        setIsLoading(false);
        alert("Account record not found. Please contact admin.");
        return;
      }

      if (!memberRow.is_active) {
        await supabase.auth.signOut();
        setIsLoading(false);
        alert("Account is not active.");
        return;
      }

      // Soft check: expected member email format
      const expectedMemberEmail = toMemberEmail(plainEmail);
      if (memberRow.email && memberRow.email !== expectedMemberEmail) {
        console.warn("Member email format mismatch", {
          expected: expectedMemberEmail,
          actual: memberRow.email,
        });
      }

      router.replace("/Member-User/Member-Dashboard");
    } catch (e: any) {
      setIsLoading(false);
      alert(e?.message || "An error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0a1612",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
            minHeight: contentMinHeight,
          }}
        >
          {/* Background gradient */}
          <Svg width={width} height={height} style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient
                id="bgGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor={primary} stopOpacity="0.25" />
                <Stop offset="30%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="70%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="100%" stopColor={secondary} stopOpacity="0.25" />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#bgGradient)" />
          </Svg>

          {/* Logo Section with Diamond Border */}
          <Animated.View
            style={[logoAnimStyle, { alignItems: "center", marginBottom: 60 }]}
          >
            {logo ? (
              <View
                style={{
                  width: 130,
                  height: 130,
                  justifyContent: "center",
                  alignItems: "center",
                  transform: [{ rotate: "45deg" }],
                  marginBottom: 10,
                }}
              >
                <Svg
                  width={130}
                  height={130}
                  viewBox="0 0 200 200"
                  style={{ position: "absolute" }}
                >
                  <Defs>
                    <LinearGradient
                      id="diamondBorderGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#FFFFFF"
                        stopOpacity="0.95"
                      />
                      <Stop
                        offset="25%"
                        stopColor={tertiary}
                        stopOpacity="0.95"
                      />
                      <Stop
                        offset="50%"
                        stopColor={secondary}
                        stopOpacity="0.95"
                      />
                      <Stop offset="75%" stopColor={primary} stopOpacity="1" />
                      <Stop
                        offset="100%"
                        stopColor="#FFFFFF"
                        stopOpacity="0.8"
                      />
                    </LinearGradient>
                  </Defs>
                  <Path
                    d="M 100 10 L 190 100 L 100 190 L 10 100 Z"
                    stroke="url(#diamondBorderGrad)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <View
                  style={{
                    width: 95,
                    height: 95,
                    overflow: "hidden",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: [{ rotate: "-45deg" }],
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                  }}
                >
                  <Image
                    source={{ uri: logo }}
                    style={{
                      width: "100%",
                      height: "100%",
                      resizeMode: "contain",
                    }}
                  />
                </View>
              </View>
            ) : null}

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 38,
                fontWeight: "800",
                letterSpacing: 5,
                marginTop: 16,
                textShadowColor: `${primary}dd`,
                textShadowOffset: { width: 0, height: 4 },
                textShadowRadius: 12,
              }}
            >
              {systemName}
            </Text>

            <Text
              style={{
                color: "#B0B0B0",
                fontSize: 14,
                marginTop: 8,
                letterSpacing: 2.5,
                fontWeight: "500",
              }}
            >
              LOGIN PAGE
            </Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View
            style={[formAnimStyle, { width: "100%", maxWidth: 420 }]}
          >
            {/* Email */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: "#C8C8C8",
                  fontSize: 12,
                  fontWeight: "700",
                  marginBottom: 10,
                  letterSpacing: 1.2,
                }}
              >
                EMAIL ADDRESS
              </Text>
              <View style={{ position: "relative" }}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? primary : "#707070"}
                  style={{ position: "absolute", left: 16, top: 18, zIndex: 1 }}
                />
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor="#707070"
                  style={{
                    backgroundColor: emailFocused
                      ? "rgba(255,255,255,1)"
                      : "rgba(255,255,255,0.95)",
                    borderRadius: 14,
                    paddingVertical: 18,
                    paddingLeft: 48,
                    paddingRight: 16,
                    fontSize: 15,
                    borderWidth: 2,
                    color: "#0a1612",
                    borderColor: emailFocused ? primary : "rgba(11,101,22,0.2)",
                    shadowColor: emailFocused ? primary : "transparent",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: emailFocused ? 4 : 0,
                  }}
                  onChangeText={setEmail}
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: "#C8C8C8",
                  fontSize: 12,
                  fontWeight: "700",
                  marginBottom: 10,
                  letterSpacing: 1.2,
                }}
              >
                PASSWORD
              </Text>
              <View style={{ position: "relative" }}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={passwordFocused ? primary : "#707070"}
                  style={{ position: "absolute", left: 16, top: 18, zIndex: 1 }}
                />
                <TextInput
                  placeholder="Enter your password"
                  placeholderTextColor="#707070"
                  style={{
                    backgroundColor: passwordFocused
                      ? "rgba(255,255,255,1)"
                      : "rgba(255,255,255,0.95)",
                    borderRadius: 14,
                    paddingVertical: 18,
                    paddingLeft: 48,
                    paddingRight: 50,
                    fontSize: 15,
                    borderWidth: 2,
                    color: "#0a1612",
                    borderColor: passwordFocused
                      ? primary
                      : "rgba(11,101,22,0.2)",
                    shadowColor: passwordFocused ? primary : "transparent",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: passwordFocused ? 4 : 0,
                  }}
                  onChangeText={setPassword}
                  value={password}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 18,
                    zIndex: 1,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={22}
                    color={passwordFocused ? primary : "#707070"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              style={{ alignSelf: "flex-end", marginBottom: 28 }}
            >
              <Text
                style={{
                  color: secondary,
                  fontSize: 13,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? "#555" : secondary,
                padding: 19,
                borderRadius: 14,
                alignItems: "center",
                marginBottom: 24,
                shadowColor: secondary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: 16,
                  letterSpacing: 1.5,
                }}
              >
                {isLoading ? "LOGGING IN..." : "LOGIN"}
              </Text>
            </TouchableOpacity>

            {/* OR Divider */}
            {/* Sign Up */}
            <TouchableOpacity
              onPress={() => router.push("/signup")}
              style={{ alignItems: "center", marginTop: 28 }}
            >
              <Text style={{ color: "#CCCCCC", fontSize: 14 }}>
                Don&apos;t have an account?{" "}
                <Text
                  style={{
                    color: secondary,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                  }}
                >
                  Sign up here
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
