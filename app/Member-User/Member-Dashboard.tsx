import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { DateTime } from "luxon";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { RRule } from "rrule";
import { supabase } from "../../src/lib/supabaseClient";
import CounselingRequest from "./counseling_request";
import MemberNavbar from "./member-navbar";

const { width } = Dimensions.get("window");

// Keep a per-session flag so we only prompt once after login until the app is restarted or the user logs out.
let hasPromptedLocationThisSession = false;

const APP_TZ = "Asia/Manila";

type UnifiedEvent = {
  key: string; // unique key for FlatList / map rendering
  source: "single" | "series";
  event_id?: number;
  series_id?: number;

  title: string;
  description: string | null;
  event_type: string | null;
  location: string | null;

  start_datetime: string; // ISO (with offset)
  end_datetime: string; // ISO (with offset)
  cover_image_path: string | null;

  branch_id: number | null;
  is_open_for_all: boolean;
  status: string | null;
};

const isHttpUrl = (s?: string | null) => !!s && /^https?:\/\//i.test(s);

const formatDateLong = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimeRange = (startIso: string, endIso: string) => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const st = s.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const et = e.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${st} - ${et}`;
};

const getEventImageUrl = (path: string | null) => {
  if (!path) {
    return null;
  }
  if (isHttpUrl(path)) {
    return path;
  }
  // If you store cover images in a bucket (example: "church-event")
  const publicUrl = supabase.storage.from("church-event").getPublicUrl(path)
    .data.publicUrl;
  return publicUrl;
};

const pickBranchId = (usersDetails: any): number | null => {
  if (!usersDetails) return null;
  if (Array.isArray(usersDetails)) {
    return usersDetails.length > 0 ? usersDetails[0]?.branch_id : null;
  }
  return usersDetails.branch_id;
};

function combineDateAndTime(
  dateISO: string,
  timeHHMMSS: string,
  zone = APP_TZ,
) {
  // dateISO: "2026-02-01"
  // time: "07:00:00"
  const [h, m, s] = timeHHMMSS.split(":").map((x) => parseInt(x, 10));
  return DateTime.fromISO(dateISO, { zone }).set({
    hour: h || 0,
    minute: m || 0,
    second: s || 0,
    millisecond: 0,
  });
}

function expandSeriesToOccurrences(args: {
  series: any;
  windowStart: DateTime;
  windowEnd: DateTime;
}): UnifiedEvent[] {
  const { series, windowStart, windowEnd } = args;

  if (!series?.rrule_text) return [];

  // Build a DTSTART based on starts_on + start_time, in Asia/Manila
  const dtStart = combineDateAndTime(
    series.starts_on,
    series.start_time,
    series.timezone || APP_TZ,
  );

  // Parse RRULE (your DB stores something like "FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,MO")
  const rule = RRule.fromString(series.rrule_text);

  // rrule works with JS Date; we feed dates in the series timezone
  const occurrences = rule.between(
    windowStart.toJSDate(),
    windowEnd.toJSDate(),
    true,
  );

  return occurrences.map((occ) => {
    const occStart = DateTime.fromJSDate(occ, {
      zone: series.timezone || APP_TZ,
    }).set({
      hour: dtStart.hour,
      minute: dtStart.minute,
      second: dtStart.second,
      millisecond: 0,
    });

    // End time uses the same date as occStart but with end_time
    const occEnd = combineDateAndTime(
      occStart.toISODate()!,
      series.end_time,
      series.timezone || APP_TZ,
    );

    return {
      key: `series-${series.series_id}-${occStart.toISO()}`,
      source: "series" as const,
      series_id: series.series_id,
      title: series.title,
      description: series.description ?? null,
      event_type: series.event_type ?? null,
      location: series.location ?? null,
      start_datetime: occStart.toISO() ?? new Date().toISOString(),
      end_datetime: occEnd.toISO() ?? new Date().toISOString(),
      cover_image_path: series.cover_image_path ?? null,
      branch_id: series.branch_id ?? null,
      is_open_for_all: !!series.is_open_for_all,
      status: series.status ?? null,
    };
  });
}

// Filter View Components
const AttendanceView = ({ branding }: { branding: any }) => {
  const [loading, setLoading] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [appealReason, setAppealReason] = useState("");
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  const getAppUser = async (): Promise<{
    user_id: number;
    branch_id: number | null;
  } | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select(`user_id, users_details:users_details (branch_id)`)
      .eq("auth_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ getAppUser error:", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const user_id = row?.user_id;
    const branch_id = pickBranchId(row?.users_details);

    if (!user_id) return null;
    return { user_id, branch_id };
  };

  // Load attendance records from database
  const loadAttendanceRecords = async () => {
    setLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        setAttendanceRecords([]);
        return;
      }

      // Assumption: attendance table with event details
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          attendance_id,
          attendance_date,
          status,
          event:events (title, cover_image_path)
        `,
        )
        .eq("user_id", u.user_id)
        .order("attendance_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      const records = (data ?? []).map((record: any) => ({
        id: record.attendance_id,
        title: record.event?.title || "Event",
        date: record.attendance_date
          ? formatDateLong(record.attendance_date)
          : "",
        status: record.status || "Present",
        statusColor: record.status === "Present" ? "#66BB6A" : "#999",
        image: record.event?.cover_image_path
          ? supabase.storage
              .from("church-event")
              .getPublicUrl(record.event.cover_image_path).data.publicUrl
          : "https://via.placeholder.com/400x300?text=Event+Image",
        raw: record,
      }));

      setAttendanceRecords(records);
    } catch (e) {
      console.error("❌ loadAttendanceRecords failed:", e);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceRecords();
  }, []);

  const handleAppealClick = (record: any) => {
    setSelectedRecord(record);
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async () => {
    if (appealReason.trim().length < 10) return;

    setAppealLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        Alert.alert(
          "Error",
          "Unable to submit appeal. Please try again later.",
        );
        return;
      }

      // Assumption: attendance_appeals table
      const { error } = await supabase.from("attendance_appeals").insert({
        user_id: u.user_id,
        attendance_id: selectedRecord?.raw?.attendance_id,
        reason: appealReason.trim(),
        status: "Pending",
        document_url: uploadedFile?.url || null,
      });

      if (error) throw error;

      setShowAppealModal(false);
      setShowConfirmModal(true);
      setTimeout(() => {
        setShowConfirmModal(false);
        setAppealReason("");
        setUploadedFile(null);
        loadAttendanceRecords(); // Reload records
      }, 3000);
    } catch (e) {
      console.error("❌ handleSubmitAppeal failed:", e);
      Alert.alert("Error", "Unable to submit appeal. Please try again later.");
    } finally {
      setAppealLoading(false);
    }
  };

  const handleFileUpload = () => {
    // File upload logic - using a simple simulation
    setUploadedFile({ name: "document.pdf", size: "2.5 MB" });
  };

  return (
    <>
      {/* Appeal Modal */}
      <Modal
        visible={showAppealModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAppealModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.appealModalContent}>
            <View style={styles.appealModalHeader}>
              <TouchableOpacity onPress={() => setShowAppealModal(false)}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.appealModalTitle}>Appeal Absence</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              contentContainerStyle={styles.appealFormContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Event Details */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>Event Details</Text>
                <View style={styles.eventDetailsBox}>
                  <Image
                    source={{ uri: selectedRecord?.image }}
                    style={styles.eventDetailImage}
                    resizeMode="cover"
                  />
                  <View style={styles.eventDetailsText}>
                    <Text style={styles.eventDetailsTitle}>
                      {selectedRecord?.title}
                    </Text>
                    <Text style={styles.eventDetailsDate}>
                      {selectedRecord?.date}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reason for Absent */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>
                  Reason for Absence
                </Text>
                <TextInput
                  style={styles.appealReasonInput}
                  placeholder="Please explain why you were unable to attend..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={5}
                  value={appealReason}
                  onChangeText={setAppealReason}
                  textAlignVertical="top"
                />
              </View>

              {/* Supporting Documents */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>
                  Supporting Documents (Optional)
                </Text>
                {uploadedFile ? (
                  <View style={styles.uploadedFileBox}>
                    <Ionicons
                      name="document"
                      size={24}
                      color={branding?.primary_color || "#064622"}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.uploadedFileName}>
                        {uploadedFile.name}
                      </Text>
                      <Text style={styles.uploadedFileSize}>
                        {uploadedFile.size}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setUploadedFile(null)}>
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadBox}
                    onPress={handleFileUpload}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={32}
                      color={branding?.primary_color || "#064622"}
                    />
                    <Text style={styles.uploadText}>
                      Tap to upload document
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitAppealBtn,
                  {
                    backgroundColor: appealLoading
                      ? "#b0b0b0"
                      : branding?.primary_color || "#064622",
                  },
                ]}
                onPress={handleSubmitAppeal}
                disabled={appealLoading || appealReason.trim().length < 10}
              >
                <Text style={styles.submitAppealBtnText}>
                  {appealLoading ? "Submitting..." : "Submit Appeal"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View
              style={[
                styles.confirmIconBox,
                {
                  backgroundColor: `${branding?.primary_color || "#064622"}20`,
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={60}
                color={branding?.primary_color || "#064622"}
              />
            </View>
            <Text style={styles.confirmTitle}>Appeal Submitted</Text>
            <Text style={styles.confirmMessage}>
              Your appeal has been received. The admin will review your request
              and get back to you shortly.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Attendance Records */}
      <View style={{ padding: 16 }}>
        {loading ? (
          <Text style={styles.filterEmptyText}>
            Loading attendance records...
          </Text>
        ) : attendanceRecords.length === 0 ? (
          <Text style={styles.filterEmptyText}>
            No attendance records found
          </Text>
        ) : (
          attendanceRecords.map((record) => (
            <View key={record.id} style={styles.attendanceCardWithImage}>
              <Image
                source={{ uri: record.image }}
                style={styles.attendanceImage}
                resizeMode="cover"
              />
              <View style={styles.attendanceInfo}>
                <Text style={styles.attendanceTitle}>{record.title}</Text>
                <Text style={styles.attendanceDate}>{record.date}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          record.statusColor === "#66BB6A"
                            ? "#E8F5E9"
                            : "#F5F5F5",
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: record.statusColor }]}
                    >
                      {record.status}
                    </Text>
                  </TouchableOpacity>
                  {record.status === "Absent" && (
                    <TouchableOpacity
                      style={[
                        styles.appealButton,
                        {
                          backgroundColor: branding?.primary_color || "#064622",
                        },
                      ]}
                      onPress={() => handleAppealClick(record)}
                    >
                      <Text style={styles.appealButtonText}>Appeal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );
};

const GivingView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>
      Giving information will appear here
    </Text>
  </View>
);

const MinistryView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>
      Ministry information will appear here
    </Text>
  </View>
);

const EventsView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>
      Events information will appear here
    </Text>
  </View>
);

const ResourcesView = ({ branding }: { branding: any }) => {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [requestDate, setRequestDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState("");

  const [resources, setResources] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);

  const primary = branding?.primary_color || "#064622";

  const getAppUser = async (): Promise<{
    user_id: number;
    branch_id: number | null;
  } | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select(`user_id, users_details:users_details (branch_id)`)
      .eq("auth_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ getAppUser error:", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const user_id = row?.user_id;
    const branch_id = pickBranchId(row?.users_details);

    if (!user_id) return null;
    return { user_id, branch_id };
  };

  // Assumption: you have resources table with:
  // resource_id, name, description, category, image_url, availability, rate, capacity, branch_id
  const loadResources = async () => {
    setLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        setResources([]);
        return;
      }

      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("branch_id", u.branch_id)
        .order("category", { ascending: true })
        .order("name", { ascending: true })
        .limit(50);

      if (error) throw error;

      const rows = (data ?? []).map((r: any) => ({
        id: r.resource_id,
        category: r.category ?? "General",
        name: r.name ?? "Resource",
        description: r.description ?? "",
        image:
          r.image_url ?? "https://via.placeholder.com/400x300?text=No+Image",
        availability: r.availability ?? "Available",
        rate: r.rate ?? "Contact for pricing",
        capacity: r.capacity ?? "N/A",
        raw: r,
      }));

      setResources(rows);

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(rows.map((r) => r.category)));
      setCategories(["All", ...uniqueCategories]);
    } catch (e) {
      console.error("❌ loadResources failed:", e);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const filteredResources = resources.filter((resource) => {
    const matchesSearch =
      resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "All" ||
      resource.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (date: Date) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleViewResource = (resource: any) => {
    setSelectedResource(resource);
  };

  const handleRequestResource = () => {
    setShowRequestModal(true);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setRequestDate(date);
    }
  };

  const handleSubmitRequest = async () => {
    if (purpose.trim().length < 10 || !duration) return;

    setLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        Alert.alert(
          "Error",
          "Unable to submit request. Please try again later.",
        );
        return;
      }

      // Assumption: you have resource_requests table with:
      // request_id, user_id, resource_id, branch_id, purpose, request_date, duration, status, created_at
      const { error } = await supabase.from("resource_requests").insert({
        user_id: u.user_id,
        resource_id: selectedResource.id,
        branch_id: u.branch_id,
        purpose: purpose.trim(),
        request_date: requestDate.toISOString(),
        duration: duration,
        status: "Pending",
      });

      if (error) throw error;

      setShowRequestModal(false);
      setShowConfirmModal(true);

      setTimeout(() => {
        setShowConfirmModal(false);
        setPurpose("");
        setRequestDate(new Date());
        setDuration("");
        setSelectedResource(null);
      }, 3000);
    } catch (e) {
      console.error("❌ handleSubmitRequest failed:", e);
      Alert.alert("Error", "Unable to submit request. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (selectedResource) {
    return (
      <>
        {/* Request Modal */}
        <Modal
          visible={showRequestModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRequestModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resourceModalContent}>
              <View style={styles.resourceModalHeader}>
                <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.resourceModalTitle}>Request Form</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView
                contentContainerStyle={{ padding: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Resource Info */}
                <View style={styles.resourceInfoBox}>
                  <Image
                    source={{ uri: selectedResource.image }}
                    style={styles.resourceInfoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.resourceInfoText}>
                    <Text style={styles.resourceInfoName}>
                      {selectedResource.name}
                    </Text>
                    <Text style={styles.resourceInfoRate}>
                      {selectedResource.rate}
                    </Text>
                  </View>
                </View>

                {/* Purpose */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Purpose / Reason</Text>
                  <TextInput
                    style={styles.resourcePurposeInput}
                    placeholder="Describe the purpose of your request..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    value={purpose}
                    onChangeText={setPurpose}
                    textAlignVertical="top"
                  />
                </View>

                {/* Date */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Requested Date</Text>
                  <TouchableOpacity
                    style={styles.resourceDateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={primary}
                    />
                    <Text
                      style={[
                        styles.resourceDateText,
                        { color: branding?.primary_text_color || "#000" },
                      ]}
                    >
                      {formatDate(requestDate)}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={requestDate}
                      mode="date"
                      display={Platform.OS === "ios" ? "default" : "default"}
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      accentColor={primary}
                    />
                  )}
                </View>

                {/* Duration */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Duration</Text>
                  <View style={styles.durationOptions}>
                    {["Half Day", "Full Day", "2 Days", "3 Days", "Custom"].map(
                      (option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.durationChip,
                            duration === option && {
                              backgroundColor: primary,
                              borderColor: primary,
                            },
                          ]}
                          onPress={() => setDuration(option)}
                        >
                          <Text
                            style={[
                              styles.durationChipText,
                              duration === option && { color: "#fff" },
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitResourceBtn,
                    { backgroundColor: loading ? "#b0b0b0" : primary },
                  ]}
                  onPress={handleSubmitRequest}
                  disabled={loading}
                >
                  <Text style={styles.submitResourceBtnText}>
                    {loading ? "Submitting..." : "Submit Request"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmModalContent}>
              <View
                style={[
                  styles.confirmIconBox,
                  { backgroundColor: `${primary}20` },
                ]}
              >
                <Ionicons name="checkmark-circle" size={64} color={primary} />
              </View>
              <Text style={styles.confirmTitle}>Request Submitted</Text>
              <Text style={styles.confirmMessage}>
                Your resource request has been received. Our team will review it
                and contact you shortly to confirm availability.
              </Text>
            </View>
          </View>
        </Modal>

        {/* Resource Detail View */}
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedResource(null)}
          >
            <Ionicons name="arrow-back" size={24} color={primary} />
            <Text style={[styles.backButtonText, { color: primary }]}>
              Back to Resources
            </Text>
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Image
              source={{ uri: selectedResource.image }}
              style={styles.resourceDetailImage}
              resizeMode="cover"
            />

            <View style={styles.resourceDetailContent}>
              <View style={styles.resourceDetailHeader}>
                <View>
                  <Text style={styles.resourceDetailCategory}>
                    {selectedResource.category}
                  </Text>
                  <Text style={styles.resourceDetailName}>
                    {selectedResource.name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.availabilityBadge,
                    { backgroundColor: `${primary}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.availabilityDot,
                      { backgroundColor: primary },
                    ]}
                  />
                  <Text style={[styles.availabilityText, { color: primary }]}>
                    {selectedResource.availability}
                  </Text>
                </View>
              </View>

              <Text style={styles.resourceDetailDescription}>
                {selectedResource.description}
              </Text>

              <View style={styles.resourceDetailInfo}>
                <View style={styles.resourceDetailInfoItem}>
                  <Ionicons name="pricetag" size={20} color={primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.resourceDetailInfoLabel}>Rate</Text>
                    <Text style={styles.resourceDetailInfoValue}>
                      {selectedResource.rate}
                    </Text>
                  </View>
                </View>
                <View style={styles.resourceDetailInfoItem}>
                  <Ionicons name="people" size={20} color={primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.resourceDetailInfoLabel}>Capacity</Text>
                    <Text style={styles.resourceDetailInfoValue}>
                      {selectedResource.capacity}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.requestResourceBtn,
                  { backgroundColor: primary },
                ]}
                onPress={handleRequestResource}
              >
                <Text style={styles.requestResourceBtnText}>
                  Request This Resource
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Search Bar */}
      <View style={styles.resourceSearchBar}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          placeholder="Search by name or type"
          placeholderTextColor="#999"
          style={styles.resourceSearchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && {
                backgroundColor: primary,
                borderColor: primary,
              },
            ]}
            onPress={() =>
              setSelectedCategory(category === "All" ? null : category)
            }
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && { color: "#fff" },
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resources List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
      >
        {loading ? (
          <Text style={styles.filterEmptyText}>Loading resources...</Text>
        ) : filteredResources.length === 0 ? (
          <Text style={styles.filterEmptyText}>No resources found</Text>
        ) : (
          filteredResources.map((resource) => (
            <View key={resource.id} style={styles.resourceCard}>
              <Image
                source={{ uri: resource.image }}
                style={styles.resourceCardImage}
                resizeMode="cover"
              />
              <View style={styles.resourceCardContent}>
                <Text style={styles.resourceCardCategory}>
                  {resource.category}
                </Text>
                <Text style={styles.resourceCardName}>{resource.name}</Text>
                <Text style={styles.resourceCardDescription} numberOfLines={2}>
                  {resource.description}
                </Text>
                <TouchableOpacity
                  style={styles.resourceViewButton}
                  onPress={() => handleViewResource(resource)}
                >
                  <Text
                    style={[styles.resourceViewButtonText, { color: primary }]}
                  >
                    View
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default function MemberDashboard() {
  const [branding, setBranding] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showGeoAttendanceModal, setShowGeoAttendanceModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] =
    useState<UnifiedEvent | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [openCounselingForm, setOpenCounselingForm] = useState(false);
  const [locationWatcher, setLocationWatcher] =
    useState<Location.LocationSubscription | null>(null);
  const [hasGeoAttendanceRecorded, setHasGeoAttendanceRecorded] =
    useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const scrollY = useRef(new Animated.Value(0)).current;

  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Summary stats state
  const [summaryStats, setSummaryStats] = useState({
    attendanceCount: 0,
    attendanceChange: "",
    givingTotal: "₱0",
    givingPeriod: "This month",
    nextService: "No upcoming services",
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  const eventGeofence = {
    name: "an Event Services/Activities",
    latitude: 14.7792,
    longitude: 120.9817,
    radiusMeters: 120,
  };

  const [calendarMonth, setCalendarMonth] = useState(() => new Date()); // current month

  const monthLabel = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const monthStart = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  );
  const monthEnd = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  );
  const daysInMonth = monthEnd.getDate();

  // Sunday=0..Saturday=6
  const startWeekday = monthStart.getDay();

  // calendar grid: 42 cells (6 weeks)
  const totalCells = 42;

  const eventByDay = useMemo(() => {
    const map: Record<number, UnifiedEvent[]> = {};
    events.forEach((ev) => {
      const d = new Date(ev.start_datetime);
      if (
        d.getFullYear() === calendarMonth.getFullYear() &&
        d.getMonth() === calendarMonth.getMonth()
      ) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(ev);
      }
    });
    return map;
  }, [events, calendarMonth]);

  const goPrevMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
    );
  };

  const goNextMonth = () => {
    setCalendarMonth(
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
    );
  };

  const closeCalendarPreview = () => {
    setShowCalendarPreview(false);
    setSelectedCalendarEvent(null);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);

      // Load member branch + ministries + events
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUserId = authData?.user?.id;

        const { data: appUser } = await supabase
          .from("users")
          .select(`user_id, users_details:users_details (branch_id)`)
          .eq("auth_user_id", authUserId)
          .order("updated_at", { ascending: false })
          .limit(1);

        const appUserRow = Array.isArray(appUser) ? appUser[0] : appUser;
        const uId = appUserRow?.user_id as number | undefined;
        const bId = pickBranchId(appUserRow?.users_details);

        let bmIds: number[] = [];
        if (uId) {
          const { data: ums } = await supabase
            .from("user_ministries")
            .select("branch_ministry_id")
            .eq("user_id", uId)
            .eq("status", "Active");
          bmIds = (ums ?? [])
            .map((x: any) => x.branch_ministry_id)
            .filter(Boolean);
        }

        await loadEventsForMember(bId, bmIds);
        await loadNotifications();
        await loadSummaryStats(); // Load summary stats after events are loaded
      } catch (e) {
        console.error("❌ Failed loading member events:", e);
        setEvents([]);
      }

      // Show permission prompt once per session after login
      if (!hasPromptedLocationThisSession) {
        setShowLocationModal(true);
        hasPromptedLocationThisSession = true;
      }
    })();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, [locationWatcher]);

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const distanceInMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371000; // meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id;
      if (!authUserId) {
        setNotifications([]);
        return;
      }

      const { data: appUser } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_user_id", authUserId)
        .order("updated_at", { ascending: false })
        .limit(1);

      const appUserRow = Array.isArray(appUser) ? appUser[0] : appUser;
      const userId = appUserRow?.user_id;
      if (!userId) {
        setNotifications([]);
        return;
      }

      // Assumption: notifications table:
      // id, user_id, type, title, message, created_at, is_read, icon
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = (data ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        time: n.created_at ? formatDateLong(n.created_at) : "",
        icon: n.icon || "notifications",
        read: !!n.is_read,
        raw: n,
      }));

      setNotifications(rows);
    } catch (e) {
      console.error("❌ loadNotifications failed:", e);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const loadSummaryStats = async () => {
    setSummaryLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id;
      if (!authUserId) return;

      const { data: appUser } = await supabase
        .from("users")
        .select(`user_id, users_details:users_details (branch_id)`)
        .eq("auth_user_id", authUserId)
        .order("updated_at", { ascending: false })
        .limit(1);

      const appUserRow = Array.isArray(appUser) ? appUser[0] : appUser;
      const userId = appUserRow?.user_id;
      const branchId = pickBranchId(appUserRow?.users_details);
      if (!userId) return;

      // Current month date range
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Load attendance count for current month
      let attendanceCount = 0;
      let lastMonthCount = 0;
      try {
        const { data: attendanceData } = await supabase
          .from("attendance")
          .select("attendance_id")
          .eq("user_id", userId)
          .gte("attendance_date", monthStart.toISOString())
          .lte("attendance_date", monthEnd.toISOString());
        attendanceCount = attendanceData?.length ?? 0;

        const { data: lastAttendanceData } = await supabase
          .from("attendance")
          .select("attendance_id")
          .eq("user_id", userId)
          .gte("attendance_date", lastMonthStart.toISOString())
          .lte("attendance_date", lastMonthEnd.toISOString());
        lastMonthCount = lastAttendanceData?.length ?? 0;
      } catch (e) {
        console.error("❌ Attendance query failed:", e);
      }

      // Load giving total for current month
      let givingTotal = 0;
      try {
        const { data: givingData } = await supabase
          .from("giving")
          .select("amount")
          .eq("user_id", userId)
          .gte("date_given", monthStart.toISOString())
          .lte("date_given", monthEnd.toISOString());
        givingTotal =
          givingData?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0;
      } catch (e) {
        console.error("❌ Giving query failed:", e);
      }

      // Find next service/event
      let nextService = "No upcoming services";
      try {
        const upcomingEvents = events.filter(
          (e) => new Date(e.start_datetime) >= now,
        );
        if (upcomingEvents.length > 0) {
          const next = upcomingEvents[0];
          const eventDate = new Date(next.start_datetime);
          const dayOfWeek = eventDate.toLocaleDateString("en-US", {
            weekday: "long",
          });
          const time = eventDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          nextService = `${dayOfWeek} • ${time}`;
        }
      } catch (e) {
        console.error("❌ Next service calculation failed:", e);
      }

      const attendanceChange =
        attendanceCount > lastMonthCount
          ? `+${attendanceCount - lastMonthCount} from last`
          : attendanceCount < lastMonthCount
            ? `-${lastMonthCount - attendanceCount} from last`
            : "Same as last month";

      setSummaryStats({
        attendanceCount,
        attendanceChange,
        givingTotal: `₱${givingTotal.toLocaleString()}`,
        givingPeriod: "This month",
        nextService,
      });
    } catch (e) {
      console.error("❌ loadSummaryStats failed:", e);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadEventsForMember = async (
    branchId: number | null,
    bmIds: number[],
  ) => {
    setEventsLoading(true);

    try {
      const statuses = ["Scheduled", "Published", "Active", "Approved"];

      // ---------- A) One-time events (events table) ----------
      // Open-to-all: branch-specific OR global (branch_id is null)
      let openEventsQuery = supabase
        .from("events")
        .select("*")
        .in("status", statuses)
        .eq("is_open_for_all", true)
        .order("start_datetime", { ascending: true });

      // include branch match + global
      if (branchId !== null) {
        openEventsQuery = openEventsQuery.or(
          `branch_id.eq.${branchId},branch_id.is.null`,
        );
      } else {
        openEventsQuery = openEventsQuery.is("branch_id", null);
      }

      const { data: openEvents, error: openErr } = await openEventsQuery;
      if (openErr) throw openErr;

      // Targeted events via event_audiences (still should allow global events if you ever do that)
      let targetedEvents: any[] = [];
      if (bmIds.length > 0) {
        const { data: aud, error: audErr } = await supabase
          .from("event_audiences")
          .select("event_id")
          .in("branch_ministry_id", bmIds);

        if (audErr) throw audErr;

        const targetedEventIds = Array.from(
          new Set((aud ?? []).map((a: any) => a.event_id)),
        ).filter(Boolean);

        if (targetedEventIds.length > 0) {
          let targetedQuery = supabase
            .from("events")
            .select("*")
            .in("status", statuses)
            .in("event_id", targetedEventIds)
            .order("start_datetime", { ascending: true });

          // if your targeted events are always within the branch, keep this; otherwise allow NULL too
          if (branchId !== null)
            targetedQuery = targetedQuery.or(
              `branch_id.eq.${branchId},branch_id.is.null`,
            );
          else targetedQuery = targetedQuery.is("branch_id", null);

          const { data: e2, error: e2Err } = await targetedQuery;
          if (e2Err) throw e2Err;
          targetedEvents = e2 ?? [];
        }
      }

      const singles: UnifiedEvent[] = [
        ...(openEvents ?? []),
        ...(targetedEvents ?? []),
      ].map((ev: any) => ({
        key: `event-${ev.event_id}`,
        source: "single",
        event_id: ev.event_id,
        title: ev.title,
        description: ev.description ?? null,
        event_type: ev.event_type ?? null,
        location: ev.location ?? null,
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        cover_image_path: ev.cover_image_path ?? null,
        branch_id: ev.branch_id ?? null,
        is_open_for_all: !!ev.is_open_for_all,
        status: ev.status ?? null,
      }));

      // ---------- B) Recurring series (event_series table) ----------
      // Open-to-all series: branch-specific OR global (branch_id is null)
      let openSeriesQuery = supabase
        .from("event_series")
        .select("*")
        .eq("is_active", true)
        .eq("is_open_for_all", true)
        .in("status", ["Approved", "Active", "Published"]) // include your actual statuses
        .order("starts_on", { ascending: true });

      if (branchId !== null)
        openSeriesQuery = openSeriesQuery.or(
          `branch_id.eq.${branchId},branch_id.is.null`,
        );
      else openSeriesQuery = openSeriesQuery.is("branch_id", null);

      const { data: openSeries, error: seriesErr } = await openSeriesQuery;
      if (seriesErr) throw seriesErr;

      // Targeted series via event_series_audiences
      let targetedSeries: any[] = [];
      if (bmIds.length > 0) {
        const { data: sa, error: saErr } = await supabase
          .from("event_series_audiences")
          .select("series_id")
          .in("branch_ministry_id", bmIds);

        if (saErr) throw saErr;

        const seriesIds = Array.from(
          new Set((sa ?? []).map((x: any) => x.series_id)),
        ).filter(Boolean);

        if (seriesIds.length > 0) {
          let targetedSeriesQuery = supabase
            .from("event_series")
            .select("*")
            .eq("is_active", true)
            .in("series_id", seriesIds)
            .in("status", ["Approved", "Active", "Published"])
            .order("starts_on", { ascending: true });

          if (branchId !== null)
            targetedSeriesQuery = targetedSeriesQuery.or(
              `branch_id.eq.${branchId},branch_id.is.null`,
            );
          else targetedSeriesQuery = targetedSeriesQuery.is("branch_id", null);

          const { data: ts, error: tsErr } = await targetedSeriesQuery;
          if (tsErr) throw tsErr;
          targetedSeries = ts ?? [];
        }
      }

      const allSeries = [...(openSeries ?? []), ...(targetedSeries ?? [])];
      const uniqSeriesMap = new Map<number, any>();
      allSeries.forEach((s: any) => uniqSeriesMap.set(s.series_id, s));
      const uniqSeries = Array.from(uniqSeriesMap.values());

      // Expand to occurrences (e.g., next 90 days)
      const windowStart = DateTime.now().setZone(APP_TZ).startOf("day");
      const windowEnd = windowStart.plus({ days: 90 }).endOf("day");

      const seriesOccurrences = uniqSeries.flatMap((s: any) =>
        expandSeriesToOccurrences({ series: s, windowStart, windowEnd }),
      );

      // ---------- C) Merge everything + sort ----------
      const merged = [...singles, ...seriesOccurrences];

      // Unique by key already; just sort by start date
      merged.sort(
        (a, b) =>
          new Date(a.start_datetime).getTime() -
          new Date(b.start_datetime).getTime(),
      );

      setEvents(merged);
    } catch (e) {
      console.error("❌ loadEventsForMember failed:", e);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const startGeofenceWatcher = async () => {
    try {
      if (locationWatcher) {
        locationWatcher.remove();
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 15,
          timeInterval: 15000,
        },
        (position) => {
          const { latitude, longitude } = position.coords;
          const distance = distanceInMeters(
            latitude,
            longitude,
            eventGeofence.latitude,
            eventGeofence.longitude,
          );

          if (
            distance <= eventGeofence.radiusMeters &&
            !hasGeoAttendanceRecorded
          ) {
            setHasGeoAttendanceRecorded(true);
            setShowGeoAttendanceModal(true);
          }
        },
      );

      setLocationWatcher(subscription);
    } catch (err) {
      console.error("Error starting geofence watcher:", err);
    }
  };

  const generateQR = async () => {
    try {
      const timestamp = new Date().toISOString();
      const qrData = JSON.stringify({ type: "check-in", timestamp });

      const svg = await new Promise<string>((resolve, reject) => {
        QRCode.toString(
          qrData,
          { type: "svg", width: 320, margin: 2 } as any,
          (err, url) => {
            if (err) reject(err);
            else resolve(url);
          },
        );
      });

      setQrSvg(svg);
      setShowQRModal(true);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleLocationPermission = async (enable: boolean) => {
    try {
      if (enable) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          await AsyncStorage.setItem("location_permission_enabled", "true");
          startGeofenceWatcher();

          // Close location modal first
          setShowLocationModal(false);

          // Show attendance detected modal after a brief delay
          setTimeout(() => {
            setShowGeoAttendanceModal(true);
          }, 400);
          return;
        }
      } else {
        await AsyncStorage.setItem("location_permission_enabled", "false");
        if (locationWatcher) {
          locationWatcher.remove();
        }
        setLocationWatcher(null);
        setHasGeoAttendanceRecorded(false);
      }

      setShowLocationModal(false);
    } catch (error) {
      console.error("Error handling location permission:", error);
      setShowLocationModal(false);
    }
  };

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  const searchBarOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const searchSectionHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [120, 0],
    extrapolate: "clamp",
  });

  const AnimatedCard = ({ children, delay = 0 }: any) => {
    const [anim] = useState(new Animated.Value(0));

    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }).start();
    }, [anim, delay]);

    return (
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    );
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const upcomingEvents = events.filter(
    (e) => new Date(e.start_datetime) >= startOfToday,
  );
  const announcements = upcomingEvents.slice(0, 2);
  const upcomingCards = upcomingEvents.slice(0, 6);

  const openEventDetails = (eventId: number | undefined) => {
    if (!eventId) {
      console.warn("Cannot open event details: missing event ID");
      return;
    }
    router.push(`/Member-User/event-details?eventId=${eventId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      {/* Location Permission Modal */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.permissionIconContainer,
                { backgroundColor: `${primary}20` },
              ]}
            >
              <Ionicons name="location" size={48} color={primary} />
            </View>

            <Text style={styles.modalTitle}>Enable Location Access</Text>
            <Text style={styles.modalSubtitle}>
              We use your location to provide personalized content and improve
              your experience. You can change this in settings anytime.
            </Text>

            <View style={styles.geofenceInfoBox}>
              <Text style={[styles.geofenceTitle, { textAlign: "center" }]}>
                Geofencing for Attendance Tracking & Engagement
              </Text>
              <Text style={styles.geofenceBody}>
                Automatic attendance when you arrive at the venue and
                location-based reminders for nearby events. Keep location on so
                we can detect when you reach {eventGeofence.name}.
              </Text>
            </View>

            <View style={styles.permissionButtons}>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  styles.permissionButtonDisable,
                ]}
                onPress={() => handleLocationPermission(false)}
              >
                <Text style={styles.permissionButtonTextDisable}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: primary }]}
                onPress={() => handleLocationPermission(true)}
              >
                <Text style={styles.permissionButtonTextEnable}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Geofence Attendance Confirmation Modal */}
      <Modal
        visible={showGeoAttendanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGeoAttendanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={[
                styles.confirmModalContent,
                { maxWidth: 380, width: "90%" },
              ]}
            >
              <View
                style={[
                  styles.confirmIconBox,
                  { backgroundColor: `${primary}20` },
                ]}
              >
                <Ionicons name="location" size={64} color={primary} />
              </View>
              <Text style={styles.confirmTitle}>
                Location-Based Member Engagement
              </Text>

              <View style={styles.engagementSection}>
                <View style={styles.engagementItem}>
                  <Ionicons name="notifications" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>
                      Targeted Notifications
                    </Text>
                    <Text style={styles.engagementItemText}>
                      Receive location-aware alerts when you are near church
                      events or ministry activities. If you are in the vicinity,
                      we will notify you about what is happening
                      (e.g.&quot;Youth Fellowship is starting soon at the main
                      church&quot;).
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="people" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>
                      Improved Event Participation
                    </Text>
                    <Text style={styles.engagementItemText}>
                      GPS-based alerts when you are close to an event increase
                      your chances of attendance. We will remind you when you
                      are nearby, making it easier to join.
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="business" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>
                      Branch Visit Recommendations
                    </Text>
                    <Text style={styles.engagementItemText}>
                      Near a satellite branch? Get notified about events,
                      services, or branch-specific initiatives happening at the
                      location closest to you.
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="calendar" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>
                      Event Alerts & Reminders
                    </Text>
                    <Text style={styles.engagementItemText}>
                      Receive push notifications when you are near the church
                      during scheduled services or special events. Stay
                      connected and never miss what is happening.
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.highlightBox,
                  { backgroundColor: `${secondary}15`, borderColor: secondary },
                ]}
              >
                <Ionicons name="checkmark-circle" size={24} color={secondary} />
                <Text
                  style={[
                    styles.highlightText,
                    { color: "#1a1a1a", marginLeft: 8 },
                  ]}
                >
                  You are now connected! We have detected your presence at{" "}
                  {eventGeofence.name}.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.refreshButton,
                  { backgroundColor: secondary, marginTop: 12 },
                ]}
                onPress={() => setShowGeoAttendanceModal(false)}
              >
                <Text style={styles.refreshButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationsModalContent}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notificationItem,
                    { backgroundColor: notif.read ? "#fff" : `${primary}08` },
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      { backgroundColor: `${primary}20` },
                    ]}
                  >
                    <Ionicons
                      name={notif.icon as any}
                      size={22}
                      color={primary}
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>
                        {notif.title}
                      </Text>
                      {!notif.read && (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: secondary },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={styles.notificationMessage}>
                      {notif.message}
                    </Text>
                    <Text style={styles.notificationTime}>{notif.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRModal(false)}
            >
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Check-In QR Code</Text>
            <Text style={styles.modalSubtitle}>
              Show this code to mark your attendance
            </Text>

            <View style={styles.qrDisplayContainer}>
              {qrSvg ? (
                <SvgXml xml={qrSvg} width={320} height={320} />
              ) : (
                <Text>Generating...</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: secondary }]}
              onPress={generateQR}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>Refresh Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header - Fixed */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: primary,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {logo ? (
              <Image
                source={{ uri: logo }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View
                style={[
                  styles.logoPlaceholder,
                  { borderColor: secondary, borderWidth: 2 },
                ]}
              />
            )}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={[styles.badge, { backgroundColor: secondary }]}>
                <Text style={styles.badgeText}>
                  {notifications.filter((n) => !n.read).length}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push("/Member-User/profile")}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search + Quick Actions - Inside Header */}
        <Animated.View
          style={{
            height: searchSectionHeight,
            opacity: searchBarOpacity,
            overflow: "hidden",
          }}
        >
          <View
            style={[
              styles.searchBar,
              {
                borderColor: searchFocused
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.2)",
                backgroundColor: "rgba(255,255,255,0.15)",
              },
            ]}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <TextInput
              placeholder="Search events, resources..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={[styles.searchInput, { color: "#fff" }]}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchFocused && (
              <TouchableOpacity onPress={() => setSearchFocused(false)}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="rgba(255,255,255,0.7)"
                />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {[
              { icon: "calendar-outline", label: "Attendance" },
              { icon: "help-circle-outline", label: "Counseling" },
              { icon: "library-outline", label: "Resources" },
            ].map((a, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.actionChip,
                  {
                    borderColor:
                      activeFilter === a.label
                        ? secondary
                        : "rgba(255,255,255,0.3)",
                    backgroundColor:
                      activeFilter === a.label ? secondary : "transparent",
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  const nextFilter = activeFilter === a.label ? null : a.label;
                  setActiveFilter(nextFilter);
                  if (nextFilter === "Counseling") {
                    setOpenCounselingForm(true);
                  } else {
                    setOpenCounselingForm(false);
                  }
                }}
              >
                <View
                  style={[
                    styles.actionChipIcon,
                    {
                      backgroundColor:
                        activeFilter === a.label
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.2)",
                    },
                  ]}
                >
                  <Ionicons name={a.icon as any} size={18} color="#fff" />
                </View>
                <Text style={[styles.actionChipText, { color: "#fff" }]}>
                  {a.label}
                </Text>
                {activeFilter === a.label && (
                  <Ionicons
                    name="close"
                    size={14}
                    color="#fff"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Filtered Content or Main Dashboard */}
      {activeFilter ? (
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>{activeFilter}</Text>
          </View>
          {activeFilter === "Attendance" && (
            <AttendanceView branding={branding} />
          )}
          {activeFilter === "Giving" && <GivingView branding={branding} />}
          {activeFilter === "Ministry" && <MinistryView branding={branding} />}
          {activeFilter === "Counseling" && (
            <CounselingRequest
              branding={branding}
              autoOpenRequest={openCounselingForm}
              onAutoOpenHandled={() => setOpenCounselingForm(false)}
              styles={styles}
            />
          )}
          {activeFilter === "Events" && <EventsView branding={branding} />}
          {activeFilter === "Resources" && (
            <ResourcesView branding={branding} />
          )}
        </ScrollView>
      ) : (
        <Animated.ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          {/* Welcome */}
          <AnimatedCard delay={100}>
            <View style={styles.section}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={[styles.welcomeText, { color: "#1a1a1a" }]}>
                  Welcome back!
                </Text>
              </View>
              <Text style={[styles.welcomeSubtext, { color: "#666666" }]}>
                Here&apos;s what&apos;s happening today
              </Text>
            </View>
          </AnimatedCard>

          {/* Summary Card */}
          <AnimatedCard delay={200}>
            <View style={styles.section}>
              <View
                style={[
                  styles.summaryCard,
                  { borderColor: "#e0e0e0", backgroundColor: "#ffffff" },
                ]}
              >
                <View style={styles.summaryRow}>
                  <TouchableOpacity
                    style={styles.summaryItem}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.summaryIconWrap,
                        {
                          backgroundColor: `${secondary}18`,
                          borderColor: `${secondary}60`,
                        },
                      ]}
                    >
                      <Ionicons name="calendar" size={22} color={secondary} />
                    </View>
                    <View>
                      <Text style={styles.summaryLabel}>Attendance</Text>
                      <Text style={styles.summaryValue}>
                        {summaryLoading
                          ? "Loading..."
                          : `${summaryStats.attendanceCount} this month`}
                      </Text>
                      {!summaryLoading && summaryStats.attendanceChange && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <Ionicons
                            name={
                              summaryStats.attendanceChange.startsWith("+")
                                ? "trending-up"
                                : summaryStats.attendanceChange.startsWith("-")
                                  ? "trending-down"
                                  : "remove"
                            }
                            size={12}
                            color={secondary}
                          />
                          <Text
                            style={[styles.summaryChange, { color: secondary }]}
                          >
                            {summaryStats.attendanceChange}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.summaryItem}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.summaryIconWrap,
                        {
                          backgroundColor: `${secondary}18`,
                          borderColor: `${secondary}60`,
                        },
                      ]}
                    >
                      <Ionicons name="cash" size={22} color={secondary} />
                    </View>
                    <View>
                      <Text style={styles.summaryLabel}>Giving</Text>
                      <Text style={styles.summaryValue}>
                        {summaryLoading
                          ? "Loading..."
                          : summaryStats.givingTotal}
                      </Text>
                      <Text
                        style={[styles.summaryChange, { color: secondary }]}
                      >
                        {summaryStats.givingPeriod}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <View
                  style={[styles.divider, { backgroundColor: "#e0e0e0" }]}
                />
                <TouchableOpacity
                  style={styles.summaryFooter}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.nextEventBadge,
                      { backgroundColor: `${secondary}20` },
                    ]}
                  >
                    <Ionicons name="time" size={16} color={secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryFooterLabel}>Next Service</Text>
                    <Text style={styles.summaryFooterText}>
                      {summaryLoading ? "Loading..." : summaryStats.nextService}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#cfd6cf" />
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedCard>

          {/* Counseling CTA */}
          <AnimatedCard delay={250}>
            <View style={styles.section}>
              <View style={[styles.sectionCard, styles.supportCard]}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={styles.supportTextContainer}>
                    <Text style={styles.supportTitle}>Need counseling?</Text>
                    <Text style={styles.supportSubtitle}>
                      Send a request to the pastoral team and we will schedule a
                      time to talk.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.supportButton, { backgroundColor: primary }]}
                    onPress={() => {
                      setActiveFilter("Counseling");
                      setOpenCounselingForm(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.supportButtonText}>Open form</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </AnimatedCard>

          {/* Announcements */}
          <AnimatedCard delay={300}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>
                  <Ionicons name="megaphone" size={18} color={primary} />
                  &nbsp; &nbsp;Announcements
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActiveFilter("Events")}
                >
                  <Text style={[styles.seeAll, { color: primary }]}>
                    See All →
                  </Text>
                </TouchableOpacity>
              </View>

              {eventsLoading ? (
                <Text style={{ color: "#666" }}>Loading announcements…</Text>
              ) : announcements.length === 0 ? (
                <Text style={{ color: "#666" }}>No announcements yet.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.announcementScroll}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {announcements.map((ev) => {
                    const img = getEventImageUrl(ev.cover_image_path);
                    return (
                      <TouchableOpacity
                        key={ev.key}
                        style={[
                          styles.announcementCard,
                          {
                            backgroundColor: "#ffffff",
                            borderColor: "#e0e0e0",
                            borderWidth: 1.5,
                          },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => openEventDetails(ev.event_id)}
                        disabled={!ev.event_id}
                      >
                        {img ? (
                          <Image
                            source={{ uri: img }}
                            style={styles.announcementImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.announcementImage,
                              {
                                backgroundColor: "#f0f0f0",
                                justifyContent: "center",
                                alignItems: "center",
                              },
                            ]}
                          >
                            <Text style={{ color: "#999", fontSize: 12 }}>
                              No Image
                            </Text>
                          </View>
                        )}

                        <View style={styles.announcementContent}>
                          <View style={styles.announcementHeader}>
                            <View
                              style={[
                                styles.announcementBadge,
                                { backgroundColor: `${secondary}20` },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.announcementBadgeText,
                                  { color: secondary },
                                ]}
                              >
                                EVENT
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.announcementText,
                              { color: "#1a1a1a" },
                            ]}
                            numberOfLines={2}
                          >
                            {ev.title}
                          </Text>

                          <View style={styles.announcementFooter}>
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color="#666"
                            />
                            <Text
                              style={[
                                styles.announcementDate,
                                { color: "#666" },
                              ]}
                            >
                              {formatDateLong(ev.start_datetime)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </AnimatedCard>

          {/* Upcoming Events */}
          <AnimatedCard delay={400}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons name="calendar" size={18} color={primary} />
                  <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>
                    Upcoming Events
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setActiveFilter("Events")}
                >
                  <Text style={[styles.seeAll, { color: primary }]}>
                    See All →
                  </Text>
                </TouchableOpacity>
              </View>

              {eventsLoading ? (
                <Text style={{ color: "#666" }}>Loading events…</Text>
              ) : upcomingCards.length === 0 ? (
                <Text style={{ color: "#666" }}>No upcoming events.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.eventScroll}
                  contentContainerStyle={{ paddingRight: 16 }}
                >
                  {upcomingCards.map((ev) => {
                    const img = getEventImageUrl(ev.cover_image_path);
                    return (
                      <TouchableOpacity
                        key={ev.key}
                        style={[
                          styles.eventCard,
                          {
                            backgroundColor: "#ffffff",
                            borderColor: "#e0e0e0",
                            borderWidth: 1.5,
                          },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => openEventDetails(ev.event_id)}
                        disabled={!ev.event_id}
                      >
                        {img ? (
                          <Image
                            source={{ uri: img }}
                            style={styles.eventImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.eventImage,
                              {
                                backgroundColor: "#f0f0f0",
                                justifyContent: "center",
                                alignItems: "center",
                              },
                            ]}
                          >
                            <Text style={{ color: "#999", fontSize: 12 }}>
                              No Image
                            </Text>
                          </View>
                        )}

                        <View style={styles.eventContent}>
                          <View
                            style={[
                              styles.eventIconWrap,
                              { backgroundColor: secondary },
                            ]}
                          >
                            <Ionicons name="star" size={20} color="#fff" />
                          </View>

                          <Text style={styles.eventTitle} numberOfLines={2}>
                            {ev.title}
                          </Text>

                          <View style={styles.eventFooter}>
                            <Ionicons name="calendar" size={12} color="#666" />
                            <Text style={styles.eventDate}>
                              {formatDateLong(ev.start_datetime)}
                            </Text>
                          </View>

                          <View style={styles.eventFooter}>
                            <Ionicons name="time" size={12} color="#666" />
                            <Text style={styles.eventDate}>
                              {formatTimeRange(
                                ev.start_datetime,
                                ev.end_datetime,
                              )}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </AnimatedCard>

          {/* Calendar */}
          <AnimatedCard delay={500}>
            <View style={styles.section}>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons name="calendar" size={18} color={primary} />
                    <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>
                      Calendar
                    </Text>
                  </View>
                </View>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    style={styles.calendarNav}
                    activeOpacity={0.7}
                    onPress={goPrevMonth}
                  >
                    <Ionicons name="chevron-back" size={20} color="#333333" />
                  </TouchableOpacity>

                  <Text style={styles.calendarMonth}>{monthLabel}</Text>

                  <TouchableOpacity
                    style={styles.calendarNav}
                    activeOpacity={0.7}
                    onPress={goNextMonth}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#333333"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.calendarWeekRow}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <Text key={`weekday-${i}`} style={styles.calendarWeekDay}>
                      {d}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {Array.from({ length: totalCells }).map((_, idx) => {
                    const dayNumber = idx - startWeekday + 1;
                    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

                    const dayEvents = inMonth
                      ? (eventByDay[dayNumber] ?? [])
                      : [];
                    const isEvent = dayEvents.length > 0;

                    const today = new Date();
                    const isToday =
                      inMonth &&
                      dayNumber === today.getDate() &&
                      calendarMonth.getMonth() === today.getMonth() &&
                      calendarMonth.getFullYear() === today.getFullYear();

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.calendarCell,
                          isToday && {
                            backgroundColor: `${primary}30`,
                            borderRadius: 8,
                          },
                          isEvent && {
                            backgroundColor: `${secondary}20`,
                            borderRadius: 8,
                          },
                        ]}
                        activeOpacity={0.7}
                        disabled={!inMonth}
                        onPress={() => {
                          if (!inMonth || !isEvent) return;
                          // If multiple events in a day, open the earliest one.
                          const chosen = [...dayEvents].sort(
                            (a, b) =>
                              new Date(a.start_datetime).getTime() -
                              new Date(b.start_datetime).getTime(),
                          )[0];
                          if (chosen.event_id) {
                            openEventDetails(chosen.event_id);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            !inMonth && { color: "#5a625a" },
                            isEvent && {
                              color: secondary,
                              fontWeight: "800" as any,
                            },
                            isToday && {
                              color: primary,
                              fontWeight: "900" as any,
                            },
                          ]}
                        >
                          {inMonth ? dayNumber : ""}
                        </Text>

                        {isEvent && (
                          <View
                            style={[
                              styles.eventDot,
                              { backgroundColor: secondary },
                            ]}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </AnimatedCard>

          <Modal
            visible={showCalendarPreview && !!selectedCalendarEvent}
            transparent
            animationType="fade"
            onRequestClose={closeCalendarPreview}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.eventPreviewCard,
                  { borderColor: `${primary}25` },
                ]}
              >
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeCalendarPreview}
                >
                  <Ionicons name="close" size={22} color="#1a1a1a" />
                </TouchableOpacity>
                {selectedCalendarEvent?.cover_image_path ? (
                  <Image
                    source={{
                      uri:
                        getEventImageUrl(
                          selectedCalendarEvent.cover_image_path,
                        ) || "https://via.placeholder.com/300x200",
                    }}
                    style={styles.eventPreviewImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.eventPreviewImage,
                      {
                        backgroundColor: "#f0f0f0",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ color: "#999" }}>No Image</Text>
                  </View>
                )}
                <View style={styles.eventPreviewBody}>
                  <Text style={styles.eventPreviewTitle}>
                    {selectedCalendarEvent?.title}
                  </Text>
                  <Text style={styles.eventPreviewSummary}>
                    {selectedCalendarEvent?.description ||
                      "No description available"}
                  </Text>
                  <View style={styles.eventPreviewMetaRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#1a1a1a"
                    />
                    <Text style={styles.eventPreviewMetaText}>
                      {selectedCalendarEvent?.start_datetime
                        ? formatDateLong(selectedCalendarEvent.start_datetime)
                        : "Date TBA"}
                    </Text>
                  </View>
                  <View style={styles.eventPreviewMetaRow}>
                    <Ionicons name="time-outline" size={16} color="#1a1a1a" />
                    <Text style={styles.eventPreviewMetaText}>
                      {selectedCalendarEvent?.start_datetime &&
                      selectedCalendarEvent?.end_datetime
                        ? formatTimeRange(
                            selectedCalendarEvent.start_datetime,
                            selectedCalendarEvent.end_datetime,
                          )
                        : "Time TBA"}
                    </Text>
                  </View>
                  <View style={styles.eventPreviewMetaRow}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color="#1a1a1a"
                    />
                    <Text style={styles.eventPreviewMetaText}>
                      {selectedCalendarEvent?.location || "Location TBA"}
                    </Text>
                  </View>
                  <View style={styles.eventPreviewActions}>
                    <TouchableOpacity
                      style={[
                        styles.eventPreviewButton,
                        { backgroundColor: primary },
                      ]}
                      onPress={closeCalendarPreview}
                    >
                      <Text style={styles.eventPreviewButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          <View style={{ height: 20 }} />
        </Animated.ScrollView>
      )}

      {/* Floating QR Button */}
      <TouchableOpacity
        style={[styles.fabQR, { backgroundColor: primary }]}
        onPress={generateQR}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code" size={28} color="#fff" />
      </TouchableOpacity>

      <MemberNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  headerLeft: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  welcomeSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#cfd6cf",
    marginTop: 4,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "500",
    color: "#0a1612",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  announcementScroll: {
    marginRight: -16,
  },
  announcementCard: {
    width: width - 80,
    marginRight: 12,
    borderRadius: 14,
    overflow: "hidden",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  announcementImage: {
    width: "100%",
    height: 140,
  },
  announcementContent: {
    padding: 18,
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  announcementBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  announcementBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  announcementText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
    lineHeight: 22,
  },
  announcementFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  announcementDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  eventScroll: {
    marginRight: -16,
  },
  eventCard: {
    width: width - 100,
    marginRight: 12,
    borderRadius: 14,
    overflow: "hidden",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  eventImage: {
    width: "100%",
    height: 120,
  },
  eventContent: {
    padding: 18,
  },
  eventIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
    lineHeight: 20,
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calendarNav: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  calendarMonth: {
    color: "#1a1a1a",
    fontSize: 15,
    fontWeight: "800",
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  calendarWeekDay: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
    width: (width - 64) / 7,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  calendarCell: {
    width: (width - 64) / 7,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
    position: "relative",
  },
  calendarDayText: {
    color: "#1a1a1a",
    fontSize: 13,
    fontWeight: "700",
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: 6,
  },

  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 25,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 8,
  },
  actionChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: {
    fontSize: 9,
    fontWeight: "600",
  },
  sectionCard: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#ffffff",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#ffffff",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  summaryValue: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryChange: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  summaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextEventBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryFooterLabel: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  summaryFooterText: {
    color: "#1a1a1a",
    fontSize: 13,
    fontWeight: "800",
  },
  supportCard: {
    backgroundColor: "#f3f7f3",
    borderColor: "#e0e5df",
  },
  supportTextContainer: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  supportSubtitle: {
    fontSize: 13,
    color: "#4f5d4f",
    lineHeight: 18,
  },
  supportButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  supportButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  fabQR: {
    position: "absolute",
    right: 18,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "85%",
    maxWidth: 400,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
    marginTop: 20,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  eventPreviewCard: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  eventPreviewImage: {
    width: "100%",
    height: 180,
  },
  eventPreviewBody: {
    padding: 16,
  },
  eventPreviewTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  eventPreviewTagText: {
    fontSize: 11,
    fontWeight: "800",
  },
  eventPreviewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  eventPreviewSummary: {
    marginTop: 8,
    fontSize: 13,
    color: "#4f5d4f",
    lineHeight: 19,
  },
  eventPreviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  eventPreviewMetaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  eventPreviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  eventPreviewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  eventPreviewButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  geofenceInfoBox: {
    width: "100%",
    backgroundColor: "#f4f6f4",
    borderWidth: 1,
    borderColor: "#e0e5df",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  geofenceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  geofenceBody: {
    marginTop: 6,
    fontSize: 13,
    color: "#4f5d4f",
    lineHeight: 18,
  },
  qrDisplayContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permissionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  permissionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionButtonDisable: {
    backgroundColor: "#f0f0f0",
  },
  permissionButtonTextDisable: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  permissionButtonTextEnable: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  filterHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  attendanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  attendanceTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  attendanceDate: {
    fontSize: 12,
    color: "#999",
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  filterEmptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginVertical: 32,
  },
  attendanceCardWithImage: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  attendanceImage: {
    width: "100%",
    height: 140,
  },
  attendanceInfo: {
    padding: 12,
  },
  appealButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  appealButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  appealModalContent: {
    backgroundColor: "#fff",
    height: "90%",
    width: "95%",
    marginTop: "auto",
    marginHorizontal: "2.5%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  appealModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  appealModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  appealFormContainer: {
    padding: 16,
  },
  appealSection: {
    marginBottom: 20,
  },
  appealSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
  },
  eventDetailsBox: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  eventDetailImage: {
    width: 100,
    height: 100,
  },
  eventDetailsText: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  eventDetailsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  eventDetailsDate: {
    fontSize: 12,
    color: "#999",
  },
  appealReasonInput: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: "#1a1a1a",
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    fontWeight: "600",
  },
  uploadedFileBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  uploadedFileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  uploadedFileSize: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  submitAppealBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 20,
  },
  submitAppealBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  confirmModalContent: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  engagementSection: {
    width: "100%",
    marginVertical: 16,
    gap: 16,
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  engagementItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  engagementItemText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  highlightBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    width: "100%",
    marginTop: 8,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    lineHeight: 18,
  },
  notificationsModalContent: {
    backgroundColor: "#fff",
    height: "90%",
    width: "100%",
    marginTop: "auto",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  notificationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  notificationsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a1a1a",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: "#999",
  },
  counselingHistoryTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 20,
  },
  counselingHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  counselingHistoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  counselingHistoryInfo: {
    flex: 1,
  },
  counselingHistoryDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  counselingHistoryPastor: {
    fontSize: 14,
    fontWeight: "600",
  },
  counselingHistoryType: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    marginTop: 2,
  },
  counselingHistoryStatus: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  requestCounselingBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  requestCounselingBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  counselingModalContent: {
    backgroundColor: "#fff",
    height: "75%",
    maxHeight: "85%",
    width: "92%",
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
  },
  counselingFormContainer: {
    flex: 1,
    padding: 16,
  },
  counselingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  counselingHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  counselingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  counselingSubtitle: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
  },
  counselingFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  counselingFieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  counselingOptionalTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f5d4f",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#e8efe8",
    borderRadius: 10,
  },
  counselingHelperText: {
    fontSize: 12,
    color: "#777",
  },
  counselingConcernInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: "#1a1a1a",
    textAlignVertical: "top",
    minHeight: 140,
    marginBottom: 16,
  },
  counselingTypeInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 16,
  },
  counselingDateInputContainer: {
    position: "relative",
    marginBottom: 24,
    zIndex: 1,
  },
  counselingDateInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 40,
    justifyContent: "center",
    minHeight: 48,
  },
  counselingDateText: {
    fontSize: 14,
  },
  counselingDateIcon: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  datePickerContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    overflow: "hidden",
    marginVertical: 8,
  },
  iosPickerButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    marginBottom: 16,
  },
  iosPickerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  iosPickerBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  counselingButtonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  counselingCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  counselingCancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
  },
  counselingSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  counselingSubmitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  resourceSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  resourceSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#1a1a1a",
  },
  categoryFilter: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  resourceCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  resourceCardImage: {
    width: 120,
    height: 140,
  },
  resourceCardContent: {
    flex: 1,
    padding: 12,
  },
  resourceCardCategory: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resourceCardName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  resourceCardDescription: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 12,
  },
  resourceViewButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  resourceViewButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  resourceDetailImage: {
    width: "100%",
    height: 250,
  },
  resourceDetailContent: {
    padding: 16,
  },
  resourceDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  resourceDetailCategory: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resourceDetailName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  resourceDetailDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    marginBottom: 24,
  },
  resourceDetailInfo: {
    marginBottom: 24,
  },
  resourceDetailInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  resourceDetailInfoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  resourceDetailInfoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  requestResourceBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  requestResourceBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  resourceModalContent: {
    backgroundColor: "#fff",
    height: "90%",
    width: "95%",
    marginTop: "auto",
    marginHorizontal: "2.5%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  resourceModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  resourceModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  resourceInfoBox: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  resourceInfoImage: {
    width: 100,
    height: 100,
  },
  resourceInfoText: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  resourceInfoName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  resourceInfoRate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  resourceFormSection: {
    marginBottom: 20,
  },
  resourceFormLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
  },
  resourcePurposeInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: "#1a1a1a",
    textAlignVertical: "top",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  resourceDateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  resourceDateText: {
    fontSize: 14,
    fontWeight: "600",
  },
  durationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  submitResourceBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitResourceBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
