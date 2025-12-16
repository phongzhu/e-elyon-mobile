import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
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
import { supabase } from "../../src/lib/supabaseClient";
import QRNavbar from "./qr-navbar";

const branches = ["San Roque", "Bustos", "Talacsan", "Vizal Pampanga", "Cavite"];
const services = ["All", "Sunday Service", "Bible Study", "Prayer Meeting", "Youth Service", "Midweek Service"];

const attendanceRecords = [
  {
    id: 1,
    name: "Ethan Carter",
    time: "10:30 AM",
    branch: "North",
    service: "Sunday Service",
    avatar: "https://i.pravatar.cc/80?img=12",
  },
  {
    id: 2,
    name: "Olivia Bennett",
    time: "10:35 AM",
    branch: "West",
    service: "Bible Study",
    avatar: "https://i.pravatar.cc/80?img=32",
  },
  {
    id: 3,
    name: "Noah Thompson",
    time: "10:40 AM",
    branch: "South",
    service: "Sunday Service",
    avatar: "https://i.pravatar.cc/80?img=45",
  },
  {
    id: 4,
    name: "Ava Collins",
    time: "11:05 AM",
    branch: "East",
    service: "Prayer Meeting",
    avatar: "https://i.pravatar.cc/80?img=24",
  },
  {
    id: 5,
    name: "Liam Foster",
    time: "11:15 AM",
    branch: "Main",
    service: "Youth Service",
    avatar: "https://i.pravatar.cc/80?img=18",
  },
];

export default function AttendanceRecords() {
  const [branding, setBranding] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedService, setSelectedService] = useState("All");
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#0C8A43";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (!error) {
        setBranding(data);
      }
    })();
  }, []);

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const branchMatch = selectedBranch === "All" || record.branch === selectedBranch;
      const serviceMatch = selectedService === "All" || record.service === selectedService;
      return branchMatch && serviceMatch;
    });
  }, [selectedBranch, selectedService]);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowScanner(false);
    console.log(`QR Code scanned! Type: ${type}, Data: ${data}`);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setScanned(false);
    setShowScanner(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f8faf9" }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Attendance</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.scanCard}>
          <View style={styles.scanIconWrap}>
            <Ionicons name="camera" size={26} color={primary} />
          </View>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: primary }]}
            onPress={openScanner}
            activeOpacity={0.9}
          >
            <Text style={styles.scanButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersBlock}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {branches.map((branch) => {
              const active = branch === selectedBranch;
              return (
                <TouchableOpacity
                  key={branch}
                  onPress={() => setSelectedBranch(branch)}
                  style={[styles.filterChip, active && { backgroundColor: `${secondary}20`, borderColor: secondary }]}
                >
                  <Text style={[styles.filterText, active && { color: secondary, fontWeight: "700" }]}>
                    {branch}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {services.map((service) => {
              const active = service === selectedService;
              return (
                <TouchableOpacity
                  key={service}
                  onPress={() => setSelectedService(service)}
                  style={[styles.filterChip, active && { backgroundColor: `${secondary}20`, borderColor: secondary }]}
                >
                  <Text style={[styles.filterText, active && { color: secondary, fontWeight: "700" }]}>
                    {service}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Attendance</Text>
        {filteredRecords.map((record) => (
          <View key={record.id} style={styles.recordRow}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: record.avatar }} style={styles.avatar} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{record.name}</Text>
              <Text style={styles.time}>{record.time}</Text>
              <Text style={styles.meta}>{record.branch} • {record.service}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

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
                  <Text style={styles.scannerInstruction}>Align the QR code within the frame</Text>
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
  content: {
    paddingHorizontal: 18,
    paddingTop: 32,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#eef3ef",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  scanCard: {
    alignItems: "center",
    marginBottom: 24,
  },
  scanIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 12,
  },
  scanButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  filtersBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7e4",
    marginRight: 10,
  },
  filterText: {
    fontSize: 13,
    color: "#444",
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    marginRight: 12,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  time: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f8a43",
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
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
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 12,
  },
  scannerInstruction: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
    paddingHorizontal: 30,
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
