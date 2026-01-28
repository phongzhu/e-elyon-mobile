type RadarGeofence = {
  _id?: string;
  tag?: string | null;
  externalId?: string | null;
  metadata?: Record<string, any> | null;
};

type RadarTrackResponse = {
  geofences?: RadarGeofence[];
  events?: Array<{ type?: string; geofence?: RadarGeofence | null }>;
};

const RADAR_TRACK_URL = "https://api.radar.io/v1/track";

export const getRadarPublishableKey = () =>
  process.env.EXPO_PUBLIC_RADAR_PUBLISHABLE_KEY || "";

export const radarTrack = async (params: {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  eventId?: number | null;
}): Promise<RadarTrackResponse | null> => {
  const key = getRadarPublishableKey();
  if (!key) return null;

  const payload = {
    userId: params.userId,
    location: {
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy ?? undefined,
    },
    metadata: params.eventId != null ? { event_id: String(params.eventId) } : undefined,
  };

  const res = await fetch(RADAR_TRACK_URL, {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Radar track failed (${res.status})`);
  }

  const data = (await res.json()) as { geofences?: RadarGeofence[]; events?: any };
  return {
    geofences: data?.geofences ?? [],
    events: data?.events ?? [],
  };
};

export const matchesRadarGeofence = (
  geofence: RadarGeofence | null | undefined,
  eventId: number,
) => {
  if (!geofence) return false;
  const eventIdStr = String(eventId);
  const tag = String(geofence.tag || "");
  const externalId = String(geofence.externalId || "");
  const metaEventId = String(geofence.metadata?.event_id || "");

  return (
    tag === eventIdStr ||
    externalId === eventIdStr ||
    metaEventId === eventIdStr ||
    tag.includes(`event:${eventIdStr}`) ||
    externalId.includes(eventIdStr)
  );
};
