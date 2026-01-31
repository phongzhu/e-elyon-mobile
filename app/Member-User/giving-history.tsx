import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Polyline,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { supabase } from "../../src/lib/supabaseClient";

type GivingRecord = {
  transaction_id: number;
  transaction_type: string | null;
  transaction_date: string | null;
  amount: number | null;
  notes: string | null;
};

export default function GivingHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyTotals, setMonthlyTotals] = useState<number[]>(
    Array.from({ length: 12 }, () => 0),
  );

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

  const loadGivingHistory = async (uidNum: number) => {
    const givingFilter = (q: any) =>
      q.or(
        "donation_id.not.is.null,transaction_type.ilike.%giving%,transaction_type.ilike.%donation%,transaction_type.ilike.%tithe%",
      );

    const q = supabase
      .from("transactions")
      .select(
        "transaction_id, amount, transaction_date, notes, transaction_type",
      )
      .eq("created_by", uidNum)
      .order("transaction_date", { ascending: false });

    const { data, error } = await givingFilter(q);
    if (error) console.error("loadGivingHistory error:", error);
    setRecords((data as GivingRecord[]) || []);
  };

  const loadGivingTrends = async (uidNum: number) => {
    const givingFilter = (q: any) =>
      q.or(
        "donation_id.not.is.null,transaction_type.ilike.%giving%,transaction_type.ilike.%donation%,transaction_type.ilike.%tithe%",
      );

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const q = supabase
      .from("transactions")
      .select("amount, transaction_date")
      .eq("created_by", uidNum)
      .gte("transaction_date", yearStart.toISOString())
      .lte("transaction_date", now.toISOString());

    const { data, error } = await givingFilter(q);
    if (error) console.error("loadGivingTrends error:", error);

    const totals = Array.from({ length: 12 }, () => 0);
    (data ?? []).forEach((r: any) => {
      const d = r.transaction_date ? new Date(r.transaction_date) : null;
      if (!d) return;
      const monthIndex =
        (d.getFullYear() - yearStart.getFullYear()) * 12 +
        (d.getMonth() - yearStart.getMonth());
      if (monthIndex >= 0 && monthIndex < 12) {
        totals[monthIndex] += Number(r.amount ?? 0);
      }
    });
    setMonthlyTotals(totals);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("branding fetch error:", error);
      else setBranding(data);

      const uidNum = await resolveUserId();
      if (uidNum) {
        await loadGivingHistory(uidNum);
        await loadGivingTrends(uidNum);
      }
      setLoading(false);
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

  const normalizeTypeLabel = (raw?: string | null) => {
    if (!raw) return "Donation";
    const lower = raw.toLowerCase();
    if (lower.includes("tithe")) return "Donation";
    return raw;
  };

  const rows = useMemo(() => records || [], [records]);
  const last12Total = useMemo(
    () => monthlyTotals.reduce((sum, v) => sum + v, 0),
    [monthlyTotals],
  );
  const yearNow = new Date().getFullYear();

  const sparkWidth = 320;
  const sparkHeight = 60;
  const sparkPoints = useMemo(() => {
    const maxVal = Math.max(1, ...monthlyTotals);
    const stepX = sparkWidth / (monthlyTotals.length - 1 || 1);
    return monthlyTotals
      .map((v, i) => {
        const x = i * stepX;
        const y = sparkHeight - (v / maxVal) * sparkHeight;
        return `${x},${y}`;
      })
      .join(" ");
  }, [monthlyTotals]);

  const hasTrends = useMemo(
    () => monthlyTotals.some((v) => v > 0),
    [monthlyTotals],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
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

        <Text style={styles.headerTitle}>Personal Giving Records</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/Member-User/profile")}
          >
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.trendsSection}>
          <Text style={styles.sectionTitle}>Giving Trends</Text>
          <Text style={styles.amount}>₱{last12Total.toLocaleString()}</Text>
          <Text style={[styles.subLabel, { color: secondary }]}>
            Last 12 Months
          </Text>

          {hasTrends ? (
            <>
              <View style={styles.sparkWrap}>
                <Svg
                  width="100%"
                  height={sparkHeight}
                  viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
                >
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
                      <Circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r={isLast ? 3 : 2}
                        fill={secondary}
                      />
                    );
                  })}
                </Svg>
              </View>
              <View style={styles.yearRow}>
                <Text style={styles.yearText}>{yearNow - 2}</Text>
                <Text style={styles.yearText}>{yearNow - 1}</Text>
                <Text style={styles.yearText}>{yearNow}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No giving data yet.</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Donations</Text>

        {loading ? (
          <Text style={styles.emptyText}>Loading records...</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>No giving records yet.</Text>
        ) : (
          rows.map((item) => {
            const title = normalizeTypeLabel(item.transaction_type);
            const date = item.transaction_date
              ? new Date(item.transaction_date).toLocaleDateString()
              : "-";
            const amount = `₱${Number(item.amount ?? 0).toLocaleString()}`;
            const meta = item.notes ? item.notes : null;

            return (
              <View key={item.transaction_id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyTitle}>{title}</Text>
                  <Text style={styles.historySubtitle}>{date}</Text>
                  {meta ? <Text style={styles.historyMeta}>{meta}</Text> : null}
                </View>
                <Text style={[styles.historyAmount, { color: secondary }]}>
                  {amount}
                </Text>
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 8,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  trendsSection: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  sparkWrap: {
    marginVertical: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  yearRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  yearText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 12,
    color: "#777",
    marginTop: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2ef",
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  historySubtitle: {
    fontSize: 12,
    color: "#7a837a",
    marginTop: 2,
  },
  historyMeta: {
    fontSize: 12,
    color: "#5c6a5c",
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
});
