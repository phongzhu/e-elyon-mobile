// app/forgot-password.tsx
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../src/lib/supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");

  const handleReset = async () => {
    if (!email) {
      Alert.alert("Missing Email", "Please enter your registered email address.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://uakxzzgfifssutxivpcj.supabase.co/auth/v1/callback", 
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert(
        "Check your inbox",
        "A password reset link has been sent to your email address."
      );
      router.replace("/login");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B6516",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 26,
          fontWeight: "800",
          marginBottom: 30,
          textAlign: "center",
        }}
      >
        Forgot Password
      </Text>

      <TextInput
        placeholder="Enter your email"
        placeholderTextColor="#ccc"
        style={{
          width: "100%",
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TouchableOpacity
        onPress={handleReset}
        style={{
          width: "100%",
          backgroundColor: "#9C0808",
          padding: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          Send Reset Link
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={{ color: "white", marginTop: 20 }}>
          Back to{" "}
          <Text style={{ color: "#FFDCDC", fontWeight: "700" }}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
