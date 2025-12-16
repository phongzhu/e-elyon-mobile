import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BankIcon, GcashIcon, MayaIcon } from "../../components/ui/wallet-icons";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function GiveOnlineScreen() {
  const [branding, setBranding] = useState<any>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedOfferingType, setSelectedOfferingType] = useState<string | null>(null);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const offeringTypes = ["Tithes", "Offering", "Mission Fund", "Building Fund", "Special Offering"];

  const handleQuickGive = (amount: string) => {
    if (amount === "Other") {
      setSelectedQuickAmount(amount);
      setCustomAmount("");
    } else {
      setSelectedQuickAmount(amount);
      setCustomAmount(amount.replace("₱", "").replace(",", ""));
    }
  };

  const handleSubmit = () => {
    if (!selectedWallet || !selectedOfferingType || (!selectedQuickAmount && !customAmount)) {
      alert("Please fill in all required fields");
      return;
    }
    setShowConfirmationModal(true);
  };

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Giving</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/profile")}> 
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.paymentNote}>
          <Ionicons name="information-circle" size={20} color={primary} />
          <Text style={styles.paymentNoteText}>
            Payments are processed securely through PayMongo payment gateway
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.walletRow}>
            <TouchableOpacity 
              style={[
                styles.walletChip,
                selectedWallet === "Maya" && { borderColor: primary, backgroundColor: `${primary}15` }
              ]}
              onPress={() => setSelectedWallet("Maya")}
            >
              <MayaIcon width={28} height={28} />
              <Text style={styles.walletText}>Maya</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.walletChip,
                selectedWallet === "GCash" && { borderColor: primary, backgroundColor: `${primary}15` }
              ]}
              onPress={() => setSelectedWallet("GCash")}
            >
              <GcashIcon width={28} height={28} />
              <Text style={styles.walletText}>GCash</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.walletChip,
                selectedWallet === "Bank" && { borderColor: primary, backgroundColor: `${primary}15` }
              ]}
              onPress={() => setSelectedWallet("Bank")}
            >
              <BankIcon width={28} height={28} />
              <Text style={styles.walletText}>Bank</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Giving</Text>
          <View style={styles.quickGivingButtons}>
            {["₱100", "₱500", "₱1,000", "Other"].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickGiveBtn,
                  { 
                    borderColor: selectedQuickAmount === amount ? primary : secondary,
                    backgroundColor: selectedQuickAmount === amount ? primary : "#fff" 
                  },
                ]}
                onPress={() => handleQuickGive(amount)}
              >
                <Text
                  style={[
                    styles.quickGiveText,
                    { color: selectedQuickAmount === amount ? "#fff" : secondary },
                  ]}
                >
                  {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offering Type</Text>
          <TouchableOpacity 
            style={styles.selectField}
            onPress={() => setShowOfferingModal(true)}
          >
            <Text style={[styles.selectPlaceholder, selectedOfferingType && { color: '#000' }]}>
              {selectedOfferingType || "Select Offering Type"}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#5d6a5d" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount (Pesos)</Text>
          <TextInput
            placeholder="Enter Amount"
            placeholderTextColor="#7a837a"
            keyboardType="numeric"
            style={styles.input}
            value={customAmount}
            onChangeText={setCustomAmount}
            editable={selectedQuickAmount === "Other" || !selectedQuickAmount}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a Message (Optional)</Text>
          <TextInput
            placeholder="Your message of thanksgiving or prayer request"
            placeholderTextColor="#7a837a"
            style={[styles.input, { height: 120, textAlignVertical: "top" }]}
            multiline
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: primary }]} 
            activeOpacity={0.9}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryBtnText}>Submit Giving</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Offering Type Modal */}
      <Modal
        visible={showOfferingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOfferingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Offering Type</Text>
              <TouchableOpacity onPress={() => setShowOfferingModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {offeringTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.offeringOption,
                    selectedOfferingType === type && { backgroundColor: `${primary}15` }
                  ]}
                  onPress={() => {
                    setSelectedOfferingType(type);
                    setShowOfferingModal(false);
                  }}
                >
                  <Text style={[styles.offeringOptionText, selectedOfferingType === type && { color: primary, fontWeight: '700' }]}>
                    {type}
                  </Text>
                  {selectedOfferingType === type && (
                    <Ionicons name="checkmark-circle" size={20} color={primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${primary}20` }]}>
              <Ionicons name="checkmark-circle" size={64} color={primary} />
            </View>
            <Text style={styles.confirmTitle}>Giving Submitted</Text>
            <Text style={styles.confirmMessage}>
              Thank you for your generous gift of ₱{customAmount} as {selectedOfferingType}. Your contribution supports the ministry and mission of El Elyon Church.
            </Text>
            <Text style={styles.confirmSubMessage}>
              Payment Method: {selectedWallet}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primary, marginTop: 16, width: '100%' }]}
              onPress={() => {
                setShowConfirmationModal(false);
                router.back();
              }}
            >
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MemberNavbar />
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
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  walletRow: {
    flexDirection: "row",
    gap: 12,
  },
  walletChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
  },
  walletText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  selectField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f9f9f9",
  },
  selectPlaceholder: {
    fontSize: 14,
    color: "#7a837a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#000",
    backgroundColor: "#f9f9f9",
  },
  primaryBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  quickGivingButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickGiveBtn: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  quickGiveText: {
    fontWeight: "700",
    fontSize: 14,
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#d0e8ff',
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '85%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  offeringOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  offeringOptionText: {
    fontSize: 15,
    color: '#333',
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  confirmIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  confirmSubMessage: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});