import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useState } from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import QRNavbar from "./qr-navbar";

export default function QRDashboard() {
  const [branding, setBranding] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#0C8A43";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) {
        console.error("Branding fetch error:", error);
      } else {
        setBranding(data);
      }
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowScanner(false);
    // Handle scanned QR code data here
    console.log(`QR Code scanned! Type: ${type}, Data: ${data}`);
    // You can add logic to process the attendance based on the scanned data
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const recentActivities = [
    { id: 1, title: "Sunday Service", time: "10:00 AM", icon: "calendar" as const },
    { id: 2, title: "Bible Study", time: "11:30 AM", icon: "book" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primary }]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: `${secondary}20` }]}>
            <Text style={styles.statLabel}>Total Attendees</Text>
            <Text style={[styles.statValue, { color: primary }]}>1,234</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: `${secondary}20` }]}>
            <Text style={styles.statLabel}>Events</Text>
            <Text style={[styles.statValue, { color: primary }]}>5</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: `${secondary}20` }]}>
                <Ionicons name={activity.icon} size={24} color={secondary} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating QR Scanner Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primary }]}
        onPress={openScanner}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code" size={28} color="#fff" />
      </TouchableOpacity>

      {/* QR Scanner Modal */}
      <Modal visible={showScanner} transparent animationType="slide">
        <View style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.scannerContainer}>
            {permission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerInstruction}>
                    Position the QR code within the frame
                  </Text>
                </View>
              </CameraView>
            ) : (
              <View style={styles.permissionContainer}>
                <Ionicons name="camera-outline" size={64} color="#999" />
                <Text style={styles.permissionText}>Camera permission required</Text>
                <TouchableOpacity
                  style={[styles.permissionButton, { backgroundColor: primary }]}
                  onPress={requestPermission}
                >
                  <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <QRNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  settingsButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: "flex-start",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "800",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scannerModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  scannerContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  scannerInstruction: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 30,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    padding: 40,
  },
  permissionText: {
    fontSize: 16,
    color: "#666",
    marginTop: 20,
    marginBottom: 30,
    textAlign: "center",
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
