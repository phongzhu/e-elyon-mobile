import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { supabase } from "../../src/lib/supabaseClient";

const pickBranchId = (usersDetails) => {
  if (!usersDetails) return null;
  if (Array.isArray(usersDetails)) {
    return usersDetails.length > 0 ? usersDetails[0]?.branch_id : null;
  }
  return usersDetails.branch_id;
};

const formatDateLong = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Counseling request tab UI + Supabase logic.
 *
 * Props:
 * - branding: UI theme object (same as Member-Dashboard)
 * - autoOpenRequest?: boolean
 * - onAutoOpenHandled?: () => void
 * - styles: StyleSheet from Member-Dashboard (keeps visuals consistent)
 */
export default function CounselingRequest({
  branding,
  autoOpenRequest = false,
  onAutoOpenHandled,
  styles,
}) {
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [concern, setConcern] = useState("");
  const [counselingType, setCounselingType] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [counselingHistory, setCounselingHistory] = useState([]);

  const primary = branding?.primary_color || "#064622";

  const getAppUser = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select(
        "user_id, auth_user_id, user_details_id, users_details:users_details (branch_id)",
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      console.error("❌ getAppUser error:", error);
      return null;
    }

    const user_id = data?.user_id;
    const branch_id = pickBranchId(data?.users_details);

    if (__DEV__) {
      console.log("[CounselingRequest] auth.uid:", authUserId);
      console.log("[CounselingRequest] users row:", {
        user_id: data?.user_id,
        auth_user_id: data?.auth_user_id,
        user_details_id: data?.user_details_id,
        branch_id,
      });
    }

    if (!user_id) return null;
    return { user_id, branch_id };
  }, []);

  const loadCounselingHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        setCounselingHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from("counseling_requests")
        .select(
          `
            request_id,
            type,
            description,
            status,
            requested_at,
            scheduled_at,
            scheduled_by_user:users!counseling_requests_scheduled_by_fkey (
            user_details:users_details (
                first_name,
                last_name
            )
            )
        `,
        )
        .eq("user_id", u.user_id)
        .order("requested_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const rows = (data ?? []).map((r) => {
        const first = r?.scheduled_by_user?.user_details?.first_name ?? "";
        const last = r?.scheduled_by_user?.user_details?.last_name ?? "";
        const scheduledByName = `${first} ${last}`.trim() || "TBA";

        const dateLabel = r.scheduled_at
          ? formatDateLong(r.scheduled_at)
          : r.requested_at
            ? formatDateLong(r.requested_at)
            : "-";

        return {
          id: r.request_id,
          date: dateLabel,
          pastor: scheduledByName,
          status: r.status ?? "Pending",
          type: r.type ?? "General",
          description: r.description ?? "",
          raw: r,
        };
      });

      setCounselingHistory(rows);
    } catch (e) {
      console.error("❌ loadCounselingHistory failed:", e);
      setCounselingHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [getAppUser]);

  useEffect(() => {
    loadCounselingHistory();
  }, [loadCounselingHistory]);

  useEffect(() => {
    if (autoOpenRequest) {
      setShowRequestModal(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenRequest, onAutoOpenHandled]);

  const formatDateTime = useCallback((date) => {
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
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${month} ${day}, ${year} at ${formattedHours}:${formattedMinutes} ${ampm}`;
  }, []);

  const handleDateChange = useCallback((event, date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === "android") {
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  }, []);

  const handleTimeChange = useCallback((event, date) => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  const handleCloseRequest = useCallback(() => {
    setShowRequestModal(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return concern.trim().length < 5 || counselingType.trim().length < 2;
  }, [concern, counselingType]);

  const handleSubmitRequest = useCallback(async () => {
    if (isSubmitDisabled) return;

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

      if (__DEV__) {
        const { data: authNow } = await supabase.auth.getUser();
        console.log("[CounselingRequest] insert auth.uid:", authNow?.user?.id);
        console.log("[CounselingRequest] insert app user:", u);
      }

      const payload = {
        user_id: Number(u.user_id),
        type: counselingType.trim(),
        description: concern.trim(),
        status: "Pending",
        scheduled_at: selectedDate ? selectedDate.toISOString() : null,
        branch_id: u.branch_id != null ? Number(u.branch_id) : null,
      };

      const { error } = await supabase
        .from("counseling_requests")
        .insert(payload);

      if (error) {
        console.log("❌ counseling insert error:", error);
        throw error;
      }

      setShowRequestModal(false);
      setShowConfirmModal(true);
      loadCounselingHistory();

      setTimeout(() => {
        setShowConfirmModal(false);
        setConcern("");
        setCounselingType("");
        setSelectedDate(null);
        loadCounselingHistory();
      }, 3000);
    } catch (e) {
      console.error("❌ handleSubmitRequest failed:", e);

      const msg =
        e?.message ??
        e?.error_description ??
        e?.details ??
        (typeof e === "object" ? JSON.stringify(e, null, 2) : String(e)) ??
        "Unable to submit request.";

      Alert.alert("Insert failed", String(msg));
    } finally {
      setLoading(false);
    }
  }, [
    concern,
    counselingType,
    getAppUser,
    isSubmitDisabled,
    loadCounselingHistory,
    selectedDate,
  ]);

  return (
    <>
      {/* Request Counseling Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseRequest}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.counselingModalContent}>
            <View style={styles.counselingHeader}>
              <View style={styles.counselingHeaderText}>
                <Text style={styles.counselingTitle}>Request Counseling</Text>
                <Text style={styles.counselingSubtitle}>
                  Share what you need and we will schedule time with a pastor.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCloseRequest}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <View style={styles.counselingFormContainer}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
              >
                <View style={styles.counselingFieldHeader}>
                  <Text style={styles.counselingFieldLabel}>
                    Counseling Type
                  </Text>
                  <Text style={styles.counselingHelperText}>
                    Minimum 2 characters
                  </Text>
                </View>
                <TextInput
                  placeholder="e.g., Marriage, Family, Personal, Spiritual..."
                  placeholderTextColor="#999"
                  value={counselingType}
                  onChangeText={setCounselingType}
                  style={styles.counselingTypeInput}
                />

                <View style={styles.counselingFieldHeader}>
                  <Text style={styles.counselingFieldLabel}>Your concern</Text>
                  <Text style={styles.counselingHelperText}>
                    Minimum 5 characters
                  </Text>
                </View>
                <TextInput
                  placeholder="Indicate your Concern Here..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  value={concern}
                  onChangeText={setConcern}
                  style={styles.counselingConcernInput}
                />

                <View style={[styles.counselingFieldHeader, { marginTop: 12 }]}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.counselingFieldLabel}>
                      Preferred date & time
                    </Text>
                    <Text style={styles.counselingOptionalTag}>Optional</Text>
                  </View>
                  {selectedDate && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDate(null);
                        setShowTimePicker(false);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text
                        style={[styles.counselingHelperText, { color: "#c00" }]}
                      >
                        Clear
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.counselingDateInputContainer}
                  onPress={() => {
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.counselingDateInput}>
                    <Text
                      style={[
                        styles.counselingDateText,
                        {
                          color: selectedDate
                            ? branding?.primary_text_color || "#000"
                            : "#999",
                        },
                      ]}
                    >
                      {selectedDate
                        ? formatDateTime(selectedDate)
                        : "Preferred Date/Time (Optional)"}
                    </Text>
                  </View>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={primary}
                    style={styles.counselingDateIcon}
                  />
                </TouchableOpacity>

                <Text style={styles.counselingHelperText}>
                  If you leave this blank, we will propose the earliest
                  available slot.
                </Text>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "default" : "default"}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    accentColor={primary}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="time"
                    display={Platform.OS === "ios" ? "default" : "default"}
                    onChange={handleTimeChange}
                    accentColor={primary}
                  />
                )}

                {Platform.OS === "ios" &&
                  (showDatePicker || showTimePicker) && (
                    <View style={styles.iosPickerButtons}>
                      <TouchableOpacity
                        onPress={() => {
                          if (showDatePicker) {
                            setShowDatePicker(false);
                            setShowTimePicker(true);
                          } else {
                            setShowTimePicker(false);
                          }
                        }}
                        style={[
                          styles.iosPickerBtn,
                          { backgroundColor: primary },
                        ]}
                      >
                        <Text style={styles.iosPickerBtnText}>
                          {showDatePicker ? "Next (Time)" : "Done"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
              </ScrollView>

              <View style={styles.counselingButtonRow}>
                <TouchableOpacity
                  style={styles.counselingCancelBtn}
                  onPress={handleCloseRequest}
                >
                  <Text style={styles.counselingCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.counselingSubmitBtn,
                    {
                      backgroundColor:
                        isSubmitDisabled || loading ? "#b0b0b0" : primary,
                    },
                  ]}
                  onPress={handleSubmitRequest}
                  disabled={isSubmitDisabled || loading}
                >
                  <Text style={styles.counselingSubmitBtnText}>
                    {loading ? "Submitting..." : "Submit Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
              Your counseling request will be reviewed by the pastor in charge.
              They will contact you to confirm or reschedule your appointment.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Counseling History */}
      <View style={{ padding: 16 }}>
        <Text style={styles.counselingHistoryTitle}>Counseling History</Text>

        {historyLoading ? (
          <Text style={styles.filterEmptyText}>Loading history...</Text>
        ) : counselingHistory.length === 0 ? (
          <Text style={styles.filterEmptyText}>No counseling sessions yet</Text>
        ) : (
          counselingHistory.map((item) => (
            <View key={item.id} style={styles.counselingHistoryItem}>
              <View
                style={[
                  styles.counselingHistoryIcon,
                  { backgroundColor: `${primary}15` },
                ]}
              >
                <Ionicons name="calendar-outline" size={24} color={primary} />
              </View>
              <View style={styles.counselingHistoryInfo}>
                <Text style={styles.counselingHistoryDate}>{item.date}</Text>
                <Text style={styles.counselingHistoryType}>{item.type}</Text>
                <Text
                  style={[styles.counselingHistoryPastor, { color: primary }]}
                >
                  {item.pastor}
                </Text>
                {item.status && (
                  <Text style={styles.counselingHistoryStatus}>
                    Status: {item.status}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[styles.requestCounselingBtn, { backgroundColor: primary }]}
          onPress={() => setShowRequestModal(true)}
        >
          <Text style={styles.requestCounselingBtnText}>
            Request Counseling
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
