import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

const isHttpUrl = (s?: string | null) => !!s && /^https?:\/\//i.test(s);

export default function ViewMinistryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const bmId = Number(params?.bmId || 0);

  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ministry, setMinistry] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

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

        let acts: any[] = [];
        let mergedMembers: any[] = [];

        const { data: rpcActs, error: rpcActsErr } = await supabase.rpc(
          "rpc_member_ministry_activities",
          { p_branch_ministry_id: bmId },
        );
        if (!rpcActsErr && Array.isArray(rpcActs)) {
          acts = rpcActs;
        } else {
          const selectActivities = `
            activity_id, branch_ministry_id, title, description, location, planned_start, planned_end, status, head_auth_user_id, created_at,
            event:events(title, start_datetime, end_datetime, location),
            series:event_series(title, starts_on, ends_on, start_time, end_time, location)
          `;

          const { data: directActs, error: aErr } = await supabase
            .from("ministry_activities")
            .select(selectActivities)
            .eq("branch_ministry_id", bmId)
            .neq("status", "Draft")
            .order("planned_start", { ascending: true });
          if (aErr) throw aErr;

          const { data: aud, error: audErr } = await supabase
            .from("ministry_activity_audiences")
            .select("activity_id")
            .eq("branch_ministry_id", bmId);
          if (audErr) throw audErr;

          let audienceActs: any[] = [];
          const activityIds = Array.from(
            new Set((aud ?? []).map((x: any) => x.activity_id)),
          ).filter(Boolean);
          if (activityIds.length > 0) {
            const { data: audActs, error: audActsErr } = await supabase
              .from("ministry_activities")
              .select(selectActivities)
              .in("activity_id", activityIds)
              .neq("status", "Draft")
              .order("planned_start", { ascending: true });
            if (audActsErr) throw audActsErr;
            audienceActs = audActs ?? [];
          }

          const actsMap = new Map<number, any>();
          [...(directActs ?? []), ...(audienceActs ?? [])].forEach((a: any) => {
            if (a?.activity_id != null) actsMap.set(a.activity_id, a);
          });
          acts = Array.from(actsMap.values());
          acts.sort(
            (x: any, y: any) =>
              new Date(x?.planned_start || 0).getTime() -
              new Date(y?.planned_start || 0).getTime(),
          );
        }

        const { data: rpcMembers, error: rpcMembersErr } = await supabase.rpc(
          "rpc_member_ministry_members",
          { p_branch_ministry_id: bmId },
        );
        if (!rpcMembersErr && Array.isArray(rpcMembers)) {
          mergedMembers = rpcMembers;
        } else {
          const { data: memRows, error: memErr } = await supabase
            .from("user_ministries")
            .select("auth_user_id, role, status, user:users(user_id, users_details_id)")
            .eq("branch_ministry_id", bmId)
            .eq("status", "Active");
          if (memErr) throw memErr;

          mergedMembers = memRows ?? [];
          const detailIds = (memRows ?? [])
            .map((m: any) =>
              Array.isArray(m.user) ? m.user?.[0]?.users_details_id : m.user?.users_details_id,
            )
            .filter(Boolean);

          if (detailIds.length > 0) {
            const { data: profiles, error: profErr } = await supabase
              .from("users_details")
              .select("user_details_id, first_name, middle_name, last_name, suffix, photo_path")
              .in("user_details_id", detailIds);
            if (profErr) throw profErr;

            const profileMap = new Map(
              (profiles ?? []).map((p: any) => [p.user_details_id, p]),
            );
            mergedMembers = (memRows ?? []).map((m: any) => {
              const udId = Array.isArray(m.user)
                ? m.user?.[0]?.users_details_id
                : m.user?.users_details_id;
              return {
                ...m,
                profile: profileMap.get(udId) || null,
              };
            });
          }
        }

        const normalizedMembers = (mergedMembers || []).map((m: any) => {
          if (m?.profile) return m;
          const profile = {
            first_name: m.first_name,
            middle_name: m.middle_name,
            last_name: m.last_name,
            suffix: m.suffix,
            photo_path: m.photo_path,
          };
          return { ...m, profile };
        });

        if (!cancelled) {
          setMinistry(bm);
          setActivities(acts || []);
          setMembers(normalizedMembers);
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
          onPress={() => router.replace("/Member-User/ministry")}
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
              <Text style={styles.sectionTitle}>Members</Text>
              {members.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No members found for this ministry.
                </Text>
              ) : (
                members.map((m: any) => {
                  const p = m.profile || {};
                  const fullName = [
                    p.first_name,
                    p.middle_name,
                    p.last_name,
                    p.suffix,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const avatarUrl = p.photo_path
                    ? isHttpUrl(p.photo_path)
                      ? p.photo_path
                      : supabase.storage
                          .from("profile_pics")
                          .getPublicUrl(p.photo_path).data.publicUrl
                    : null;
                  return (
                    <View key={m.auth_user_id} style={styles.memberRow}>
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.memberAvatar}
                        />
                      ) : (
                        <View style={styles.memberAvatar} />
                      )}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {fullName || "Member"}
                        </Text>
                        {m.role ? (
                          <Text style={styles.memberMeta}>{m.role}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {activities.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No activities yet for this ministry.
                </Text>
              ) : (
                activities.map((a) => {
                  const start =
                    a.planned_start ||
                    a.event?.start_datetime ||
                    a.series?.starts_on ||
                    null;
                  const end =
                    a.planned_end ||
                    a.event?.end_datetime ||
                    a.series?.ends_on ||
                    null;
                  const location =
                    a.location || a.event?.location || a.series?.location;
                  return (
                    <View key={a.activity_id} style={styles.activityCard}>
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {a.title || a.event?.title || a.series?.title || "Activity"}
                      </Text>
                      <Text style={{ color: "#666", marginTop: 4 }}>
                        {fmtDateTime(start)} - {fmtDateTime(end)}
                      </Text>
                      {location ? (
                        <Text style={{ color: "#666", marginTop: 4 }}>
                          {location}
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e6e9e6",
    marginBottom: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e9eeeb",
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
  },
  memberMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b6b6b",
  },
});
