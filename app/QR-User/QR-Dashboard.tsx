import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import QRNavbar from "./qr-navbar";

export default function QRDashboard() {
  const [branding, setBranding] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({ attendees: 0, events: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>(
    [],
  );

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#0C8A43";
  const toEventImageUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return supabase.storage.from("church-event").getPublicUrl(path).data
      .publicUrl;
  };
  const formatTimeRange = (
    startIso?: string | null,
    endIso?: string | null,
  ) => {
    if (!startIso && !endIso) return "";
    const fmt = (iso?: string | null) =>
      iso
        ? new Date(iso).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "";
    if (startIso && endIso) return `${fmt(startIso)} - ${fmt(endIso)}`;
    return fmt(startIso ?? endIso);
  };
  const pickBranchId = (usersDetails: any): number | null => {
    if (!usersDetails) return null;
    if (Array.isArray(usersDetails)) {
      return usersDetails.length > 0
        ? (usersDetails[0]?.branch_id ?? null)
        : null;
    }
    return usersDetails?.branch_id ?? null;
  };

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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) {
        console.error("Branding fetch error:", error);
      } else {
        setBranding(data);
      }
    })();
    loadBranches();
  }, [branches]);

  const loadStats = async () => {
    try {
      const branchId = await getQrBranchId();
      const nowIso = new Date().toISOString();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      let eventsQuery = supabase
        .from("events")
        .select("event_id", { count: "exact", head: true })
        .in("status", ["Scheduled", "Published", "Active", "Approved"])
        .gte("start_datetime", monthStart.toISOString())
        .lte("start_datetime", nowIso);

      if (branchId !== null) {
        eventsQuery = eventsQuery.or(
          `branch_id.eq.${branchId},branch_id.is.null`,
        );
      } else {
        eventsQuery = eventsQuery.is("branch_id", null);
      }

      const { count: eventsCount } = await eventsQuery;

      let attendeesCount = 0;
      if (branchId !== null) {
        const { count } = await supabase
          .from("event_attendance")
          .select("attendance_id, event:events!inner(branch_id)", {
            count: "exact",
            head: true,
          })
          .gte("attended_at", monthStart.toISOString())
          .lte("attended_at", nowIso)
          .in("check_in_method", ["qr", "QR"])
          .or(`event.branch_id.eq.${branchId},event.branch_id.is.null`);
        attendeesCount = count ?? 0;
      } else {
        const { count } = await supabase
          .from("event_attendance")
          .select("attendance_id", { count: "exact", head: true })
          .gte("attended_at", monthStart.toISOString())
          .lte("attended_at", nowIso)
          .in("check_in_method", ["qr", "QR"]);
        attendeesCount = count ?? 0;
      }

      setStats({
        attendees: attendeesCount ?? 0,
        events: eventsCount ?? 0,
      });

      const { data: recent } = await supabase
        .from("event_attendance")
        .select(
          "attendance_id, attended_at, event:events(title, branch_id, start_datetime, end_datetime, cover_image_path, branches(name)), user:users(user_details:users_details(first_name,last_name,branch_id))",
        )
        .in("check_in_method", ["qr", "QR"])
        .order("attended_at", { ascending: false })
        .limit(5);

      const recentRows = (recent ?? []).map((r: any) => ({
        id: r.attendance_id,
        title: r.event?.title || "Event",
        time: formatTimeRange(r.event?.start_datetime, r.event?.end_datetime),
        member:
          [r.user?.user_details?.first_name, r.user?.user_details?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || "Member",
        branch: (() => {
          const derivedBranchId =
            r.event?.branch_id ?? r.user?.user_details?.branch_id ?? null;
          return (
            r.event?.branches?.name ||
            branches.find((b) => b.id === derivedBranchId)?.name ||
            "Unknown"
          );
        })(),
        imageUrl: toEventImageUrl(r.event?.cover_image_path),
        icon: "qr-code" as const,
      }));

      setRecentActivities(recentRows);
    } catch (e) {
      console.error("QR dashboard stats error:", e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

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
      Alert.alert("No Active Event", "No ongoing event found for this branch.");
      return;
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("event_attendance").upsert(
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
      Alert.alert(
        "Attendance",
        error.message || "Failed to record attendance.",
      );
      return;
    }

    const { error: rsvpError } = await supabase.from("event_rsvp").upsert(
      {
        event_id: eventId,
        user_id: memberUserId,
        attended: true,
      },
      { onConflict: "event_id,user_id" },
    );

    if (rsvpError) {
      console.error("QR RSVP update error:", rsvpError);
      Alert.alert(
        "Attendance",
        rsvpError.message || "Attendance recorded, but RSVP update failed.",
      );
      loadStats();
      return;
    }

    loadStats();
    Alert.alert("Attendance", "Attendance recorded via QR.");
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const performLogout = async () => {
    setShowSettings(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("logout failed:", e);
    } finally {
      router.replace("/login");
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      await performLogout();
      return;
    }

    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: performLogout,
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primary }]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View
            style={[styles.statCard, { backgroundColor: `${secondary}20` }]}
          >
            <Text style={styles.statLabel}>Total Attendees</Text>
            <Text style={[styles.statValue, { color: primary }]}>
              {stats.attendees}
            </Text>
          </View>
          <View
            style={[styles.statCard, { backgroundColor: `${secondary}20` }]}
          >
            <Text style={styles.statLabel}>Events</Text>
            <Text style={[styles.statValue, { color: primary }]}>
              {stats.events}
            </Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivities.length === 0 ? (
            <Text style={styles.activityTime}>No recent activity yet.</Text>
          ) : (
            recentActivities.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                {activity.imageUrl ? (
                  <Image
                    source={{ uri: activity.imageUrl }}
                    style={styles.activityThumb}
                  />
                ) : (
                  <View
                    style={[
                      styles.activityIcon,
                      { backgroundColor: `${secondary}20` },
                    ]}
                  >
                    <Ionicons
                      name={activity.icon}
                      size={24}
                      color={secondary}
                    />
                  </View>
                )}
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityMeta}>
                    {activity.member} • {activity.branch}
                  </Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating QR Scanner Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primary }]}
        onPress={openScanner}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code" size={28} color="#fff" />
      </TouchableOpacity>

      {/* QR Scanner Modal */}
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
                    Position the QR code within the frame
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

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View style={styles.settingsModalOverlay}>
          <View style={styles.settingsModalContent}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsOptions}>
              <TouchableOpacity
                style={styles.settingsOption}
                onPress={handleLogout}
              >
                <View
                  style={[
                    styles.settingsOptionIcon,
                    { backgroundColor: "#ff000020" },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={24} color="#ff0000" />
                </View>
                <View style={styles.settingsOptionText}>
                  <Text style={styles.settingsOptionTitle}>Logout</Text>
                  <Text style={styles.settingsOptionSubtitle}>
                    Sign out of your account
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  settingsButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: "flex-start",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "800",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  activityThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#e6ece8",
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scannerInstruction: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 30,
    textAlign: "center",
    paddingHorizontal: 40,
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
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "85%",
    maxWidth: 400,
    overflow: "hidden",
  },
  settingsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingsModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  settingsOptions: {
    padding: 16,
  },
  settingsOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingsOptionText: {
    flex: 1,
  },
  settingsOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  settingsOptionSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
});
