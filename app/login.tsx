// app/login.tsx
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../src/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Login failed", error.message);
    else {
      Alert.alert("Success", "Logged in!");
      router.replace("/(tabs)"); // or wherever your main app starts
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B6516", justifyContent: "center", alignItems: "center", padding: 20 }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginBottom: 30 }}>Login</Text>

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

      <TextInput
        placeholder="Password"
        placeholderTextColor="#ccc"
        style={{
          width: "100%",
          backgroundColor: "white",
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
        }}
        onChangeText={setPassword}
        value={password}
        secureTextEntry
      />

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          width: "100%",
          backgroundColor: "#9C0808",
          padding: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/forgot-password")}>
        <Text style={{ color: "#FFDCDC", marginTop: 15, textDecorationLine: "underline" }}>
            Forgot password?
        </Text>
        </TouchableOpacity>


      <TouchableOpacity onPress={() => router.push("/signup")}>
        <Text style={{ color: "white", marginTop: 20 }}>
          Don’t have an account? <Text style={{ color: "#FFDCDC", fontWeight: "700" }}>Sign up here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
