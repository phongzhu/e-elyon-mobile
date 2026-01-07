// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { supabase } from "../src/lib/supabaseClient";

const { width, height } = Dimensions.get("window");

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch branding from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else {
        console.log("✅ Branding loaded:", data);
        setBranding(data);
      }
    })();
  }, []);

  // Dynamic colors and logo
  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const tertiary = branding?.tertiary_color || "#7ac29d";

  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
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
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    logoOpacity.value = withTiming(1, { duration: 700 });
    formOpacity.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    formTranslateY.value = withDelay(500, withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const formAnimStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  // Email/password login - Simple redirection based on email
  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Always append '_member' for member login (after full email)
      const plainEmail = email.trim();
      const memberEmail = plainEmail + '_member';
      // Query users for is_active check using _member email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id, email, is_active')
        .eq('email', memberEmail)
        .single();
      if (userError) {
        setIsLoading(false);
        alert('A system error occurred: ' + (userError.message || JSON.stringify(userError)));
        return;
      }
      if (!userData) {
        setIsLoading(false);
        alert('Invalid Login Credentials');
        return;
      }
      if (!userData.is_active) {
        setIsLoading(false);
        alert('Account is not active.');
        return;
      }
      // Proceed with Supabase Auth sign in using plain email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: plainEmail,
        password,
      });
      if (signInError) {
        setIsLoading(false);
        alert('Invalid Login Credentials');
        return;
      }
      // Redirect to member dashboard
      router.replace('/Member-User/Member-Dashboard');
    } catch (err) {
      setIsLoading(false);
      alert('An error occurred during login.');
    }
    setIsLoading(false);
  };

  // Google OAuth Login - Simple redirection
  const handleGoogleLogin = () => {
    if (email === "member@gmail.com") {
      router.replace("/Member-User/Member-Dashboard");
    } else if (email === "qrmember@gmail.com") {
      router.replace("/QR-User/QR-Dashboard");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            flex: 1,
            backgroundColor: "#0a1612",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            minHeight: height,
          }}
        >
          {/* Background gradient */}
          <Svg width={width} height={height} style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={primary} stopOpacity="0.25" />
                <Stop offset="30%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="70%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="100%" stopColor={secondary} stopOpacity="0.25" />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#bgGradient)" />
          </Svg>

          {/* Logo Section with Diamond Border */}
          <Animated.View style={[logoAnimStyle, { alignItems: "center", marginBottom: 60 }]}>
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
                <Svg width={130} height={130} viewBox="0 0 200 200" style={{ position: "absolute" }}>
                  <Defs>
                    <LinearGradient id="diamondBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                      <Stop offset="25%" stopColor={tertiary} stopOpacity="0.95" />
                      <Stop offset="50%" stopColor={secondary} stopOpacity="0.95" />
                      <Stop offset="75%" stopColor={primary} stopOpacity="1" />
                      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
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
                  <Image source={{ uri: logo }} style={{ width: "100%", height: "100%", resizeMode: "contain" }} />
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
          <Animated.View style={[formAnimStyle, { width: "100%", maxWidth: 420 }]}>
            {/* Email */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: "#C8C8C8", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 1.2 }}>
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
                    backgroundColor: emailFocused ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.95)",
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
              <Text style={{ color: "#C8C8C8", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 1.2 }}>
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
                    backgroundColor: passwordFocused ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.95)",
                    borderRadius: 14,
                    paddingVertical: 18,
                    paddingLeft: 48,
                    paddingRight: 50,
                    fontSize: 15,
                    borderWidth: 2,
                    color: "#0a1612",
                    borderColor: passwordFocused ? primary : "rgba(11,101,22,0.2)",
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
                  style={{ position: "absolute", right: 16, top: 18, zIndex: 1 }}
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
            <TouchableOpacity onPress={() => router.push("/forgot-password")} style={{ alignSelf: "flex-end", marginBottom: 28 }}>
              <Text style={{ color: secondary, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>Forgot Password?</Text>
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
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1.5 }}>
                {isLoading ? "LOGGING IN..." : "LOGIN"}
              </Text>
            </TouchableOpacity>

            {/* OR Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(200,200,200,0.25)" }} />
              <Text style={{ color: "#B0B0B0", paddingHorizontal: 14, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(200,200,200,0.25)" }} />
            </View>

            {/* Google Login */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                borderRadius: 14,
                paddingVertical: 16,
                paddingHorizontal: 20,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 5,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.05)",
              }}
            >
              <Svg width={26} height={26} viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                <Path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <Path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <Path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC04"
                />
                <Path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </Svg>
              <Text style={{ color: "#333", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 }}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Sign Up */}
            <TouchableOpacity onPress={() => router.push("/signup")} style={{ alignItems: "center", marginTop: 28 }}>
              <Text style={{ color: "#CCCCCC", fontSize: 14 }}>
                Don&apos;t have an account? <Text style={{ color: secondary, fontWeight: "700", letterSpacing: 0.5 }}>Sign up here</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}