import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabaseClient";

function extractTokensFromUrl(url: string) {
  // Supabase typically returns tokens in the URL hash:
  // exp://.../--/auth-callback#access_token=...&refresh_token=...&expires_in=...&token_type=bearer
  // Sometimes it can be in query too, so we handle both.

  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");

  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1) : "";

  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(query);

  const access_token =
    hashParams.get("access_token") || queryParams.get("access_token");
  const refresh_token =
    hashParams.get("refresh_token") || queryParams.get("refresh_token");

  return { access_token, refresh_token };
}

export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // expo-router usually provides the deep link url in `params.url`
        // but depending on setup it can be elsewhere. We'll try the common cases.
        const url =
          (typeof params?.url === "string" && params.url) ||
          (typeof params?.redirectedFrom === "string" &&
            params.redirectedFrom) ||
          "";

        if (!url) {
          // If no URL passed, fallback: maybe session already saved.
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            router.replace("/account-setup" as any);
            return;
          }

          Alert.alert("Authentication Error", "Missing callback URL.");
          router.replace("/login" as any);
          return;
        }

        const { access_token, refresh_token } = extractTokensFromUrl(url);

        if (!access_token || !refresh_token) {
          console.error("Callback URL missing tokens:", url);
          Alert.alert(
            "Authentication Error",
            "Missing tokens from Google sign-in.",
          );
          router.replace("/login" as any);
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("setSession error:", error);
          Alert.alert(
            "Authentication Error",
            error.message || "Could not complete sign-in.",
          );
          router.replace("/login" as any);
          return;
        }

        // ✅ Session is now stored. Check if user already has profile data
        // If they do, redirect to appropriate dashboard; if not, continue signup
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const { data: existingUser } = await supabase
            .from("users")
            .select("*")
            .eq("auth_user_id", authUser.user.id)
            .single();

          if (existingUser) {
            // User already exists, redirect to login or dashboard
            router.replace("/login" as any);
          } else {
            // New user, continue with signup flow
            router.replace("/signup?stage=credentials" as any);
          }
        } else {
          router.replace("/signup?stage=credentials" as any);
        }
      } catch (err: any) {
        console.error("Callback handling failed", err);
        Alert.alert(
          "Authentication Error",
          err?.message || "Could not complete sign-in.",
        );
        router.replace("/login" as any);
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Completing sign-in...</Text>
    </View>
  );
}
