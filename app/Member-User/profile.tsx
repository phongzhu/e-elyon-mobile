import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function ProfileScreen() {
  const [branding, setBranding] = useState<any>(null);

  // Theme colors (fallbacks)
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

  // Tabs / UI state
  const [activeTab, setActiveTab] = useState<"profile" | "family" | "settings">("profile");
  const [baptismVerified, setBaptismVerified] = useState(false);
  const [showBaptismForm, setShowBaptismForm] = useState(false);

  // Baptism form state
  const [baptismDate, setBaptismDate] = useState<string>("");
  const [baptizerName, setBaptizerName] = useState<string>("");
  const [showBaptizerDropdown, setShowBaptizerDropdown] = useState(false);

  // Modals
  const [showBaptismModal, setShowBaptismModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPersonalInfoModal, setShowPersonalInfoModal] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);

  // Add Family Member form state
  const [familyUserId, setFamilyUserId] = useState("");
  const [familyRelationship, setFamilyRelationship] = useState("");
  const [familyFullName, setFamilyFullName] = useState("");
  const [familyDateOfBirth, setFamilyDateOfBirth] = useState("");
  const [familyContact, setFamilyContact] = useState("");

  // Static data
  const baptizers = [
    "Pastor John Smith",
    "Pastor Maria Garcia",
    "Pastor David Johnson",
    "Deacon Robert Williams",
    "Deacon Susan Brown",
  ];

  const userData = {
    userId: "AKD-X32",
    firstName: "Jane",
    middleName: "Michel",
    surname: "Bagtas",
    suffix: "None",
    birthdate: "1990-05-15",
    gender: "Female",
    street: "123 Sample St",
    region: "NCR",
    province: "Metro Manila",
    barangay: "Barangay 123",
    city: "Quezon City",
    contactNumber: "+63 900 123 4567",
  };

  const familyMembers = [
    { id: "1", name: "John Doe", relationship: "Husband", status: "Active", joinDate: "Jan 2021" },
    { id: "2", name: "Maria Doe", relationship: "Daughter", status: "Active", joinDate: "Sep 2022" },
  ];

  const profileMenuItems = [
    { id: "pi-1", label: "Personal Information", icon: "person-outline", action: () => setShowPersonalInfoModal(true) },
    { id: "pi-2", label: "Reports", icon: "bar-chart-outline", action: () => router.push("/Member-User/reports" as any) },
    { id: "pi-3", label: "Help & Support", icon: "help-circle-outline", action: () => router.push("/modal" as any) },
  ];

  // Handlers
  const handleBaptismSubmit = () => {
    setShowBaptismModal(true);
  };
  const handleReviewComplete = () => {
    setShowBaptismModal(false);
    setShowReviewModal(true);
  };
  const handleUpgradeComplete = () => {
    setShowUpgradeModal(false);
    setBaptismVerified(true);
  };
  const handleLogout = () => {
    router.replace("/login" as any);
  };

  const handleAddFamilyMember = () => {
    // Handle family member invitation logic here
    setShowAddFamilyModal(false);
    setFamilyUserId("");
    setFamilyRelationship("");
    setFamilyFullName("");
    setFamilyDateOfBirth("");
    setFamilyContact("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity style={[styles.tab, activeTab === "profile" && { borderBottomColor: secondary, borderBottomWidth: 3 }]} onPress={() => setActiveTab("profile")}>
            <Text style={[styles.tabLabel, activeTab === "profile" && { color: secondary, fontWeight: "700" }]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === "family" && { borderBottomColor: secondary, borderBottomWidth: 3 }]} onPress={() => setActiveTab("family")}>
            <Text style={[styles.tabLabel, activeTab === "family" && { color: secondary, fontWeight: "700" }]}>Family</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === "settings" && { borderBottomColor: secondary, borderBottomWidth: 3 }]} onPress={() => setActiveTab("settings")}>
            <Text style={[styles.tabLabel, activeTab === "settings" && { color: secondary, fontWeight: "700" }]}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <>
            <View style={styles.section}>
              <View style={[styles.profileCard, { backgroundColor: secondary }]}>
                <View style={styles.profileImageContainer}>
                  <View style={styles.profileImage}>
                    <Ionicons name="person-circle-outline" size={80} color="#fff" />
                  </View>
                </View>
                <Text style={styles.profileName}>Jane Michel Bagtas</Text>
                <Text style={styles.profileEmail}>member@gmail.com</Text>
                <View style={styles.userIdBadge}>
                  <Ionicons name="key-outline" size={14} color="#fff" />
                  <Text style={styles.userIdText}>ID: {userData.userId}</Text>
                </View>
                <View style={styles.membershipBadge}>
                  <Text style={styles.membershipText}>Active Member</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>12</Text>
                  <Text style={styles.statLabel}>Attendance</Text>
                </View>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>1</Text>
                  <Text style={styles.statLabel}>Ministries</Text>
                </View>
                <View style={[styles.statCard, { borderColor: primary }]}>
                  <Text style={[styles.statNumber, { color: primary }]}>₱2.5k</Text>
                  <Text style={styles.statLabel}>Giving</Text>
                </View>
              </View>
            </View>

            {!baptismVerified && (
              <View style={styles.section}>
                <TouchableOpacity style={[styles.toggleBtn, { backgroundColor: secondary }]} onPress={() => setShowBaptismForm(!showBaptismForm)}>
                  <Ionicons name={showBaptismForm ? "chevron-up" : "chevron-down"} size={20} color="#fff" />
                  <Text style={styles.toggleBtnText}>Verify Baptismal Record</Text>
                </TouchableOpacity>

                {showBaptismForm && (
                  <View style={styles.baptismFormContainer}>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>First Name</Text>
                      <View style={styles.inputField}><Text style={styles.inputText}>Jane</Text><Ionicons name="person-outline" size={20} color="#999" /></View>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Last Name</Text>
                      <View style={styles.inputField}><Text style={styles.inputText}>Bagtas</Text><Ionicons name="person-outline" size={20} color="#999" /></View>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Date of Baptism</Text>
                      <TouchableOpacity style={[styles.datePickerField, { borderColor: baptismDate ? primary : "#dfe4de" }]} onPress={() => setBaptismDate(new Date().toISOString().split("T")[0])}>
                        <Text style={[styles.datePickerText, { color: baptismDate ? "#000" : "#999" }]}>{baptismDate ? new Date(baptismDate).toLocaleDateString() : "Select Date"}</Text>
                        <Ionicons name="calendar-outline" size={20} color={primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Name of Baptizer</Text>
                      <TouchableOpacity style={[styles.dropdownField, { borderColor: baptizerName ? primary : "#dfe4de" }]} onPress={() => setShowBaptizerDropdown(!showBaptizerDropdown)}>
                        <Text style={[styles.dropdownText, { color: baptizerName ? "#000" : "#999" }]}>{baptizerName || "Select Baptizer"}</Text>
                        <Ionicons name={showBaptizerDropdown ? "chevron-up" : "chevron-down"} size={20} color={primary} />
                      </TouchableOpacity>
                      {showBaptizerDropdown && (
                        <View style={styles.dropdownMenu}>
                          {baptizers.map((b, i) => (
                            <TouchableOpacity key={`${b}-${i}`} style={[styles.dropdownItem, i !== baptizers.length - 1 && styles.dropdownItemBorder]} onPress={() => { setBaptizerName(b); setShowBaptizerDropdown(false); }}>
                              <Text style={styles.dropdownItemText}>{b}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity style={[styles.submitBtn, { backgroundColor: secondary }]} onPress={handleBaptismSubmit}>
                      <Text style={styles.submitBtnText}>Submit for Verification</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 20 }} />
          </>
        )}

        {/* Family Tab */}
        {activeTab === "family" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Family</Text>
              <Text style={styles.sectionSubtitle}>View and manage family members in your household</Text>
            </View>
            <View style={styles.section}>
              {familyMembers.map((member) => (
                <View key={member.id} style={[styles.familyCard, { borderLeftColor: secondary }]}>
                  <View style={styles.memberCardContent}>
                    <View style={[styles.memberAvatar, { backgroundColor: `${secondary}15` }]}>
                      <Ionicons name="person-circle" size={48} color={secondary} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRelationship}>{member.relationship}</Text>
                      <Text style={styles.memberStatus}>{member.status}</Text>
                      <Text style={styles.memberJoinDate}>Member since {member.joinDate}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.section}>
              <TouchableOpacity 
                style={[styles.addMemberBtn, { backgroundColor: secondary }]}
                onPress={() => setShowAddFamilyModal(true)}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addMemberBtnText}>Add Family Member</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              {profileMenuItems.map((item, index) => (
                <TouchableOpacity key={item.id} style={[styles.menuItem, index !== profileMenuItems.length - 1 && styles.menuItemBorder]} onPress={item.action}>
                  <Ionicons name={item.icon as any} size={24} color={primary} />
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={24} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.section}>
              <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: secondary }]} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#fff" />
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showBaptismModal} transparent animationType="fade" onRequestClose={() => setShowBaptismModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}>
              <Ionicons name="checkmark-circle" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Baptism Record Submitted</Text>
            <Text style={styles.confirmText}>Your baptism record has been submitted for verification. We will review your information and confirm your status as an official church member.</Text>
            <TouchableOpacity style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]} activeOpacity={0.9} onPress={handleReviewComplete}>
              <Text style={styles.primaryCtaText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showReviewModal} transparent animationType="fade" onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}>
              <Ionicons name="time-outline" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Under Review</Text>
            <Text style={styles.confirmText}>Your baptismal record is being reviewed by our church administrators. You will be notified once the verification is complete.</Text>
            <TouchableOpacity style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]} activeOpacity={0.9} onPress={() => { setShowReviewModal(false); setShowUpgradeModal(true); }}>
              <Text style={styles.primaryCtaText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUpgradeModal} transparent animationType="fade" onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}>
              <Ionicons name="checkmark-done-circle" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Account Upgraded!</Text>
            <Text style={styles.confirmText}>Congratulations! Your baptismal record has been verified. You are now an official member of our church community.</Text>
            <TouchableOpacity style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]} activeOpacity={0.9} onPress={handleUpgradeComplete}>
              <Text style={styles.primaryCtaText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryCta, { borderColor: primary, marginTop: 8 }]} activeOpacity={0.9} onPress={() => router.push("/Member-User/reports" as any)}>
              <Text style={[styles.secondaryCtaText, { color: primary }]}>Preview Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPersonalInfoModal} transparent animationType="slide" onRequestClose={() => setShowPersonalInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.personalInfoModalContent, { maxHeight: "90%" }]}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setShowPersonalInfoModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              <View style={styles.formGroup}><Text style={styles.formLabel}>First Name</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.firstName}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Middle Name</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.middleName}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Surname</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.surname}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Suffix</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.suffix}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Birthdate</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.birthdate}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Gender</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.gender}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Street</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.street}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Region</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.region}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Province</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.province}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Barangay</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.barangay}</Text></View></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>City</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.city}</Text></View></View>
              <View style={[styles.formGroup, { marginBottom: 20 }]}><Text style={styles.formLabel}>Contact Number</Text><View style={styles.inputField}><Text style={styles.inputText}>{userData.contactNumber}</Text></View></View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddFamilyModal} transparent animationType="slide" onRequestClose={() => setShowAddFamilyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.addFamilyModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Add Family Member</Text>
              <TouchableOpacity onPress={() => setShowAddFamilyModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <View style={styles.familyInputWrapper}>
                <TextInput
                  style={styles.familyTextInput}
                  placeholder="Enter 6-Digit User ID"
                  placeholderTextColor="#999"
                  value={familyUserId}
                  onChangeText={setFamilyUserId}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity style={styles.qrIconButton}>
                  <Ionicons name="qr-code-outline" size={20} color="#064622" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.familyTextInput}
                placeholder="Relationship"
                placeholderTextColor="#999"
                value={familyRelationship}
                onChangeText={setFamilyRelationship}
              />

              <TextInput
                style={styles.familyTextInput}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={familyFullName}
                onChangeText={setFamilyFullName}
              />

              <TextInput
                style={styles.familyTextInput}
                placeholder="Date of Birth"
                placeholderTextColor="#999"
                value={familyDateOfBirth}
                onChangeText={setFamilyDateOfBirth}
              />

              <TextInput
                style={styles.familyTextInput}
                placeholder="Contact Information (Optional)"
                placeholderTextColor="#999"
                value={familyContact}
                onChangeText={setFamilyContact}
              />

              <TouchableOpacity 
                style={[styles.inviteBtn, { backgroundColor: primary, marginTop: 8 }]} 
                onPress={handleAddFamilyMember}
              >
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MemberNavbar baptismVerified={baptismVerified || showUpgradeModal} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    padding: 6,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: -2,
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
  profileCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  membershipBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  membershipText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  notificationsModalContent: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  notificationsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  notificationItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#444",
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  logoutBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  baptismFormContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    color: "#4c5b4c",
    fontWeight: "700",
  },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 8,
  },
  inputText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  datePickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 8,
  },
  datePickerText: {
    fontSize: 14,
    color: "#999",
    flex: 1,
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  confirmModalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmText: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  primaryCta: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryCtaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryCta: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1.5,
  },
  secondaryCtaText: {
    fontWeight: "700",
    fontSize: 14,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 10,
  },
  toggleBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  personalInfoModalContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 0,
  },
  addFamilyModalContent: {
    width: "92%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
  },
  userIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    gap: 6,
  },
  userIdText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  inputFieldWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#f5f5f5",
  },
  inputFieldEditable: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#f5f5f5",
  },
  inviteBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  inviteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  familyInputWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  familyTextInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#000",
    marginBottom: 12,
    borderWidth: 0,
  },
  qrIconButton: {
    position: "absolute",
    right: 16,
    top: 14,
  },
  tabNavigation: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 0,
  },
  tabLabel: {
    fontSize: 14,
    color: "#999",
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  familyCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberCardContent: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  memberRelationship: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  memberStatus: {
    fontSize: 12,
    color: "#4d5a4d",
  },
  memberJoinDate: {
    fontSize: 11,
    color: "#999",
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMemberBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  dropdownText: {
    fontSize: 14,
    color: "#999",
    flex: 1,
  },
  dropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#111",
  },
});
