import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

type UserRow = {
  user_id: number;
  email: string;
  role: string;
  is_active: boolean | null;
  auth_user_id: string | null;
  user_details_id: number | null;
  user_details?: UserDetailsRow | null;
};

type UserDetailsRow = {
  user_details_id: number;
  branch_id: number | null;
  photo_path: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  birthdate: string | null;
  baptismal_date: string | null;
  gender: string | null;
  street: string | null;
  region: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  contact_number: string | null;
  joined_date: string | null;
  last_attended: string | null;
  user_code: string | null; // ✅ NEW
};

function safeText(v: any, fallback = "-") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function buildFullName(d?: UserDetailsRow | null) {
  if (!d) return "-";
  const parts = [
    safeText(d.first_name, ""),
    safeText(d.middle_name, ""),
    safeText(d.last_name, ""),
  ].filter(Boolean);
  const base = parts.join(" ").trim();
  const suffix = safeText(d.suffix, "");
  return (base + (suffix ? ` ${suffix}` : "")).trim() || "-";
}

const normalizeUserCode = (raw: string) => {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  // allow input without hyphen (e.g. AXCBJ10S)
  if (s.length === 8 && !s.includes("-"))
    return s.slice(0, 4) + "-" + s.slice(4);
  return s;
};

const PROFILE_PICS_BUCKET = "profile_pics";

function toProfilePicUrl(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from(PROFILE_PICS_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

// 4-4 code like AXCB-J10S (8 chars + hyphen)
function generateUserCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  const left = Array.from({ length: 4 }, pick).join("");
  const right = Array.from({ length: 4 }, pick).join("");
  return `${left}-${right}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);

  // Theme colors (fallbacks)
  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#0C8A43";

  // Tabs / UI state
  const [activeTab, setActiveTab] = useState<"profile" | "family" | "settings">(
    "profile",
  );

  // Modals
  const [showPersonalInfoModal, setShowPersonalInfoModal] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  const [showRemoveFamilyModal, setShowRemoveFamilyModal] = useState(false);
  const [removingFamily, setRemovingFamily] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);

  // Add Family Member form state
  const [familyUserId, setFamilyUserId] = useState("");
  const [familyRelationshipOwner, setFamilyRelationshipOwner] = useState("");
  const [familyRelationshipFamily, setFamilyRelationshipFamily] = useState("");

  // ✅ Live family state
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyErr, setFamilyErr] = useState("");
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  // ✅ Incoming requests state
  const [reqLoading, setReqLoading] = useState(false);
  const [reqErr, setReqErr] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

  const pendingRequests = useMemo(
    () =>
      incomingRequests.filter(
        (r) => String(r?.status).toLowerCase() === "pending",
      ),
    [incomingRequests],
  );

  // ✅ Real user state
  const [loadingUser, setLoadingUser] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userRow, setUserRow] = useState<UserRow | null>(null);
  const details = userRow?.user_details ?? null;

  const displayName = useMemo(() => buildFullName(details), [details]);
  const displayEmail = useMemo(() => {
    const email = safeText(userRow?.email, "-");
    if (email === "-") return email;
    // Remove app-specific suffix if present (e.g. john_member@gmail.com -> john@gmail.com)
    return email.replace(/_member(?=@)|_member$/i, "");
  }, [userRow]);
  const displayUserCode = useMemo(
    () => safeText(details?.user_code, "-"),
    [details],
  );

  const profilePhotoUrl = useMemo(() => {
    const url = toProfilePicUrl(details?.photo_path);
    return url || null;
  }, [details?.photo_path]);

  const profileMenuItems = [
    {
      id: "pi-1",
      label: "Personal Information",
      icon: "person-outline",
      action: () => setShowPersonalInfoModal(true),
    },
    {
      id: "pi-2",
      label: "Help & Support",
      icon: "help-circle-outline",
      action: () => router.push("/modal" as any),
    },
  ];

  // Handlers
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.replace("/login" as any);
  };

  const fetchFamily = useCallback(async () => {
    if (!authUserId) return;

    setFamilyLoading(true);
    setFamilyErr("");
    try {
      // Step 1: load relationships in BOTH directions
      // - Always include Accepted
      // - Include Pending only if it's outgoing (sent by current user)
      const { data: rels, error: relErr } = await supabase
        .from("user_family")
        .select(
          "user_family_id, status, created_at, owner_auth_user_id, family_auth_user_id, relationship_owner, relationship_family",
        )
        .or(
          `owner_auth_user_id.eq.${authUserId},family_auth_user_id.eq.${authUserId}`,
        )
        .in("status", ["Accepted", "Pending"])
        .order("created_at", { ascending: false });

      if (relErr) throw relErr;

      const normalized = (rels ?? []).map((r: any) => ({
        ...r,
        status: String(r?.status ?? ""),
      }));

      const visibleRels = normalized.filter((r: any) => {
        const status = String(r?.status).toLowerCase();
        if (status === "accepted") return true;
        // show pending only if current user sent the request
        if (status === "pending") return r.owner_auth_user_id === authUserId;
        return false;
      });

      const otherAuthIds = Array.from(
        new Set(
          visibleRels
            .map((r: any) =>
              r.owner_auth_user_id === authUserId
                ? r.family_auth_user_id
                : r.owner_auth_user_id,
            )
            .filter(Boolean),
        ),
      ) as string[];

      if (otherAuthIds.length === 0) {
        setFamilyMembers([]);
        return;
      }

      // Step 2: load public display info via RPC (bypasses users RLS)
      const { data: users, error: usersErr } = await supabase.rpc(
        "get_member_public_profiles",
        { p_auth_ids: otherAuthIds },
      );

      if (usersErr) throw usersErr;

      const byAuthId = new Map<string, any>(
        (users ?? []).map((u: any) => [
          String(u.auth_user_id),
          {
            auth_user_id: u.auth_user_id,
            email: u.email,
            role: u.role,
            user_details: {
              photo_path: u.photo_path,
              first_name: u.first_name,
              middle_name: u.middle_name,
              last_name: u.last_name,
              suffix: u.suffix,
              user_code: u.user_code,
            },
          },
        ]),
      );

      const merged = visibleRels.map((r: any) => {
        const otherAuthId =
          r.owner_auth_user_id === authUserId
            ? r.family_auth_user_id
            : r.owner_auth_user_id;

        return {
          ...r,
          other_user: byAuthId.get(String(otherAuthId)) ?? null,
          direction:
            r.owner_auth_user_id === authUserId ? "outgoing" : "incoming",
        };
      });

      setFamilyMembers(merged);
    } catch (e: any) {
      setFamilyErr(e?.message || "Failed to load family members.");
      setFamilyMembers([]);
    } finally {
      setFamilyLoading(false);
    }
  }, [authUserId]);

  const fetchIncomingRequests = useCallback(async () => {
    if (!authUserId) return;

    setReqLoading(true);
    setReqErr("");
    try {
      const { data: rels, error: relErr } = await supabase
        .from("user_family")
        .select(
          "user_family_id, status, created_at, owner_auth_user_id, relationship_owner, relationship_family",
        )
        .eq("family_auth_user_id", authUserId)
        .eq("status", "Pending")
        .order("created_at", { ascending: false });

      if (relErr) throw relErr;

      const pendingOnly = (rels ?? []).filter(
        (r: any) => String(r?.status).toLowerCase() === "pending",
      );

      // if nothing pending after normalization, ensure UI is clean
      if (pendingOnly.length === 0) {
        setIncomingRequests([]);
        return;
      }

      const safeOwnerIds = Array.from(
        new Set(
          pendingOnly.map((r: any) => r.owner_auth_user_id).filter(Boolean),
        ),
      ) as string[];

      if (safeOwnerIds.length === 0) {
        setIncomingRequests([]);
        return;
      }

      const { data: owners, error: ownersErr } = await supabase.rpc(
        "get_member_public_profiles",
        { p_auth_ids: safeOwnerIds },
      );
      if (ownersErr) throw ownersErr;

      const byAuthId = new Map<string, any>(
        (owners ?? []).map((u: any) => [
          String(u.auth_user_id),
          {
            auth_user_id: u.auth_user_id,
            email: u.email,
            role: u.role,
            user_details: {
              photo_path: u.photo_path,
              first_name: u.first_name,
              middle_name: u.middle_name,
              last_name: u.last_name,
              suffix: u.suffix,
              user_code: u.user_code,
            },
          },
        ]),
      );

      const merged = pendingOnly.map((r: any) => ({
        ...r,
        requester: byAuthId.get(String(r.owner_auth_user_id)) ?? null,
      }));

      setIncomingRequests(merged);
    } catch (e: any) {
      setReqErr(e?.message || "Failed to load requests.");
      setIncomingRequests([]);
    } finally {
      setReqLoading(false);
    }
  }, [authUserId]);

  const addFamilyByCode = useCallback(async () => {
    try {
      if (!authUserId) throw new Error("No authenticated user.");

      const code = normalizeUserCode(familyUserId);
      if (!code) throw new Error("Enter a user code.");

      if (!familyRelationshipOwner.trim())
        throw new Error("Enter their relationship to you.");
      if (!familyRelationshipFamily.trim())
        throw new Error("Enter your relationship to them.");

      // ✅ 1) Resolve code -> MEMBER auth_user_id (uuid)
      const { data: targetAuthId, error: rpcErr } = await supabase.rpc(
        "find_member_auth_user_id_by_code",
        { p_code: code },
      );

      if (rpcErr) throw rpcErr;

      const cleanedTarget = (targetAuthId ? String(targetAuthId) : "").trim();
      if (!cleanedTarget) throw new Error("No user found for that code.");

      if (cleanedTarget === authUserId)
        throw new Error("You can’t add yourself.");

      // ✅ 2) Insert relationship (UUID based)
      const { error: insErr } = await supabase.from("user_family").insert({
        owner_auth_user_id: authUserId,
        family_auth_user_id: cleanedTarget,
        relationship_owner: familyRelationshipOwner.trim(),
        relationship_family: familyRelationshipFamily.trim(),
        status: "Pending",
      });

      if (insErr) {
        const msg = String((insErr as any).message || "").toLowerCase();
        const codeErr = String((insErr as any).code || "");
        const details = String((insErr as any).details || "").toLowerCase();
        if (
          codeErr === "23505" ||
          msg.includes("duplicate key") ||
          details.includes("duplicate key") ||
          msg.includes("user_family_unique")
        ) {
          throw new Error("That family member is already added.");
        }
        throw insErr;
      }

      // reset + refresh
      setShowAddFamilyModal(false);
      setFamilyUserId("");
      setFamilyRelationshipOwner("");
      setFamilyRelationshipFamily("");
      await fetchFamily();
    } catch (e: any) {
      setFamilyErr(e?.message || "Failed to add family member.");
    }
  }, [
    authUserId,
    familyRelationshipFamily,
    familyRelationshipOwner,
    familyUserId,
    fetchFamily,
  ]);

  const removeFamilyMember = useCallback(async () => {
    try {
      if (!authUserId) throw new Error("No authenticated user.");
      if (!removeTarget) return;

      setRemovingFamily(true);
      setFamilyErr("");

      const meId = authUserId;
      const otherId =
        removeTarget.owner_auth_user_id === meId
          ? removeTarget.family_auth_user_id
          : removeTarget.owner_auth_user_id;

      // Optimistic UI: remove any rows that point to the same other user
      setFamilyMembers((prev) =>
        prev.filter((r: any) => {
          const rOtherId =
            r.owner_auth_user_id === meId
              ? r.family_auth_user_id
              : r.owner_auth_user_id;
          return rOtherId !== otherId;
        }),
      );

      // Single-row model: delete the relationship record itself
      // (Pending outgoing or Accepted in either direction)
      const { error } = await supabase
        .from("user_family")
        .delete()
        .eq("user_family_id", removeTarget.user_family_id)
        .or(`owner_auth_user_id.eq.${meId},family_auth_user_id.eq.${meId}`);
      if (error) throw error;

      setShowRemoveFamilyModal(false);
      setRemoveTarget(null);
      await fetchFamily();
    } catch (e: any) {
      setFamilyErr(e?.message || "Failed to remove family member.");
      await fetchFamily();
    } finally {
      setRemovingFamily(false);
    }
  }, [authUserId, fetchFamily, removeTarget]);

  const acceptRequest = useCallback(
    async (user_family_id: number) => {
      try {
        const { error } = await supabase
          .from("user_family")
          .update({ status: "Accepted" })
          .eq("user_family_id", user_family_id);

        if (error) throw error;

        setIncomingRequests((prev) =>
          prev.filter((r) => r.user_family_id !== user_family_id),
        );

        await fetchIncomingRequests();
        await fetchFamily();
      } catch (e: any) {
        setReqErr(e?.message || "Failed to accept request.");
      }
    },
    [fetchIncomingRequests, fetchFamily],
  );

  const rejectRequest = useCallback(
    async (user_family_id: number) => {
      try {
        if (!authUserId) throw new Error("No authenticated user.");

        const { error } = await supabase
          .from("user_family")
          .delete()
          .eq("user_family_id", user_family_id)
          .eq("family_auth_user_id", authUserId);

        if (error) throw error;

        setIncomingRequests((prev) =>
          prev.filter((r) => r.user_family_id !== user_family_id),
        );

        await fetchIncomingRequests();
      } catch (e: any) {
        setReqErr(e?.message || "Failed to reject request.");
      }
    },
    [authUserId, fetchIncomingRequests],
  );

  // ✅ Fetch branding
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();

      if (error) console.error("Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  useEffect(() => {
    if (activeTab === "family" && authUserId) {
      void fetchFamily();
      void fetchIncomingRequests();
    }
  }, [activeTab, authUserId, fetchFamily, fetchIncomingRequests]);

  // ✅ Fetch user profile + ensure user_code exists
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingUser(true);
      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const authUserId = authRes?.user?.id;
        if (!authUserId) throw new Error("No authenticated user.");

        if (!cancelled) setAuthUserId(authUserId);

        // Pick ONE user row for this auth user (latest active if multiple)
        const { data: usersData, error: usersErr } = await supabase
          .from("users")
          .select(
            `
            user_id,
            email,
            role,
            is_active,
            auth_user_id,
            user_details_id,
            user_details:users_details(
              user_details_id,
              branch_id,
              photo_path,
              first_name,
              middle_name,
              last_name,
              suffix,
              birthdate,
              baptismal_date,
              gender,
              street,
              region,
              barangay,
              city,
              province,
              contact_number,
              joined_date,
              last_attended,
              user_code
            )
          `,
          )
          .eq("auth_user_id", authUserId)
          .eq("is_active", true)
          .ilike("role", "Member")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (usersErr) throw usersErr;

        const row = (usersData?.[0] ?? null) as any as UserRow | null;
        if (!row) throw new Error("No MEMBER user row found for this account.");

        // If user_details missing, you can decide how you create it.
        // For now, we just show placeholders if it doesn't exist.
        if (!cancelled) setUserRow(row);

        // ✅ Ensure user_code exists (app-side)
        const d = row?.user_details as UserDetailsRow | null | undefined;
        if (d?.user_details_id && !d.user_code) {
          // Try a few times in case of rare collision with unique constraint
          for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateUserCode();

            const { error: updErr } = await supabase
              .from("users_details")
              .update({ user_code: code })
              .eq("user_details_id", d.user_details_id)
              .is("user_code", null); // only set if still null

            if (!updErr) {
              // refresh local state
              if (!cancelled) {
                setUserRow((prev) => {
                  if (!prev?.user_details) return prev;
                  return {
                    ...prev,
                    user_details: { ...prev.user_details, user_code: code },
                  };
                });
              }
              break;
            }

            // if collision, try again; otherwise stop
            if (
              !String(updErr.message || "")
                .toLowerCase()
                .includes("unique")
            )
              break;
          }
        }
      } catch (e) {
        console.error("Profile fetch error:", e);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 170, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "profile" && {
                borderBottomColor: secondary,
                borderBottomWidth: 3,
              },
            ]}
            onPress={() => setActiveTab("profile")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "profile" && {
                  color: secondary,
                  fontWeight: "700",
                },
              ]}
            >
              Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "family" && {
                borderBottomColor: secondary,
                borderBottomWidth: 3,
              },
            ]}
            onPress={() => setActiveTab("family")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "family" && {
                  color: secondary,
                  fontWeight: "700",
                },
              ]}
            >
              Family
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "settings" && {
                borderBottomColor: secondary,
                borderBottomWidth: 3,
              },
            ]}
            onPress={() => setActiveTab("settings")}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "settings" && {
                  color: secondary,
                  fontWeight: "700",
                },
              ]}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <>
            <View style={styles.section}>
              <View
                style={[styles.profileCard, { backgroundColor: secondary }]}
              >
                <View style={styles.profileImageContainer}>
                  <View style={styles.profileImage}>
                    {profilePhotoUrl ? (
                      <Image
                        source={{ uri: profilePhotoUrl }}
                        style={{ width: 100, height: 100, borderRadius: 50 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="person-circle-outline"
                        size={80}
                        color="#fff"
                      />
                    )}
                  </View>
                </View>

                {loadingUser ? (
                  <>
                    <ActivityIndicator />
                    <Text style={[styles.profileEmail, { marginTop: 10 }]}>
                      Loading profile...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.profileName}>{displayName}</Text>
                    <Text style={styles.profileEmail}>{displayEmail}</Text>

                    <View style={styles.userIdBadge}>
                      <Ionicons name="key-outline" size={14} color="#fff" />
                      <Text style={styles.userIdText}>
                        ID: {displayUserCode}
                      </Text>
                    </View>

                    <View style={styles.membershipBadge}>
                      <Text style={styles.membershipText}>
                        {safeText(userRow?.role, "Member")}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>
                    12
                  </Text>
                  <Text style={styles.statLabel}>Attendance</Text>
                </View>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>1</Text>
                  <Text style={styles.statLabel}>Ministries</Text>
                </View>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>
                    ₱2.5k
                  </Text>
                  <Text style={styles.statLabel}>Giving</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </>
        )}

        {/* Family Tab */}
        {activeTab === "family" && (
          <>
            {/* Incoming Requests */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requests</Text>

              {reqLoading ? (
                <View style={{ paddingVertical: 12 }}>
                  <ActivityIndicator />
                </View>
              ) : reqErr ? (
                <Text style={{ color: "crimson", fontWeight: "600" }}>
                  {reqErr}
                </Text>
              ) : pendingRequests.length === 0 ? (
                <Text style={{ color: "#666" }}>No pending requests.</Text>
              ) : (
                pendingRequests.map((row) => {
                  const fu = row?.requester;
                  const ud = Array.isArray(fu?.user_details)
                    ? fu?.user_details?.[0]
                    : fu?.user_details;

                  const photoUrl = toProfilePicUrl(ud?.photo_path);

                  const name =
                    `${ud?.first_name || ""} ${ud?.middle_name || ""} ${ud?.last_name || ""}`
                      .replace(/\s+/g, " ")
                      .trim() || "-";

                  const code = ud?.user_code || "-";

                  return (
                    <View
                      key={row.user_family_id}
                      style={[
                        styles.familyCard,
                        { borderLeftColor: "#f59e0b" },
                      ]}
                    >
                      <View style={styles.memberCardContent}>
                        <View
                          style={[
                            styles.memberAvatar,
                            { backgroundColor: "#f59e0b15" },
                          ]}
                        >
                          {photoUrl ? (
                            <Image
                              source={{ uri: photoUrl }}
                              style={styles.memberAvatarImage}
                            />
                          ) : (
                            <Ionicons
                              name="person-circle"
                              size={48}
                              color="#f59e0b"
                            />
                          )}
                        </View>

                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{name}</Text>
                          <Text style={styles.memberRelationship}>
                            Wants to add you as: {row.relationship_family}
                          </Text>
                          <Text style={styles.memberStatus}>Pending</Text>
                          <Text style={styles.memberJoinDate}>
                            Code: {code}
                          </Text>

                          <View
                            style={{
                              flexDirection: "row",
                              gap: 10,
                              marginTop: 8,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => acceptRequest(row.user_family_id)}
                              style={[
                                styles.reqBtn,
                                { backgroundColor: "#16a34a" },
                              ]}
                            >
                              <Text style={styles.reqBtnText}>Accept</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => rejectRequest(row.user_family_id)}
                              style={[
                                styles.reqBtn,
                                { backgroundColor: "#dc2626" },
                              ]}
                            >
                              <Text style={styles.reqBtnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Family</Text>
              <Text style={styles.sectionSubtitle}>
                Add family members using their User Code (e.g., AXCB-J10S)
              </Text>
            </View>
            <View style={styles.section}>
              {familyLoading ? (
                <View style={{ paddingVertical: 12 }}>
                  <ActivityIndicator />
                </View>
              ) : familyErr ? (
                <Text style={{ color: "crimson", fontWeight: "600" }}>
                  {familyErr}
                </Text>
              ) : familyMembers.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No family members yet. Tap “Add Family Member” to add one.
                </Text>
              ) : (
                familyMembers.map((row) => {
                  const fu = row?.other_user;
                  const ud = Array.isArray(fu?.user_details)
                    ? fu?.user_details?.[0]
                    : fu?.user_details;

                  const photoUrl = toProfilePicUrl(ud?.photo_path);
                  const name =
                    `${ud?.first_name || ""} ${ud?.middle_name || ""} ${ud?.last_name || ""}`
                      .replace(/\s+/g, " ")
                      .trim() || "-";
                  const code = ud?.user_code || "-";
                  const isOwner = row.owner_auth_user_id === authUserId;
                  const isPending =
                    String(row?.status).toLowerCase() === "pending";
                  const relLabel = isOwner
                    ? row.relationship_owner
                    : row.relationship_family;
                  const directionLabel = isPending
                    ? isOwner
                      ? "Request sent"
                      : "Requested you"
                    : isOwner
                      ? "Added by you"
                      : "Added you";

                  return (
                    <View
                      key={row.user_family_id}
                      style={[
                        styles.familyCard,
                        { borderLeftColor: secondary },
                      ]}
                    >
                      <View style={styles.memberCardContent}>
                        <View
                          style={[
                            styles.memberAvatar,
                            { backgroundColor: `${secondary}15` },
                          ]}
                        >
                          {photoUrl ? (
                            <Image
                              source={{ uri: photoUrl }}
                              style={styles.memberAvatarImage}
                            />
                          ) : (
                            <Ionicons
                              name="person-circle"
                              size={48}
                              color={secondary}
                            />
                          )}
                        </View>

                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{name}</Text>
                          <Text style={styles.memberRelationship}>
                            {relLabel} • {directionLabel}
                          </Text>
                          <Text style={styles.memberStatus}>{row.status}</Text>
                          <Text style={styles.memberJoinDate}>
                            Code: {code}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            setRemoveTarget({
                              ...row,
                              displayName: name,
                            });
                            setShowRemoveFamilyModal(true);
                          }}
                          style={{ padding: 8 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#999"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
            <View style={{ height: 20 }} />
          </>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              {profileMenuItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    index !== profileMenuItems.length - 1 &&
                      styles.menuItemBorder,
                  ]}
                  onPress={item.action}
                >
                  <Ionicons name={item.icon as any} size={24} color={primary} />
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={24} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Modals */}

      <Modal
        visible={showPersonalInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPersonalInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.personalInfoModalContent, { maxHeight: "90%" }]}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setShowPersonalInfoModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ paddingHorizontal: 16 }}
            >
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>User Code</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>{displayUserCode}</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>First Name</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.first_name)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Middle Name</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.middle_name)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Surname</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.last_name)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Suffix</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.suffix)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Birthdate</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.birthdate)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Gender</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.gender)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Street</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.street)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Region</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.region)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Province</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.province)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Barangay</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.barangay)}
                  </Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>City</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.city)}
                  </Text>
                </View>
              </View>
              <View style={[styles.formGroup, { marginBottom: 20 }]}>
                <Text style={styles.formLabel}>Contact Number</Text>
                <View style={styles.inputField}>
                  <Text style={styles.inputText}>
                    {safeText(details?.contact_number)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddFamilyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddFamilyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addFamilyModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowAddFamilyModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <View style={styles.familyInputWrapper}>
                <TextInput
                  style={styles.familyTextInput}
                  placeholder="Enter User Code (e.g., AXCB-J10S)"
                  placeholderTextColor="#999"
                  value={familyUserId}
                  onChangeText={setFamilyUserId}
                  autoCapitalize="characters"
                  maxLength={9}
                />
                <TouchableOpacity style={styles.qrIconButton}>
                  <Ionicons name="qr-code-outline" size={20} color="#064622" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.familyTextInput}
                placeholder="Their relationship to you (e.g., Mother)"
                placeholderTextColor="#999"
                value={familyRelationshipOwner}
                onChangeText={setFamilyRelationshipOwner}
              />

              <TextInput
                style={styles.familyTextInput}
                placeholder="Your relationship to them (e.g., Child)"
                placeholderTextColor="#999"
                value={familyRelationshipFamily}
                onChangeText={setFamilyRelationshipFamily}
              />

              <TouchableOpacity
                style={[
                  styles.inviteBtn,
                  { backgroundColor: primary, marginTop: 8 },
                ]}
                onPress={addFamilyByCode}
              >
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemoveFamilyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (removingFamily) return;
          setShowRemoveFamilyModal(false);
          setRemoveTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View
              style={[
                styles.confirmIconBox,
                { backgroundColor: "rgba(220,38,38,0.12)" },
              ]}
            >
              <Ionicons name="trash-outline" size={52} color="#dc2626" />
            </View>

            <Text style={styles.confirmTitle}>Remove family member?</Text>
            <Text style={styles.confirmText}>
              {`This will remove ${safeText(removeTarget?.displayName, "this user")} from your family list.`}
            </Text>

            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: "#dc2626" }]}
              activeOpacity={0.9}
              onPress={removeFamilyMember}
              disabled={removingFamily}
            >
              {removingFamily ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryCtaText}>Remove</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryCta,
                { borderColor: "#dc2626", marginTop: 8 },
              ]}
              activeOpacity={0.9}
              onPress={() => {
                if (removingFamily) return;
                setShowRemoveFamilyModal(false);
                setRemoveTarget(null);
              }}
              disabled={removingFamily}
            >
              <Text style={[styles.secondaryCtaText, { color: "#dc2626" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {activeTab === "family" && (
        <View style={styles.bottomCtaWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.addMemberBtn, { backgroundColor: secondary }]}
            onPress={() => setShowAddFamilyModal(true)}
            activeOpacity={0.9}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addMemberBtnText}>Add Family Member</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "settings" && (
        <View style={styles.bottomCtaWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: secondary }]}
            onPress={handleLogout}
            activeOpacity={0.9}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

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
  headerLeft: { width: 32, height: 32 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { padding: 6 },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  container: { flex: 1, paddingHorizontal: 16 },
  section: { marginVertical: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  profileImageContainer: { marginBottom: 16 },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  membershipBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  membershipText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  statCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  statNumber: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  statLabel: { fontSize: 12, color: "#999" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    gap: 12,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  menuItemLabel: { flex: 1, fontSize: 16, color: "#000", fontWeight: "500" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  logoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  baptismFormContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 12, color: "#4c5b4c", fontWeight: "700" },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 8,
  },
  inputText: { fontSize: 14, color: "#333", flex: 1 },
  datePickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 8,
  },
  datePickerText: { fontSize: 14, color: "#999", flex: 1 },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  confirmModalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmText: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  primaryCta: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryCtaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryCta: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1.5,
  },
  secondaryCtaText: { fontWeight: "700", fontSize: 14 },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 10,
  },
  toggleBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  requestTitle: { fontSize: 18, fontWeight: "800", color: "#111" },
  personalInfoModalContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 0,
  },
  addFamilyModalContent: {
    width: "92%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
  },
  userIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    gap: 6,
  },
  userIdText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  inviteBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reqBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reqBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  familyInputWrapper: { position: "relative", marginBottom: 12 },
  familyTextInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#000",
    marginBottom: 12,
    borderWidth: 0,
  },
  qrIconButton: { position: "absolute", right: 16, top: 14 },
  tabNavigation: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 0,
  },
  tabLabel: { fontSize: 14, color: "#999", fontWeight: "600" },
  sectionSubtitle: { fontSize: 13, color: "#666", marginBottom: 12 },
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
  memberCardContent: { flexDirection: "row", gap: 12, alignItems: "center" },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    resizeMode: "cover",
  },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { fontSize: 15, fontWeight: "700", color: "#111" },
  memberRelationship: { fontSize: 12, color: "#666", fontWeight: "600" },
  memberStatus: { fontSize: 12, color: "#4d5a4d" },
  memberJoinDate: { fontSize: 11, color: "#999" },
  bottomCtaWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    // approx height of MemberNavbar + a small gap
    bottom: 96,
    zIndex: 20,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMemberBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  dropdownText: { fontSize: 14, color: "#999", flex: 1 },
  dropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  dropdownItemText: { fontSize: 14, color: "#111" },
});
