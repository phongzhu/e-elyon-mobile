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
const timePeriods = ["Daily", "Weekly", "Monthly"];

// Dummy data for Daily view (Today)
const dailyAttendance = [
  { id: 1, name: "Ethan Carter", time: "10:30 AM", date: "Today", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=12" },
  { id: 2, name: "Olivia Bennett", time: "10:35 AM", date: "Today", branch: "Bustos", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=32" },
  { id: 3, name: "Noah Thompson", time: "10:40 AM", date: "Today", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=45" },
  { id: 4, name: "Ava Collins", time: "11:05 AM", date: "Today", branch: "Talacsan", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=24" },
  { id: 5, name: "Liam Foster", time: "11:15 AM", date: "Today", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=18" },
  { id: 6, name: "Sophia Martinez", time: "2:20 PM", date: "Today", branch: "Bustos", service: "Bible Study", avatar: "https://i.pravatar.cc/80?img=28" },
  { id: 7, name: "James Wilson", time: "3:45 PM", date: "Today", branch: "Vizal Pampanga", service: "Prayer Meeting", avatar: "https://i.pravatar.cc/80?img=51" },
];

// Dummy data for Weekly view (Last 7 days)
const weeklyAttendance = [
  { id: 11, name: "Emma Davis", time: "9:15 AM", date: "Mon, Dec 16", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=5" },
  { id: 12, name: "Michael Brown", time: "9:30 AM", date: "Mon, Dec 16", branch: "Cavite", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=13" },
  { id: 13, name: "Isabella Garcia", time: "10:00 AM", date: "Sun, Dec 15", branch: "Bustos", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=44" },
  { id: 14, name: "William Johnson", time: "10:20 AM", date: "Sun, Dec 15", branch: "Talacsan", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=33" },
  { id: 15, name: "Charlotte Lee", time: "6:00 PM", date: "Wed, Dec 11", branch: "San Roque", service: "Midweek Service", avatar: "https://i.pravatar.cc/80?img=22" },
  { id: 16, name: "Benjamin Taylor", time: "6:15 PM", date: "Wed, Dec 11", branch: "Bustos", service: "Midweek Service", avatar: "https://i.pravatar.cc/80?img=14" },
  { id: 17, name: "Amelia Anderson", time: "7:00 PM", date: "Tue, Dec 10", branch: "Vizal Pampanga", service: "Bible Study", avatar: "https://i.pravatar.cc/80?img=26" },
  { id: 18, name: "Lucas White", time: "7:30 PM", date: "Tue, Dec 10", branch: "Cavite", service: "Prayer Meeting", avatar: "https://i.pravatar.cc/80?img=60" },
  { id: 19, name: "Mia Harris", time: "5:00 PM", date: "Sat, Dec 14", branch: "San Roque", service: "Youth Service", avatar: "https://i.pravatar.cc/80?img=47" },
  { id: 20, name: "Alexander Clark", time: "5:30 PM", date: "Sat, Dec 14", branch: "Talacsan", service: "Youth Service", avatar: "https://i.pravatar.cc/80?img=52" },
];

// Dummy data for Monthly view (December)
const monthlyAttendance = [
  { id: 31, name: "Harper Lewis", time: "9:00 AM", date: "Dec 1", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=9" },
  { id: 32, name: "Evelyn Walker", time: "9:30 AM", date: "Dec 1", branch: "Bustos", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=20" },
  { id: 33, name: "Sebastian Hall", time: "10:00 AM", date: "Dec 8", branch: "Vizal Pampanga", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=15" },
  { id: 34, name: "Abigail Young", time: "10:30 AM", date: "Dec 8", branch: "Cavite", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=48" },
  { id: 35, name: "Jackson Allen", time: "6:00 PM", date: "Dec 4", branch: "San Roque", service: "Midweek Service", avatar: "https://i.pravatar.cc/80?img=11" },
  { id: 36, name: "Ella King", time: "6:30 PM", date: "Dec 4", branch: "Talacsan", service: "Midweek Service", avatar: "https://i.pravatar.cc/80?img=25" },
  { id: 37, name: "Henry Wright", time: "7:00 PM", date: "Dec 3", branch: "Bustos", service: "Bible Study", avatar: "https://i.pravatar.cc/80?img=53" },
  { id: 38, name: "Scarlett Lopez", time: "7:15 PM", date: "Dec 3", branch: "San Roque", service: "Prayer Meeting", avatar: "https://i.pravatar.cc/80?img=41" },
  { id: 39, name: "Daniel Hill", time: "4:30 PM", date: "Dec 7", branch: "Vizal Pampanga", service: "Youth Service", avatar: "https://i.pravatar.cc/80?img=31" },
  { id: 40, name: "Grace Scott", time: "5:00 PM", date: "Dec 7", branch: "Cavite", service: "Youth Service", avatar: "https://i.pravatar.cc/80?img=19" },
  { id: 41, name: "Matthew Green", time: "10:15 AM", date: "Dec 15", branch: "Bustos", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=54" },
  { id: 42, name: "Chloe Adams", time: "10:45 AM", date: "Dec 15", branch: "San Roque", service: "Sunday Service", avatar: "https://i.pravatar.cc/80?img=27" },
];

export default function AttendanceRecords() {
  const [branding, setBranding] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedService, setSelectedService] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("Daily");
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

  // Get current attendance records based on period
  const currentRecords = useMemo(() => {
    switch (selectedPeriod) {
      case "Daily":
        return dailyAttendance;
      case "Weekly":
        return weeklyAttendance;
      case "Monthly":
        return monthlyAttendance;
      default:
        return dailyAttendance;
    }
  }, [selectedPeriod]);

  const filteredRecords = useMemo(() => {
    return currentRecords.filter((record) => {
      const branchMatch = selectedBranch === "All" || record.branch === selectedBranch;
      const serviceMatch = selectedService === "All" || record.service === selectedService;
      return branchMatch && serviceMatch;
    });
  }, [currentRecords, selectedBranch, selectedService]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalAttendees = filteredRecords.length;
    const uniqueBranches = [...new Set(filteredRecords.map(r => r.branch))].length;
    
    // Count by service
    const serviceCount: { [key: string]: number } = {};
    filteredRecords.forEach(record => {
      serviceCount[record.service] = (serviceCount[record.service] || 0) + 1;
    });
    const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0];
    
    // Count by branch
    const branchCount: { [key: string]: number } = {};
    filteredRecords.forEach(record => {
      branchCount[record.branch] = (branchCount[record.branch] || 0) + 1;
    });
    const topBranch = Object.entries(branchCount).sort((a, b) => b[1] - a[1])[0];

    // Calculate average per day based on period
    let avgPerDay = totalAttendees;
    if (selectedPeriod === "Weekly") avgPerDay = Math.round(totalAttendees / 7);
    if (selectedPeriod === "Monthly") avgPerDay = Math.round(totalAttendees / 30);

    return {
      totalAttendees,
      uniqueBranches,
      topService: topService ? `${topService[0]} (${topService[1]})` : "N/A",
      topBranch: topBranch ? `${topBranch[0]} (${topBranch[1]})` : "N/A",
      avgPerDay,
    };
  }, [filteredRecords, selectedPeriod]);

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

        {/* Time Period Filters */}
        <View style={styles.periodFilters}>
          <Text style={styles.sectionTitle}>Time Period</Text>
          <View style={styles.periodRow}>
            {timePeriods.map((period) => {
              const active = period === selectedPeriod;
              return (
                <TouchableOpacity
                  key={period}
                  onPress={() => setSelectedPeriod(period)}
                  style={[
                    styles.periodButton,
                    active && { backgroundColor: primary, borderColor: primary }
                  ]}
                >
                  <Text style={[styles.periodText, active && { color: "#fff", fontWeight: "700" }]}>
                    {period}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Analytics Cards */}
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: `${secondary}15` }]}>
              <Ionicons name="people" size={24} color={secondary} />
              <Text style={styles.analyticsValue}>{analytics.totalAttendees}</Text>
              <Text style={styles.analyticsLabel}>Total Attendees</Text>
            </View>
            <View style={[styles.analyticsCard, { backgroundColor: `${primary}15` }]}>
              <Ionicons name="trending-up" size={24} color={primary} />
              <Text style={styles.analyticsValue}>{analytics.avgPerDay}</Text>
              <Text style={styles.analyticsLabel}>Avg per Day</Text>
            </View>
          </View>
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: "#ffeaa7" }]}>
              <Ionicons name="calendar" size={24} color="#fdcb6e" />
              <Text style={styles.analyticsValue} numberOfLines={1} adjustsFontSizeToFit>
                {analytics.topService.split(' ')[0]}
              </Text>
              <Text style={styles.analyticsLabel}>Top Event</Text>
            </View>
            <View style={[styles.analyticsCard, { backgroundColor: "#dfe6e9" }]}>
              <Ionicons name="location" size={24} color="#636e72" />
              <Text style={styles.analyticsValue} numberOfLines={1} adjustsFontSizeToFit>
                {analytics.topBranch.split(' ')[0]}
              </Text>
              <Text style={styles.analyticsLabel}>Top Branch</Text>
            </View>
          </View>
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

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Attendance Records ({selectedPeriod})</Text>
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <View key={record.id} style={styles.recordRow}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: record.avatar }} style={styles.avatar} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{record.name}</Text>
                <Text style={styles.time}>{record.time} • {record.date}</Text>
                <Text style={styles.meta}>{record.branch} • {record.service}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No attendance records found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
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
  periodFilters: {
    marginBottom: 20,
  },
  periodRow: {
    flexDirection: "row",
    gap: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7e4",
    alignItems: "center",
  },
  periodText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
  },
  analyticsSection: {
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  analyticsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginTop: 8,
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#999",
    marginTop: 6,
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
