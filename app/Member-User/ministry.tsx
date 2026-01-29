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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const normalizeGender = (v: any) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "male" || s === "m") return "Male";
  if (s === "female" || s === "f") return "Female";
  return null;
};

const computeAge = (birthdate?: string | null) => {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const passesDemographic = (cfg: any, profile: any) => {
  const allowed = Array.isArray(cfg?.allowed_gender) ? cfg.allowed_gender : [];
  const minorOnly = !!cfg?.minor_only;
  const adultOnly = !!cfg?.adult_only;

  const g = normalizeGender(profile?.gender);
  const age = computeAge(profile?.birthdate);

  if (allowed.length > 0 && (!g || !allowed.includes(g))) return false;

  if (minorOnly) {
    if (age == null) return false;
    if (age >= 18) return false;
  }

  if (adultOnly) {
    if (age == null) return false;
    if (age < 18) return false;
  }

  return true;
};

const passesAgeRange = (cfg: any, profile: any) => {
  const age = computeAge(profile?.birthdate);
  if (age == null) return false;

  const min = cfg?.min_age ?? null;
  const max = cfg?.max_age ?? null;

  if (min != null && age < Number(min)) return false;
  if (max != null && age > Number(max)) return false;
  return true;
};

const normRel = (v: any) => String(v ?? "").trim().toLowerCase();

const passesFamilyRelation = (
  cfg: any,
  applicantAuthId: string,
  familyRows: any[],
) => {
  const needed = Array.isArray(cfg?.must_have_relation)
    ? cfg.must_have_relation
    : [];
  const neededNorm = needed.map(normRel).filter(Boolean);
  if (neededNorm.length === 0) return true;

  const direction = cfg?.direction || "owner_has_family";
  const rows = Array.isArray(familyRows) ? familyRows : [];

  const ownerSide = rows
    .filter((r) => r.owner_auth_user_id === applicantAuthId)
    .map((r) => normRel(r.relationship_owner))
    .filter(Boolean);

  const familySide = rows
    .filter((r) => r.family_auth_user_id === applicantAuthId)
    .map((r) => normRel(r.relationship_family))
    .filter(Boolean);

  const hasAny = (list: string[]) => neededNorm.some((n) => list.includes(n));

  if (direction === "owner_has_family") return hasAny(ownerSide);
  if (direction === "family_has_owner") return hasAny(familySide);
  return hasAny(ownerSide) || hasAny(familySide);
};

export default function MinistryScreen() {
  const insets = useSafeAreaInsets();
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
  const [applicantProfile, setApplicantProfile] = useState<{
    birthdate: string | null;
    gender: string | null;
    auth_user_id: string | null;
  } | null>(null);
  const [applicantFamily, setApplicantFamily] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"your" | "join">("your");
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewApplication, setViewApplication] = useState<any | null>(null);
  const [viewRequirements, setViewRequirements] = useState<
    MinistryRequirementRow[]
  >([]);
  const [viewAnswers, setViewAnswers] = useState<Record<number, any>>({});

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
          `branch_ministry_id, branch_id, ministry_id, is_active, ministries:ministries(id, name, description)`,
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

      const { data: prof, error: pErr } = await supabase
        .from("users_details")
        .select("auth_user_id, birthdate, gender")
        .eq("auth_user_id", authUid)
        .maybeSingle();
      if (pErr) throw pErr;
      setApplicantProfile(
        prof || { auth_user_id: authUid, birthdate: null, gender: null },
      );

      const { data: fam, error: fErr } = await supabase
        .from("user_family")
        .select(
          "owner_auth_user_id, family_auth_user_id, status, relationship_owner, relationship_family",
        )
        .or(`owner_auth_user_id.eq.${authUid},family_auth_user_id.eq.${authUid}`);
      if (fErr) throw fErr;
      const confirmed = (fam || []).filter((r) => {
        const s = String(r.status || "").toLowerCase();
        return s === "accepted" || s === "approved" || s === "confirmed";
      });
      setApplicantFamily(confirmed);
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
      const isDraft = app?.status === "Draft";
      if (app && !isDraft) {
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

      let appId: number | null = null;
      let existingAnswers: Record<number, any> = {};

      if (isDraft && app?.application_id) {
        appId = Number(app.application_id);
        const { data: ans, error: ansErr } = await supabase
          .from("ministry_application_answers")
          .select("requirement_id, answer")
          .eq("application_id", appId);
        if (ansErr) throw ansErr;
        existingAnswers = (ans || []).reduce(
          (acc: Record<number, any>, row: any) => {
            acc[Number(row.requirement_id)] = row.answer;
            return acc;
          },
          {},
        );
      } else {
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
        appId = Number(created.application_id);
      }

      setRequirements((reqs ?? []) as any as MinistryRequirementRow[]);
      setApplicationId(appId);
      setAnswers(existingAnswers);
      setShowJoinModal(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to start application.");
    }
  }, []);

  const openViewApplication = useCallback(async (app: any) => {
    try {
      setErr("");
      setViewApplication(app);
      setShowViewModal(true);

      const bmId = app?.branch_ministry?.branch_ministry_id;
      if (!bmId) throw new Error("Branch ministry not found.");

      const { data: reqs, error: rErr } = await supabase
        .from("ministry_requirements")
        .select("*")
        .eq("branch_ministry_id", bmId)
        .order("sort_order");
      if (rErr) throw rErr;

      const { data: ans, error: aErr } = await supabase
        .from("ministry_application_answers")
        .select("requirement_id, answer")
        .eq("application_id", app.application_id);
      if (aErr) throw aErr;

      const ansMap = (ans || []).reduce(
        (acc: Record<number, any>, row: any) => {
          acc[Number(row.requirement_id)] = row.answer;
          return acc;
        },
        {},
      );

      setViewRequirements((reqs ?? []) as any as MinistryRequirementRow[]);
      setViewAnswers(ansMap);
    } catch (e: any) {
      setErr(e?.message || "Failed to load application.");
    }
  }, []);

  const deleteDraftApplication = useCallback(
    async (appId: number) => {
      try {
        setErr("");
        await supabase
          .from("ministry_application_answers")
          .delete()
          .eq("application_id", appId);
        const { error: delErr } = await supabase
          .from("ministry_applications")
          .delete()
          .eq("application_id", appId);
        if (delErr) throw delErr;
        await fetchBranchAndMinistries();
      } catch (e: any) {
        setErr(e?.message || "Failed to delete draft.");
      }
    },
    [fetchBranchAndMinistries],
  );

  const cancelApplication = useCallback(
    async (appId: number) => {
      try {
        setErr("");
        const { error: upErr } = await supabase
          .from("ministry_applications")
          .update({ status: "Cancelled" })
          .eq("application_id", appId);
        if (upErr) throw upErr;
        await fetchBranchAndMinistries();
      } catch (e: any) {
        setErr(e?.message || "Failed to cancel application.");
      }
    },
    [fetchBranchAndMinistries],
  );

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

        if (r.requirement_type === "asset_select") {
          const opts = Array.isArray(cfg?.options) ? cfg.options : [];
          const selected = Array.isArray(a?.selected) ? a.selected : [];
          const min = Number(cfg?.min_selected ?? 0);
          const max =
            cfg?.max_selected == null || cfg?.max_selected === ""
              ? null
              : Number(cfg.max_selected);
          const requireAny = !!cfg?.require_any;

          if (r.is_required !== false || requireAny || min > 0) {
            if (selected.length === 0 && (requireAny || min > 0)) {
              throw new Error(`Select at least one: ${title}`);
            }
          }

          if (selected.length < min) {
            throw new Error(`Select at least ${min}: ${title}`);
          }
          if (max != null && selected.length > max) {
            throw new Error(`Select at most ${max}: ${title}`);
          }

          if (opts.length > 0 && selected.some((x: any) => !opts.includes(x))) {
            throw new Error(`Invalid selection in: ${title}`);
          }
        }

        if (r.requirement_type === "skill_select") {
          const sel = Array.isArray(a?.selected) ? a.selected : [];
          const otherChecked = !!a?.other_checked;
          const otherText = safeText(a?.other_text, "");

          const hasOther = otherChecked && !!otherText;
          if (r.is_required !== false && sel.length === 0 && !hasOther) {
            throw new Error(
              `Select at least one skill or specify Other: ${title}`,
            );
          }
        }

        if (r.requirement_type === "demographic" && r.is_required !== false) {
          if (!passesDemographic(cfg, applicantProfile)) {
            throw new Error(
              `You do not meet the demographic requirement: ${title}`,
            );
          }
        }

        if (r.requirement_type === "age_range" && r.is_required !== false) {
          if (!passesAgeRange(cfg, applicantProfile)) {
            throw new Error(`You do not meet the age requirement: ${title}`);
          }
        }

        if (
          r.requirement_type === "family_relation" &&
          r.is_required !== false
        ) {
          const authId = applicantProfile?.auth_user_id;
          if (
            !authId ||
            !passesFamilyRelation(cfg, authId, applicantFamily)
          ) {
            throw new Error(`You do not meet the family requirement: ${title}`);
          }
        }

        if (r.requirement_type === "custom_form") {
          const fields = Array.isArray(cfg?.fields) ? cfg.fields : [];
          const form =
            a?.fields && typeof a.fields === "object" ? a.fields : {};

          for (const f of fields) {
            if (!f?.required) continue;
            const key = String(f.key || "");
            const label = safeText(f.label, key);
            const v = form[key];
            if (v == null || String(v).trim() === "") {
              throw new Error(`Please fill in "${label}": ${title}`);
            }
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

        if (r.requirement_type === "asset_select") {
          const selected = Array.isArray(raw?.selected) ? raw.selected : [];
          answerToSave = { selected };
        }

        if (r.requirement_type === "skill_select") {
          const sel = Array.isArray(raw?.selected) ? raw.selected : [];
          const otherChecked = !!raw?.other_checked;
          const otherText = safeText(raw?.other_text, "");

          const selectedFinal = [...sel];
          if (otherChecked && otherText) {
            selectedFinal.push(`Other: ${otherText}`);
          }

          answerToSave = {
            selected: selectedFinal,
            other_checked: otherChecked,
            other_text: otherChecked ? otherText : "",
          };
        }

        if (r.requirement_type === "custom_form") {
          const fields =
            raw?.fields && typeof raw.fields === "object" ? raw.fields : {};
          answerToSave = { fields };
        }

        if (r.requirement_type === "demographic") {
          answerToSave = {
            computed: true,
            gender: normalizeGender(applicantProfile?.gender),
            birthdate: applicantProfile?.birthdate || null,
            age: computeAge(applicantProfile?.birthdate),
            pass: passesDemographic(cfg, applicantProfile),
          };
        }

        if (r.requirement_type === "age_range") {
          answerToSave = {
            computed: true,
            birthdate: applicantProfile?.birthdate || null,
            age: computeAge(applicantProfile?.birthdate),
            pass: passesAgeRange(cfg, applicantProfile),
          };
        }

        if (r.requirement_type === "family_relation") {
          const authId = applicantProfile?.auth_user_id;
          answerToSave = {
            computed: true,
            pass: authId ? passesFamilyRelation(cfg, authId, applicantFamily) : false,
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
      setApplicantProfile(null);
      setApplicantFamily([]);

      await fetchBranchAndMinistries();
    } catch (e: any) {
      setErr(e?.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  }, [
    applicationId,
    requirements,
    answers,
    applicantProfile,
    applicantFamily,
    fetchBranchAndMinistries,
  ]);

  // ---- UI ----
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
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
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "your" && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setActiveTab("your")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "your" && { color: "#fff" },
                  ]}
                >
                  Your Ministries
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === "join" && {
                    backgroundColor: primary,
                    borderColor: primary,
                  },
                ]}
                onPress={() => setActiveTab("join")}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === "join" && { color: "#fff" },
                  ]}
                >
                  Join Ministry
                </Text>
              </TouchableOpacity>
            </View>

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

            {activeTab === "your" ? (
              <>
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
                      const bmId = j.branch_ministry?.branch_ministry_id;
                      const app = bmId
                        ? applicationMap.get(Number(bmId))
                        : null;
                      return (
                        <TouchableOpacity
                          key={j.user_ministry_id}
                          style={[
                            styles.myMinistryPill,
                            { borderColor: `${secondary}40` },
                          ]}
                          onPress={() => {
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
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            <TouchableOpacity
                              style={{
                                backgroundColor: secondary,
                                borderRadius: 999,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                              }}
                              onPress={() => {
                                setErr("Ministry details screen coming soon.");
                              }}
                            >
                              <Text
                                style={{
                                  color: "#fff",
                                  fontWeight: "900",
                                  fontSize: 12,
                                }}
                              >
                                Go to Ministry
                              </Text>
                            </TouchableOpacity>
                            {app ? (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: "#f0f0f0",
                                  borderRadius: 999,
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                }}
                                onPress={() => void openViewApplication(app)}
                              >
                                <Text
                                  style={{
                                    color: "#333",
                                    fontWeight: "900",
                                    fontSize: 12,
                                  }}
                                >
                                  View Application
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {yourMinistries.length === 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>My Applications</Text>
                    {loadingMinistries ? (
                      <ActivityIndicator />
                    ) : myApplications.filter(
                        (a) =>
                          safeText(a?.status, "").toLowerCase() !== "approved",
                      ).length === 0 ? (
                      <Text style={{ color: "#666" }}>
                        You have not applied to any ministries yet.
                      </Text>
                    ) : (
                      myApplications
                        .filter(
                          (a) =>
                            safeText(a?.status, "").toLowerCase() !== "approved",
                        )
                        .map((a) => {
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
                        const isDraft = status.toLowerCase() === "draft";
                        const isSubmitted =
                          status.toLowerCase() === "submitted" ||
                          status.toLowerCase() === "underreview";
                        const canView = !isDraft;
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
                                  setErr("Ministry details screen coming soon.");
                                }}
                              >
                                <Text style={{ color: "#fff", fontWeight: "900" }}>
                                  Go to Ministry
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {isDraft ? (
                              <TouchableOpacity
                                style={{
                                  marginTop: 8,
                                  backgroundColor: secondary,
                                  borderRadius: 8,
                                  paddingVertical: 8,
                                  alignItems: "center",
                                }}
                                onPress={() => {
                                  const bm = a.branch_ministry;
                                  const item = branchMinistries.find(
                                    (x) =>
                                      x.branch_ministry_id ===
                                      bm?.branch_ministry_id,
                                  );
                                  if (item) {
                                    void openJoinModal(item);
                                  } else {
                                    setErr(
                                      "Ministry details unavailable for this draft.",
                                    );
                                  }
                                }}
                              >
                                <Text style={{ color: "#fff", fontWeight: "900" }}>
                                  Continue Draft
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {isDraft ? (
                              <TouchableOpacity
                                style={{
                                  marginTop: 8,
                                  backgroundColor: "#fef2f2",
                                  borderRadius: 8,
                                  paddingVertical: 8,
                                  alignItems: "center",
                                  borderWidth: 1,
                                  borderColor: "#fecaca",
                                }}
                                onPress={() =>
                                  void deleteDraftApplication(a.application_id)
                                }
                              >
                                <Text
                                  style={{ color: "#b91c1c", fontWeight: "900" }}
                                >
                                  Remove Draft
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {canView ? (
                              <TouchableOpacity
                                style={{
                                  marginTop: 8,
                                  backgroundColor: "#f0f0f0",
                                  borderRadius: 8,
                                  paddingVertical: 8,
                                  alignItems: "center",
                                }}
                                onPress={() => void openViewApplication(a)}
                              >
                                <Text style={{ color: "#333", fontWeight: "900" }}>
                                  View Application
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {isSubmitted ? (
                              <TouchableOpacity
                                style={{
                                  marginTop: 8,
                                  backgroundColor: "#fef2f2",
                                  borderRadius: 8,
                                  paddingVertical: 8,
                                  alignItems: "center",
                                  borderWidth: 1,
                                  borderColor: "#fecaca",
                                }}
                                onPress={() =>
                                  void cancelApplication(a.application_id)
                                }
                              >
                                <Text
                                  style={{ color: "#b91c1c", fontWeight: "900" }}
                                >
                                  Cancel Application
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                        })
                    )}
                  </View>
                ) : null}
              </>
            ) : (
              <>
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
                          disabled = ["Submitted", "UnderReview"].includes(
                            status,
                          );
                          if (status === "Draft") {
                            buttonText = "Continue";
                          } else {
                            buttonText = disabled ? statusLabel : "Apply Again";
                          }
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
                                  <Text style={styles.ministryName}>
                                    {m.name}
                                  </Text>
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
              </>
            )}

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowJoinModal(false);
          setApplicantProfile(null);
          setApplicantFamily([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Apply to Ministry</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowJoinModal(false);
                  setApplicantProfile(null);
                  setApplicantFamily([]);
                }}
              >
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
                const titleWithRequired = (
                  <Text style={styles.fieldLabel}>
                    {title}{" "}
                    {r.is_required ? (
                      <Text style={{ color: "crimson" }}>*</Text>
                    ) : null}
                  </Text>
                );

                // TEXT ACK
                if (r.requirement_type === "text_ack") {
                  return (
                    <View key={r.requirement_id}>
                      {titleWithRequired}
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
                      {titleWithRequired}
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

                // SKILL SELECT (with "Other")
                if (r.requirement_type === "skill_select") {
                  const options: string[] = Array.isArray(cfg?.options)
                    ? cfg.options
                    : [];
                  const selected: string[] = Array.isArray(value?.selected)
                    ? value.selected
                    : [];
                  const otherChecked = !!value?.other_checked;
                  const otherText = value?.other_text || "";

                  const toggleOpt = (opt: string) => {
                    const set = new Set(selected);
                    if (set.has(opt)) set.delete(opt);
                    else set.add(opt);

                    setAnswers((p) => ({
                      ...p,
                      [r.requirement_id]: {
                        ...(p[r.requirement_id] || {}),
                        selected: Array.from(set),
                      },
                    }));
                  };

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 16 }}>
                      {titleWithRequired}
                      {options.length === 0 ? (
                        <Text style={{ color: "#666" }}>
                          No skill options configured.
                        </Text>
                      ) : (
                        options.map((opt: string) => {
                          const checked = selected.includes(opt);
                          return (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => toggleOpt(opt)}
                              style={{ paddingVertical: 6 }}
                            >
                              <Text>
                                {checked ? "☑" : "☐"} {opt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}

                      <TouchableOpacity
                        onPress={() =>
                          setAnswers((p) => ({
                            ...p,
                            [r.requirement_id]: {
                              ...(p[r.requirement_id] || {}),
                              other_checked: !(
                                p?.[r.requirement_id]?.other_checked
                              ),
                              other_text: !(
                                p?.[r.requirement_id]?.other_checked
                              )
                                ? (p?.[r.requirement_id]?.other_text || "")
                                : "",
                            },
                          }))
                        }
                        style={{ paddingVertical: 6, marginTop: 6 }}
                      >
                        <Text>{otherChecked ? "☑" : "☐"} Other</Text>
                      </TouchableOpacity>

                      {otherChecked ? (
                        <TextInput
                          placeholder="Type your skill (e.g., Video Editing, Sound Tech...)"
                          placeholderTextColor="#8a938a"
                          value={otherText}
                          onChangeText={(t) =>
                            setAnswers((p) => ({
                              ...p,
                              [r.requirement_id]: {
                                ...(p[r.requirement_id] || {}),
                                other_checked: true,
                                other_text: t,
                              },
                            }))
                          }
                          style={[styles.input, { marginTop: 8 }]}
                        />
                      ) : null}
                    </View>
                  );
                }

                if (r.requirement_type === "demographic") {
                  const age = computeAge(applicantProfile?.birthdate);
                  const g = normalizeGender(applicantProfile?.gender);
                  const pass = passesDemographic(cfg, applicantProfile);

                  const allowed = Array.isArray(cfg?.allowed_gender)
                    ? cfg.allowed_gender
                    : [];
                  const minorOnly = !!cfg?.minor_only;
                  const adultOnly = !!cfg?.adult_only;

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 14 }}>
                      {titleWithRequired}

                      <Text style={{ color: "#666", marginBottom: 6 }}>
                        Your profile: {g || "Unknown gender"} • Age:{" "}
                        {age ?? "Unknown"}
                      </Text>

                      <Text style={{ color: "#666", fontSize: 12 }}>
                        Allowed gender:{" "}
                        {allowed.length ? allowed.join(", ") : "Any"}
                        {"\n"}Minor only: {minorOnly ? "Yes" : "No"} • Adult only:{" "}
                        {adultOnly ? "Yes" : "No"}
                      </Text>

                      <Text
                        style={{
                          marginTop: 8,
                          fontWeight: "900",
                          color: pass ? "#166534" : "#b91c1c",
                        }}
                      >
                        {pass
                          ? "✅ You meet this requirement"
                          : "❌ You do not meet this requirement"}
                      </Text>
                    </View>
                  );
                }

                if (r.requirement_type === "age_range") {
                  const min = cfg?.min_age ?? null;
                  const max = cfg?.max_age ?? null;

                  const age = computeAge(applicantProfile?.birthdate);
                  const pass = passesAgeRange(cfg, applicantProfile);

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 14 }}>
                      {titleWithRequired}

                      <Text style={{ color: "#666" }}>
                        Required age: {min != null ? min : "Any"} -{" "}
                        {max != null ? max : "Any"}
                      </Text>

                      <Text style={{ color: "#666", marginTop: 4 }}>
                        Your age: {age ?? "Unknown"}
                      </Text>

                      <Text
                        style={{
                          marginTop: 8,
                          fontWeight: "900",
                          color: pass ? "#166534" : "#b91c1c",
                        }}
                      >
                        {pass
                          ? "✅ You meet this requirement"
                          : "❌ You do not meet this requirement"}
                      </Text>
                    </View>
                  );
                }

                if (r.requirement_type === "family_relation") {
                  const needed = Array.isArray(cfg?.must_have_relation)
                    ? cfg.must_have_relation
                    : [];
                  const direction = cfg?.direction || "owner_has_family";

                  const applicantAuthId = applicantProfile?.auth_user_id || null;
                  const pass = applicantAuthId
                    ? passesFamilyRelation(
                        cfg,
                        applicantAuthId,
                        applicantFamily,
                      )
                    : false;

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 14 }}>
                      {titleWithRequired}

                      <Text style={{ color: "#666" }}>
                        Must have:{" "}
                        {needed.length ? needed.join(", ") : "—"}
                      </Text>

                      <Text
                        style={{ color: "#666", marginTop: 4, fontSize: 12 }}
                      >
                        Direction: {direction}
                      </Text>

                      <Text
                        style={{
                          marginTop: 8,
                          fontWeight: "900",
                          color: pass ? "#166534" : "#b91c1c",
                        }}
                      >
                        {pass
                          ? "✅ Family requirement satisfied"
                          : "❌ Family requirement not satisfied"}
                      </Text>

                      <Text
                        style={{ color: "#666", fontSize: 12, marginTop: 6 }}
                      >
                        Tip: If this fails, update your family relationships in
                        your profile first.
                      </Text>
                    </View>
                  );
                }

                if (r.requirement_type === "custom_form") {
                  const fields = Array.isArray(cfg?.fields) ? cfg.fields : [];
                  const form =
                    value?.fields && typeof value.fields === "object"
                      ? value.fields
                      : {};

                  const setField = (key: string, val: any) => {
                    setAnswers((p) => ({
                      ...p,
                      [r.requirement_id]: {
                        ...(p[r.requirement_id] || {}),
                        fields: { ...(p[r.requirement_id]?.fields || {}), [key]: val },
                      },
                    }));
                  };

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 14 }}>
                      {titleWithRequired}

                      {fields.length === 0 ? (
                        <Text style={{ color: "#666" }}>
                          No form fields configured.
                        </Text>
                      ) : (
                        fields.map((f: any) => {
                          const key = String(f.key || "");
                          const label = safeText(f.label, key);
                          const type = String(f.type || "text");
                          const required = !!f.required;
                          const v = form[key];

                          return (
                            <View key={key} style={{ marginBottom: 10 }}>
                              <Text style={styles.fieldLabel}>
                                {label}{" "}
                                {required ? (
                                  <Text style={{ color: "crimson" }}>*</Text>
                                ) : null}
                              </Text>

                              {type === "select" && Array.isArray(f.options) ? (
                                <View
                                  style={{
                                    borderWidth: 1,
                                    borderColor: "#dfe4de",
                                    borderRadius: 10,
                                    overflow: "hidden",
                                  }}
                                >
                                  {f.options.map((opt: any) => {
                                    const ov = String(opt);
                                    const checked = String(v ?? "") === ov;
                                    return (
                                      <TouchableOpacity
                                        key={ov}
                                        onPress={() => setField(key, ov)}
                                        style={{
                                          padding: 12,
                                          backgroundColor: checked
                                            ? "#eef6ee"
                                            : "#fff",
                                          borderBottomWidth: 1,
                                          borderBottomColor: "#eef1ee",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontWeight: "800",
                                            color: "#111",
                                          }}
                                        >
                                          {checked ? "✓ " : ""}
                                          {ov}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              ) : (
                                <TextInput
                                  value={String(v ?? "")}
                                  onChangeText={(t) => setField(key, t)}
                                  placeholder={safeText(f.placeholder, "")}
                                  placeholderTextColor="#8a938a"
                                  style={styles.input}
                                />
                              )}
                            </View>
                          );
                        })
                      )}
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
                      {titleWithRequired}

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
              onPress={() => {
                setShowJoinModal(false);
                setApplicantProfile(null);
                setApplicantFamily([]);
              }}
            >
              <Text style={styles.secondaryCtaText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* View Application Modal */}
      <Modal
        visible={showViewModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowViewModal(false);
          setViewApplication(null);
          setViewRequirements([]);
          setViewAnswers({});
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Application Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowViewModal(false);
                  setViewApplication(null);
                  setViewRequirements([]);
                  setViewAnswers({});
                }}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
              {viewApplication?.branch_ministry?.ministry?.name || "Ministry"}
            </Text>
            <Text style={{ color: "#666", marginBottom: 12 }}>
              Status: {safeText(viewApplication?.status, "—")}
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {viewRequirements.length === 0 ? (
                <Text style={{ color: "#666" }}>
                  No requirements found for this application.
                </Text>
              ) : (
                viewRequirements.map((r) => {
                  const cfg = r.config || {};
                  const ans = viewAnswers[r.requirement_id] || {};
                  const title = safeText(r.title, "Requirement");

                  const renderValue = () => {
                    if (r.requirement_type === "text_ack") {
                      return ans?.accepted ? "Agreed" : "Not agreed";
                    }

                    if (
                      r.requirement_type === "asset_select" ||
                      r.requirement_type === "skill_select"
                    ) {
                      const selected = Array.isArray(ans?.selected)
                        ? ans.selected
                        : [];
                      return selected.length ? selected.join(", ") : "—";
                    }

                    if (r.requirement_type === "availability") {
                      const days = Array.isArray(ans?.days) ? ans.days : [];
                      const hrs = ans?.hours_per_week ?? "";
                      const notes = safeText(ans?.notes, "");
                      return [
                        days.length ? `Days: ${days.join(", ")}` : "Days: —",
                        `Hours/week: ${hrs || "—"}`,
                        notes ? `Notes: ${notes}` : null,
                      ]
                        .filter(Boolean)
                        .join("\n");
                    }

                    if (
                      r.requirement_type === "demographic" ||
                      r.requirement_type === "age_range" ||
                      r.requirement_type === "family_relation"
                    ) {
                      return ans?.pass ? "Passed" : "Not passed";
                    }

                    if (r.requirement_type === "custom_form") {
                      const fields = Array.isArray(cfg?.fields)
                        ? cfg.fields
                        : [];
                      const values =
                        ans?.fields && typeof ans.fields === "object"
                          ? ans.fields
                          : {};
                      if (fields.length === 0) return "—";
                      return fields
                        .map((f: any) => {
                          const key = String(f.key || "");
                          const label = safeText(f.label, key);
                          const v = values[key];
                          return `${label}: ${safeText(v, "—")}`;
                        })
                        .join("\n");
                    }

                    return safeText(ans, "—");
                  };

                  return (
                    <View key={r.requirement_id} style={{ marginBottom: 14 }}>
                      <Text style={styles.fieldLabel}>
                        {title}{" "}
                        {r.is_required ? (
                          <Text style={{ color: "crimson" }}>*</Text>
                        ) : null}
                      </Text>
                      <Text style={{ color: "#111" }}>
                        {renderValue()}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.secondaryCta, { marginTop: 8 }]}
              onPress={() => {
                setShowViewModal(false);
                setViewApplication(null);
                setViewRequirements([]);
                setViewAnswers({});
              }}
            >
              <Text style={styles.secondaryCtaText}>Close</Text>
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
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dfe4de",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  tabButtonText: { fontWeight: "800", color: "#111", fontSize: 12 },

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
