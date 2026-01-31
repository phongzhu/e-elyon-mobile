import React, { useEffect, useRef } from "react";
import { Text, View, StyleSheet } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";

type Props = {
  eventCoords: { latitude: number; longitude: number };
  radiusMeters: number;
  currentCoords: { latitude: number; longitude: number } | null;
  attendanceSeconds: number;
  geofenceStatus: "idle" | "inside" | "outside" | "unsupported" | "no-permission";
  isEventActive: boolean;
  center: { latitude: number; longitude: number };
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
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800,
    );
  }, [center.latitude, center.longitude]);

  return (
    <MapView
      ref={mapRef}
      style={{ height: 220, width: "100%" }}
      initialRegion={{
        latitude: eventCoords.latitude,
        longitude: eventCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Circle
        center={eventCoords}
        radius={radiusMeters}
        strokeColor="#2f6b3f"
        fillColor="rgba(47,107,63,0.15)"
      />
      <Marker coordinate={eventCoords}>
        <View style={styles.eventMarker} />
      </Marker>
      {currentCoords ? (
        <Marker coordinate={currentCoords}>
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
    </MapView>
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
