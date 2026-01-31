import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getBackgroundAttendanceSnapshot,
  startBackgroundAttendance,
} from "../src/lib/backgroundAttendance";

export default function RootLayout() {
  useEffect(() => {
    const startIfConfigured = async () => {
      try {
        const snapshot = await getBackgroundAttendanceSnapshot();
        if (snapshot.config) {
          await startBackgroundAttendance();
        }
      } catch {}
    };

    void startIfConfigured();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
