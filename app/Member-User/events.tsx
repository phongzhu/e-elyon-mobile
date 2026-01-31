import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { DateTime } from "luxon";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RRule } from "rrule";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

const APP_TZ = "Asia/Manila";
const EVENT_STATUSES = ["Scheduled", "Published", "Active", "Approved"];
const DATE_FILTERS = ["All", "Today", "This Week", "This Month"];

type EventItem = {
  key: string;
  source: "single" | "series";
  event_id?: number;
  series_id?: number;
  title: string;
  description: string | null;
  event_type: string | null;
  location: string | null;
  start_datetime: string;
  end_datetime: string;
  cover_image_path: string | null;
  branch_id: number | null;
  is_open_for_all: boolean;
  status: string | null;
  geofence_lat?: number | null;
  geofence_lng?: number | null;
};

type RecommendationItem = {
  key: string;
  label: string;
  event: EventItem;
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
  if (!path) return null;
  if (isHttpUrl(path)) return path;
  return supabase.storage.from("church-event").getPublicUrl(path).data
    .publicUrl;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const distanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371000;
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

function combineDateAndTime(
  dateISO: string,
  timeHHMMSS: string,
  zone = APP_TZ,
) {
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
}): EventItem[] {
  const { series, windowStart, windowEnd } = args;
  if (!series?.rrule_text) return [];

  const dtStart = combineDateAndTime(
    series.starts_on,
    series.start_time,
    series.timezone || APP_TZ,
  );
  const rule = RRule.fromString(series.rrule_text);
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
    const occEnd = combineDateAndTime(
      occStart.toISODate()!,
      series.end_time,
      series.timezone || APP_TZ,
    );

    return {
      key: `series-${series.series_id}-${occStart.toISO()}`,
      source: "series",
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
      geofence_lat: series.geofence_lat ?? null,
      geofence_lng: series.geofence_lng ?? null,
    };
  });
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [memberBranchId, setMemberBranchId] = useState<number | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(DATE_FILTERS[0]);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [eventTypes, setEventTypes] = useState<string[]>(["All"]);
  const [openDropdown, setOpenDropdown] = useState<
    "branch" | "date" | "type" | null
  >(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const primary = branding?.primary_color || "#0f5a2c";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;
  const cardShadow =
    Platform.select({
      web: { boxShadow: "0px 12px 28px rgba(10, 23, 17, 0.12)" },
      default: { elevation: 3 },
    }) ?? {};

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
      .ilike("role", "member")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("getAppUser error:", error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const user_id = row?.user_id;
    const branch_id = Array.isArray(row?.users_details)
      ? (row?.users_details?.[0]?.branch_id ?? null)
      : (row?.users_details?.branch_id ?? null);
    if (!user_id) return null;
    return { user_id, branch_id };
  };

  const loadBranding = async () => {
    const { data, error } = await supabase
      .from("ui_settings")
      .select("*")
      .single();
    if (!error) setBranding(data);
  };

  const loadBranches = async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("branch_id, name")
      .order("name", { ascending: true });
    if (error) {
      console.warn("loadBranches error:", error);
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

  const loadNotifications = async () => {
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
        .ilike("role", "member")
        .order("updated_at", { ascending: false })
        .limit(1);

      const appUserRow = Array.isArray(appUser) ? appUser[0] : appUser;
      const userId = appUserRow?.user_id;
      if (!userId) {
        setNotifications([]);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = (data ?? []).map((n: any) => ({
        id: n.id,
        read: !!n.is_read,
      }));
      setNotifications(rows);
    } catch (e) {
      console.error("loadNotifications failed:", e);
      setNotifications([]);
    }
  };

  const loadLocation = async () => {
    try {
      let status = (await Location.getForegroundPermissionsAsync()).status;
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      console.warn("location unavailable:", e);
    }
  };

  const loadEvents = async (branchOverride: number | null) => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id;
      const appUser = await getAppUser();
      const userBranchId = appUser?.branch_id ?? null;
      if (__DEV__) {
        console.log("events: authUserId", authUserId);
        console.log("events: appUser", appUser);
      }

      if (memberBranchId === null && userBranchId !== null) {
        setMemberBranchId(userBranchId);
      }

      let bmIds: number[] = [];
      if (authUserId) {
        const { data: ums } = await supabase
          .from("user_ministries")
          .select("branch_ministry_id")
          .eq("auth_user_id", authUserId)
          .eq("status", "Active");
        bmIds = (ums ?? [])
          .map((x: any) => x.branch_ministry_id)
          .filter(Boolean);
      }
      if (__DEV__) {
        console.log("events: bmIds", bmIds);
      }

      const branchIdForQuery = branchOverride ?? userBranchId;

      let openEventsQuery = supabase
        .from("events")
        .select("*")
        .in("status", EVENT_STATUSES)
        .eq("is_open_for_all", true)
        .gte("end_datetime", new Date().toISOString())
        .order("start_datetime", { ascending: true });

      if (branchIdForQuery !== null && branchIdForQuery !== undefined) {
        openEventsQuery = openEventsQuery.or(
          `branch_id.eq.${branchIdForQuery},branch_id.is.null`,
        );
      } else {
        openEventsQuery = openEventsQuery.is("branch_id", null);
      }

      const { data: openEvents, error: openErr } = await openEventsQuery;
      if (openErr) throw openErr;
      if (__DEV__) {
        console.log("events: openEvents", openEvents?.length ?? 0);
      }

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

        let targetedQuery = supabase
          .from("events")
          .select("*")
          .in("status", EVENT_STATUSES)
          .gte("end_datetime", new Date().toISOString())
          .order("start_datetime", { ascending: true });

        if (targetedEventIds.length > 0) {
          targetedQuery = targetedQuery.in("event_id", targetedEventIds);
        } else {
          targetedQuery = targetedQuery.in("branch_ministry_id", bmIds);
        }

        const { data: e2, error: e2Err } = await targetedQuery;
        if (e2Err) throw e2Err;
        targetedEvents = e2 ?? [];

        if (targetedEventIds.length > 0) {
          const { data: directEvents, error: directErr } = await supabase
            .from("events")
            .select("*")
            .in("status", EVENT_STATUSES)
            .in("branch_ministry_id", bmIds)
            .gte("end_datetime", new Date().toISOString())
            .order("start_datetime", { ascending: true });

          if (directErr) throw directErr;
          targetedEvents = [...targetedEvents, ...(directEvents ?? [])];
        }
      }
      if (__DEV__) {
        console.log("events: targetedEvents", targetedEvents.length);
      }

      const uniqSinglesMap = new Map<number, any>();
      [...(openEvents ?? []), ...(targetedEvents ?? [])].forEach((ev: any) => {
        if (ev?.event_id != null) {
          uniqSinglesMap.set(ev.event_id, ev);
        }
      });

      const singles: EventItem[] = Array.from(uniqSinglesMap.values()).map(
        (ev: any) => ({
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
          geofence_lat: ev.geofence_lat ?? null,
          geofence_lng: ev.geofence_lng ?? null,
        }),
      );

      let openSeriesQuery = supabase
        .from("event_series")
        .select("*")
        .eq("is_active", true)
        .eq("is_open_for_all", true)
        .in("status", ["Approved", "Active", "Published"])
        .order("starts_on", { ascending: true });

      if (branchIdForQuery !== null && branchIdForQuery !== undefined) {
        openSeriesQuery = openSeriesQuery.or(
          `branch_id.eq.${branchIdForQuery},branch_id.is.null`,
        );
      } else {
        openSeriesQuery = openSeriesQuery.is("branch_id", null);
      }

      const { data: openSeries, error: seriesErr } = await openSeriesQuery;
      if (seriesErr) throw seriesErr;
      if (__DEV__) {
        console.log("events: openSeries", openSeries?.length ?? 0);
      }

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
          const { data: ts, error: tsErr } = await supabase
            .from("event_series")
            .select("*")
            .eq("is_active", true)
            .in("series_id", seriesIds)
            .in("status", ["Approved", "Active", "Published"])
            .order("starts_on", { ascending: true });

          if (tsErr) throw tsErr;
          targetedSeries = ts ?? [];
        }
      }
      if (__DEV__) {
        console.log("events: targetedSeries", targetedSeries.length);
      }

      if (branchIdForQuery !== null && branchIdForQuery !== undefined) {
        const { data: branchSeries, error: branchSeriesErr } = await supabase
          .from("event_series")
          .select("*")
          .eq("is_active", true)
          .eq("branch_id", branchIdForQuery)
          .in("status", ["Approved", "Active", "Published"])
          .order("starts_on", { ascending: true });
        if (branchSeriesErr) throw branchSeriesErr;
        targetedSeries = [...targetedSeries, ...(branchSeries ?? [])];
      }

      const allSeries = [...(openSeries ?? []), ...(targetedSeries ?? [])];
      const uniqSeriesMap = new Map<number, any>();
      allSeries.forEach((s: any) => {
        if (s?.series_id != null) uniqSeriesMap.set(s.series_id, s);
      });
      const uniqSeries = Array.from(uniqSeriesMap.values());

      const windowStart = DateTime.now().setZone(APP_TZ).startOf("day");
      const windowEnd = windowStart.plus({ days: 90 }).endOf("day");
      const seriesOccurrences = uniqSeries.flatMap((s: any) =>
        expandSeriesToOccurrences({ series: s, windowStart, windowEnd }),
      );

      const merged = [...singles, ...seriesOccurrences];
      merged.sort(
        (a, b) =>
          new Date(a.start_datetime).getTime() -
          new Date(b.start_datetime).getTime(),
      );
      if (__DEV__) {
        console.log("events: merged", merged.length);
      }

      setEvents(merged);

      const types = Array.from(
        new Set(merged.map((e) => e.event_type).filter(Boolean)),
      ) as string[];
      const sortedTypes = types.sort((a, b) => a.localeCompare(b));
      setEventTypes(["All", ...sortedTypes]);
    } catch (e) {
      console.error("loadEvents failed:", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
    loadBranches();
    loadLocation();
    loadNotifications();
  }, []);

  const branchIdForQuery = selectedBranchId ?? memberBranchId;
  useEffect(() => {
    loadEvents(branchIdForQuery ?? null);
  }, [branchIdForQuery]);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const upcomingEvents = useMemo(
    () => events.filter((e) => new Date(e.start_datetime) >= startOfToday),
    [events, startOfToday],
  );

  const filteredEvents = useMemo(() => {
    let list = [...upcomingEvents];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          (e.location || "").toLowerCase().includes(q),
      );
    }

    if (selectedType !== "All") {
      list = list.filter((e) => e.event_type === selectedType);
    }

    if (selectedDate === "Today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      list = list.filter((e) => {
        const d = new Date(e.start_datetime);
        return d >= start && d <= end;
      });
    } else if (selectedDate === "This Week") {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      list = list.filter((e) => {
        const d = new Date(e.start_datetime);
        return d >= start && d <= end;
      });
    } else if (selectedDate === "This Month") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      list = list.filter((e) => {
        const d = new Date(e.start_datetime);
        return d >= start && d <= end;
      });
    }

    return list;
  }, [upcomingEvents, searchQuery, selectedType, selectedDate]);

  useEffect(() => {
    const recs: RecommendationItem[] = [];
    const nextEvent = upcomingEvents[0];

    let nearestEvent: EventItem | null = null;
    if (currentCoords) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const ev of upcomingEvents) {
        if (ev.geofence_lat == null || ev.geofence_lng == null) continue;
        const dist = distanceInMeters(
          currentCoords.latitude,
          currentCoords.longitude,
          Number(ev.geofence_lat),
          Number(ev.geofence_lng),
        );
        if (dist < bestDistance) {
          bestDistance = dist;
          nearestEvent = ev;
        }
      }
    }

    if (nearestEvent) {
      recs.push({
        key: `near-${nearestEvent.key}`,
        label: "Next event near you",
        event: nearestEvent,
      });
    }

    if (nextEvent && nextEvent.key !== nearestEvent?.key) {
      recs.push({
        key: `next-${nextEvent.key}`,
        label: "You may be interested",
        event: nextEvent,
      });
    }

    setRecommendations(recs);
  }, [upcomingEvents, currentCoords]);

  const openEventDetails = (eventId: number | undefined) => {
    if (!eventId) return;
    router.push(`/Member-User/event-details?eventId=${eventId}`);
  };

  const selectedBranchLabel =
    selectedBranchId == null
      ? "All"
      : branches.find((b) => b.id === selectedBranchId)?.name || "All";

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
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
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={[styles.badge, { backgroundColor: secondary }]}>
                <Text style={styles.badgeText}>
                  {notifications.filter((n) => !n.read).length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerSearchArea}>
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
              placeholder="Search events, location, or keywords"
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={[styles.searchInput, { color: "#fff" }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
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
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
        <View style={[styles.filterCard, cardShadow]}>
          <View style={styles.filterRowAligned}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Branch</Text>
              <TouchableOpacity
                style={styles.selectShell}
                activeOpacity={0.8}
                onPress={() =>
                  setOpenDropdown((prev) =>
                    prev === "branch" ? null : "branch",
                  )
                }
              >
                <Text style={styles.selectText} numberOfLines={1}>
                  {selectedBranchLabel}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#4c5a51" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Date</Text>
              <TouchableOpacity
                style={styles.selectShell}
                activeOpacity={0.8}
                onPress={() =>
                  setOpenDropdown((prev) => (prev === "date" ? null : "date"))
                }
              >
                <Text style={styles.selectText} numberOfLines={1}>
                  {selectedDate}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#4c5a51" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Type</Text>
              <TouchableOpacity
                style={styles.selectShell}
                activeOpacity={0.8}
                onPress={() =>
                  setOpenDropdown((prev) => (prev === "type" ? null : "type"))
                }
              >
                <Text style={styles.selectText} numberOfLines={1}>
                  {selectedType}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#4c5a51" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
        </View>
        {recommendations.length === 0 ? (
          <Text style={styles.emptyText}>
            We will show nearby and suggested events here.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationsRow}
          >
            {recommendations.map((rec) => {
              const img = getEventImageUrl(rec.event.cover_image_path);
              return (
                <TouchableOpacity
                  key={rec.key}
                  style={[styles.recommendationCard, cardShadow]}
                  activeOpacity={0.9}
                  onPress={() => openEventDetails(rec.event.event_id)}
                  disabled={!rec.event.event_id}
                >
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={styles.recommendationImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.recommendationImagePlaceholder}>
                      <Text style={styles.recommendationPlaceholderText}>
                        No Image
                      </Text>
                    </View>
                  )}
                  <View style={styles.recommendationBody}>
                    <Text style={styles.recommendationLabel}>{rec.label}</Text>
                    <Text style={styles.recommendationTitle} numberOfLines={2}>
                      {rec.event.title}
                    </Text>
                    <Text style={styles.recommendationMeta}>
                      {formatDateLong(rec.event.start_datetime)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Events</Text>
          <Text style={styles.sectionCount}>{filteredEvents.length}</Text>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading events...</Text>
        ) : filteredEvents.length === 0 ? (
          <Text style={styles.emptyText}>No events match your filters.</Text>
        ) : (
          filteredEvents.map((ev) => {
            const img = getEventImageUrl(ev.cover_image_path);
            return (
              <TouchableOpacity
                key={ev.key}
                style={[styles.eventCardClean, cardShadow]}
                activeOpacity={0.9}
                onPress={() => openEventDetails(ev.event_id)}
                disabled={!ev.event_id}
              >
                <View style={styles.eventCardLeft}>
                  <Text style={styles.eventCardDate}>
                    {formatDateLong(ev.start_datetime)}
                  </Text>
                  <Text style={styles.eventCardTitle} numberOfLines={2}>
                    {ev.title}
                  </Text>
                  <Text style={styles.eventCardDesc} numberOfLines={2}>
                    {ev.description || "Join us for this event."}
                  </Text>
                  <TouchableOpacity
                    style={styles.eventCardButton}
                    activeOpacity={0.8}
                    onPress={() => openEventDetails(ev.event_id)}
                    disabled={!ev.event_id}
                  >
                    <Text style={styles.eventCardButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
                {img ? (
                  <Image
                    source={{ uri: img }}
                    style={styles.eventCardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.eventCardImagePlaceholder} />
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <MemberNavbar />

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

            {openDropdown === "date" &&
              DATE_FILTERS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedDate(opt);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}

            {openDropdown === "type" &&
              eventTypes.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedType(opt);
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6f4",
  },
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
  headerSearchArea: {
    paddingBottom: 14,
  },
  filterCard: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7e5",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterLabel: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "#5f6a64",
    textTransform: "uppercase",
  },
  filterRowAligned: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  filterField: {
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
  body: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a1f1c",
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5c665f",
  },
  emptyText: {
    fontSize: 13,
    color: "#6b756e",
    marginBottom: 10,
  },
  recommendationsRow: {
    paddingBottom: 8,
    gap: 12,
  },
  recommendationCard: {
    width: 220,
    borderRadius: 16,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  recommendationImage: {
    width: "100%",
    height: 120,
  },
  recommendationImagePlaceholder: {
    width: "100%",
    height: 120,
    backgroundColor: "#e7ece8",
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationPlaceholderText: {
    fontSize: 12,
    color: "#8a9590",
  },
  recommendationBody: {
    padding: 12,
  },
  recommendationLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f5a2c",
    marginBottom: 6,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  recommendationMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#6f7b73",
  },
  eventCardClean: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e4e9e6",
  },
  eventCardLeft: {
    flex: 1,
  },
  eventCardDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7a857d",
    marginBottom: 4,
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2a1f",
    marginBottom: 6,
  },
  eventCardDesc: {
    fontSize: 12,
    color: "#6b756e",
    marginBottom: 10,
  },
  eventCardButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#f1f4f2",
    borderWidth: 1,
    borderColor: "#d5dcd8",
  },
  eventCardButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5a51",
  },
  eventCardImage: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#e6ece8",
  },
  eventCardImagePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#e6ece8",
  },
  bottomSpacer: {
    height: 120,
  },
});
