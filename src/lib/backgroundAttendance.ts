import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { supabase } from "./supabaseClient";

export const BACKGROUND_ATTENDANCE_TASK = "background-attendance";

const CONFIG_KEY = "bg_attendance_config";
const STATE_KEY = "bg_attendance_state";

type BackgroundAttendanceConfig = {
  event_id: number;
  user_id: number;
  geofence_lat: number;
  geofence_lng: number;
  geofence_radius_m: number;
  event_start: string;
  event_end: string;
  initial_seconds?: number;
};

type BackgroundAttendanceState = {
  totalSeconds: number;
  lastTimestamp: number | null;
  inside: boolean;
};

const isEventActive = (start?: string | null, end?: string | null) => {
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
};

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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const loadConfig = async (): Promise<BackgroundAttendanceConfig | null> => {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as BackgroundAttendanceConfig) : null;
  } catch {
    return null;
  }
};

const loadState = async (): Promise<BackgroundAttendanceState> => {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as BackgroundAttendanceState;
  } catch {}
  return { totalSeconds: 0, lastTimestamp: null, inside: false };
};

const saveState = async (state: BackgroundAttendanceState) => {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {}
};

export const getBackgroundAttendanceSnapshot = async () => {
  const [config, state] = await Promise.all([loadConfig(), loadState()]);
  return { config, state };
};

if (!TaskManager.isTaskDefined(BACKGROUND_ATTENDANCE_TASK)) {
  TaskManager.defineTask(BACKGROUND_ATTENDANCE_TASK, async ({ data, error }) => {
    if (error) return;

    const config = await loadConfig();
    if (!config) return;

    if (!isEventActive(config.event_start, config.event_end)) {
      try {
        if (Platform.OS !== "web" && typeof (Location as any).stopLocationUpdatesAsync === "function") {
          await (Location as any).stopLocationUpdatesAsync(
            BACKGROUND_ATTENDANCE_TASK,
          );
        }
      } catch {}
      await AsyncStorage.multiRemove([CONFIG_KEY, STATE_KEY]);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)
      ?.locations;
    if (!locations?.length) return;

    const latest = locations[locations.length - 1];
    const nowTs = latest.timestamp ?? Date.now();
    const dist = haversineMeters(
      latest.coords.latitude,
      latest.coords.longitude,
      config.geofence_lat,
      config.geofence_lng,
    );
    const inside = dist <= config.geofence_radius_m;

    const prevState = await loadState();
    const lastTs = prevState.lastTimestamp ?? nowTs;
    let totalSeconds = prevState.totalSeconds ?? 0;

    if (prevState.inside && inside) {
      const delta = Math.max(0, Math.round((nowTs - lastTs) / 1000));
      totalSeconds += delta;
    }

    const nextState: BackgroundAttendanceState = {
      totalSeconds,
      lastTimestamp: nowTs,
      inside,
    };
    await saveState(nextState);

    if (!inside) return;

    const durationMinutes = Number((totalSeconds / 60).toFixed(2));
    const attendanceCounted = durationMinutes >= 3;

    await supabase
      .from("event_attendance")
      .upsert(
        {
          event_id: config.event_id,
          user_id: config.user_id,
          check_in_method: "geofence",
          attended_at: new Date().toISOString(),
          latitude: latest.coords.latitude ?? null,
          longitude: latest.coords.longitude ?? null,
          attendance_counted: attendanceCounted,
          attendance_duration_minutes: durationMinutes,
        },
        { onConflict: "event_id,user_id" },
      );

    if (attendanceCounted) {
      await supabase
        .from("event_rsvp")
        .upsert(
          {
            event_id: config.event_id,
            user_id: config.user_id,
            attended: true,
          },
          { onConflict: "event_id,user_id" },
        );

      try {
        if (Platform.OS !== "web" && typeof (Location as any).stopLocationUpdatesAsync === "function") {
          await (Location as any).stopLocationUpdatesAsync(
            BACKGROUND_ATTENDANCE_TASK,
          );
        }
      } catch {}
      await AsyncStorage.multiRemove([CONFIG_KEY, STATE_KEY]);
    }
  });
}

export const configureBackgroundAttendance = async (
  config: BackgroundAttendanceConfig | null,
) => {
  if (!config) {
    await AsyncStorage.multiRemove([CONFIG_KEY, STATE_KEY]);
    return;
  }

  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  const existingState = await loadState();
  const initialSeconds = Math.max(
    existingState.totalSeconds || 0,
    config.initial_seconds || 0,
  );

  await saveState({
    totalSeconds: initialSeconds,
    lastTimestamp: null,
    inside: existingState.inside || false,
  });
};

export const startBackgroundAttendance = async () => {
  if (Platform.OS === "web") return;
  const locationModule: any = (Location as any).default ?? Location;
  if (typeof locationModule.hasStartedLocationUpdatesAsync !== "function") {
    return;
  }

  const started = await locationModule.hasStartedLocationUpdatesAsync(
    BACKGROUND_ATTENDANCE_TASK,
  );
  if (started) return;

  await locationModule.startLocationUpdatesAsync(BACKGROUND_ATTENDANCE_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 10,
    deferredUpdatesInterval: 15000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Attendance tracking",
      notificationBody: "Tracking your event attendance in the background.",
      notificationColor: "#064622",
    },
  });
};

export const stopBackgroundAttendance = async () => {
  if (Platform.OS === "web") return;
  const locationModule: any = (Location as any).default ?? Location;
  if (typeof locationModule.hasStartedLocationUpdatesAsync !== "function") {
    return;
  }

  const started = await locationModule.hasStartedLocationUpdatesAsync(
    BACKGROUND_ATTENDANCE_TASK,
  );
  if (!started) return;
  await locationModule.stopLocationUpdatesAsync(BACKGROUND_ATTENDANCE_TASK);
};
