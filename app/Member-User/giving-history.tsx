import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabaseClient";


type GivingRecord = {
  id: number;
  title: string;
  date: string;
  amount: string;
  channel: "Onsite" | "Online";
  activity: string;
};

export const recordsByTab: Record<string, GivingRecord[]> = {
  Tithes: [
    { id: 1, title: "Tithes", date: "October 20, 2024", amount: "₱1,500", channel: "Onsite", activity: "1st Sunday Service" },
    { id: 2, title: "Tithes", date: "September 15, 2024", amount: "₱1,200", channel: "Online", activity: "2nd Sunday Service" },
    { id: 3, title: "Tithes", date: "August 5, 2024", amount: "₱1,800", channel: "Onsite", activity: "Church Anniversary" },
    { id: 4, title: "Tithes", date: "July 12, 2024", amount: "₱1,300", channel: "Online", activity: "Midweek Service" },
    { id: 5, title: "Tithes", date: "June 28, 2024", amount: "₱1,600", channel: "Onsite", activity: "1st Sunday Service" },
  ],
  Offering: [
    { id: 6, title: "Offering", date: "October 6, 2024", amount: "₱950", channel: "Online", activity: "Youth Service" },
    { id: 7, title: "Offering", date: "September 29, 2024", amount: "₱700", channel: "Onsite", activity: "Mission Sunday" },
  ],
  Designations: [
    { id: 8, title: "Designations", date: "September 10, 2024", amount: "₱1,050", channel: "Online", activity: "Building Fund" },
    { id: 9, title: "Designations", date: "August 18, 2024", amount: "₱850", channel: "Onsite", activity: "Community Outreach" },
  ],
};

export default function GivingHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("Tithes");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  const records = useMemo(() => recordsByTab[activeTab] || [], [activeTab]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Personal Giving Records</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="download-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/profile")}> 
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.tabsRow}>
          {Object.keys(recordsByTab).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabItem, active && { borderBottomColor: primary }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, active && { color: primary }]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>Date Range</Text>
            <Ionicons name="chevron-down" size={14} color="#3c4a3c" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterText}>Search</Text>
            <Ionicons name="chevron-down" size={14} color="#3c4a3c" />
          </TouchableOpacity>
        </View>

        {records.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View>
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historySubtitle}>{item.date}</Text>
              <Text style={styles.historyMeta}>{`${item.channel} • ${item.activity}`}</Text>
            </View>
            <Text style={[styles.historyAmount, { color: secondary }]}>{item.amount}</Text>
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginTop: 12,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9aa59a",
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3c4a3c",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2ef",
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  historySubtitle: {
    fontSize: 12,
    color: "#7a837a",
    marginTop: 2,
  },
  historyMeta: {
    fontSize: 12,
    color: "#5c6a5c",
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
});
