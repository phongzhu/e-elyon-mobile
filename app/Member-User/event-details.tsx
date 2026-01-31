import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import {
  configureBackgroundAttendance,
  getBackgroundAttendanceSnapshot,
  startBackgroundAttendance,
  stopBackgroundAttendance,
} from "../../src/lib/backgroundAttendance";
import { matchesRadarGeofence, radarTrack } from "../../src/lib/radarClient";
import { supabase } from "../../src/lib/supabaseClient";

if (Platform.OS === "web") {
  require("leaflet/dist/leaflet.css");
}

export default function EventDetails() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [branding, setBranding] = useState<any>(null);
  const [showRsvpConfirm, setShowRsvpConfirm] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<"none" | "rsvped" | "attended">(
    "none",
  );
  const [showAttendanceSuccess, setShowAttendanceSuccess] = useState(false);
  const [showGeofenceDetected, setShowGeofenceDetected] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [geofenceStatus, setGeofenceStatus] = useState<
    "idle" | "inside" | "outside" | "unsupported" | "no-permission"
  >("idle");
  const [geofenceProvider, setGeofenceProvider] = useState<
    "radar" | "local" | null
  >(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [countdownStartedAt, setCountdownStartedAt] = useState<Date | null>(
    null,
  );
  const [attendanceSeconds, setAttendanceSeconds] = useState<number>(0);
  const [lastPosition, setLastPosition] =
    useState<Location.LocationObject | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "granted" | "denied"
  >("idle");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<
    { id: number; name: string; photo: string }[]
  >([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const attendancePostedRef = useRef(false);
  const attendanceStartedRef = useRef(false);
  const attendanceSecondsRef = useRef(0);
  const outsideSinceRef = useRef<number | null>(null);
  const lastAttendanceSyncRef = useRef<number>(0);
  const geofenceModalShownRef = useRef(false);
  const attendanceConfirmShownRef = useRef(false);
  const attendanceConfirmKeyRef = useRef<string | null>(null);
  const backgroundSyncedRef = useRef(false);
  const initialAttendanceSecondsRef = useRef(0);
  const geoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const attendanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthUserId(data?.user?.id ?? null);
    })();
  }, []);

  const eventId = useMemo(() => {
    const rawParam =
      (params.id as string | string[] | undefined) ??
      (params.event_id as string | string[] | undefined) ??
      (params.eventId as string | string[] | undefined);
    const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id, params.event_id, params.eventId]);

  useEffect(() => {
    let active = true;

    const loadAttendanceModalState = async () => {
      if (!eventId) return;
      const u = await getAppUser();
      if (!u || !active) return;

      const key = `attendance_modal_shown:${eventId}:${u.user_id}`;
      attendanceConfirmKeyRef.current = key;
      const stored = await AsyncStorage.getItem(key);
      const alreadyShown = stored === "true";

      attendanceConfirmShownRef.current = alreadyShown;
      if (alreadyShown) {
        setShowAttendanceSuccess(false);
      }
    };

    void loadAttendanceModalState();

    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (showAttendanceSuccess) {
      attendanceConfirmShownRef.current = true;
      if (attendanceConfirmKeyRef.current) {
        void AsyncStorage.setItem(attendanceConfirmKeyRef.current, "true");
      }
    }
  }, [showAttendanceSuccess]);

  const getAppUser = async (): Promise<{ user_id: number } | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const authUserId = auth?.user?.id;
    if (!authUserId) return null;

    const { data, error } = await supabase
      .from("users")
      .select("user_id")
      .eq("auth_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ getAppUser error:", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.user_id) return null;
    return { user_id: row.user_id };
  };

  const toPublicUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return supabase.storage.from("church-event").getPublicUrl(path).data
      .publicUrl;
  };

  const PROFILE_PICS_BUCKET = "profile_pics";
  const toProfilePicUrl = (path: string | null | undefined) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return supabase.storage.from(PROFILE_PICS_BUCKET).getPublicUrl(path).data
      .publicUrl;
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const fmtTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isWeb = Platform.OS === "web";
  const eventCoords = useMemo(() => {
    if (event?.geofence_lat == null || event?.geofence_lng == null) return null;
    return {
      latitude: Number(event.geofence_lat),
      longitude: Number(event.geofence_lng),
    };
  }, [event?.geofence_lat, event?.geofence_lng]);

  const isEventActive = (start?: string | null, end?: string | null) => {
    if (!start || !end) return false;
    const now = Date.now();
    return now >= new Date(start).getTime() && now <= new Date(end).getTime();
  };

  const hasGeofence = Boolean(
    event?.geofence_lat != null &&
    event?.geofence_lng != null &&
    event?.geofence_radius_m != null,
  );

  const isRsvpEligible = rsvpStatus !== "none";

  const haversineMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const loadEvent = async () => {
    if (!eventId) {
      setEventError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setEventError(null);
    try {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          event_id,
          title,
          description,
          event_type,
          location,
          start_datetime,
          end_datetime,
          cover_image_path,
          regis_fee_adult,
          regis_fee_minor,
          geofence_lat,
          geofence_lng,
          geofence_radius_m
        `,
        )
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setEventError("Event not found.");
        setEvent(null);
        return;
      }

      setEvent(data);
      backgroundSyncedRef.current = false;
      initialAttendanceSecondsRef.current = 0;
      attendancePostedRef.current = false;
      attendanceStartedRef.current = false;
      setShowAttendanceSuccess(false);
      lastAttendanceSyncRef.current = 0;
      setCountdownSeconds(null);
      setCountdownStartedAt(null);
      setAttendanceSeconds(0);
      attendanceSecondsRef.current = 0;

      const u = await getAppUser();
      if (u) {
        const { data: rsvp } = await supabase
          .from("event_rsvp")
          .select("rsvp_id, attended")
          .eq("event_id", eventId)
          .eq("user_id", u.user_id)
          .maybeSingle();

        const { data: attendance } = await supabase
          .from("event_attendance")
          .select(
            "attendance_id, attendance_counted, attendance_duration_minutes",
          )
          .eq("event_id", eventId)
          .eq("user_id", u.user_id)
          .maybeSingle();

        const prevSeconds = Math.max(
          0,
          Math.round(Number(attendance?.attendance_duration_minutes || 0) * 60),
        );
        initialAttendanceSecondsRef.current = prevSeconds;

        if (prevSeconds > 0 && !attendance?.attendance_counted) {
          setAttendanceSeconds(prevSeconds);
          attendanceSecondsRef.current = prevSeconds;
          setCountdownSeconds(Math.max(0, 180 - prevSeconds));
          setCountdownStartedAt(new Date(Date.now() - prevSeconds * 1000));
        }

        if (attendance?.attendance_counted) {
          setRsvpStatus("attended");
        } else if (rsvp?.rsvp_id) {
          setRsvpStatus("rsvped");
        } else {
          setRsvpStatus("none");
        }
      }

      void loadAttendees(data?.event_id);
    } catch (e: any) {
      console.error("❌ loadEvent failed:", e);
      setEventError(e?.message || "Failed to load event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    let active = true;

    const syncBackgroundState = async () => {
      if (!eventId) return;
      const u = await getAppUser();
      if (!u || !active) return;

      const snapshot = await getBackgroundAttendanceSnapshot();
      const config = snapshot.config;
      if (!config) return;
      if (config.event_id !== eventId || config.user_id !== u.user_id) return;

      const totalSeconds = snapshot.state?.totalSeconds ?? 0;
      const inside = snapshot.state?.inside ?? false;

      backgroundSyncedRef.current = true;
      setAttendanceSeconds(totalSeconds);
      attendanceSecondsRef.current = totalSeconds;

      if (inside) {
        const remaining = Math.max(0, 180 - totalSeconds);
        setCountdownSeconds(remaining);
        setCountdownStartedAt(new Date(Date.now() - totalSeconds * 1000));
        attendanceStartedRef.current = true;
        if (!geofenceModalShownRef.current && totalSeconds < 180) {
          geofenceModalShownRef.current = true;
          setShowGeofenceDetected(true);
        }
      } else if (totalSeconds === 0) {
        setCountdownSeconds(null);
        setCountdownStartedAt(null);
        attendanceStartedRef.current = false;
      }
    };

    void syncBackgroundState();
    const interval = setInterval(syncBackgroundState, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    const startLocation = async () => {
      if (Platform.OS === "web") {
        try {
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (cancelled) return;
                setLocationStatus("granted");
                setCurrentCoords({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              () => {
                if (!cancelled) setLocationStatus("denied");
              },
              { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
            );
          }
        } catch {}
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!cancelled) setLocationStatus("denied");
        return;
      }

      if (!cancelled) setLocationStatus("granted");

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCurrentCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {}

      try {
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 10,
          },
          (pos) => {
            if (cancelled) return;
            setCurrentCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
        );
      } catch {}
    };

    startLocation();

    return () => {
      cancelled = true;
      if (locationWatchRef.current) {
        try {
          if (typeof locationWatchRef.current.remove === "function") {
            locationWatchRef.current.remove();
          }
        } catch {}
        locationWatchRef.current = null;
      }
    };
  }, []);

  const loadAttendees = async (evtId?: number | null) => {
    if (!evtId) return;
    setAttendeesLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_rsvp")
        .select(
          `
          rsvp_id,
          user:users (
            user_id,
            user_details_id,
            user_details:users_details (
              first_name,
              last_name,
              photo_path
            )
          )
        `,
        )
        .eq("event_id", evtId);

      if (error) throw error;

      const mapped = (data ?? []).map((row: any) => {
        const details = Array.isArray(row?.user?.user_details)
          ? row.user.user_details?.[0]
          : row?.user?.user_details;
        const first = details?.first_name ?? "";
        const last = details?.last_name ?? "";
        const name = `${first} ${last}`.trim() || "Member";
        const photo =
          toProfilePicUrl(details?.photo_path) ||
          "https://i.pravatar.cc/80?img=12";
        return {
          id: row.rsvp_id,
          name,
          photo,
        };
      });

      setAttendees(mapped);
    } catch (e) {
      console.error("❌ loadAttendees failed:", e);
      setAttendees([]);
    } finally {
      setAttendeesLoading(false);
    }
  };

  useEffect(() => {
    if (!event || !hasGeofence) {
      setGeofenceStatus(hasGeofence ? "idle" : "unsupported");
      return;
    }

    if (Platform.OS === "web" && typeof navigator === "undefined") {
      setGeofenceStatus("unsupported");
      return;
    }

    if (locationStatus === "denied") {
      setGeofenceStatus("no-permission");
      setCountdownSeconds(null);
      setCountdownStartedAt(null);
      setAttendanceSeconds(0);
      attendanceSecondsRef.current = 0;
      lastAttendanceSyncRef.current = 0;
      geofenceModalShownRef.current = false;
      void stopBackgroundTracking();
      return;
    }

    let active = true;

    const startGeofence = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGeofenceStatus("no-permission");
        setLocationStatus("denied");
        setCountdownSeconds(null);
        setCountdownStartedAt(null);
        setAttendanceSeconds(0);
        attendanceSecondsRef.current = 0;
        lastAttendanceSyncRef.current = 0;
        geofenceModalShownRef.current = false;
        return;
      }

      if (!active) return;

      const poll = async () => {
        if (!event) return;
        if (rsvpStatus === "attended") {
          setCountdownSeconds(null);
          setCountdownStartedAt(null);
          setAttendanceSeconds(0);
          attendanceSecondsRef.current = 0;
          attendanceStartedRef.current = false;
          lastAttendanceSyncRef.current = 0;
          geofenceModalShownRef.current = false;
          return;
        }

        const activeEvent = isEventActive(
          event.start_datetime,
          event.end_datetime,
        );
        if (!activeEvent) {
          setCountdownSeconds(null);
          setGeofenceStatus("outside");
          setAttendanceSeconds(0);
          setDistanceMeters(null);
          attendanceSecondsRef.current = 0;
          attendanceStartedRef.current = false;
          lastAttendanceSyncRef.current = 0;
          geofenceModalShownRef.current = false;
          return;
        }

        if (!isRsvpEligible) {
          setCountdownSeconds(null);
          setCountdownStartedAt(null);
          setGeofenceStatus("outside");
          setAttendanceSeconds(0);
          setDistanceMeters(null);
          attendanceSecondsRef.current = 0;
          attendanceStartedRef.current = false;
          lastAttendanceSyncRef.current = 0;
          geofenceModalShownRef.current = false;
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLastPosition(pos);

        let inside = false;
        let usedRadar = false;
        const radius = Number(event.geofence_radius_m || 0);
        const radiusBuffer = Math.max(10, Math.round(radius * 0.1));
        const graceMs = 15000;

        if (authUserId) {
          try {
            const radarRes = await radarTrack({
              userId: authUserId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              eventId: event.event_id,
            });

            if (radarRes?.geofences?.length) {
              inside = radarRes.geofences.some((g) =>
                matchesRadarGeofence(g, event.event_id),
              );
              usedRadar = true;
            }
          } catch (e) {
            console.warn("Radar check failed, falling back to local geofence.");
          }
        }

        if (!usedRadar) {
          const dist = haversineMeters(
            pos.coords.latitude,
            pos.coords.longitude,
            Number(event.geofence_lat),
            Number(event.geofence_lng),
          );
          inside = dist <= radius + radiusBuffer;
          setDistanceMeters(dist);
          setGeofenceProvider("local");
        } else {
          setGeofenceProvider("radar");
          setDistanceMeters(null);
        }

        if (!inside) {
          if (outsideSinceRef.current == null) {
            outsideSinceRef.current = Date.now();
          }
        } else {
          outsideSinceRef.current = null;
        }

        const isOutsideLongEnough =
          outsideSinceRef.current != null &&
          Date.now() - outsideSinceRef.current >= graceMs;

        setGeofenceStatus(inside ? "inside" : "outside");

        if (inside) {
          if (!attendanceStartedRef.current) {
            attendanceStartedRef.current = true;
            void recordAttendanceStart();
          }
          if (countdownSeconds == null) {
            let restored = false;
            const snapshot = await getBackgroundAttendanceSnapshot();
            const totalSeconds = snapshot.state?.totalSeconds ?? 0;
            const bgInside = snapshot.state?.inside ?? false;
            const u = await getAppUser();
            const config = snapshot.config;
            const matchesConfig =
              u &&
              config &&
              config.event_id === event.event_id &&
              config.user_id === u.user_id;

            if (matchesConfig && bgInside && totalSeconds > 0) {
              const remaining = Math.max(0, 180 - totalSeconds);
              setCountdownSeconds(remaining);
              setCountdownStartedAt(new Date(Date.now() - totalSeconds * 1000));
              setAttendanceSeconds(totalSeconds);
              attendanceSecondsRef.current = totalSeconds;
              restored = true;
            }

            if (!restored) {
              const startedAt = new Date();
              setCountdownSeconds(180);
              setCountdownStartedAt(startedAt);
              if (u) void ensureBackgroundTracking(u);
            }

            if (!geofenceModalShownRef.current) {
              geofenceModalShownRef.current = true;
              setShowGeofenceDetected(true);
            }
          }
        } else if (isOutsideLongEnough) {
          setCountdownSeconds(null);
          setCountdownStartedAt(null);
          setAttendanceSeconds(0);
          setDistanceMeters(null);
          attendanceSecondsRef.current = 0;
          attendanceStartedRef.current = false;
          lastAttendanceSyncRef.current = 0;
          geofenceModalShownRef.current = false;
        }
      };

      await poll();
      geoIntervalRef.current = setInterval(poll, 15000);
    };

    startGeofence();

    return () => {
      active = false;
      if (geoIntervalRef.current) clearInterval(geoIntervalRef.current);
      geoIntervalRef.current = null;
      if (attendanceIntervalRef.current)
        clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
    };
  }, [event, hasGeofence, rsvpStatus, locationStatus]);

  useEffect(() => {
    let active = true;

    const setupBackground = async () => {
      if (!event || !hasGeofence) return;
      if (locationStatus === "denied") {
        await stopBackgroundTracking();
        return;
      }
      const u = await getAppUser();
      if (!u || !active) return;

      if (!isRsvpEligible || rsvpStatus === "attended") {
        await stopBackgroundTracking();
        return;
      }

      await ensureBackgroundTracking(u);
    };

    void setupBackground();

    return () => {
      active = false;
    };
  }, [event, hasGeofence, isRsvpEligible, rsvpStatus, locationStatus]);

  useEffect(() => {
    if (countdownSeconds == null) {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      return;
    }

    if (countdownSeconds <= 0) {
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => (prev == null ? null : prev - 1));
    }, 1000);

    return () => {
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    };
  }, [countdownSeconds]);

  useEffect(() => {
    if (countdownSeconds == null) {
      if (attendanceIntervalRef.current)
        clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
      attendanceSecondsRef.current = 0;
      return;
    }

    if (attendanceIntervalRef.current) return;

    attendanceIntervalRef.current = setInterval(() => {
      setAttendanceSeconds((prev) => {
        const next = prev + 1;
        attendanceSecondsRef.current = next;
        return next;
      });

      const now = Date.now();
      if (now - lastAttendanceSyncRef.current >= 10000) {
        lastAttendanceSyncRef.current = now;
        void syncAttendanceProgress();
      }
    }, 1000);

    return () => {
      if (attendanceIntervalRef.current)
        clearInterval(attendanceIntervalRef.current);
      attendanceIntervalRef.current = null;
    };
  }, [countdownSeconds]);

  useEffect(() => {
    if (!event || countdownSeconds == null || countdownSeconds > 0) return;
    if (!isRsvpEligible) return;
    if (attendancePostedRef.current) return;
    attendancePostedRef.current = true;
    void recordAttendance();
  }, [countdownSeconds, event, isRsvpEligible]);

  useEffect(() => {
    if (!eventId || rsvpStatus === "attended") return;
    let active = true;

    const pollAttendanceStatus = async () => {
      const u = await getAppUser();
      if (!u || !active) return;

      const { data: rsvp, error } = await supabase
        .from("event_rsvp")
        .select("attended")
        .eq("event_id", eventId)
        .eq("user_id", u.user_id)
        .maybeSingle();

      if (!active || error) return;
      if (!rsvp?.attended) return;

      setRsvpStatus("attended");
      setCountdownSeconds(null);
      setCountdownStartedAt(null);
      setAttendanceSeconds(0);
      attendanceSecondsRef.current = 0;
      lastAttendanceSyncRef.current = 0;
      void stopBackgroundTracking();
      void loadAttendees(eventId);

      if (!attendanceConfirmShownRef.current) {
        attendanceConfirmShownRef.current = true;
        setShowAttendanceSuccess(true);
      }
    };

    void pollAttendanceStatus();
    const interval = setInterval(pollAttendanceStatus, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eventId, rsvpStatus]);

  const recordAttendanceStart = async () => {
    try {
      const u = await getAppUser();
      if (!u) return;

      const durationMinutes = Number((attendanceSeconds / 60).toFixed(2));
      const payload = {
        event_id: event.event_id,
        user_id: u.user_id,
        check_in_method: "geofence",
        attended_at: new Date().toISOString(),
        latitude: lastPosition?.coords?.latitude ?? null,
        longitude: lastPosition?.coords?.longitude ?? null,
        attendance_counted: false,
        attendance_duration_minutes: durationMinutes,
      };

      await supabase
        .from("event_attendance")
        .upsert(payload, { onConflict: "event_id,user_id" });
    } catch (e) {
      console.error("❌ recordAttendanceStart failed:", e);
    }
  };

  const syncAttendanceProgress = async () => {
    try {
      const u = await getAppUser();
      if (!u || !event) return;

      const durationMinutes = Number(
        (attendanceSecondsRef.current / 60).toFixed(2),
      );
      const attendanceCounted = durationMinutes >= 3;

      const { error: attendanceError } = await supabase
        .from("event_attendance")
        .upsert(
          {
            event_id: event.event_id,
            user_id: u.user_id,
            check_in_method: "geofence",
            attended_at: new Date().toISOString(),
            latitude: lastPosition?.coords?.latitude ?? null,
            longitude: lastPosition?.coords?.longitude ?? null,
            attendance_counted: attendanceCounted,
            attendance_duration_minutes: durationMinutes,
          },
          { onConflict: "event_id,user_id" },
        );

      if (attendanceError) throw attendanceError;

      if (attendanceCounted) {
        const { error: rsvpError } = await supabase.from("event_rsvp").upsert(
          {
            event_id: event.event_id,
            user_id: u.user_id,
            attended: true,
          },
          { onConflict: "event_id,user_id" },
        );

        if (rsvpError) throw rsvpError;

        if (rsvpStatus !== "attended") {
          setRsvpStatus("attended");
          if (!attendanceConfirmShownRef.current) {
            attendanceConfirmShownRef.current = true;
            setShowAttendanceSuccess(true);
          }
          setCountdownSeconds(null);
          setCountdownStartedAt(null);
        }
        void stopBackgroundTracking();
      }
    } catch (e) {
      console.error("❌ syncAttendanceProgress failed:", e);
    }
  };

  const ensureBackgroundTracking = async (u: { user_id: number }) => {
    if (!event || !hasGeofence) return;

    if (Platform.OS !== "web") {
      try {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== "granted") return;
      } catch {
        return;
      }
    }

    const snapshot = await getBackgroundAttendanceSnapshot();
    const existing = snapshot.config;
    const sameConfig =
      existing &&
      existing.event_id === event.event_id &&
      existing.user_id === u.user_id;

    if (!sameConfig) {
      await configureBackgroundAttendance({
        event_id: event.event_id,
        user_id: u.user_id,
        geofence_lat: Number(event.geofence_lat),
        geofence_lng: Number(event.geofence_lng),
        geofence_radius_m: Number(event.geofence_radius_m),
        event_start: event.start_datetime,
        event_end: event.end_datetime,
        initial_seconds: Math.max(
          snapshot.state?.totalSeconds ?? 0,
          initialAttendanceSecondsRef.current,
        ),
      });
    }

    await startBackgroundAttendance();
  };

  const stopBackgroundTracking = async () => {
    await configureBackgroundAttendance(null);
    await stopBackgroundAttendance();
  };

  const recordAttendance = async () => {
    try {
      const u = await getAppUser();
      if (!u) {
        Alert.alert("Attendance", "Please log in to record attendance.");
        return;
      }

      const durationMinutes = Math.max(
        0.01,
        Number((attendanceSecondsRef.current / 60).toFixed(2)),
      );

      const payload = {
        event_id: event.event_id,
        user_id: u.user_id,
        check_in_method: "geofence",
        attended_at: new Date().toISOString(),
        latitude: lastPosition?.coords?.latitude ?? null,
        longitude: lastPosition?.coords?.longitude ?? null,
        attendance_counted: true,
        attendance_duration_minutes: durationMinutes,
      };

      const { error } = await supabase
        .from("event_attendance")
        .upsert(payload, { onConflict: "event_id,user_id" });

      if (error) throw error;

      const { error: rsvpError } = await supabase.from("event_rsvp").upsert(
        {
          event_id: event.event_id,
          user_id: u.user_id,
          attended: true,
        },
        { onConflict: "event_id,user_id" },
      );

      if (rsvpError) throw rsvpError;

      setRsvpStatus("attended");
      setCountdownSeconds(null);
      setCountdownStartedAt(null);
      setAttendanceSeconds(0);
      attendanceSecondsRef.current = 0;
      lastAttendanceSyncRef.current = 0;
      void stopBackgroundTracking();
      void loadAttendees(event.event_id);
      if (!attendanceConfirmShownRef.current) {
        attendanceConfirmShownRef.current = true;
        setShowAttendanceSuccess(true);
      }
    } catch (e: any) {
      console.error("❌ recordAttendance failed:", e);
      attendancePostedRef.current = false;
      Alert.alert("Attendance", e?.message || "Failed to record attendance.");
    }
  };

  const handleRsvp = async () => {
    if (!event) return;
    setRsvpLoading(true);
    try {
      const u = await getAppUser();
      if (!u) {
        Alert.alert("RSVP", "Please log in to RSVP.");
        return;
      }

      const payload = {
        event_id: event.event_id,
        user_id: u.user_id,
        attended: false,
      };

      const { error } = await supabase
        .from("event_rsvp")
        .upsert(payload, { onConflict: "event_id,user_id" });

      if (error) throw error;

      setRsvpStatus("rsvped");
      if (hasGeofence && locationStatus !== "denied") {
        void ensureBackgroundTracking(u);
      }
      void loadAttendees(event.event_id);
      setShowRsvpConfirm(true);
    } catch (e: any) {
      console.error("❌ RSVP failed:", e);
      Alert.alert("RSVP", e?.message || "Failed to RSVP.");
    } finally {
      setRsvpLoading(false);
    }
  };

  const generateAttendanceQr = async () => {
    if (!event) return;
    setQrLoading(true);
    try {
      const u = await getAppUser();
      if (!u || !authUserId) {
        Alert.alert("QR Attendance", "Please log in to generate your QR code.");
        return;
      }

      const { error: checkInError } = await supabase
        .from("event_attendance")
        .upsert(
          {
            event_id: event.event_id,
            user_id: u.user_id,
            check_in_method: "qr",
            attended_at: new Date().toISOString(),
          },
          { onConflict: "event_id,user_id" },
        );

      if (checkInError) throw checkInError;

      const payload = {
        type: "check-in",
        v: 1,
        user_id: u.user_id,
        auth_user_id: authUserId,
        event_id: event.event_id,
        timestamp: new Date().toISOString(),
      };

      const svg = await new Promise<string>((resolve, reject) => {
        QRCode.toString(
          JSON.stringify(payload),
          { type: "svg", width: 320, margin: 2 } as any,
          (err, url) => {
            if (err) reject(err);
            else resolve(url);
          },
        );
      });

      setQrSvg(svg);
      setShowQrModal(true);
    } catch (e) {
      console.error("QR generation failed:", e);
      Alert.alert("QR Attendance", "Failed to generate QR code.");
    } finally {
      setQrLoading(false);
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

  const title = event?.title || (params.title as string) || "Event";
  const subtitle =
    event?.description ||
    (params.subtitle as string) ||
    "Event details unavailable.";
  const date = fmtDate(event?.start_datetime) || (params.date as string) || "";
  const timeStart = fmtTime(event?.start_datetime);
  const timeEnd = fmtTime(event?.end_datetime);
  const time =
    timeStart && timeEnd
      ? `${timeStart} - ${timeEnd}`
      : (params.time as string) || "";
  const location = event?.location || (params.location as string) || "";
  const image =
    toPublicUrl(event?.cover_image_path) ||
    (params.image as string) ||
    "https://images.unsplash.com/photo-1515165562835-c4c46905b01c?w=1200&q=80";
  const mapImage =
    "https://drive.google.com/uc?export=view&id=1pjCtJy7JVbzX0J8jAcNvQlrTtbGITvg2";

  const geofenceMessage = useMemo(() => {
    if (!hasGeofence) return "Geo-fencing not set for this event.";
    if (geofenceStatus === "unsupported")
      return "Geo-fencing is not supported on web.";
    if (geofenceStatus === "no-permission")
      return "Location permission is required for attendance.";
    if (!isRsvpEligible) return "RSVP is required before attendance can start.";
    if (!isEventActive(event?.start_datetime, event?.end_datetime)) {
      return "Attendance starts when the event begins.";
    }
    if (geofenceStatus === "inside") return "You are inside the event area.";
    if (geofenceStatus === "outside") return "You are outside the event area.";
    return "Checking your location...";
  }, [event, hasGeofence, geofenceStatus, isRsvpEligible]);

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
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/Member-User/Member-Dashboard");
            }}
            style={styles.iconButton}
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

        <Text style={styles.headerTitle}>Event Details</Text>

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

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: image }} style={styles.hero} />

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={primary} />
              <Text style={styles.loadingText}>Loading event...</Text>
            </View>
          ) : eventError ? (
            <Text style={styles.errorText}>{eventError}</Text>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </>
          )}

          <View style={styles.infoBlock}>
            <InfoRow icon="calendar-outline" label={date} />
            <InfoRow icon="time-outline" label={time} />
            <InfoRow icon="location-outline" label={location} />
            {event?.event_type ? (
              <InfoRow icon="pricetag-outline" label={event.event_type} />
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: primary }]}
            onPress={handleRsvp}
            disabled={rsvpLoading || rsvpStatus !== "none"}
          >
            {rsvpLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {rsvpStatus === "attended"
                  ? "Attendance Recorded"
                  : rsvpStatus === "rsvped"
                    ? "RSVP Submitted"
                    : "RSVP"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.geoCard}>
            <View style={styles.geoTitleRow}>
              <Text style={styles.geoTitle}>Attendance via Geo-fence</Text>
              {hasGeofence && isRsvpEligible ? (
                <View style={styles.geoTrackingPill}>
                  <View style={styles.geoTrackingDot} />
                  <Text style={styles.geoTrackingText}>
                    {rsvpStatus === "attended" ? "Recorded" : "Tracking"}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.geoMessage}>{geofenceMessage}</Text>
            {hasGeofence && countdownSeconds != null ? (
              <Text style={styles.geoCountdown}>
                Countdown: {Math.max(0, countdownSeconds)}s
              </Text>
            ) : null}
            {hasGeofence && countdownSeconds != null ? (
              <Text style={styles.geoMeta}>
                Attendance time: {Math.floor(attendanceSeconds / 60)}m{" "}
                {attendanceSeconds % 60}s
              </Text>
            ) : null}
            {hasGeofence ? (
              <Text style={styles.geoMeta}>
                Radius: {Number(event?.geofence_radius_m || 0)}m
                {geofenceProvider ? ` • Provider: ${geofenceProvider}` : ""}
              </Text>
            ) : null}
            {isRsvpEligible &&
            rsvpStatus !== "attended" &&
            (geofenceStatus === "no-permission" ||
              geofenceStatus === "unsupported" ||
              locationStatus === "denied") ? (
              <TouchableOpacity
                style={[styles.qrButton, { backgroundColor: primary }]}
                onPress={generateAttendanceQr}
                disabled={qrLoading}
              >
                <Text style={styles.qrButtonText}>
                  {qrLoading ? "Generating QR..." : "Use QR Attendance"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>Location</Text>
            <Text style={styles.locationText}>Event: {location || "-"}</Text>
            <Text style={styles.locationText}>
              Your location:{" "}
              {currentCoords
                ? `${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}`
                : locationStatus === "denied"
                  ? "Location permission denied"
                  : "Waiting for GPS..."}
            </Text>
            {distanceMeters != null ? (
              <Text style={styles.locationText}>
                Distance to event: {Math.round(distanceMeters)}m
              </Text>
            ) : null}
            {countdownSeconds != null ? (
              <Text style={styles.locationText}>
                Time in area: {Math.floor(attendanceSeconds / 60)}m{" "}
                {attendanceSeconds % 60}s
              </Text>
            ) : null}

            {isWeb && eventCoords ? (
              <View style={styles.mapContainer}>
                {(() => {
                  // Lazy-require to avoid native bundling
                  const RL = require("react-leaflet");
                  const MapContainer = RL.MapContainer;
                  const TileLayer = RL.TileLayer;
                  const Circle = RL.Circle;
                  const CircleMarker = RL.CircleMarker;
                  const Popup = RL.Popup;
                  return (
                    <MapContainer
                      center={[eventCoords.latitude, eventCoords.longitude]}
                      zoom={16}
                      style={{ height: 220, width: "100%" }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Circle
                        center={[eventCoords.latitude, eventCoords.longitude]}
                        radius={Number(event?.geofence_radius_m || 0)}
                        pathOptions={{
                          color: "#2f6b3f",
                          fillColor: "#2f6b3f",
                          fillOpacity: 0.15,
                        }}
                      />
                      <CircleMarker
                        center={[eventCoords.latitude, eventCoords.longitude]}
                        radius={10}
                        pathOptions={{ color: "#2f6b3f", fillColor: "#2f6b3f" }}
                      >
                        <Popup>
                          <Text style={{ color: "#1f2a1f" }}>
                            Event Location
                          </Text>
                        </Popup>
                      </CircleMarker>
                      {currentCoords ? (
                        <CircleMarker
                          center={[
                            currentCoords.latitude,
                            currentCoords.longitude,
                          ]}
                          radius={8}
                          pathOptions={{
                            color: "#1c88ff",
                            fillColor: "#1c88ff",
                          }}
                        >
                          <Popup>
                            <Text style={{ color: "#1f2a1f" }}>
                              Your Location
                            </Text>
                          </Popup>
                        </CircleMarker>
                      ) : null}
                    </MapContainer>
                  );
                })()}
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 18 }}>
            <Text style={styles.sectionTitle}>
              Who’s Attending {attendees.length ? `(${attendees.length})` : ""}
            </Text>
            {attendeesLoading ? (
              <Text style={styles.loadingText}>Loading attendees...</Text>
            ) : attendees.length === 0 ? (
              <Text style={styles.emptyText}>No RSVPs yet.</Text>
            ) : (
              <View style={styles.avatarRow}>
                {attendees.map((a, idx) => (
                  <Image
                    key={a.id}
                    source={{ uri: a.photo }}
                    style={[styles.avatar, idx > 0 && { marginLeft: -10 }]}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal
        visible={showAttendanceSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttendanceSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: `${primary}30` }]}>
            <Ionicons name="checkmark-circle" size={56} color={primary} />
            <Text style={styles.modalTitle}>Attendance Recorded</Text>
            <Text style={styles.modalMessage}>
              You have successfully attended this event.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primary }]}
              onPress={() => {
                setShowAttendanceSuccess(false);
                router.replace("/Member-User/Member-Dashboard");
              }}
            >
              <Text style={styles.modalButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGeofenceDetected}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGeofenceDetected(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: `${primary}30` }]}>
            <Ionicons name="navigate-circle" size={56} color={primary} />
            <Text style={styles.modalTitle}>You are on site</Text>
            <Text style={styles.modalMessage}>
              We detected you inside the event area. Your attendance is now
              being recorded.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primary }]}
              onPress={() => setShowGeofenceDetected(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: `${primary}30` }]}>
            <Ionicons name="qr-code" size={56} color={primary} />
            <Text style={styles.modalTitle}>QR Attendance</Text>
            <Text style={styles.modalMessage}>
              Show this code to the QR staff for attendance.
            </Text>
            {qrSvg ? <SvgXml xml={qrSvg} width={240} height={240} /> : null}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primary }]}
              onPress={() => setShowQrModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRsvpConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRsvpConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: `${primary}30` }]}>
            <Ionicons name="checkmark-circle" size={56} color={primary} />
            <Text style={styles.modalTitle}>RSVP Received</Text>
            <Text style={styles.modalMessage}>
              Thank you! We’ve recorded your RSVP. We’ll reach out with any
              updates about this event.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primary }]}
              onPress={() => setShowRsvpConfirm(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color="#1f2a1f" />
      </View>
      <Text style={styles.infoText}>{label}</Text>
    </View>
  );
}

const avatars = [
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/women/32.jpg",
  "https://randomuser.me/api/portraits/men/45.jpg",
  "https://randomuser.me/api/portraits/women/12.jpg",
  "https://randomuser.me/api/portraits/men/14.jpg",
];

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
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
    fontSize: 18,
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
  hero: {
    width: "100%",
    height: 220,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#3b463b",
  },
  errorText: {
    fontSize: 14,
    color: "#b00020",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#3b463b",
  },
  infoBlock: {
    marginTop: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef3ec",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#1f2a1f",
  },
  cta: {
    marginTop: 16,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  geoCard: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6ece6",
    backgroundColor: "#f8faf8",
    padding: 12,
    gap: 6,
  },
  geoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  geoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  geoTrackingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e6f3ea",
  },
  geoTrackingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2f6b3f",
  },
  geoTrackingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2f6b3f",
  },
  geoMessage: {
    fontSize: 13,
    color: "#3b463b",
  },
  geoCountdown: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  geoMeta: {
    fontSize: 12,
    color: "#5b6b5b",
  },
  qrButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  qrButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 13,
    color: "#5b6b5b",
  },
  map: {
    marginTop: 16,
    width: "100%",
    height: 190,
    borderRadius: 12,
    backgroundColor: "#dfe5df",
  },
  locationCard: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6ece6",
    backgroundColor: "#f8faf8",
    padding: 12,
    gap: 6,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2a1f",
  },
  locationText: {
    fontSize: 13,
    color: "#3b463b",
  },
  mapContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a1f",
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
  },
  modalTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    color: "#3b463b",
    textAlign: "center",
    lineHeight: 20,
  },
  modalButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
