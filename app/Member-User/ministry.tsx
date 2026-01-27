import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

type Branch = {
  branch_id: number;
  name: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
};

type BranchMinistryRow = {
  branch_ministry_id: number;
  branch_id: number;
  ministry_id: number;
  is_active: boolean | null;
  ministries: {
    id: number;
    name: string;
    description: string | null;
    min_age: number | null;
    max_age: number | null;
  } | null;
};

type JoinedMinistryRow = {
  user_ministry_id: number;
  user_id: number;
  branch_ministry_id: number;
  role: string | null;
  status: string | null;
  is_primary: boolean | null;
  branch_ministries?: {
    branch_ministry_id: number;
    ministries?: {
      id: number;
      name: string;
      description: string | null;
    } | null;
  } | null;
};

function safeText(v: any, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function formatBranchAddress(b?: Branch | null) {
  if (!b) return "";
  const parts = [b.street, b.barangay, b.city, b.province]
    .map((x) => safeText(x, ""))
    .filter(Boolean);
  return parts.join(", ");
}

export default function MinistryScreen() {
  const [branding, setBranding] = useState<any>(null);

  // auth + user
  const [memberUserId, setMemberUserId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);

  // branch + ministries
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branchMinistries, setBranchMinistries] = useState<BranchMinistryRow[]>(
    [],
  );
  const [joinedMinistries, setJoinedMinistries] = useState<JoinedMinistryRow[]>(
    [],
  );

  // UI state
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingMinistries, setLoadingMinistries] = useState(false);
  const [err, setErr] = useState("");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedMinistry, setSelectedMinistry] =
    useState<BranchMinistryRow | null>(null);
  const [availability, setAvailability] = useState("");
  const [note, setNote] = useState("");

  // Notifications UI (still placeholder — can wire later)
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (!error) setBranding(data);
    })();
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  // 1) Boot: auth + resolve user's Member row + branch_id
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingBoot(true);
      setErr("");

      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const uid = authRes?.user?.id;
        if (!uid) throw new Error("No authenticated user.");
        if (cancelled) return;

        // Pick ONE active Member row
        const { data: uRows, error: uErr } = await supabase
          .from("users")
          .select(
            `
            user_id,
            role,
            is_active,
            auth_user_id,
            user_details:users_details(branch_id)
          `,
          )
          .eq("auth_user_id", uid)
          .eq("is_active", true)
          .ilike("role", "Member")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (uErr) throw uErr;

        const row: any = uRows?.[0];
        if (!row?.user_id) throw new Error("No active Member user row found.");

        const bId = Array.isArray(row?.user_details)
          ? row?.user_details?.[0]?.branch_id
          : row?.user_details?.branch_id;

        if (cancelled) return;
        setMemberUserId(Number(row.user_id));
        setBranchId(bId ? Number(bId) : null);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load user.");
      } finally {
        if (!cancelled) setLoadingBoot(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Fetch branch info + available ministries + my ministries
  const fetchBranchAndMinistries = useCallback(async () => {
    if (!branchId || !memberUserId) return;

    setLoadingMinistries(true);
    setErr("");

    try {
      // branch
      const { data: b, error: bErr } = await supabase
        .from("branches")
        .select("branch_id, name, street, barangay, city, province")
        .eq("branch_id", branchId)
        .single();

      if (bErr) throw bErr;
      setBranch(b as any);

      // ministries available in this branch
      const { data: bm, error: bmErr } = await supabase
        .from("branch_ministries")
        .select(
          `
          branch_ministry_id,
          branch_id,
          ministry_id,
          is_active,
          ministries:ministries(id, name, description, min_age, max_age)
        `,
        )
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (bmErr) throw bmErr;

      setBranchMinistries((bm ?? []) as any);

      // my joined ministries (Active/Pending/etc.)
      const { data: jm, error: jmErr } = await supabase
        .from("user_ministries")
        .select(
          `
          user_ministry_id,
          user_id,
          branch_ministry_id,
          role,
          status,
          is_primary,
          branch_ministries:branch_ministries(
            branch_ministry_id,
            ministries:ministries(id, name, description)
          )
        `,
        )
        .eq("user_id", memberUserId)
        .order("assigned_at", { ascending: false });

      if (jmErr) throw jmErr;

      setJoinedMinistries((jm ?? []) as any);
    } catch (e: any) {
      setErr(e?.message || "Failed to load ministries.");
    } finally {
      setLoadingMinistries(false);
    }
  }, [branchId, memberUserId]);

  useEffect(() => {
    if (branchId && memberUserId) {
      void fetchBranchAndMinistries();
    }
  }, [branchId, memberUserId, fetchBranchAndMinistries]);

  // Helpers
  const joinedByBranchMinistryId = useMemo(() => {
    const m = new Map<number, JoinedMinistryRow>();
    joinedMinistries.forEach((j) => m.set(Number(j.branch_ministry_id), j));
    return m;
  }, [joinedMinistries]);

  // 3) Join action
  const joinSelected = useCallback(async () => {
    try {
      if (!memberUserId) throw new Error("Missing user.");
      if (!selectedMinistry?.branch_ministry_id)
        throw new Error("No ministry selected.");

      const existing = joinedByBranchMinistryId.get(
        Number(selectedMinistry.branch_ministry_id),
      );
      if (existing) {
        throw new Error(
          `Already ${safeText(existing.status, "joined")} in this ministry.`,
        );
      }

      const { error } = await supabase.from("user_ministries").insert({
        user_id: memberUserId,
        branch_ministry_id: selectedMinistry.branch_ministry_id,
        role: null,
        status: "Pending", // change to "Active" if you want instant join
        is_primary: false,
      });

      if (error) throw error;

      setShowJoinModal(false);
      setSelectedMinistry(null);
      setAvailability("");
      setNote("");

      await fetchBranchAndMinistries();
    } catch (e: any) {
      setErr(e?.message || "Failed to join ministry.");
    }
  }, [
    memberUserId,
    selectedMinistry,
    joinedByBranchMinistryId,
    fetchBranchAndMinistries,
  ]);

  const openJoinModal = (item: BranchMinistryRow) => {
    setSelectedMinistry(item);
    setShowJoinModal(true);
  };

  // ---- UI ----
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Ministry</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowNotifications(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/Member-User/profile")}
          >
            <Ionicons name="person-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {loadingBoot ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: "#666", textAlign: "center" }}>
              Loading your account…
            </Text>
          </View>
        ) : err ? (
          <View style={{ paddingVertical: 16 }}>
            <Text style={{ color: "crimson", fontWeight: "700" }}>{err}</Text>
          </View>
        ) : (
          <>
            {/* Branch */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Branch</Text>

              {!branchId ? (
                <Text style={{ color: "#666" }}>
                  No branch assigned to your profile yet.
                </Text>
              ) : loadingMinistries ? (
                <ActivityIndicator />
              ) : branch ? (
                <View
                  style={[styles.branchCard, { borderColor: `${primary}20` }]}
                >
                  <Text style={[styles.branchName, { color: primary }]}>
                    {branch.name}
                  </Text>
                  <Text style={styles.branchAddress}>
                    {formatBranchAddress(branch)}
                  </Text>
                  <Text style={styles.branchMeta}>
                    Branch ID: {branch.branch_id}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: "#666" }}>Branch not found.</Text>
              )}
            </View>

            {/* My Ministries */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Ministries</Text>

              {loadingMinistries ? (
                <ActivityIndicator />
              ) : joinedMinistries.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  You have no ministries yet. Join one below.
                </Text>
              ) : (
                joinedMinistries.map((j) => {
                  const name =
                    j.branch_ministries?.ministries?.name || "Ministry";
                  const status = safeText(j.status, "Active");
                  return (
                    <View
                      key={j.user_ministry_id}
                      style={[
                        styles.myMinistryPill,
                        { borderColor: `${secondary}40` },
                      ]}
                    >
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {name}
                      </Text>
                      <Text style={{ color: "#666", marginTop: 2 }}>
                        {status}
                        {j.is_primary ? " • Primary" : ""}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Join a Ministry (from this branch only) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Join a Ministry</Text>

              {loadingMinistries ? (
                <ActivityIndicator />
              ) : branchMinistries.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No ministries available for your branch yet.
                </Text>
              ) : (
                <FlatList
                  data={branchMinistries}
                  keyExtractor={(item) => String(item.branch_ministry_id)}
                  scrollEnabled={false}
                  renderItem={({ item }) => {
                    const m = item.ministries;
                    if (!m) return null;

                    const existing = joinedByBranchMinistryId.get(
                      Number(item.branch_ministry_id),
                    );
                    const disabled = !!existing;
                    const statusLabel = existing
                      ? safeText(existing.status, "Joined")
                      : "";

                    return (
                      <View style={styles.ministryCard}>
                        <View style={styles.ministryContent}>
                          <View style={styles.ministryHeader}>
                            <View
                              style={[
                                styles.ministryAvatar,
                                { backgroundColor: `${secondary}18` },
                              ]}
                            >
                              <Ionicons
                                name="people"
                                size={20}
                                color={secondary}
                              />
                            </View>

                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.ministryName}>{m.name}</Text>
                              <Text style={styles.ministryDescription}>
                                {safeText(m.description, "—")}
                              </Text>

                              {statusLabel ? (
                                <Text
                                  style={{
                                    marginTop: 6,
                                    fontSize: 12,
                                    color: secondary,
                                    fontWeight: "800",
                                  }}
                                >
                                  {statusLabel}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.ministryFooter}>
                            <TouchableOpacity
                              style={[
                                styles.joinBtn,
                                {
                                  backgroundColor: disabled
                                    ? "#cfd6cf"
                                    : secondary,
                                },
                              ]}
                              disabled={disabled}
                              onPress={() => openJoinModal(item)}
                            >
                              <Text style={styles.joinBtnText}>
                                {disabled ? "Joined" : "Join"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Join Ministry</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
              {selectedMinistry?.ministries?.name}
            </Text>
            <Text style={{ color: "#666", marginBottom: 12 }}>
              {safeText(selectedMinistry?.ministries?.description, "—")}
            </Text>

            <Text style={styles.fieldLabel}>Availability</Text>
            <TextInput
              placeholder="e.g. Sundays 8-12, Wednesdays 6-9"
              placeholderTextColor="#8a938a"
              value={availability}
              onChangeText={setAvailability}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Notes / Skills</Text>
            <TextInput
              placeholder="Share your skills, preferences, or constraints"
              placeholderTextColor="#8a938a"
              value={note}
              onChangeText={setNote}
              style={[styles.input, { height: 90 }]}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.primaryCta,
                { backgroundColor: primary, marginTop: 12 },
              ]}
              onPress={joinSelected}
            >
              <Text style={styles.primaryCtaText}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryCta, { marginTop: 8 }]}
              onPress={() => setShowJoinModal(false)}
            >
              <Text style={styles.secondaryCtaText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications modal left as-is for now */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationsModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#666" }}>
              Wire this to your real notifications table later.
            </Text>
          </View>
        </View>
      </Modal>

      <MemberNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { width: 40, height: 40, borderRadius: 20 },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { padding: 8 },
  container: { flex: 1, paddingHorizontal: 16 },

  section: { marginVertical: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },

  branchCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fff",
  },
  branchName: { fontSize: 16, fontWeight: "900" },
  branchAddress: { marginTop: 4, color: "#666" },
  branchMeta: { marginTop: 8, color: "#999", fontSize: 12 },

  myMinistryPill: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },

  ministryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    elevation: 1,
  },
  ministryContent: { gap: 10 },
  ministryHeader: { flexDirection: "row", alignItems: "flex-start" },
  ministryAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ministryName: { fontSize: 16, fontWeight: "800", color: "#111" },
  ministryDescription: { fontSize: 13, color: "#666", marginTop: 4 },
  ministryFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  joinBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  joinBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  requestModalContent: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestTitle: { fontSize: 16, fontWeight: "800", color: "#111" },

  fieldLabel: {
    fontSize: 12,
    color: "#4c5b4c",
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#f7faf7",
    color: "#111",
  },

  primaryCta: { paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  primaryCtaText: { color: "#fff", fontWeight: "900" },

  secondaryCta: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  secondaryCtaText: { color: "#333", fontWeight: "900" },

  notificationsModalContent: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
});
