import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function ReportsScreen() {
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/reports")}>
            <Ionicons name="document-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Financial Transparency Header */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Transparency</Text>
          <Text style={styles.sectionSubtitle}>
            View how your contributions support church activities.
          </Text>
        </View>

        {/* Contribution Cards */}
        <View style={styles.cardsSection}>
          {/* Total Contributions */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#f5e6d3" }]}>
              <View style={styles.churchImagePlaceholder}>
                  <Ionicons name="storefront" size={40} color={secondary} />
                </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Total Contributions</Text>
              <Text style={styles.cardSubLabel}>(My Giving)</Text>
              <Text style={[styles.cardAmount, { color: secondary }]}>₱2,500</Text>
            </View>
          </View>

          {/* Total Church Funds */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#fffaf0" }]}>
              <View style={styles.churchImagePlaceholder}>
                <Ionicons name="business" size={40} color={primary} />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Total Church Funds</Text>
              <Text style={styles.cardSubLabel}>Collected</Text>
              <Text style={[styles.cardAmount, { color: primary }]}>₱12,500</Text>
            </View>
          </View>

          {/* Special Projects */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#e8f4e8" }]}>
              <View style={styles.churchImagePlaceholder}>
                <Ionicons name="construct" size={40} color="#28a745" />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Special Projects</Text>
              <Text style={styles.cardSubLabel}>Spent</Text>
              <Text style={[styles.cardAmount, { color: "#28a745" }]}>₱4,200</Text>
            </View>
          </View>
        </View>

        {/* Report Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Categories</Text>
          
          <TouchableOpacity style={styles.reportItem}>
            <View style={styles.reportIcon}>
              <Ionicons name="document-text" size={24} color={primary} />
            </View>
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Church Financial Reports</Text>
              <Text style={styles.reportDescription}>Detailed breakdown of all church finances</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportItem}>
            <View style={styles.reportIcon}>
              <Ionicons name="calendar" size={24} color={primary} />
            </View>
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Annual Financial Summary</Text>
              <Text style={styles.reportDescription}>Year-end financial performance and impact</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <MemberNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  cardsSection: {
    marginVertical: 12,
  },
  cardItem: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardImage: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  churchImagePlaceholder: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 2,
  },
  cardSubLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 12,
    color: "#999",
  },
});
