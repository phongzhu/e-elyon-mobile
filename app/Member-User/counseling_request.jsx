import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Image,
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

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi! I am your AI companion. I can listen, offer encouragement, and share Bible verses. How can I help you today?",
      at: new Date().toISOString(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [language, setLanguage] = useState("English");
  const [bibleVersion, setBibleVersion] = useState("NIV");
  const [activeTab, setActiveTab] = useState("AI");

  const [pastoralConcern, setPastoralConcern] = useState("");
  const [pastoralPreferredSchedule, setPastoralPreferredSchedule] =
    useState("");
  const [pastoralHistory, setPastoralHistory] = useState([]);
  const [pastoralLoading, setPastoralLoading] = useState(false);
  const [pastoralSubmitting, setPastoralSubmitting] = useState(false);
  const [pastoralTab, setPastoralTab] = useState("New");

  const [counselingHistory, setCounselingHistory] = useState([]);

  const primary = branding?.primary_color || "#064622";

  const getAppUser = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select(
        "user_id, role, auth_user_id, user_details_id, users_details:users_details (branch_id)",
      )
      .eq("auth_user_id", authUserId)
      .eq("role", "member")
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
        setChatMessages([
          {
            role: "assistant",
            text:
              "Hi! I am your AI companion. I can listen, offer encouragement, and share Bible verses. How can I help you today?",
            at: new Date().toISOString(),
          },
        ]);
        return;
      }

      const { data, error } = await supabase
        .from("counseling_requests")
        .select(
          `
            request_id,
            type,
            message,
            description,
            status,
            requested_at,
            branch_id,
            conversation_id
          `,
        )
        .eq("user_id", u.user_id)
        .eq("type", "AI")
        .order("requested_at", { ascending: true })
        .limit(200);

      if (error) throw error;

      const rows = (data ?? []).map((r) => {
        let role = "assistant";
        let text = "";
        if (r.message && typeof r.message === "object") {
          role = r.message.role || role;
          text = r.message.text || "";
        } else {
          text = r.description ?? "";
          try {
            const parsed = JSON.parse(r.description ?? "");
            if (parsed && typeof parsed === "object") {
              role = parsed.role || role;
              text = parsed.text || text;
            }
          } catch {}
        }

        return {
          id: r.request_id,
          date: r.requested_at ? formatDateLong(r.requested_at) : "-",
          at: r.requested_at,
          role,
          text,
          status: r.status ?? "Completed",
          conversation_id: r.conversation_id ?? null,
          raw: r,
        };
      });

      setCounselingHistory(rows);
      if (rows.length) {
        const latestConversation =
          activeConversationId ||
          rows
            .slice()
            .reverse()
            .find((r) => r.conversation_id)?.conversation_id ||
          rows[rows.length - 1].conversation_id ||
          null;
        if (!activeConversationId) setActiveConversationId(latestConversation);
        const convoRows = latestConversation
          ? rows.filter((r) => r.conversation_id === latestConversation)
          : rows;
        setChatMessages(
          convoRows.map((r) => ({
            role: r.role,
            text: r.text,
            at: r.at,
          })),
        );
      } else {
        setChatMessages([
          {
            role: "assistant",
            text:
              "Hi! I am your AI companion. I can listen, offer encouragement, and share Bible verses. How can I help you today?",
            at: new Date().toISOString(),
          },
        ]);
      }
    } catch (e) {
      console.error("❌ loadCounselingHistory failed:", e);
      setCounselingHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [getAppUser, activeConversationId]);

  useEffect(() => {
    loadCounselingHistory();
  }, [loadCounselingHistory]);

  const loadPastoralHistory = useCallback(async () => {
    setPastoralLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        setPastoralHistory([]);
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
            scheduled_at
          `,
        )
        .eq("user_id", u.user_id)
        .neq("type", "AI")
        .order("requested_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const rows = (data ?? []).map((r) => ({
        id: r.request_id,
        type: r.type ?? "Pastoral",
        status: r.status ?? "Pending",
        requested_at: r.requested_at,
        scheduled_at: r.scheduled_at,
        description: r.description ?? "",
      }));
      setPastoralHistory(rows);
    } catch (e) {
      console.error("❌ loadPastoralHistory failed:", e);
      setPastoralHistory([]);
    } finally {
      setPastoralLoading(false);
    }
  }, [getAppUser]);

  useEffect(() => {
    loadPastoralHistory();
  }, [loadPastoralHistory]);

  useEffect(() => {
    if (autoOpenRequest) {
      setShowRequestModal(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenRequest, onAutoOpenHandled]);

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const newConversationId = () => {
    if (typeof crypto !== "undefined" && crypto?.randomUUID) {
      return crypto.randomUUID();
    }
    const rnd = Math.random().toString(16).slice(2);
    return `conv_${Date.now()}_${rnd}`;
  };

  const handleNewChat = () => {
    const id = newConversationId();
    setActiveConversationId(id);
    setChatMessages([
      {
        role: "assistant",
        text:
          "Hi! I am your AI companion. I can listen, offer encouragement, and share Bible verses. How can I help you today?",
        at: new Date().toISOString(),
      },
    ]);
  };

  const setLangAndVersion = (lang) => {
    setLanguage(lang);
    setBibleVersion(lang === "Tagalog" ? "ASND" : "NIV");
  };

  const handleCloseRequest = useCallback(() => {
    setShowRequestModal(false);
    setChatInput("");
  }, []);

  const submitPastoralRequest = useCallback(async () => {
    if (pastoralSubmitting) return;
    const trimmed = pastoralConcern.trim();
    if (!trimmed) {
      Alert.alert("Missing info", "Please describe your concern.");
      return;
    }
    setPastoralSubmitting(true);
    try {
      const u = await getAppUser();
      if (!u) {
        Alert.alert("Not signed in", "Please sign in and try again.");
        return;
      }

      const payload = {
        user_id: Number(u.user_id),
        branch_id: u.branch_id != null ? Number(u.branch_id) : null,
        type: "Pastoral",
        description: [
          "Concern:",
          trimmed,
          pastoralPreferredSchedule
            ? `Preferred schedule: ${pastoralPreferredSchedule}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        status: "Pending",
      };

      const { error } = await supabase
        .from("counseling_requests")
        .insert(payload);
      if (error) throw error;

      setPastoralConcern("");
      setPastoralPreferredSchedule("");
      loadPastoralHistory();
      Alert.alert(
        "Request sent",
        "Your counseling request was sent to your branch pastor/bishop.",
      );
    } catch (e) {
      console.error("❌ submitPastoralRequest failed:", e);
      Alert.alert(
        "Request failed",
        "Unable to send your request right now. Please try again.",
      );
    } finally {
      setPastoralSubmitting(false);
    }
  }, [
    pastoralConcern,
    pastoralPreferredSchedule,
    pastoralSubmitting,
    getAppUser,
    loadPastoralHistory,
  ]);

    const sendChatMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || loading) return;

    const convoId = activeConversationId || newConversationId();
    if (!activeConversationId) setActiveConversationId(convoId);
    const nowIso = new Date().toISOString();
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, at: nowIso },
    ]);
    setChatInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai_counselor", {
        body: {
          message: trimmed,
          conversation_id: convoId,
          language,
          bible_version: bibleVersion,
        },
      });

      if (error) {
        throw new Error(error.message || "AI request failed.");
      }

      const reply =
        data?.reply ||
        "I'm here with you. Can you share a little more about what you're feeling?";

      const replyAt = new Date().toISOString();
      if (data?.conversation_id && !activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: reply, at: replyAt },
      ]);
      loadCounselingHistory();
    } catch (e) {
      console.error("❌ ai_counselor error:", e);
      Alert.alert(
        "AI Companion Error",
        "Unable to get a response right now. Please try again.",
      );
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  }, [
    chatInput,
    loading,
    loadCounselingHistory,
    activeConversationId,
    language,
    bibleVersion,
  ]);
  const convoMap = new Map();
  for (const item of counselingHistory) {
    const convoId = item.conversation_id || `single_${item.id}`;
    const existing = convoMap.get(convoId);
    if (!existing) {
      convoMap.set(convoId, {
        conversation_id: convoId,
        id: item.id,
        date: item.date,
        at: item.at,
        lastRole: item.role,
        lastText: item.text,
        count: 1,
        status: item.status,
      });
    } else {
      existing.count += 1;
      existing.lastRole = item.role;
      existing.lastText = item.text;
      existing.at = item.at;
      existing.date = item.date;
      existing.status = item.status || existing.status;
    }
  }
  const historyGroups = Array.from(convoMap.values())
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 20);
  return (
    <>
      {/* AI Companion Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseRequest}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.notificationsModalContent,
              { overflow: "hidden" },
            ]}
          >
            <View style={styles.notificationsHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Image
                    source={require("../../assets/images/Elly-Logo.png")}
                    style={{ width: 34, height: 34, borderRadius: 17 }}
                    resizeMode="cover"
                  />
                  <View>
                    <Text style={styles.notificationsTitle}>Elly</Text>
                    <Text style={[styles.counselingSubtitle, { marginTop: 2 }]}>
                      AI Companion
                    </Text>
                  </View>
                </View>
                <Text style={[styles.counselingSubtitle, { marginTop: 6 }]}>
                  A private, supportive chat with Scripture-based encouragement.
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={handleNewChat}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: "#eee",
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 12 }}>
                    New Chat
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCloseRequest}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {["English", "Tagalog"].map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setLangAndVersion(lang)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: language === lang ? primary : "#eee",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        fontSize: 12,
                        color: language === lang ? "#fff" : "#1a1a1a",
                      }}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: "#eee",
                  }}
                >
                  <Text style={{ fontWeight: "700", fontSize: 12 }}>
                    {bibleVersion}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.counselingHelperText,
                  { textAlign: "left", marginBottom: 10 },
                ]}
              >
                This companion offers encouragement and verses, but it is not a
                substitute for professional or pastoral care.
              </Text>
              <View
                style={{
                  height: 1,
                  backgroundColor: "#eee",
                }}
              />
            </View>

            <View style={{ flex: 1, backgroundColor: "#fff" }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  gap: 10,
                }}
              >
                {chatMessages.map((msg, idx) => (
                  <View
                    key={`${msg.role}-${idx}`}
                    style={{
                      alignSelf:
                        msg.role === "user" ? "flex-end" : "flex-start",
                      backgroundColor:
                        msg.role === "user"
                          ? primary
                          : "rgba(11, 11, 11, 0.06)",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      maxWidth: "82%",
                    }}
                  >
                    <Text
                      style={{
                        color: msg.role === "user" ? "#fff" : "#1a1a1a",
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: msg.role === "user" ? "#e6e6e6" : "#666",
                        textAlign: "right",
                      }}
                    >
                      {formatTime(msg.at)}
                    </Text>
                  </View>
                ))}
                {isTyping ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "rgba(11, 11, 11, 0.06)",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      maxWidth: "60%",
                    }}
                  >
                    <Text style={{ color: "#1a1a1a", fontSize: 13 }}>
                      AI is typing...
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>

            <View
              style={{
                padding: 12,
                borderTopWidth: 1,
                borderTopColor: "#eee",
                backgroundColor: "#fff",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f1f1f1",
                  borderRadius: 24,
                  paddingHorizontal: 12,
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: "#1a1a1a",
                  }}
                  placeholder="Type your message..."
                  placeholderTextColor="#888"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  onSubmitEditing={sendChatMessage}
                />
                <TouchableOpacity
                  onPress={sendChatMessage}
                  disabled={loading}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: loading ? "#b0b0b0" : primary,
                  }}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Counseling History */}
      <View style={{ padding: 16, paddingBottom: 96 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {["AI", "Pastoral"].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor:
                  activeTab === tab ? primary : "rgba(0,0,0,0.06)",
              }}
            >
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: 12,
                  color: activeTab === tab ? "#fff" : "#1a1a1a",
                }}
              >
                {tab === "AI" ? "Chat with Elly" : "Request Counseling"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "Pastoral" ? (
          <>
            <Text style={styles.counselingHistoryTitle}>
              Request Counseling
            </Text>
            <Text style={[styles.counselingHelperText, { marginTop: 6 }]}>
              Your request will be sent to your branch pastor or bishop.
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 14,
                marginBottom: 12,
              }}
            >
              {["New", "History"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setPastoralTab(tab)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor:
                      pastoralTab === tab ? primary : "rgba(0,0,0,0.06)",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 12,
                      color: pastoralTab === tab ? "#fff" : "#1a1a1a",
                    }}
                  >
                    {tab === "New" ? "New Request" : "Request History"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {pastoralTab === "New" ? (
              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#fff",
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <TextInput
                  style={[
                    styles.counselingConcernInput,
                    { minHeight: 120, textAlignVertical: "top" },
                  ]}
                  placeholder="Describe your concern..."
                  placeholderTextColor="#888"
                  value={pastoralConcern}
                  onChangeText={setPastoralConcern}
                  multiline
                />
                <TextInput
                  style={[styles.counselingConcernInput, { marginTop: 10 }]}
                  placeholder="Preferred schedule (e.g., Feb 5, 3 PM)"
                  placeholderTextColor="#888"
                  value={pastoralPreferredSchedule}
                  onChangeText={setPastoralPreferredSchedule}
                />
                <TouchableOpacity
                  style={[
                    styles.requestCounselingBtn,
                    {
                      backgroundColor: pastoralSubmitting
                        ? "#b0b0b0"
                        : primary,
                      marginTop: 12,
                    },
                  ]}
                  onPress={submitPastoralRequest}
                  disabled={pastoralSubmitting}
                >
                  <Text style={styles.requestCounselingBtnText}>
                    {pastoralSubmitting ? "Sending..." : "Send Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 6 }}>
                {pastoralLoading ? (
                  <Text style={styles.filterEmptyText}>Loading...</Text>
                ) : pastoralHistory.length === 0 ? (
                  <Text style={styles.filterEmptyText}>No requests yet</Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 6 }}>
                    {pastoralHistory.map((item) => (
                      <View
                        key={item.id}
                        style={{
                          borderRadius: 14,
                          backgroundColor: "#fff",
                          padding: 12,
                          borderWidth: 1,
                          borderColor: "rgba(0,0,0,0.06)",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text style={styles.counselingHistoryDate}>
                            {item.requested_at
                              ? formatDateLong(item.requested_at)
                              : "-"}
                          </Text>
                          <Text style={styles.counselingHistoryStatus}>
                            {item.status}
                          </Text>
                        </View>
                        <Text style={styles.counselingHistoryType}>
                          {item.type}
                        </Text>
                        <Text
                          style={[
                            styles.counselingHistoryPastor,
                            { marginTop: 6 },
                          ]}
                          numberOfLines={3}
                        >
                          {item.description}
                        </Text>
                        {item.scheduled_at ? (
                          <Text style={styles.counselingHistoryStatus}>
                            Scheduled: {formatDateLong(item.scheduled_at)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.counselingHistoryTitle}>Chat History</Text>
          <TouchableOpacity
            onPress={() => {
              handleNewChat();
              setShowRequestModal(true);
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: "rgba(0,0,0,0.06)",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 12 }}>New Chat</Text>
          </TouchableOpacity>
        </View>

        {historyLoading ? (
          <Text style={styles.filterEmptyText}>Loading history...</Text>
        ) : counselingHistory.length === 0 ? (
          <Text style={styles.filterEmptyText}>No counseling sessions yet</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {historyGroups.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{
                  borderRadius: 14,
                  backgroundColor:
                    item.lastRole === "user" ? "#eef5f0" : "#f7f7f7",
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveConversationId(item.conversation_id);
                  const convoRows = counselingHistory.filter(
                    (r) => r.conversation_id === item.conversation_id,
                  );
                  if (convoRows.length) {
                    setChatMessages(
                      convoRows.map((r) => ({
                        role: r.role,
                        text: r.text,
                        at: r.at,
                      })),
                    );
                  }
                  setShowRequestModal(true);
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.counselingHistoryDate}>{item.date}</Text>
                  <Text style={styles.counselingHistoryStatus}>
                    {formatTime(item.at)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.counselingHistoryType,
                    { color: item.lastRole === "user" ? primary : "#333" },
                  ]}
                >
                  {item.lastRole === "user" ? "You" : "AI Companion"}
                </Text>
                <Text
                  style={[styles.counselingHistoryPastor, { marginTop: 6 }]}
                  numberOfLines={2}
                >
                  {item.lastText}
                </Text>
                <Text style={styles.counselingHistoryStatus}>
                  {item.count} messages
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View
          style={{
            position: Platform.OS === "web" ? "fixed" : "absolute",
            left: 16,
            right: 16,
            bottom: 40,
            zIndex: 30,
          }}
        >
          <TouchableOpacity
            style={[
              styles.requestCounselingBtn,
              {
                backgroundColor: primary,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 6,
              },
            ]}
            onPress={() => setShowRequestModal(true)}
          >
            <Text style={styles.requestCounselingBtnText}>Chat with Elly</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </View>
    </>
  );
}

