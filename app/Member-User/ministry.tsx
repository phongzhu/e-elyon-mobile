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

type MinistryRequirementRow = {
  requirement_id: number;
  branch_ministry_id: number;
  requirement_type: string;
  title: string | null;
  config: any;
  is_active: boolean | null;
  sort_order: number | null;
  is_required: boolean | null;
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
  // "Your Ministries" (accepted memberships)
  const [yourMinistries, setYourMinistries] = useState<any[]>([]);
  // "My Applications" (all applications)
  const [myApplications, setMyApplications] = useState<any[]>([]);

  // UI state
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingMinistries, setLoadingMinistries] = useState(false);
  const [err, setErr] = useState("");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedMinistry, setSelectedMinistry] =
    useState<BranchMinistryRow | null>(null);

  // ministry application flow
  const [requirements, setRequirements] = useState<MinistryRequirementRow[]>(
    [],
  );
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState("");

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

  // Fetch branch, ministries, memberships, and applications
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
          `branch_ministry_id, branch_id, ministry_id, is_active, ministries:ministries(id, name, description, min_age, max_age)`,
        )
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (bmErr) throw bmErr;
      setBranchMinistries((bm ?? []) as any);

      // Get user id safely
      const { data: authUser } = await supabase.auth.getUser();
      const userId = authUser?.user?.id;
      if (!userId) throw new Error("No authenticated user.");

      // 1️⃣ Fetch "Your Ministries" (accepted memberships)
      const { data: ym, error: ymErr } = await supabase
        .from("user_ministries")
        .select(
          `user_ministry_id, role, status, assigned_at, branch_ministry:branch_ministries(branch_ministry_id, ministry:ministries(id, name, description), branch:branches(branch_id, name))`,
        )
        .eq("auth_user_id", userId)
        .eq("status", "Active");
      if (ymErr) throw ymErr;
      setYourMinistries(ym ?? []);

      // 2️⃣ Fetch "My Applications" (all statuses)
      const { data: apps, error: appsErr } = await supabase
        .from("ministry_applications")
        .select(
          `application_id, status, submitted_at, reviewer_notes, branch_ministry:branch_ministries(branch_ministry_id, ministry:ministries(id, name), branch:branches(branch_id, name))`,
        )
        .eq("applicant_auth_user_id", userId)
        .order("created_at", { ascending: false });
      if (appsErr) throw appsErr;
      setMyApplications(apps ?? []);
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

  // Map for quick lookup: branch_ministry_id → membership
  const yourMinistryMap = useMemo(() => {
    const m = new Map<number, any>();
    yourMinistries.forEach((j) => {
      const bmId = j.branch_ministry?.branch_ministry_id;
      if (bmId) m.set(Number(bmId), j);
    });
    return m;
  }, [yourMinistries]);

  // Map for quick lookup: branch_ministry_id → latest application
  const applicationMap = useMemo(() => {
    const m = new Map<number, any>();
    myApplications.forEach((a) => {
      const bmId = a.branch_ministry?.branch_ministry_id;
      if (
        bmId &&
        (!m.has(bmId) ||
          new Date(a.submitted_at || 0) >
            new Date(m.get(bmId)?.submitted_at || 0))
      ) {
        m.set(Number(bmId), a);
      }
    });
    return m;
  }, [myApplications]);

  // Updated openJoinModal: prevent duplicate applications, follow new rules
  const openJoinModal = useCallback(async (item: BranchMinistryRow) => {
    try {
      setErr("");
      setRejectedNotice("");
      setSelectedMinistry(item);

      // 1) Check membership
      const { data: auth } = await supabase.auth.getUser();
      const authUid = auth?.user?.id;
      if (!authUid) throw new Error("No authenticated user.");
      const { data: member } = await supabase
        .from("user_ministries")
        .select("user_ministry_id")
        .eq("auth_user_id", authUid)
        .eq("branch_ministry_id", item.branch_ministry_id)
        .eq("status", "Active")
        .maybeSingle();
      if (member) {
        setErr("You are already a member of this ministry.");
        return;
      }

      // 2) Check for active application
      const { data: app } = await supabase
        .from("ministry_applications")
        .select("application_id, status")
        .eq("applicant_auth_user_id", authUid)
        .eq("branch_ministry_id", item.branch_ministry_id)
        .in("status", ["Draft", "Submitted", "UnderReview"])
        .maybeSingle();
      if (app) {
        setErr(
          `You already have an application in progress (Status: ${app.status}).`,
        );
        return;
      }

      // 3) Fetch requirements
      const { data: reqs, error: rErr } = await supabase
        .from("ministry_requirements")
        .select("*")
        .eq("branch_ministry_id", item.branch_ministry_id)
        .eq("is_active", true)
        .order("sort_order");
      if (rErr) throw rErr;

      // 4) Create new application (always new, since no active one)
      const { data: created, error: aErr } = await supabase
        .from("ministry_applications")
        .insert({
          branch_ministry_id: item.branch_ministry_id,
          applicant_auth_user_id: authUid,
          status: "Draft",
        })
        .select("application_id")
        .single();
      if (aErr) throw aErr;
      const appId = Number(created.application_id);

      setRequirements((reqs ?? []) as any as MinistryRequirementRow[]);
      setApplicationId(appId);
      setAnswers({});
      setShowJoinModal(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to start application.");
    }
  }, []);

  const submitApplication = useCallback(async () => {
    try {
      if (!applicationId) throw new Error("Missing application.");

      setSubmitting(true);
      setErr("");

      // Validate (client-side) before submitting
      for (const r of requirements) {
        const cfg = r.config || {};
        const a = answers[r.requirement_id];
        const title = safeText(r.title, "Requirement");

        // TEXT ACK VALIDATION
        if (r.requirement_type === "text_ack") {
          const mustCheck =
            r.is_required !== false && (cfg?.require_checkbox ?? true);
          if (mustCheck && !a?.accepted) {
            throw new Error(`Please agree to: ${title}`);
          }
        }

        if (r.requirement_type === "availability") {
          const allowed =
            Array.isArray(cfg.allowed_days) && cfg.allowed_days.length > 0
              ? cfg.allowed_days
              : [];
          const days = Array.isArray(a?.days) ? a.days : [];
          if (days.length === 0) {
            throw new Error(`Select at least one day: ${title}`);
          }
          if (
            allowed.length > 0 &&
            days.some((d: any) => !allowed.includes(d))
          ) {
            throw new Error(`Selected day not allowed in: ${title}`);
          }

          const minHours = Number(cfg.min_hours_per_week || 0);
          const hrs = Number(a?.hours_per_week || 0);
          if (Number.isNaN(hrs)) {
            throw new Error(`Enter valid hours per week: ${title}`);
          }
          if (hrs < minHours) {
            throw new Error(`Minimum ${minHours} hour(s) required: ${title}`);
          }
        }
      }

      // 1) Save answers
      for (const r of requirements) {
        const raw = answers[r.requirement_id] || {};
        const cfg = r.config || {};
        let answerToSave: any = raw;

        // Normalize text_ack so it never saves {}
        if (r.requirement_type === "text_ack") {
          const accepted = !!raw?.accepted;
          answerToSave = {
            accepted,
            accepted_at: accepted ? new Date().toISOString() : null,
          };
        }

        // Normalize availability to structured JSON
        if (r.requirement_type === "availability") {
          const allowed =
            Array.isArray(cfg.allowed_days) && cfg.allowed_days.length > 0
              ? cfg.allowed_days
              : null;
          const days = Array.isArray(raw?.days) ? raw.days : [];
          answerToSave = {
            days: allowed ? days.filter((d: any) => allowed.includes(d)) : days,
            hours_per_week: Number(raw?.hours_per_week || 0),
            notes: safeText(raw?.notes, ""),
          };
        }

        const { data, error: upErr } = await supabase
          .from("ministry_application_answers")
          .upsert(
            {
              application_id: applicationId,
              requirement_id: r.requirement_id,
              answer: answerToSave,
            },
            { onConflict: "application_id,requirement_id" },
          )
          .select();

        if (upErr) {
          console.log("UPSERT ERROR:", upErr);
          throw upErr;
        }
        console.log("UPSERT OK:", data);
      }

      // 2) Mark application submitted
      const { error: subErr } = await supabase
        .from("ministry_applications")
        .update({
          status: "Submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("application_id", applicationId);

      if (subErr) throw subErr;

      setShowJoinModal(false);
      setSelectedMinistry(null);
      setRequirements([]);
      setApplicationId(null);
      setAnswers({});

      await fetchBranchAndMinistries();
    } catch (e: any) {
      setErr(e?.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  }, [applicationId, requirements, answers, fetchBranchAndMinistries]);

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

            {/* Your Ministries */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Ministries</Text>
              {loadingMinistries ? (
                <ActivityIndicator />
              ) : yourMinistries.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  You have no ministries yet. Join one below.
                </Text>
              ) : (
                yourMinistries.map((j) => {
                  const ministry = j.branch_ministry?.ministry;
                  const branch = j.branch_ministry?.branch;
                  const name = ministry?.name || "Ministry";
                  const branchName = branch?.name ? ` – ${branch.name}` : "";
                  return (
                    <TouchableOpacity
                      key={j.user_ministry_id}
                      style={[
                        styles.myMinistryPill,
                        { borderColor: `${secondary}40` },
                      ]}
                      onPress={() => {
                        // TODO: Navigate to ministry details screen
                        // router.push(`/Member-User/ministry-details/${j.branch_ministry?.branch_ministry_id}`);
                        setErr("Ministry details screen coming soon.");
                      }}
                    >
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {name}
                        {branchName}
                      </Text>
                      <Text style={{ color: "#666", marginTop: 2 }}>
                        Active
                        {j.is_primary ? " • Primary" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* My Applications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Applications</Text>
              {loadingMinistries ? (
                <ActivityIndicator />
              ) : myApplications.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  You have not applied to any ministries yet.
                </Text>
              ) : (
                myApplications.map((a) => {
                  const ministry = a.branch_ministry?.ministry;
                  const branch = a.branch_ministry?.branch;
                  const name = ministry?.name || "Ministry";
                  const branchName = branch?.name ? ` – ${branch.name}` : "";
                  const status = safeText(a.status, "");
                  const submitted = a.submitted_at
                    ? new Date(a.submitted_at).toLocaleDateString()
                    : "";
                  const isApproved = status.toLowerCase() === "approved";
                  const isRejected = status.toLowerCase() === "rejected";
                  return (
                    <View
                      key={a.application_id}
                      style={[
                        styles.myMinistryPill,
                        {
                          borderColor: isApproved
                            ? "#4ade80"
                            : isRejected
                              ? "#fecaca"
                              : `${secondary}40`,
                          backgroundColor: isRejected ? "#fef2f2" : "#fff",
                        },
                      ]}
                    >
                      <Text style={{ fontWeight: "800", color: "#111" }}>
                        {name}
                        {branchName}
                      </Text>
                      <Text
                        style={{
                          color: isApproved
                            ? "#166534"
                            : isRejected
                              ? "#b91c1c"
                              : "#666",
                          marginTop: 2,
                          fontWeight: "700",
                        }}
                      >
                        {status}
                        {submitted ? ` • ${submitted}` : ""}
                      </Text>
                      {isRejected && a.reviewer_notes ? (
                        <Text
                          style={{
                            color: "#b91c1c",
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          Reason: {a.reviewer_notes}
                        </Text>
                      ) : null}
                      {isApproved ? (
                        <TouchableOpacity
                          style={{
                            marginTop: 8,
                            backgroundColor: secondary,
                            borderRadius: 8,
                            paddingVertical: 8,
                            alignItems: "center",
                          }}
                          onPress={() => {
                            // TODO: Navigate to ministry details screen
                            setErr("Ministry details screen coming soon.");
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "900" }}>
                            Go to Ministry
                          </Text>
                        </TouchableOpacity>
                      ) : null}
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
                    const bmId = item.branch_ministry_id;
                    const membership = yourMinistryMap.get(Number(bmId));
                    const application = applicationMap.get(Number(bmId));
                    let statusLabel = "";
                    let disabled = false;
                    let buttonText = "Apply";
                    if (membership) {
                      statusLabel = "You are already a member";
                      disabled = true;
                      buttonText = "Joined";
                    } else if (application) {
                      const status = safeText(application.status, "");
                      statusLabel = `Application: ${status}`;
                      disabled = ["Draft", "Submitted", "UnderReview"].includes(
                        status,
                      );
                      buttonText = disabled ? statusLabel : "Apply Again";
                    }
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
                              onPress={() => void openJoinModal(item)}
                            >
                              <Text style={styles.joinBtnText}>
                                {buttonText}
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
              <Text style={styles.requestTitle}>Apply to Ministry</Text>
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
            {rejectedNotice ? (
              <View style={styles.rejectedNotice}>
                <Ionicons name="alert-circle" size={18} color="#b91c1c" />
                <Text style={styles.rejectedNoticeText}>{rejectedNotice}</Text>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 340 }}>
              {requirements.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No requirements found. You can submit your application.
                </Text>
              ) : null}

              {requirements.map((r) => {
                const cfg = r.config || {};
                const value = answers[r.requirement_id];
                const title = safeText(r.title, "Requirement");

                // TEXT ACK
                if (r.requirement_type === "text_ack") {
                  return (
                    <View key={r.requirement_id}>
                      <Text style={styles.fieldLabel}>{title}</Text>
                      <Text style={{ color: "#666", marginBottom: 8 }}>
                        {safeText(cfg?.ack_text, "")}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setAnswers((p) => {
                            const prev = !!p?.[r.requirement_id]?.accepted;
                            return {
                              ...p,
                              [r.requirement_id]: { accepted: !prev },
                            };
                          })
                        }
                      >
                        <Text>
                          {value?.accepted ? "☑ I agree" : "☐ I agree"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                // ASSET SELECT
                if (r.requirement_type === "asset_select") {
                  return (
                    <View key={r.requirement_id}>
                      <Text style={styles.fieldLabel}>{title}</Text>
                      {cfg?.options?.map((opt: string) => {
                        const selected = value?.selected || [];
                        const checked = selected.includes(opt);

                        return (
                          <TouchableOpacity
                            key={opt}
                            onPress={() => {
                              const next = checked
                                ? selected.filter((x: string) => x !== opt)
                                : [...selected, opt];

                              setAnswers((p) => ({
                                ...p,
                                [r.requirement_id]: { selected: next },
                              }));
                            }}
                          >
                            <Text>
                              {checked ? "☑" : "☐"} {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                }

                // AVAILABILITY
                if (r.requirement_type === "availability") {
                  const allowed =
                    Array.isArray(cfg.allowed_days) &&
                    cfg.allowed_days.length > 0
                      ? cfg.allowed_days
                      : [
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                          "Sunday",
                        ];

                  const minHours = Number(cfg.min_hours_per_week || 0);
                  const selectedDays: string[] = Array.isArray(value?.days)
                    ? value.days
                    : [];
                  const hours = value?.hours_per_week ?? "";

                  const toggleDay = (day: string) => {
                    const set = new Set(selectedDays);
                    if (set.has(day)) set.delete(day);
                    else set.add(day);

                    setAnswers((p) => ({
                      ...p,
                      [r.requirement_id]: {
                        ...(p[r.requirement_id] || {}),
                        days: Array.from(set),
                      },
                    }));
                  };

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 16 }}>
                      <Text style={styles.fieldLabel}>{title}</Text>

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          marginBottom: 6,
                          color: "#4c5b4c",
                        }}
                      >
                        Select available days
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        {allowed.map((day: string) => {
                          const checked = selectedDays.includes(day);
                          return (
                            <TouchableOpacity
                              key={day}
                              onPress={() => toggleDay(day)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: checked ? secondary : "#dfe4de",
                                backgroundColor: checked
                                  ? `${secondary}1f`
                                  : "#fff",
                              }}
                            >
                              <Text
                                style={{
                                  fontWeight: "800",
                                  color: "#111",
                                  fontSize: 12,
                                }}
                              >
                                {checked ? "✓ " : ""}
                                {day}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          marginBottom: 6,
                          color: "#4c5b4c",
                        }}
                      >
                        Hours per week {minHours > 0 ? `(min ${minHours})` : ""}
                      </Text>

                      <TextInput
                        keyboardType="numeric"
                        placeholder={
                          minHours > 0
                            ? `Enter at least ${minHours}`
                            : "Enter hours per week"
                        }
                        placeholderTextColor="#8a938a"
                        value={String(hours)}
                        onChangeText={(t) =>
                          setAnswers((p) => ({
                            ...p,
                            [r.requirement_id]: {
                              ...(p[r.requirement_id] || {}),
                              hours_per_week: t,
                            },
                          }))
                        }
                        style={styles.input}
                      />

                      <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
                        Notes (optional)
                      </Text>
                      <TextInput
                        placeholder="e.g., Morning only, after 6PM, etc."
                        placeholderTextColor="#8a938a"
                        value={value?.notes || ""}
                        onChangeText={(t) =>
                          setAnswers((p) => ({
                            ...p,
                            [r.requirement_id]: {
                              ...(p[r.requirement_id] || {}),
                              notes: t,
                            },
                          }))
                        }
                        style={[styles.input, { height: 80 }]}
                        multiline
                      />
                    </View>
                  );
                }

                return null;
              })}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.primaryCta,
                { backgroundColor: primary, marginTop: 12 },
              ]}
              onPress={submitApplication}
              disabled={submitting}
            >
              <Text style={styles.primaryCtaText}>
                {submitting ? "Submitting..." : "Submit Application"}
              </Text>
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
  rejectedNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    marginBottom: 12,
  },
  rejectedNoticeText: {
    flex: 1,
    color: "#7f1d1d",
    fontWeight: "700",
    fontSize: 12,
  },

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
