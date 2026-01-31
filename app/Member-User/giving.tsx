import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [recentGiving, setRecentGiving] = useState<any[]>([]);
  const [thisMonthTotal, setThisMonthTotal] = useState(0);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const [thisWeekTotal, setThisWeekTotal] = useState(0);
  const [thisWeekCount, setThisWeekCount] = useState(0);

  const [notifications] = useState<any[]>([]);

  const startOfMonth = (d = new Date()) =>
    new Date(d.getFullYear(), d.getMonth(), 1);

  const startOfWeekMon = (d = new Date()) => {
    const x = new Date(d);
    const day = x.getDay(); // 0 Sun
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const normalizeTypeLabel = (raw?: string | null) => {
    if (!raw) return "Donation";
    const lower = raw.toLowerCase();
    if (lower.includes("tithe")) return "Donation";
    return raw;
  };

  const resolveUserId = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, role")
      .eq("auth_user_id", uid)
      .eq("role", "member")
      .maybeSingle();

    if (error) {
      console.error("resolveUserId error:", error);
      return null;
    }
    return data?.user_id ?? null;
  };

  const loadGiving = async (uidNum: number) => {
    const givingFilter = (q: any) =>
      q.or(
        "donation_id.not.is.null,transaction_type.ilike.%giving%,transaction_type.ilike.%donation%,transaction_type.ilike.%tithe%",
      );

    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeekMon(now);

    {
      const q = supabase
        .from("transactions")
        .select("amount, transaction_date", { count: "exact" })
        .eq("created_by", uidNum)
        .gte("transaction_date", monthStart.toISOString())
        .lte("transaction_date", now.toISOString());

      const { data, count, error } = await givingFilter(q);
      if (error) console.error("loadGiving month error:", error);
      const total =
        (data ?? []).reduce(
          (s: number, r: any) => s + Number(r.amount ?? 0),
          0,
        ) ?? 0;
      setThisMonthTotal(total);
      setThisMonthCount(count ?? data?.length ?? 0);
    }

    {
      const q = supabase
        .from("transactions")
        .select("amount, transaction_date", { count: "exact" })
        .eq("created_by", uidNum)
        .gte("transaction_date", weekStart.toISOString())
        .lte("transaction_date", now.toISOString());

      const { data, count, error } = await givingFilter(q);
      if (error) console.error("loadGiving week error:", error);
      const total =
        (data ?? []).reduce(
          (s: number, r: any) => s + Number(r.amount ?? 0),
          0,
        ) ?? 0;
      setThisWeekTotal(total);
      setThisWeekCount(count ?? data?.length ?? 0);
    }

    {
      const q = supabase
        .from("transactions")
        .select(
          "transaction_id, amount, transaction_date, notes, transaction_type",
        )
        .eq("created_by", uidNum)
        .order("transaction_date", { ascending: false })
        .limit(3);

      const { data, error } = await givingFilter(q);
      if (error) console.error("loadGiving recent error:", error);
      setRecentGiving(data ?? []);
    }
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("âŒ Branding fetch error:", error);
      else setBranding(data);

      const uidNum = await resolveUserId();
      setUserId(uidNum);
      if (uidNum) await loadGiving(uidNum);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  const avgContribution =
    thisMonthCount > 0 ? thisMonthTotal / thisMonthCount : 0;

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

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowNotifications(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {notifications.filter((n) => !n.read).length > 0 && (
              <View style={[styles.badge, { backgroundColor: secondary }]}>
                <Text style={styles.badgeText}>
                  {notifications.filter((n) => !n.read).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 140 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giving Analytics</Text>
          <View style={styles.analyticsRow}>
            <View
              style={[
                styles.analyticsCard,
                { backgroundColor: `${primary}15` },
              ]}
            >
              <Text style={styles.analyticsLabel}>This Month</Text>
              <Text style={[styles.analyticsAmount, { color: primary }]}>
                ₱{thisMonthTotal.toLocaleString()}
              </Text>
              <Text style={styles.analyticsSub}>
                {thisMonthCount} contributions
              </Text>
            </View>
            <View
              style={[
                styles.analyticsCard,
                { backgroundColor: `${secondary}15` },
              ]}
            >
              <Text style={styles.analyticsLabel}>This Week</Text>
              <Text style={[styles.analyticsAmount, { color: secondary }]}>
                ₱{thisWeekTotal.toLocaleString()}
              </Text>
              <Text style={styles.analyticsSub}>
                {thisWeekCount} contribution(s)
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.analyticsCard,
              { backgroundColor: "#f5f5f5", marginTop: 12 },
            ]}
          >
            <Text style={styles.analyticsLabel}>Avg per Contribution</Text>
            <Text style={[styles.analyticsAmount, { color: "#000" }]}>
              ₱
              {avgContribution.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={styles.analyticsSub}>
              Based on {thisMonthCount} contributions
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Giving</Text>
          {recentGiving.length === 0 ? (
            <Text style={{ color: "#666" }}>No giving records yet.</Text>
          ) : (
            recentGiving.map((item) => {
              const date = item.transaction_date
                ? new Date(item.transaction_date).toLocaleDateString()
                : "-";
              const title = normalizeTypeLabel(item.transaction_type);
              const amount = `₱${Number(item.amount ?? 0).toLocaleString()}`;
              const meta = item.notes ? item.notes : "GCash â€¢ Online";

              return (
                <View key={item.transaction_id} style={styles.previewRow}>
                  <View>
                    <Text style={styles.previewTitle}>{title}</Text>
                    <Text style={styles.previewSubtitle}>{date}</Text>
                    <Text style={styles.previewMeta}>{meta}</Text>
                  </View>
                  <Text style={[styles.previewAmount, { color: secondary }]}>
                    {amount}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          { bottom: 64 + 12 + insets.bottom },
        ]}
      >
        <TouchableOpacity
          style={styles.actionGhost}
          activeOpacity={0.9}
          onPress={() => router.push("/Member-User/giving-history")}
        >
          <Text style={styles.actionGhostText}>View History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionPrimary, { backgroundColor: primary }]}
          activeOpacity={0.9}
          onPress={() => router.push("/Member-User/give-online")}
        >
          <Text style={styles.actionPrimaryText}>Give Online</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showNotifications}
        transparent
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
              {notifications.length === 0 ? (
                <Text
                  style={{ color: "#666", textAlign: "center", marginTop: 16 }}
                >
                  No notifications yet.
                </Text>
              ) : (
                notifications.map((notif) => (
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
                ))
              )}
            </ScrollView>
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
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    backgroundColor: "rgba(255,255,255,0.3)",
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
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
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
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  actionBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e7ece9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  actionGhost: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#cfd6d1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f8faf9",
  },
  actionGhostText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  actionPrimary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2ef",
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  previewSubtitle: {
    fontSize: 12,
    color: "#7a837a",
    marginTop: 2,
  },
  previewMeta: {
    fontSize: 12,
    color: "#5c6a5c",
    marginTop: 2,
  },
  previewAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  notificationsModalContent: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  notificationsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  notificationItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#444",
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
  },
  analyticsRow: {
    flexDirection: "row",
    gap: 12,
  },
  analyticsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  analyticsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  analyticsAmount: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  analyticsSub: {
    fontSize: 11,
    color: "#888",
  },
});
