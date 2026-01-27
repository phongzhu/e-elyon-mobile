// app/forgot-password.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { supabase } from "../src/lib/supabaseClient";

const { width, height } = Dimensions.get("window");

type Step = "email" | "otp" | "password";

const toPlainEmail = (raw: string) => {
  const e = String(raw || "")
    .trim()
    .toLowerCase();
  return e.replace(/\.com_member$/i, ".com").replace(/_member$/i, "");
};

const isValidPassword = (p: string) => {
  const s = String(p || "");
  if (s.length < 8) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};

export default function ForgotPassword() {
  const [branding, setBranding] = useState<any>(null);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";

  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  const systemName = branding?.system_name || "E-ELYON";

  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [newPassFocused, setNewPassFocused] = useState(false);
  const [confirmPassFocused, setConfirmPassFocused] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);

  const plainEmail = useMemo(() => toPlainEmail(email), [email]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(
      () => setResendCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [resendCooldown]);

  const sendOtp = async () => {
    if (!plainEmail) {
      Alert.alert(
        "Missing Email",
        "Please enter your registered email address.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: plainEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      setStep("otp");
      setOtp("");
      setResendCooldown(60);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    const cleanedOtp = String(otp || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (cleanedOtp.length !== 6) {
      Alert.alert(
        "Invalid OTP",
        "Please enter the 6-digit code sent to your email.",
      );
      return;
    }
    if (!plainEmail) {
      Alert.alert("Missing Email", "Please enter your email first.");
      setStep("email");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: plainEmail,
        token: cleanedOtp,
        type: "email",
      });
      if (error) throw error;

      setStep("password");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to verify OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const setPassword = async () => {
    if (!plainEmail) {
      Alert.alert("Missing Email", "Please enter your email first.");
      setStep("email");
      return;
    }

    if (!isValidPassword(newPassword)) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 8 characters, contain 1 uppercase letter, and 1 special character.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        "Password Mismatch",
        "Please make sure both passwords match.",
      );
      return;
    }

    setIsLoading(true);
    try {
      // Prevent re-using the current (old) password:
      // If signing in with the candidate password works, it matches the current password.
      const { error: oldCheckErr } = await supabase.auth.signInWithPassword({
        email: plainEmail,
        password: newPassword,
      });

      if (!oldCheckErr) {
        Alert.alert(
          "Invalid Password",
          "New password must be different from your old password.",
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      await supabase.auth.signOut();
      Alert.alert("Success", "Your password has been updated. Please log in.");
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to set new password.");
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitle =
    step === "email"
      ? "FORGOT PASSWORD"
      : step === "otp"
        ? "VERIFY OTP"
        : "SET NEW PASSWORD";

  const stepSubtitle =
    step === "email"
      ? "Enter your email to receive a 6-digit OTP."
      : step === "otp"
        ? "Enter the 6-digit code sent to your email."
        : "Create a strong password for your account.";

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
            padding: 24,
            minHeight: height,
          }}
        >
          {/* Background gradient (match login vibe) */}
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

          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 34 }}>
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              {logo ? (
                <Image
                  source={{ uri: logo }}
                  style={{ width: 86, height: 86, borderRadius: 16 }}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name="lock-closed-outline"
                  size={52}
                  color={secondary}
                />
              )}
            </View>

            <Text
              style={{
                color: "#fff",
                fontSize: 28,
                fontWeight: "900",
                letterSpacing: 2,
                textAlign: "center",
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
              {stepTitle}
            </Text>
            <Text
              style={{
                color: "#9AA0A6",
                fontSize: 13,
                marginTop: 10,
                textAlign: "center",
                maxWidth: 360,
                lineHeight: 18,
              }}
            >
              {stepSubtitle}
            </Text>
          </View>

          {/* Form */}
          <View style={{ width: "100%", maxWidth: 420 }}>
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
                  editable={step === "email"}
                  onChangeText={setEmail}
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* OTP */}
            {step === "otp" && (
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
                  OTP CODE
                </Text>
                <View style={{ position: "relative" }}>
                  <Ionicons
                    name="keypad-outline"
                    size={20}
                    color={otpFocused ? primary : "#707070"}
                    style={{
                      position: "absolute",
                      left: 16,
                      top: 18,
                      zIndex: 1,
                    }}
                  />
                  <TextInput
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#707070"
                    style={{
                      backgroundColor: otpFocused
                        ? "rgba(255,255,255,1)"
                        : "rgba(255,255,255,0.95)",
                      borderRadius: 14,
                      paddingVertical: 18,
                      paddingLeft: 48,
                      paddingRight: 16,
                      fontSize: 15,
                      borderWidth: 2,
                      color: "#0a1612",
                      borderColor: otpFocused ? primary : "rgba(11,101,22,0.2)",
                      shadowColor: otpFocused ? primary : "transparent",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: otpFocused ? 4 : 0,
                      letterSpacing: 6,
                      textAlign: "center",
                    }}
                    editable={step === "otp"}
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={(t) =>
                      setOtp(
                        String(t || "")
                          .replace(/\D/g, "")
                          .slice(0, 6),
                      )
                    }
                    maxLength={6}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                  />
                </View>
              </View>
            )}

            {/* Passwords */}
            {step === "password" && (
              <>
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
                    NEW PASSWORD
                  </Text>
                  <View style={{ position: "relative" }}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={newPassFocused ? primary : "#707070"}
                      style={{
                        position: "absolute",
                        left: 16,
                        top: 18,
                        zIndex: 1,
                      }}
                    />
                    <TextInput
                      placeholder="Enter new password"
                      placeholderTextColor="#707070"
                      style={{
                        backgroundColor: newPassFocused
                          ? "rgba(255,255,255,1)"
                          : "rgba(255,255,255,0.95)",
                        borderRadius: 14,
                        paddingVertical: 18,
                        paddingLeft: 48,
                        paddingRight: 50,
                        fontSize: 15,
                        borderWidth: 2,
                        color: "#0a1612",
                        borderColor: newPassFocused
                          ? primary
                          : "rgba(11,101,22,0.2)",
                        shadowColor: newPassFocused ? primary : "transparent",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: newPassFocused ? 4 : 0,
                      }}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                      onFocus={() => setNewPassFocused(true)}
                      onBlur={() => setNewPassFocused(false)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword((s) => !s)}
                      style={{
                        position: "absolute",
                        right: 16,
                        top: 18,
                        zIndex: 1,
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={
                          showNewPassword ? "eye-outline" : "eye-off-outline"
                        }
                        size={22}
                        color={newPassFocused ? primary : "#707070"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      color: "#C8C8C8",
                      fontSize: 12,
                      fontWeight: "700",
                      marginBottom: 10,
                      letterSpacing: 1.2,
                    }}
                  >
                    CONFIRM PASSWORD
                  </Text>
                  <View style={{ position: "relative" }}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color={confirmPassFocused ? primary : "#707070"}
                      style={{
                        position: "absolute",
                        left: 16,
                        top: 18,
                        zIndex: 1,
                      }}
                    />
                    <TextInput
                      placeholder="Re-enter new password"
                      placeholderTextColor="#707070"
                      style={{
                        backgroundColor: confirmPassFocused
                          ? "rgba(255,255,255,1)"
                          : "rgba(255,255,255,0.95)",
                        borderRadius: 14,
                        paddingVertical: 18,
                        paddingLeft: 48,
                        paddingRight: 50,
                        fontSize: 15,
                        borderWidth: 2,
                        color: "#0a1612",
                        borderColor: confirmPassFocused
                          ? primary
                          : "rgba(11,101,22,0.2)",
                        shadowColor: confirmPassFocused
                          ? primary
                          : "transparent",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: confirmPassFocused ? 4 : 0,
                      }}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      onFocus={() => setConfirmPassFocused(true)}
                      onBlur={() => setConfirmPassFocused(false)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((s) => !s)}
                      style={{
                        position: "absolute",
                        right: 16,
                        top: 18,
                        zIndex: 1,
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={
                          showConfirmPassword
                            ? "eye-outline"
                            : "eye-off-outline"
                        }
                        size={22}
                        color={confirmPassFocused ? primary : "#707070"}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={{
                      color: "#9AA0A6",
                      fontSize: 12,
                      marginTop: 10,
                      lineHeight: 18,
                    }}
                  >
                    Password rules: at least 8 characters, 1 uppercase, 1
                    special character, and must not match your old password.
                  </Text>
                </View>
              </>
            )}

            {/* Primary button */}
            <TouchableOpacity
              onPress={
                step === "email"
                  ? sendOtp
                  : step === "otp"
                    ? verifyOtp
                    : setPassword
              }
              disabled={isLoading || (step === "otp" && otp.length !== 6)}
              style={{
                backgroundColor: isLoading ? "#555" : secondary,
                padding: 19,
                borderRadius: 14,
                alignItems: "center",
                marginBottom: 16,
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
                {isLoading
                  ? "PLEASE WAIT..."
                  : step === "email"
                    ? "SEND OTP"
                    : step === "otp"
                      ? "VERIFY OTP"
                      : "SET NEW PASSWORD"}
              </Text>
            </TouchableOpacity>

            {/* Secondary actions */}
            {step === "otp" && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 18,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (isLoading) return;
                    setStep("email");
                    setOtp("");
                  }}
                >
                  <Text
                    style={{
                      color: "#CCCCCC",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Change email
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (isLoading || resendCooldown > 0) return;
                    void sendOtp();
                  }}
                  disabled={isLoading || resendCooldown > 0}
                >
                  <Text
                    style={{
                      color: resendCooldown > 0 ? "#777" : secondary,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend OTP"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={{ alignItems: "center", marginTop: 18 }}
            >
              <Text style={{ color: "#CCCCCC", fontSize: 14 }}>
                Back to{" "}
                <Text style={{ color: secondary, fontWeight: "800" }}>
                  Login
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
