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

export default function FamilyScreen() {
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

  // Sample family members data
  const familyMembers = [
    { id: 1, name: "Maria Grace Doe", relationship: "Spouse", status: "Active Member", joinDate: "2020-03-15" },
    { id: 2, name: "James Doe Jr.", relationship: "Son", status: "Youth Group", joinDate: "2022-01-10" },
    { id: 3, name: "Sarah Doe", relationship: "Daughter", status: "Children's Ministry", joinDate: "2021-06-20" },
    { id: 4, name: "Robert Doe Sr.", relationship: "Father", status: "Active Member", joinDate: "2015-07-05" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>Family Members</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/family")}>
            <Ionicons name="people-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Family</Text>
          <Text style={styles.sectionSubtitle}>
            View and manage family members in your household
          </Text>
        </View>

        {/* Family Members List */}
        <View style={styles.section}>
          {familyMembers.map((member) => (
            <View key={member.id} style={[styles.familyCard, { borderLeftColor: secondary }]}>
              <View style={styles.memberCardContent}>
                <View style={[styles.memberAvatar, { backgroundColor: `${secondary}15` }]}>
                  <Ionicons name="person-circle" size={48} color={secondary} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRelationship}>{member.relationship}</Text>
                  <Text style={styles.memberStatus}>{member.status}</Text>
                  <Text style={styles.memberJoinDate}>Member since {member.joinDate}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Add Family Member CTA */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.addMemberBtn, { backgroundColor: secondary }]}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addMemberBtnText}>Add Family Member</Text>
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  familyCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberCardContent: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  memberRelationship: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  memberStatus: {
    fontSize: 12,
    color: "#4d5a4d",
  },
  memberJoinDate: {
    fontSize: 11,
    color: "#999",
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMemberBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
