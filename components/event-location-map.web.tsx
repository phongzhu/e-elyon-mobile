import React, { useEffect, useMemo, useRef } from "react";
import { Text, View, StyleSheet } from "react-native";
import maplibre from "maplibre-gl";
import { Map, Marker, Source, Layer, NavigationControl } from "react-map-gl/maplibre";

type Props = {
  eventCoords: { latitude: number; longitude: number };
  radiusMeters: number;
  currentCoords: { latitude: number; longitude: number } | null;
  attendanceSeconds: number;
  geofenceStatus: "idle" | "inside" | "outside" | "unsupported" | "no-permission";
  isEventActive: boolean;
  center: { latitude: number; longitude: number };
};

const createCircleGeoJSON = (
  center: { latitude: number; longitude: number },
  radiusMeters: number,
) => {
  const points = 64;
  const coords: Array<[number, number]> = [];
  const lat = center.latitude;
  const lng = center.longitude;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = dy / metersPerDegreeLat;
    const dLng = dx / metersPerDegreeLng;
    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: {},
  } as const;
};

export default function EventLocationMap({
  eventCoords,
  radiusMeters,
  currentCoords,
  attendanceSeconds,
  geofenceStatus,
  isEventActive,
  center,
}: Props) {
  const mapRef = useRef<any>(null);
  const geofenceGeoJson = useMemo(
    () => createCircleGeoJSON(eventCoords, radiusMeters),
    [eventCoords.latitude, eventCoords.longitude, radiusMeters],
  );

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.longitude, center.latitude],
      zoom: 16,
      duration: 800,
    });
  }, [center.latitude, center.longitude]);

  return (
    <Map
      ref={mapRef}
      mapLib={maplibre}
      initialViewState={{
        latitude: eventCoords.latitude,
        longitude: eventCoords.longitude,
        zoom: 16,
      }}
      style={{ height: 220, width: "100%" }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      scrollZoom={false}
      dragRotate={false}
      touchPitch={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <Source id="geofence" type="geojson" data={geofenceGeoJson}>
        <Layer
          id="geofence-fill"
          type="fill"
          paint={{
            "fill-color": "#2f6b3f",
            "fill-opacity": 0.15,
          }}
        />
        <Layer
          id="geofence-line"
          type="line"
          paint={{
            "line-color": "#2f6b3f",
            "line-width": 2,
          }}
        />
      </Source>

      <Marker
        longitude={eventCoords.longitude}
        latitude={eventCoords.latitude}
        anchor="bottom"
      >
        <View style={styles.eventMarker} />
      </Marker>

      {currentCoords ? (
        <Marker
          longitude={currentCoords.longitude}
          latitude={currentCoords.latitude}
          anchor="bottom"
        >
          <View style={styles.userMarker}>
            {geofenceStatus === "inside" && isEventActive ? (
              <View style={styles.userMarkerLabel}>
                <Text style={styles.userMarkerLabelText}>
                  {Math.floor(attendanceSeconds / 60)}m {attendanceSeconds % 60}s
                </Text>
              </View>
            ) : null}
            <View style={styles.userMarkerDot} />
          </View>
        </Marker>
      ) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  eventMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2f6b3f",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userMarker: {
    alignItems: "center",
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1c88ff",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userMarkerLabel: {
    marginBottom: 6,
    backgroundColor: "rgba(31,42,31,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  userMarkerLabelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
