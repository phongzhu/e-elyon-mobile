// app/signup.tsx
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../src/lib/supabaseClient";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      Alert.alert("Signup failed", error.message);
    } else {
      Alert.alert("Success!", "Account created successfully. Please log in.");
      router.replace("/login");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B6516", // main color
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "800",
          marginBottom: 30,
        }}
      >
        Create Account
      </Text>

      {/* Email Field */}
      <TextInput
        placeholder="Email"
        placeholderTextColor="#ccc"
        style={{
          width: "100%",
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
      />

      {/* Password Field */}
      <TextInput
        placeholder="Password"
        placeholderTextColor="#ccc"
        secureTextEntry
        style={{
          width: "100%",
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
        onChangeText={setPassword}
        value={password}
      />

      {/* Confirm Password Field */}
      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#ccc"
        secureTextEntry
        style={{
          width: "100%",
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
        }}
        onChangeText={setConfirmPassword}
        value={confirmPassword}
      />

      {/* Sign Up Button */}
      <TouchableOpacity
        onPress={handleSignup}
        style={{
          width: "100%",
          backgroundColor: "#9C0808",
          padding: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          Sign Up
        </Text>
      </TouchableOpacity>

      {/* Go Back to Login */}
      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={{ color: "white", marginTop: 20 }}>
          Already have an account?{" "}
          <Text style={{ color: "#FFDCDC", fontWeight: "700" }}>Log in here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
