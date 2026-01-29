import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import Svg, { Circle, Polyline, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { supabase } from "../../src/lib/supabaseClient";
import { recordsByTab } from "./giving-history";
import MemberNavbar from "./member-navbar";

export default function GivingScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    {
      id: 1,
      type: "event",
      title: "Youth Fellowship Starting Soon",
      message: "Youth Fellowship is starting in 30 minutes at the main church. Join us!",
      time: "5 mins ago",
      icon: "people",
      read: false,
    },
    {
      id: 2,
      type: "location",
      title: "Near Bustos Campus",
      message: "You are near Bustos Campus. Sunday Service starts at 10:00 AM today.",
      time: "1 hour ago",
      icon: "location",
      read: false,
    },
    {
      id: 3,
      type: "reminder",
      title: "Pastor Appreciation Day",
      message: "Don't forget! Pastor Appreciation Day is this Sunday, October 12.",
      time: "2 hours ago",
      icon: "calendar",
      read: true,
    },
    {
      id: 4,
      type: "branch",
      title: "Cavite Branch Activity",
      message: "Special Family Fun Day at Cavite Community Grounds. RSVP now!",
      time: "Yesterday",
      icon: "home",
      read: true,
    },
    {
      id: 5,
      type: "attendance",
      title: "Attendance Recorded",
      message: "Your attendance at Sunday Worship Service has been validated.",
      time: "2 days ago",
      icon: "checkmark-circle",
      read: true,
    },
  ];

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  const wallets = ["Maya", "Gcash", "Bank Transfer"];

  const allRecords = useMemo(() => {
    return Object.values(recordsByTab).flat();
  }, []);

  const monthlyTotals = useMemo(() => {
    const monthOrder = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const totals: Record<string, number> = {};
    allRecords.forEach(r => {
      const m = r.date.split(",")[0].split(" ")[0];
      const amt = Number(r.amount.replace(/[^0-9.]/g, ""));
      if (!isNaN(amt)) totals[m] = (totals[m] || 0) + amt;
    });
    return monthOrder.map(m => totals[m] || 0);
  }, [allRecords]);

  const sparkWidth = 320;
  const sparkHeight = 60;
  const sparkPoints = useMemo(() => {
    const maxVal = Math.max(1, ...monthlyTotals);
    const stepX = sparkWidth / (monthlyTotals.length - 1 || 1);
    return monthlyTotals.map((v, i) => {
      const x = i * stepX;
      const y = sparkHeight - (v / maxVal) * sparkHeight;
      return `${x},${y}`;
    }).join(" ");
  }, [monthlyTotals]);

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
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
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
            <View style={[styles.badge, { backgroundColor: secondary }]}>
              <Text style={styles.badgeText}>{notifications.filter((n) => !n.read).length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/profile")}>
            <Ionicons name="person-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
       

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giving Analytics</Text>
          <View style={styles.analyticsRow}>
            <View style={[styles.analyticsCard, { backgroundColor: `${primary}15` }]}>
              <Text style={styles.analyticsLabel}>This Month</Text>
              <Text style={[styles.analyticsAmount, { color: primary }]}>₱4,500</Text>
              <Text style={styles.analyticsSub}>3 contributions</Text>
            </View>
            <View style={[styles.analyticsCard, { backgroundColor: `${secondary}15` }]}>
              <Text style={styles.analyticsLabel}>This Week</Text>
              <Text style={[styles.analyticsAmount, { color: secondary }]}>₱1,500</Text>
              <Text style={styles.analyticsSub}>1 contribution</Text>
            </View>
          </View>

          <View style={[styles.analyticsCard, { backgroundColor: '#f5f5f5', marginTop: 12 }]}>
            <Text style={styles.analyticsLabel}>Per Service Average</Text>
            <Text style={[styles.analyticsAmount, { color: '#000' }]}>₱1,200</Text>
            <Text style={styles.analyticsSub}>Based on 12 services</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Giving</Text>
          {[
            { id: 1, title: "Tithes", date: "December 15, 2024", amount: "₱1,500", channel: "Online", activity: "Sunday Worship Service" },
            { id: 2, title: "Offering", date: "December 8, 2024", amount: "₱1,200", channel: "Online", activity: "Midweek Prayer Meeting" },
            { id: 3, title: "Tithes", date: "December 1, 2024", amount: "₱1,800", channel: "Onsite", activity: "Sunday Worship Service" },
          ].map((item) => (
            <View key={item.id} style={styles.previewRow}>
              <View>
                <Text style={styles.previewTitle}>{item.title}</Text>
                <Text style={styles.previewSubtitle}>{item.date}</Text>
                <Text style={styles.previewMeta}>{`${item.channel} • ${item.activity}`}</Text>
              </View>
              <Text style={[styles.previewAmount, { color: secondary }]}>{item.amount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Giving Trends</Text>
          <Text style={styles.amount}>₱14,200</Text>
          <Text style={[styles.subLabel, { color: secondary }]}>Last 12 Months +15%</Text>

          <View style={styles.sparkWrap}>
            <Svg width="100%" height={sparkHeight} viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}>
              <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={secondary} stopOpacity="0.35" />
                <Stop offset="1" stopColor={secondary} stopOpacity="0" />
              </SvgLinearGradient>
              <Polyline
                points={sparkPoints}
                fill="none"
                stroke={secondary}
                strokeWidth="2"
              />
              {sparkPoints.split(" ").map((p, idx) => {
                const [x, y] = p.split(",").map(Number);
                const isLast = idx === sparkPoints.split(" ").length - 1;
                return (
                  <Circle key={idx} cx={x} cy={y} r={isLast ? 3 : 2} fill={secondary} />
                );
              })}
            </Svg>
          </View>
          <View style={styles.yearRow}>
            <Text style={styles.yearText}>2021</Text>
            <Text style={styles.yearText}>2022</Text>
            <Text style={styles.yearText}>2023</Text>
          </View>

          <TouchableOpacity
            style={styles.ghostBtn}
            activeOpacity={0.9}
            onPress={() => router.push("/Member-User/giving-history")}
          >
            <Text style={styles.ghostText}>View History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: primary }]}
            activeOpacity={0.9}
            onPress={() => router.push("/Member-User/give-online")}
          >
            <Text style={styles.primaryBtnText}>Give Online</Text>
          </TouchableOpacity>
        </View>

        
        <View style={{ height: 20 }} />
      </ScrollView>

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
              {notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notificationItem,
                    { backgroundColor: notif.read ? "#fff" : `${primary}08` },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: `${primary}20` }]}>
                    <Ionicons name={notif.icon as any} size={22} color={primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notif.title}</Text>
                      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: secondary }]} />}
                    </View>
                    <Text style={styles.notificationMessage}>{notif.message}</Text>
                    <Text style={styles.notificationTime}>{notif.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 16,
  },
  sparkWrap: {
    marginVertical: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  yearRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  yearText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  ghostText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2a1f",
  },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
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
    flexDirection: 'row',
    gap: 12,
  },
  analyticsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  analyticsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  analyticsAmount: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  analyticsSub: {
    fontSize: 11,
    color: '#888',
  },
});
