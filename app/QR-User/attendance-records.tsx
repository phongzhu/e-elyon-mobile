import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import QRNavbar from "./qr-navbar";

const timePeriods = ["Daily", "Weekly", "Monthly"];

type AttendanceRecord = {
  id: number;
  name: string;
  time: string;
  date: string;
  attendedAt: string;
  branch: string;
  branchId: number | null;
  service: string;
  avatarUrl: string | null;
  eventTime: string;
  eventImageUrl: string | null;
  checkInMethod: string | null;
};

const PROFILE_PICS_BUCKET = "profile_pics";
const pickBranchId = (usersDetails: any): number | null => {
  if (!usersDetails) return null;
  if (Array.isArray(usersDetails)) {
    return usersDetails.length > 0 ? usersDetails[0]?.branch_id ?? null : null;
  }
  return usersDetails?.branch_id ?? null;
};

const toProfilePicUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from(PROFILE_PICS_BUCKET).getPublicUrl(path).data
    .publicUrl;
};

const toEventImageUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("church-event").getPublicUrl(path).data.publicUrl;
};

const formatDateLabel = (iso?: string | null) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
};

const formatTimeLabel = (iso?: string | null) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatEventTimeRange = (startIso?: string | null, endIso?: string | null) => {
  if (!startIso && !endIso) return "-";
  if (startIso && endIso) return `${formatTimeLabel(startIso)} - ${formatTimeLabel(endIso)}`;
  return formatTimeLabel(startIso ?? endIso);
};

export default function AttendanceRecords() {
  const [branding, setBranding] = useState<any>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("Daily");
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [openDropdown, setOpenDropdown] = useState<"branch" | "period" | null>(null);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#0C8A43";

  const loadBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("branch_id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("loadBranches error:", error);
      setBranches([]);
      return;
    }

    const rows = (data ?? []).map((b: any) => ({
      id: b.branch_id,
      name: b.name ?? "Branch",
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    setBranches(rows);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (!error) {
        setBranding(data);
      }
    })();
    loadBranches();
  }, []);

  const getQrBranchId = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, role, users_details:users_details(branch_id)")
      .eq("auth_user_id", authUserId)
      .in("role", ["QR_MEMBER", "QR-MEMBER"])
      .maybeSingle();

    if (error) {
      console.error("QR branch resolve error:", error);
      return null;
    }

    return pickBranchId(data?.users_details);
  };

  const resolveMemberUserId = async (payload: any) => {
    if (payload?.user_id) return Number(payload.user_id);

    const authUserId = payload?.auth_user_id;
    if (authUserId) {
      const { data, error } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_user_id", authUserId)
        .eq("role", "member")
        .maybeSingle();
      if (!error && data?.user_id) return Number(data.user_id);
    }

    const userCode = payload?.user_code;
    if (userCode) {
      const { data, error } = await supabase
        .from("users_details")
        .select("user_details_id, auth_user_id")
        .eq("user_code", userCode)
        .maybeSingle();
      if (error || !data?.auth_user_id) return null;
      const { data: userRow } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_user_id", data.auth_user_id)
        .eq("role", "member")
        .maybeSingle();
      return userRow?.user_id ? Number(userRow.user_id) : null;
    }

    return null;
  };

  const resolveActiveEventId = async (branchId: number | null) => {
    const nowIso = new Date().toISOString();
    let q = supabase
      .from("events")
      .select("event_id, title, start_datetime, end_datetime, branch_id")
      .in("status", ["Scheduled", "Published", "Active", "Approved"])
      .lte("start_datetime", nowIso)
      .gte("end_datetime", nowIso)
      .order("start_datetime", { ascending: false })
      .limit(1);

    if (branchId !== null) {
      q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
    } else {
      q = q.is("branch_id", null);
    }

    const { data, error } = await q.maybeSingle();
    if (error) {
      console.error("resolveActiveEventId error:", error);
      return null;
    }
    return data?.event_id ? Number(data.event_id) : null;
  };

  const loadAttendanceRecords = async () => {
    setLoading(true);
    try {
      const branchId = await getQrBranchId();
      const now = new Date();
      const startRange = new Date(now);
      startRange.setDate(now.getDate() - 30);

      let q = supabase
        .from("event_attendance")
        .select(
          "attendance_id, attended_at, check_in_method, event:events!inner(title, branch_id, branches(name), cover_image_path, start_datetime, end_datetime), user:users(user_details:users_details(first_name,last_name,photo_path,branch_id))",
        )
        .in("check_in_method", ["qr", "QR"])
        .gte("attended_at", startRange.toISOString())
        .order("attended_at", { ascending: false });

      if (branchId !== null) {
        q = q.or(`event.branch_id.eq.${branchId},event.branch_id.is.null`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []).map((r: any) => {
        const details = r.user?.user_details;
        const name = [details?.first_name, details?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Member";
        const derivedBranchId =
          r.event?.branch_id ??
          details?.branch_id ??
          null;
        const derivedBranchName =
          r.event?.branches?.name ||
          branches.find((b) => b.id === derivedBranchId)?.name ||
          "Unknown";
        return {
          id: r.attendance_id,
          name,
          time: formatTimeLabel(r.attended_at),
          date: formatDateLabel(r.attended_at),
          attendedAt: r.attended_at || "",
          branch: derivedBranchName,
          branchId: derivedBranchId,
          service: r.event?.title || "Event",
          avatarUrl: toProfilePicUrl(details?.photo_path),
          eventTime: formatEventTimeRange(
            r.event?.start_datetime,
            r.event?.end_datetime,
          ),
          eventImageUrl: toEventImageUrl(r.event?.cover_image_path),
          checkInMethod: r.check_in_method || null,
        } as AttendanceRecord;
      });

      setRecords(rows);

    } catch (e) {
      console.error("loadAttendanceRecords error:", e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const periodStart = new Date(now);
    if (selectedPeriod === "Weekly") {
      periodStart.setDate(now.getDate() - 7);
    } else if (selectedPeriod === "Monthly") {
      periodStart.setDate(now.getDate() - 30);
    } else {
      periodStart.setHours(0, 0, 0, 0);
    }

    const periodFiltered = records.filter((record) => {
      const recordDate = record.attendedAt
        ? new Date(record.attendedAt)
        : null;
      if (!recordDate) return false;
      return recordDate >= periodStart && recordDate <= now;
    });

    return periodFiltered.filter((record) => {
      if (selectedBranchId == null) return true;
      return record.branchId === selectedBranchId;
    });
  }, [records, selectedBranchId, selectedPeriod, branches]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalAttendees = filteredRecords.length;

    let avgPerDay = totalAttendees;
    if (selectedPeriod === "Weekly") avgPerDay = Math.round(totalAttendees / 7);
    if (selectedPeriod === "Monthly")
      avgPerDay = Math.round(totalAttendees / 30);

    return {
      totalAttendees,
      avgPerDay,
    };
  }, [filteredRecords, selectedPeriod]);

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    setScanned(true);
    setShowScanner(false);

    let payload: any = null;
    try {
      payload = JSON.parse(data);
    } catch {
      Alert.alert("Invalid QR", "This QR code is not valid.");
      return;
    }

    if (!payload || payload.type !== "check-in") {
      Alert.alert("Invalid QR", "This QR code is not a check-in code.");
      return;
    }

    const memberUserId = await resolveMemberUserId(payload);
    if (!memberUserId) {
      Alert.alert(
        "Invalid QR",
        "Unable to identify the member. Please regenerate the QR code.",
      );
      return;
    }

    const branchId = await getQrBranchId();
    const eventId = payload?.event_id
      ? Number(payload.event_id)
      : await resolveActiveEventId(branchId);

    if (!eventId) {
      Alert.alert(
        "No Active Event",
        "No ongoing event found for this branch.",
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("event_attendance")
      .upsert(
        {
          event_id: eventId,
          user_id: memberUserId,
          check_in_method: "qr",
          attended_at: nowIso,
          attendance_counted: true,
          attendance_duration_minutes: 0,
        },
        { onConflict: "event_id,user_id" },
      );

    if (error) {
      console.error("QR attendance insert error:", error);
      Alert.alert("Attendance", error.message || "Failed to record attendance.");
      return;
    }

    Alert.alert("Attendance", "Attendance recorded via QR.");
    loadAttendanceRecords();
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setScanned(false);
    setShowScanner(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8faf9" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <Text style={styles.headerTitle}>Attendance Records</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={openScanner}
        >
          <Ionicons name="qr-code" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View
              style={[
                styles.analyticsCard,
                { backgroundColor: `${secondary}15` },
              ]}
            >
              <Ionicons name="people" size={24} color={secondary} />
              <Text style={styles.analyticsValue}>
                {analytics.totalAttendees}
              </Text>
              <Text style={styles.analyticsLabel}>Total Attendees</Text>
            </View>
            <View
              style={[
                styles.analyticsCard,
                { backgroundColor: `${primary}15` },
              ]}
            >
              <Ionicons name="trending-up" size={24} color={primary} />
              <Text style={styles.analyticsValue}>{analytics.avgPerDay}</Text>
              <Text style={styles.analyticsLabel}>Avg per Day</Text>
            </View>
          </View>
        </View>

        <View style={styles.filtersRow}>
          <View style={styles.filterColumn}>
            <Text style={styles.sectionTitle}>Branch</Text>
            <TouchableOpacity
              style={styles.selectShell}
              activeOpacity={0.8}
              onPress={() =>
                setOpenDropdown((prev) => (prev === "branch" ? null : "branch"))
              }
            >
              <Text style={styles.selectText} numberOfLines={1}>
                {selectedBranchId == null
                  ? "All"
                  : branches.find((b) => b.id === selectedBranchId)?.name || "All"}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#4c5a51" />
            </TouchableOpacity>
          </View>
          <View style={styles.filterColumn}>
            <Text style={styles.sectionTitle}>Time Period</Text>
            <TouchableOpacity
              style={styles.selectShell}
              activeOpacity={0.8}
              onPress={() =>
                setOpenDropdown((prev) => (prev === "period" ? null : "period"))
              }
            >
              <Text style={styles.selectText} numberOfLines={1}>
                {selectedPeriod}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#4c5a51" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
          Records ({selectedPeriod})
        </Text>
        {loading ? (
          <Text style={styles.emptyText}>Loading records...</Text>
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <View key={record.id} style={styles.recordRow}>
              <View style={styles.avatarWrap}>
                {record.avatarUrl ? (
                  <Image
                    source={{ uri: record.avatarUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {record.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{record.name}</Text>
                <Text style={styles.meta}>
                  {record.branch} - {record.service}
                </Text>
                <Text style={styles.time}>{record.eventTime}</Text>
                <Text style={styles.timeSub}>
                  Checked in {record.time} • {record.date}
                </Text>
              </View>
              <View style={styles.eventThumb}>
                {record.eventImageUrl ? (
                  <Image
                    source={{ uri: record.eventImageUrl }}
                    style={styles.eventThumbImage}
                  />
                ) : (
                  <View style={styles.eventThumbFallback}>
                    <Ionicons name="image" size={18} color="#9aa5a0" />
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No attendance records found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal
        transparent
        visible={openDropdown !== null}
        animationType="fade"
        onRequestClose={() => setOpenDropdown(null)}
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setOpenDropdown(null)}
        >
          <View style={styles.dropdownSheet}>
            {openDropdown === "branch" && (
              <>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedBranchId(null);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>All</Text>
                </TouchableOpacity>
                {branches.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedBranchId(b.id);
                      setOpenDropdown(null);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {openDropdown === "period" &&
              timePeriods.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedPeriod(opt);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showScanner} transparent animationType="slide">
        <View style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.scannerContainer}>
            {permission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerInstruction}>
                    Align the QR code within the frame
                  </Text>
                </View>
              </CameraView>
            ) : (
              <View style={styles.permissionContainer}>
                <Ionicons name="camera-outline" size={64} color="#999" />
                <Text style={styles.permissionText}>
                  Camera permission required
                </Text>
                <TouchableOpacity
                  style={[
                    styles.permissionButton,
                    { backgroundColor: primary },
                  ]}
                  onPress={requestPermission}
                >
                  <Text style={styles.permissionButtonText}>
                    Grant Permission
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <QRNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  filterColumn: {
    flex: 1,
    minWidth: 0,
  },
  selectShell: {
    height: 40,
    borderWidth: 1,
    borderColor: "#e1e5e2",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 13,
    color: "#1f2a1f",
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e3e7e5",
    maxHeight: "70%",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#1f2a1f",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  analyticsSection: {
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  analyticsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginTop: 8,
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#999",
    marginTop: 6,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    marginRight: 12,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e6ebe8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f3b33",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  time: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f8a43",
    marginTop: 4,
  },
  timeSub: {
    fontSize: 11,
    color: "#8a948f",
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  eventThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: 10,
    backgroundColor: "#eef2ef",
  },
  eventThumbImage: {
    width: "100%",
    height: "100%",
  },
  eventThumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 12,
  },
  scannerInstruction: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    padding: 40,
  },
  permissionText: {
    fontSize: 16,
    color: "#666",
    marginTop: 20,
    marginBottom: 30,
    textAlign: "center",
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});















