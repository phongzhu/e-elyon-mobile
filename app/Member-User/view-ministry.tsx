import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

const fmtDateTime = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export default function ViewMinistryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const bmId = Number(params?.bmId || 0);

  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ministry, setMinistry] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ui_settings").select("*").single();
      if (data) setBranding(data);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        if (!bmId) throw new Error("Missing ministry id.");

        const { data: bm, error: bmErr } = await supabase
          .from("branch_ministries")
          .select(
            "branch_ministry_id, ministries(id, name, description), branches(name)",
          )
          .eq("branch_ministry_id", bmId)
          .single();
        if (bmErr) throw bmErr;

        const { data: acts, error: aErr } = await supabase
          .from("ministry_activities")
          .select(
            "activity_id, branch_ministry_id, title, description, location, planned_start, planned_end, status, head_auth_user_id, created_at",
          )
          .eq("branch_ministry_id", bmId)
          .eq("status", "Published")
          .order("planned_start", { ascending: true });
        if (aErr) throw aErr;

        if (!cancelled) {
          setMinistry(bm);
          setActivities(acts || []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load ministry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bmId]);

  const primary = branding?.primary_color || "#064622";

  const ministryName = ministry?.ministries?.name || "Ministry";
  const ministryDesc = ministry?.ministries?.description || "";
  const branchName = ministry?.branches?.name || "";

  return (
    <View style={{ flex: 1, backgroundColor: "#f7f9f7" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ministry</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: "#666", textAlign: "center" }}>
              Loading ministry...
            </Text>
          </View>
        ) : err ? (
          <View style={{ paddingVertical: 16 }}>
            <Text style={{ color: "crimson", fontWeight: "700" }}>{err}</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.title}>{ministryName}</Text>
              {branchName ? (
                <Text style={{ color: "#666", marginTop: 4 }}>
                  {branchName}
                </Text>
              ) : null}
              {ministryDesc ? (
                <Text style={{ color: "#555", marginTop: 8 }}>
                  {ministryDesc}
                </Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {activities.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No activities yet for this ministry.
                </Text>
              ) : (
                activities.map((a) => {
                  return (
                    <View key={a.activity_id} style={styles.activityCard}>
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {a.title}
                      </Text>
                      <Text style={{ color: "#666", marginTop: 4 }}>
                        {fmtDateTime(a.planned_start)} -{" "}
                        {fmtDateTime(a.planned_end)}
                      </Text>
                      {a.location ? (
                        <Text style={{ color: "#666", marginTop: 4 }}>
                          {a.location}
                        </Text>
                      ) : null}
                      {a.description ? (
                        <Text style={{ color: "#444", marginTop: 8 }}>
                          {a.description}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  headerSpacer: { width: 32, height: 32 },
  iconButton: { padding: 8 },
  container: { flex: 1, paddingHorizontal: 16 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e6e9e6",
  },
  title: { fontSize: 18, fontWeight: "900", color: "#111" },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    color: "#111",
  },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e6e9e6",
    marginBottom: 12,
  },
});
