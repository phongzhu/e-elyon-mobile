import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { router } from "expo-router";
import QRCode from "qrcode";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

const { width } = Dimensions.get("window");

// Keep a per-session flag so we only prompt once after login until the app is restarted or the user logs out.
let hasPromptedLocationThisSession = false;

type CalendarEvent = {
  day: number;
  title: string;
  date: string;
  time: string;
  location: string;
  summary: string;
  image: string;
  tag?: string;
};

// Filter View Components
const AttendanceView = ({ branding }: { branding: any }) => {
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [appealReason, setAppealReason] = useState("");
  const [uploadedFile, setUploadedFile] = useState<any>(null);

  const attendanceRecords = [
    { id: 1, title: "Mid-week Prayer Meeting", date: "October 25, 2023", status: "Absent", statusColor: "#999", image: "https://drive.google.com/uc?export=view&id=1etQu4ciwn_DjpIFvQqr_QTCZwiFDAg1G" },
    { id: 2, title: "Sunday Worship Service", date: "October 22, 2023", status: "Present", statusColor: "#66BB6A", image: "https://drive.google.com/uc?export=view&id=15BA5mR43FgZgL_siHe3i9ULTwu78f2VZ" },
    { id: 3, title: "Youth Fellowship", date: "October 21, 2023", status: "Present", statusColor: "#66BB6A", image: "https://drive.google.com/uc?export=view&id=1xYi-ocCx6p7-hfS8drA6pr1TcCBTUUEz" },
    { id: 4, title: "Mid-week Prayer Meeting", date: "October 18, 2023", status: "Absent", statusColor: "#999", image: "https://drive.google.com/uc?export=view&id=1etQu4ciwn_DjpIFvQqr_QTCZwiFDAg1G" },
    { id: 5, title: "Sunday Worship Service", date: "October 15, 2023", status: "Present", statusColor: "#66BB6A", image: "https://drive.google.com/uc?export=view&id=1etQu4ciwn_DjpIFvQqr_QTCZwiFDAg1G" },
  ];

  const handleAppealClick = (record: any) => {
    setSelectedRecord(record);
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = () => {
    setShowAppealModal(false);
    setShowConfirmModal(true);
    setTimeout(() => {
      setShowConfirmModal(false);
      setAppealReason("");
      setUploadedFile(null);
    }, 3000);
  };

  const handleFileUpload = () => {
    // File upload logic - using a simple simulation
    setUploadedFile({ name: "document.pdf", size: "2.5 MB" });
  };

  return (
    <>
      {/* Appeal Modal */}
      <Modal
        visible={showAppealModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAppealModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.appealModalContent}>
            <View style={styles.appealModalHeader}>
              <TouchableOpacity onPress={() => setShowAppealModal(false)}>
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.appealModalTitle}>Appeal Absence</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.appealFormContainer} showsVerticalScrollIndicator={false}>
              {/* Event Details */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>Event Details</Text>
                <View style={styles.eventDetailsBox}>
                  <Image 
                    source={{ uri: selectedRecord?.image }}
                    style={styles.eventDetailImage}
                    resizeMode="cover"
                  />
                  <View style={styles.eventDetailsText}>
                    <Text style={styles.eventDetailsTitle}>{selectedRecord?.title}</Text>
                    <Text style={styles.eventDetailsDate}>{selectedRecord?.date}</Text>
                  </View>
                </View>
              </View>

              {/* Reason for Absent */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>Reason for Absence</Text>
                <TextInput
                  style={styles.appealReasonInput}
                  placeholder="Please explain why you were unable to attend..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={5}
                  value={appealReason}
                  onChangeText={setAppealReason}
                  textAlignVertical="top"
                />
              </View>

              {/* Supporting Documents */}
              <View style={styles.appealSection}>
                <Text style={styles.appealSectionTitle}>Supporting Documents (Optional)</Text>
                {uploadedFile ? (
                  <View style={styles.uploadedFileBox}>
                    <Ionicons name="document" size={24} color={branding?.primary_color || "#064622"} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.uploadedFileName}>{uploadedFile.name}</Text>
                      <Text style={styles.uploadedFileSize}>{uploadedFile.size}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setUploadedFile(null)}>
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadBox}
                    onPress={handleFileUpload}
                  >
                    <Ionicons name="cloud-upload-outline" size={32} color={branding?.primary_color || "#064622"} />
                    <Text style={styles.uploadText}>Tap to upload document</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.submitAppealBtn, { backgroundColor: branding?.primary_color || "#064622" }]}
                onPress={handleSubmitAppeal}
              >
                <Text style={styles.submitAppealBtnText}>Submit Appeal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${branding?.primary_color || "#064622"}20` }]}>
              <Ionicons name="checkmark-circle" size={60} color={branding?.primary_color || "#064622"} />
            </View>
            <Text style={styles.confirmTitle}>Appeal Submitted</Text>
            <Text style={styles.confirmMessage}>
              Your appeal has been received. The admin will review your request and get back to you shortly.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Attendance Records */}
      <View style={{ padding: 16 }}>
        {attendanceRecords.map((record) => (
          <View key={record.id} style={styles.attendanceCardWithImage}>
            <Image 
              source={{ uri: record.image }}
              style={styles.attendanceImage}
              resizeMode="cover"
            />
            <View style={styles.attendanceInfo}>
              <Text style={styles.attendanceTitle}>{record.title}</Text>
              <Text style={styles.attendanceDate}>{record.date}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: record.statusColor === "#66BB6A" ? "#E8F5E9" : "#F5F5F5" }]}
                >
                  <Text style={[styles.statusText, { color: record.statusColor }]}>{record.status}</Text>
                </TouchableOpacity>
                {record.status === "Absent" && (
                  <TouchableOpacity 
                    style={[styles.appealButton, { backgroundColor: branding?.primary_color || "#064622" }]}
                    onPress={() => handleAppealClick(record)}
                  >
                    <Text style={styles.appealButtonText}>Appeal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </>
  );
};

const GivingView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>Giving information will appear here</Text>
  </View>
);

const MinistryView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>Ministry information will appear here</Text>
  </View>
);

const CounselingView = ({
  branding,
  autoOpenRequest = false,
  onAutoOpenHandled,
}: {
  branding: any;
  autoOpenRequest?: boolean;
  onAutoOpenHandled?: () => void;
}) => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [concern, setConcern] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const primary = branding?.primary_color || "#064622";

  const counselingHistory = [
    { id: 1, date: "2024-07-20", pastor: "Pastor Samuel" },
    { id: 2, date: "2024-06-15", pastor: "Pastor David" },
    { id: 3, date: "2024-05-10", pastor: "Pastor Michael" },
  ];

  const formatDateTime = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${month} ${day}, ${year} at ${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      if (Platform.OS === 'android') {
        // On Android, show time picker after date is selected
        setTimeout(() => setShowTimePicker(true), 100);
      }
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleSubmitRequest = () => {
    setShowRequestModal(false);
    setShowConfirmModal(true);
    setTimeout(() => {
      setShowConfirmModal(false);
      setConcern("");
      setSelectedDate(null);
    }, 3000);
  };

  const handleCloseRequest = () => {
    setShowRequestModal(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const isSubmitDisabled = concern.trim().length < 5;

  useEffect(() => {
    if (autoOpenRequest) {
      setShowRequestModal(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenRequest, onAutoOpenHandled]);

  return (
    <>
      {/* Request Counseling Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseRequest}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.counselingModalContent}>
            <View style={styles.counselingHeader}>
              <View style={styles.counselingHeaderText}>
                <Text style={styles.counselingTitle}>Request Counseling</Text>
                <Text style={styles.counselingSubtitle}>Share what you need and we will schedule time with a pastor.</Text>
              </View>
              <TouchableOpacity onPress={handleCloseRequest} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <View style={styles.counselingFormContainer}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
              >
                <View style={styles.counselingFieldHeader}>
                  <Text style={styles.counselingFieldLabel}>Your concern</Text>
                  <Text style={styles.counselingHelperText}>Minimum 5 characters</Text>
                </View>
                <TextInput
                  placeholder="Indicate your Concern Here..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  value={concern}
                  onChangeText={setConcern}
                  style={styles.counselingConcernInput}
                />

                <View style={[styles.counselingFieldHeader, { marginTop: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.counselingFieldLabel}>Preferred date & time</Text>
                    <Text style={styles.counselingOptionalTag}>Optional</Text>
                  </View>
                  {selectedDate && (
                    <TouchableOpacity onPress={() => { setSelectedDate(null); setShowTimePicker(false); setShowDatePicker(false); }}>
                      <Text style={[styles.counselingHelperText, { color: '#c00' }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.counselingDateInputContainer}
                  onPress={() => {
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                >
                  <View style={styles.counselingDateInput}>
                    <Text style={[styles.counselingDateText, { color: selectedDate ? (branding?.primary_text_color || '#000') : '#999' }]}>
                      {selectedDate ? formatDateTime(selectedDate) : 'Preferred Date/Time (Optional)'}
                    </Text>
                  </View>
                  <Ionicons name="calendar-outline" size={20} color={primary} style={styles.counselingDateIcon} />
                </TouchableOpacity>

                <Text style={styles.counselingHelperText}>If you leave this blank, we will propose the earliest available slot.</Text>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'default' : 'inline'}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    accentColor={primary}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'default' : 'inline'}
                    onChange={handleTimeChange}
                    accentColor={primary}
                  />
                )}

                {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
                  <View style={styles.iosPickerButtons}>
                    <TouchableOpacity
                      onPress={() => {
                        if (showDatePicker) {
                          setShowDatePicker(false);
                          setShowTimePicker(true);
                        } else {
                          setShowTimePicker(false);
                        }
                      }}
                      style={[styles.iosPickerBtn, { backgroundColor: primary }]}
                    >
                      <Text style={styles.iosPickerBtnText}>
                        {showDatePicker ? 'Next (Time)' : 'Done'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              <View style={styles.counselingButtonRow}>
                <TouchableOpacity
                  style={styles.counselingCancelBtn}
                  onPress={handleCloseRequest}
                >
                  <Text style={styles.counselingCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.counselingSubmitBtn, { backgroundColor: isSubmitDisabled ? '#b0b0b0' : primary }]}
                  onPress={handleSubmitRequest}
                  disabled={isSubmitDisabled}
                >
                  <Text style={styles.counselingSubmitBtnText}>Submit Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${primary}20` }]}>
              <Ionicons name="checkmark-circle" size={64} color={primary} />
            </View>
            <Text style={styles.confirmTitle}>Request Submitted</Text>
            <Text style={styles.confirmMessage}>
              Your counseling request will be reviewed by the pastor in charge. They will contact you to confirm or reschedule your appointment.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Counseling History */}
      <View style={{ padding: 16 }}>
        <Text style={styles.counselingHistoryTitle}>Counseling History</Text>
        
        {counselingHistory.map((item) => (
          <View key={item.id} style={styles.counselingHistoryItem}>
            <View style={[styles.counselingHistoryIcon, { backgroundColor: `${primary}15` }]}>
              <Ionicons name="calendar-outline" size={24} color={primary} />
            </View>
            <View style={styles.counselingHistoryInfo}>
              <Text style={styles.counselingHistoryDate}>{item.date}</Text>
              <Text style={[styles.counselingHistoryPastor, { color: primary }]}>{item.pastor}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.requestCounselingBtn, { backgroundColor: primary }]}
          onPress={() => setShowRequestModal(true)}
        >
          <Text style={styles.requestCounselingBtnText}>Request Counseling</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const EventsView = ({ branding }: { branding: any }) => (
  <View style={{ padding: 16 }}>
    <Text style={styles.filterEmptyText}>Events information will appear here</Text>
  </View>
);

const ResourcesView = ({ branding }: { branding: any }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [requestDate, setRequestDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState("");

  const primary = branding?.primary_color || "#064622";

  const resources = [
    {
      id: 1,
      category: "Facilities",
      name: "Fellowship Hall",
      description: "A versatile space for social events, meetings, and community activities.",
      image: "https://images.squarespace-cdn.com/content/v1/5791c3c6e3df2888fe5f045f/1603212695959-A8GABFCHQNWIABDX0TDH/FH+1.jpg",
      availability: "Available",
      rate: "₱3,000/day",
      capacity: "200 people"
    },
    {
      id: 2,
      category: "Equipment",
      name: "Band Equipment",
      description: "Professional audio and lighting equipment for worship bands and performances.",
      image: "https://images.unsplash.com/photo-1735518874625-08b27a4850c8?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
      availability: "Available",
      rate: "₱2,000/day",
      capacity: "N/A"
    },
    {
      id: 3,
      category: "Vehicles",
      name: "Church Van",
      description: "15-seater van for transportation to events, outreach, and community activities.",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSd2JoRr54ELwiYs4fTcRV-V4eeD7yp3MR-Eg&s",
      availability: "Available",
      rate: "₱2,500/day",
      capacity: "15 passengers"
    },
    {
      id: 4,
      category: "Services",
      name: "House Blessing",
      description: "Professional pastoral visit and blessing service for your home.",
      image: "https://img.lazcdn.com/g/p/d02467827f38bd92b08e61e77b89b346.jpg_720x720q80.jpg",
      availability: "Available",
      rate: "Free for members",
      capacity: "N/A"
    },
  ];

  const categories = ["All", "Facilities", "Equipment", "Vehicles", "Services"];

  const filteredResources = resources.filter((resource) => {
    const matchesSearch = resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "All" || resource.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleViewResource = (resource: any) => {
    setSelectedResource(resource);
  };

  const handleRequestResource = () => {
    setShowRequestModal(true);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setRequestDate(date);
    }
  };

  const handleSubmitRequest = () => {
    setShowRequestModal(false);
    setShowConfirmModal(true);
    setTimeout(() => {
      setShowConfirmModal(false);
      setPurpose("");
      setRequestDate(new Date());
      setDuration("");
      setSelectedResource(null);
    }, 3000);
  };

  if (selectedResource) {
    return (
      <>
        {/* Request Modal */}
        <Modal
          visible={showRequestModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRequestModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resourceModalContent}>
              <View style={styles.resourceModalHeader}>
                <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.resourceModalTitle}>Request Form</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {/* Resource Info */}
                <View style={styles.resourceInfoBox}>
                  <Image 
                    source={{ uri: selectedResource.image }}
                    style={styles.resourceInfoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.resourceInfoText}>
                    <Text style={styles.resourceInfoName}>{selectedResource.name}</Text>
                    <Text style={styles.resourceInfoRate}>{selectedResource.rate}</Text>
                  </View>
                </View>

                {/* Purpose */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Purpose / Reason</Text>
                  <TextInput
                    style={styles.resourcePurposeInput}
                    placeholder="Describe the purpose of your request..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    value={purpose}
                    onChangeText={setPurpose}
                    textAlignVertical="top"
                  />
                </View>

                {/* Date */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Requested Date</Text>
                  <TouchableOpacity 
                    style={styles.resourceDateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={primary} />
                    <Text style={[styles.resourceDateText, { color: branding?.primary_text_color || '#000' }]}>
                      {formatDate(requestDate)}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={requestDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'default' : 'inline'}
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      accentColor={primary}
                    />
                  )}
                </View>

                {/* Duration */}
                <View style={styles.resourceFormSection}>
                  <Text style={styles.resourceFormLabel}>Duration</Text>
                  <View style={styles.durationOptions}>
                    {["Half Day", "Full Day", "2 Days", "3 Days", "Custom"].map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.durationChip,
                          duration === option && { backgroundColor: primary, borderColor: primary }
                        ]}
                        onPress={() => setDuration(option)}
                      >
                        <Text style={[
                          styles.durationChipText,
                          duration === option && { color: '#fff' }
                        ]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity 
                  style={[styles.submitResourceBtn, { backgroundColor: primary }]}
                  onPress={handleSubmitRequest}
                >
                  <Text style={styles.submitResourceBtnText}>Submit Request</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmModalContent}>
              <View style={[styles.confirmIconBox, { backgroundColor: `${primary}20` }]}>
                <Ionicons name="checkmark-circle" size={64} color={primary} />
              </View>
              <Text style={styles.confirmTitle}>Request Submitted</Text>
              <Text style={styles.confirmMessage}>
                Your resource request has been received. Our team will review it and contact you shortly to confirm availability.
              </Text>
            </View>
          </View>
        </Modal>

        {/* Resource Detail View */}
        <View style={{ flex: 1 }}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setSelectedResource(null)}
          >
            <Ionicons name="arrow-back" size={24} color={primary} />
            <Text style={[styles.backButtonText, { color: primary }]}>Back to Resources</Text>
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Image 
              source={{ uri: selectedResource.image }}
              style={styles.resourceDetailImage}
              resizeMode="cover"
            />
            
            <View style={styles.resourceDetailContent}>
              <View style={styles.resourceDetailHeader}>
                <View>
                  <Text style={styles.resourceDetailCategory}>{selectedResource.category}</Text>
                  <Text style={styles.resourceDetailName}>{selectedResource.name}</Text>
                </View>
                <View style={[styles.availabilityBadge, { backgroundColor: `${primary}20` }]}>
                  <View style={[styles.availabilityDot, { backgroundColor: primary }]} />
                  <Text style={[styles.availabilityText, { color: primary }]}>
                    {selectedResource.availability}
                  </Text>
                </View>
              </View>

              <Text style={styles.resourceDetailDescription}>{selectedResource.description}</Text>

              <View style={styles.resourceDetailInfo}>
                <View style={styles.resourceDetailInfoItem}>
                  <Ionicons name="pricetag" size={20} color={primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.resourceDetailInfoLabel}>Rate</Text>
                    <Text style={styles.resourceDetailInfoValue}>{selectedResource.rate}</Text>
                  </View>
                </View>
                <View style={styles.resourceDetailInfoItem}>
                  <Ionicons name="people" size={20} color={primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.resourceDetailInfoLabel}>Capacity</Text>
                    <Text style={styles.resourceDetailInfoValue}>{selectedResource.capacity}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.requestResourceBtn, { backgroundColor: primary }]}
                onPress={handleRequestResource}
              >
                <Text style={styles.requestResourceBtnText}>Request This Resource</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Search Bar */}
      <View style={styles.resourceSearchBar}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          placeholder="Search by name or type"
          placeholderTextColor="#999"
          style={styles.resourceSearchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && { backgroundColor: primary, borderColor: primary }
            ]}
            onPress={() => setSelectedCategory(category === "All" ? null : category)}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === category && { color: '#fff' }
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resources List */}
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
      >
        {filteredResources.map((resource) => (
          <View key={resource.id} style={styles.resourceCard}>
            <Image 
              source={{ uri: resource.image }}
              style={styles.resourceCardImage}
              resizeMode="cover"
            />
            <View style={styles.resourceCardContent}>
              <Text style={styles.resourceCardCategory}>{resource.category}</Text>
              <Text style={styles.resourceCardName}>{resource.name}</Text>
              <Text style={styles.resourceCardDescription} numberOfLines={2}>
                {resource.description}
              </Text>
              <TouchableOpacity 
                style={styles.resourceViewButton}
                onPress={() => handleViewResource(resource)}
              >
                <Text style={[styles.resourceViewButtonText, { color: primary }]}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default function MemberDashboard() {
  const [branding, setBranding] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showGeoAttendanceModal, setShowGeoAttendanceModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [openCounselingForm, setOpenCounselingForm] = useState(false);
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null);
  const [hasGeoAttendanceRecorded, setHasGeoAttendanceRecorded] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const scrollY = useRef(new Animated.Value(0)).current;

  const notifications = [
    {
      id: 1,
      type: 'event',
      title: 'Youth Fellowship Starting Soon',
      message: 'Youth Fellowship is starting in 30 minutes at the main church. Join us!',
      time: '5 mins ago',
      icon: 'people',
      read: false,
    },
    {
      id: 2,
      type: 'location',
      title: 'Near Bustos Campus',
      message: 'You are near Bustos Campus. Sunday Service starts at 10:00 AM today.',
      time: '1 hour ago',
      icon: 'location',
      read: false,
    },
    {
      id: 3,
      type: 'reminder',
      title: 'Pastor Appreciation Day',
      message: 'Don\'t forget! Pastor Appreciation Day is this Sunday, October 12.',
      time: '2 hours ago',
      icon: 'calendar',
      read: true,
    },
    {
      id: 4,
      type: 'branch',
      title: 'Cavite Branch Activity',
      message: 'Special Family Fun Day at Cavite Community Grounds. RSVP now!',
      time: 'Yesterday',
      icon: 'home',
      read: true,
    },
    {
      id: 5,
      type: 'attendance',
      title: 'Attendance Recorded',
      message: 'Your attendance at Sunday Worship Service has been validated.',
      time: '2 days ago',
      icon: 'checkmark-circle',
      read: true,
    },
  ];

  const eventGeofence = {
    name: "an Event Services/Activities",
    latitude: 14.7792,
    longitude: 120.9817,
    radiusMeters: 120,
  };

  const calendarEvents = useMemo<CalendarEvent[]>(() => [
    {
      day: 17,
      title: "Worship Night",
      date: "July 17, 2024",
      time: "6:00 PM - 8:00 PM",
      location: "Main Sanctuary",
      summary: "An acoustic worship set with space for prayer, reflection, and communion together.",
      image: "https://drive.google.com/file/d/15BA5mR43FgZgL_siHe3i9ULTwu78f2VZ/view?usp=drive_link",
      tag: "Worship",
    },
    {
      day: 18,
      title: "Paskong EECM - Sambang Gabi",
      date: "July 18, 2024",
      time: "7:30 PM - 9:00 PM",
      location: "San Roque Campus",
      summary: "Spared and Blesses to be a Blessing - A night of worship, reflection, and celebration as we prepare our hearts for the Christmas season.",
      image: "https://scontent.fmnl9-5.fna.fbcdn.net/v/t1.15752-9/598340466_2965762010289105_2733580117442302736_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeGZS3JcfouPoS3iBN1jvDQePvloqZdkOQ8--Wipl2Q5D07Hni0t6yYj-WqFcuIbhJ7Yd-hYHW4hgiZDDU5RYGpM&_nc_ohc=l3B_vdrnSmgQ7kNvwFindhJ&_nc_oc=Adm4gAcCGI45yOcNWt9KkUoiHX_lJf3Yg5RZmWkMZ67QigiNMK-uAL5RoiRPm9cXqjQ&_nc_zt=23&_nc_ht=scontent.fmnl9-5.fna&oh=03_Q7cD4AEFKCiSzATB1P80Z1Wxnx0lOGhVIsCxIoC_dyEjZ8gVWQ&oe=6968DC95",
      tag: "Worship",
    },
    {
      day: 19,
      title: "Service Sunday",
      date: "July 19, 2024",
      time: "9:00 AM - 11:30 AM",
      location: "Bustos Campus",
      summary: "A family-friendly service with kids choir, testimonies, and a short message.",
      image: "https://scontent.fmnl9-4.fna.fbcdn.net/v/t1.15752-9/597609743_1149142690324644_3441941934777869070_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeHSfavVT2lTSiTACW8ZktF4dzN4UaEgIoZ3M3hRoSAihrDX-NMseikRVWg8OpObi68TICvMw7hmfuOcBiOSWbvu&_nc_ohc=paegu3jYPloQ7kNvwFLM8jK&_nc_oc=AdnRGASIYOFBte1SZxZ3G9tgQoYSYPyE2Lp9Q4m2LgfdXGP3GNEAJRLie2WfSfR3DqI&_nc_zt=23&_nc_ht=scontent.fmnl9-4.fna&oh=03_Q7cD4AF78m_KJX6e67WoVCbdVGqvOpHIO7-fJhPveufZb-Vdeg&oe=6968D7AC",
      tag: "Family",
    },
  ], []);

  const calendarEventLookup = useMemo(() => {
    const lookup: Record<number, CalendarEvent> = {};
    calendarEvents.forEach((event) => {
      lookup[event.day] = event;
    });
    return lookup;
  }, [calendarEvents]);

  const closeCalendarPreview = () => {
    setShowCalendarPreview(false);
    setSelectedCalendarEvent(null);
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);

      // Show permission prompt once per session after login
      if (!hasPromptedLocationThisSession) {
        setShowLocationModal(true);
        hasPromptedLocationThisSession = true;
      }
    })();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, [locationWatcher]);

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const distanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const startGeofenceWatcher = async () => {
    try {
      if (locationWatcher) {
        locationWatcher.remove();
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 15,
          timeInterval: 15000,
        },
        (position) => {
          const { latitude, longitude } = position.coords;
          const distance = distanceInMeters(
            latitude,
            longitude,
            eventGeofence.latitude,
            eventGeofence.longitude
          );

          if (distance <= eventGeofence.radiusMeters && !hasGeoAttendanceRecorded) {
            setHasGeoAttendanceRecorded(true);
            setShowGeoAttendanceModal(true);
          }
        }
      );

      setLocationWatcher(subscription);
    } catch (err) {
      console.error("Error starting geofence watcher:", err);
    }
  };

  const generateQR = async () => {
    try {
      const timestamp = new Date().toISOString();
      const qrData = JSON.stringify({ type: "check-in", timestamp });
      
      const svg = await new Promise<string>((resolve, reject) => {
        QRCode.toString(qrData, { type: "svg", width: 320, margin: 2 } as any, (err, url) => {
          if (err) reject(err);
          else resolve(url);
        });
      });

      setQrSvg(svg);
      setShowQRModal(true);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleLocationPermission = async (enable: boolean) => {
    try {
      if (enable) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          await AsyncStorage.setItem("location_permission_enabled", "true");
          startGeofenceWatcher();
          
          // Close location modal first
          setShowLocationModal(false);
          
          // Show attendance detected modal after a brief delay
          setTimeout(() => {
            setShowGeoAttendanceModal(true);
          }, 400);
          return;
        }
      } else {
        await AsyncStorage.setItem("location_permission_enabled", "false");
        if (locationWatcher) {
          locationWatcher.remove();
        }
        setLocationWatcher(null);
        setHasGeoAttendanceRecorded(false);
      }
      
      setShowLocationModal(false);
    } catch (error) {
      console.error("Error handling location permission:", error);
      setShowLocationModal(false);
    }
  };

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  const searchBarOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const searchSectionHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [120, 0],
    extrapolate: 'clamp',
  });

  const AnimatedCard = ({ children, delay = 0 }: any) => {
    const [anim] = useState(new Animated.Value(0));
    
    useEffect(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }).start();
    }, [anim, delay]);

    return (
      <Animated.View
        style={{
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        }}
      >
        {children}
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>

      {/* Location Permission Modal */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.permissionIconContainer, { backgroundColor: `${primary}20` }]}>
              <Ionicons name="location" size={48} color={primary} />
            </View>

            <Text style={styles.modalTitle}>Enable Location Access</Text>
            <Text style={styles.modalSubtitle}>
              We use your location to provide personalized content and improve your experience. You can change this in settings anytime.
            </Text>

            <View style={styles.geofenceInfoBox}>
                <Text style={[styles.geofenceTitle, { textAlign: 'center' }]}>Geofencing for Attendance Tracking & Engagement</Text>
              <Text style={styles.geofenceBody}>
                Automatic attendance when you arrive at the venue and location-based reminders for nearby events. Keep location on so we can detect when you reach {eventGeofence.name}.
              </Text>
            </View>

            <View style={styles.permissionButtons}>
              <TouchableOpacity
                style={[styles.permissionButton, styles.permissionButtonDisable]}
                onPress={() => handleLocationPermission(false)}
              >
                <Text style={styles.permissionButtonTextDisable}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: primary }]}
                onPress={() => handleLocationPermission(true)}
              >
                <Text style={styles.permissionButtonTextEnable}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Geofence Attendance Confirmation Modal */}
      <Modal
        visible={showGeoAttendanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGeoAttendanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={[styles.confirmModalContent, { maxWidth: 380, width: '90%' }]}>
              <View style={[styles.confirmIconBox, { backgroundColor: `${primary}20` }]}>
                <Ionicons name="location" size={64} color={primary} />
              </View>
              <Text style={styles.confirmTitle}>Location-Based Member Engagement</Text>
              
              <View style={styles.engagementSection}>
                <View style={styles.engagementItem}>
                  <Ionicons name="notifications" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>Targeted Notifications</Text>
                    <Text style={styles.engagementItemText}>
                      Receive location-aware alerts when you are near church events or ministry activities. If you are in the vicinity, we will notify you about what is happening (e.g.&quot;Youth Fellowship is starting soon at the main church&quot;).
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="people" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>Improved Event Participation</Text>
                    <Text style={styles.engagementItemText}>
                      GPS-based alerts when you are close to an event increase your chances of attendance. We will remind you when you are nearby, making it easier to join.
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="business" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>Branch Visit Recommendations</Text>
                    <Text style={styles.engagementItemText}>
                      Near a satellite branch? Get notified about events, services, or branch-specific initiatives happening at the location closest to you.
                    </Text>
                  </View>
                </View>

                <View style={styles.engagementItem}>
                  <Ionicons name="calendar" size={20} color={primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.engagementItemTitle}>Event Alerts & Reminders</Text>
                    <Text style={styles.engagementItemText}>
                      Receive push notifications when you are near the church during scheduled services or special events. Stay connected and never miss what is happening.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.highlightBox, { backgroundColor: `${secondary}15`, borderColor: secondary }]}>
                <Ionicons name="checkmark-circle" size={24} color={secondary} />
                <Text style={[styles.highlightText, { color: '#1a1a1a', marginLeft: 8 }]}>
                  You are now connected! We have detected your presence at {eventGeofence.name}.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: secondary, marginTop: 12 }]}
                onPress={() => setShowGeoAttendanceModal(false)}
              >
                <Text style={styles.refreshButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationsModalContent}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notificationItem,
                    { backgroundColor: notif.read ? '#fff' : `${primary}08` }
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: `${primary}20` }]}>
                    <Ionicons name={notif.icon as any} size={22} color={primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notif.title}</Text>
                      {!notif.read && (
                        <View style={[styles.unreadDot, { backgroundColor: secondary }]} />
                      )}
                    </View>
                    <Text style={styles.notificationMessage}>{notif.message}</Text>
                    <Text style={styles.notificationTime}>{notif.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRModal(false)}
            >
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Check-In QR Code</Text>
            <Text style={styles.modalSubtitle}>Show this code to mark your attendance</Text>

            <View style={styles.qrDisplayContainer}>
              {qrSvg ? (
                <SvgXml xml={qrSvg} width={320} height={320} />
              ) : (
                <Text>Generating...</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: secondary }]}
              onPress={generateQR}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.refreshButtonText}>Refresh Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header - Fixed */}
      <View 
        style={[
          styles.header, 
          { 
            backgroundColor: primary,
          }
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {logo ? (
              <Image
                source={{ uri: logo }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.logoPlaceholder, { borderColor: secondary, borderWidth: 2 }]} />
            )}
          </View>

       

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.iconButton} 
              activeOpacity={0.7}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              <View style={[styles.badge, { backgroundColor: secondary }]}>
                <Text style={styles.badgeText}>{notifications.filter(n => !n.read).length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push("/Member-User/profile")}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search + Quick Actions - Inside Header */}
        <Animated.View 
          style={{ 
            height: searchSectionHeight,
            opacity: searchBarOpacity,
            overflow: 'hidden',
          }}
        >
          <View 
            style={[
              styles.searchBar, 
              { 
                borderColor: searchFocused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)",
                backgroundColor: "rgba(255,255,255,0.15)",
              }
            ]}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <TextInput
              placeholder="Search events, resources..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              style={[styles.searchInput, { color: "#fff" }]}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchFocused && (
              <TouchableOpacity onPress={() => setSearchFocused(false)}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {[
              {icon:'calendar-outline',label:'Attendance'},
              {icon:'help-circle-outline',label:'Counseling'},
              {icon:'library-outline',label:'Resources'}
            ].map((a, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[
                  styles.actionChip, 
                  { 
                    borderColor: activeFilter === a.label ? secondary : "rgba(255,255,255,0.3)",
                    backgroundColor: activeFilter === a.label ? secondary : "transparent"
                  }
                ]} 
                activeOpacity={0.8}
                onPress={() => {
                  const nextFilter = activeFilter === a.label ? null : a.label;
                  setActiveFilter(nextFilter);
                  if (nextFilter === 'Counseling') {
                    setOpenCounselingForm(true);
                  } else {
                    setOpenCounselingForm(false);
                  }
                }}
              >
                <View style={[styles.actionChipIcon, { backgroundColor: activeFilter === a.label ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)" }]}>
                  <Ionicons name={a.icon as any} size={18} color="#fff" />
                </View>
                <Text style={[styles.actionChipText, { color: "#fff" }]}>{a.label}</Text>
                {activeFilter === a.label && (
                  <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Filtered Content or Main Dashboard */}
      {activeFilter ? (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>{activeFilter}</Text>
          </View>
          {activeFilter === 'Attendance' && <AttendanceView branding={branding} />}
          {activeFilter === 'Giving' && <GivingView branding={branding} />}
          {activeFilter === 'Ministry' && <MinistryView branding={branding} />}
          {activeFilter === 'Counseling' && (
            <CounselingView
              branding={branding}
              autoOpenRequest={openCounselingForm}
              onAutoOpenHandled={() => setOpenCounselingForm(false)}
            />
          )}
          {activeFilter === 'Events' && <EventsView branding={branding} />}
          {activeFilter === 'Resources' && <ResourcesView branding={branding} />}
        </ScrollView>
      ) : (
        <Animated.ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {/* Welcome */}
          <AnimatedCard delay={100}>
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.welcomeText, { color: "#1a1a1a" }]}>
                  Welcome back!
                </Text>
              
              </View>
              <Text style={[styles.welcomeSubtext, { color: "#666666" }]}>
              Here&apos;s what&apos;s happening today
            </Text>
          </View>
        </AnimatedCard>

        {/* Summary Card */}
        <AnimatedCard delay={200}>
          <View style={styles.section}>
            <View style={[styles.summaryCard, { borderColor: "#e0e0e0", backgroundColor: "#ffffff" }]}> 
              <View style={styles.summaryRow}>
                <TouchableOpacity style={styles.summaryItem} activeOpacity={0.8}>
                  <View style={[styles.summaryIconWrap, { backgroundColor: `${secondary}18`, borderColor: `${secondary}60` }]}> 
                    <Ionicons name="calendar" size={22} color={secondary} />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Attendance</Text>
                    <Text style={styles.summaryValue}>12 this month</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="trending-up" size={12} color={secondary} />
                      <Text style={[styles.summaryChange, { color: secondary }]}>+2 from last</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryItem} activeOpacity={0.8}>
                  <View style={[styles.summaryIconWrap, { backgroundColor: `${secondary}18`, borderColor: `${secondary}60` }]}> 
                    <Ionicons name="cash" size={22} color={secondary} />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Giving</Text>
                    <Text style={styles.summaryValue}>₱4,550</Text>
                    <Text style={[styles.summaryChange, { color: secondary }]}>This month</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={[styles.divider, { backgroundColor: '#e0e0e0' }]} />
              <TouchableOpacity style={styles.summaryFooter} activeOpacity={0.8}>
                <View style={[styles.nextEventBadge, { backgroundColor: `${secondary}20` }]}>
                  <Ionicons name="time" size={16} color={secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryFooterLabel}>Next Service</Text>
                  <Text style={styles.summaryFooterText}>Sunday • 9:00 AM</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cfd6cf" />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedCard>

        {/* Counseling CTA */}
        <AnimatedCard delay={250}>
          <View style={styles.section}>
            <View style={[styles.sectionCard, styles.supportCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.supportTextContainer}>
                  <Text style={styles.supportTitle}>Need counseling?</Text>
                  <Text style={styles.supportSubtitle}>
                    Send a request to the pastoral team and we will schedule a time to talk.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.supportButton, { backgroundColor: primary }]}
                  onPress={() => {
                    setActiveFilter('Counseling');
                    setOpenCounselingForm(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.supportButtonText}>Open form</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Announcements */}
        <AnimatedCard delay={300}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>
                   <Ionicons name="megaphone" size={18} color={primary} />
                &nbsp; &nbsp;Announcements
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: primary }]}>See All →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.announcementScroll}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <TouchableOpacity 
                style={[styles.announcementCard, { backgroundColor: '#ffffff', borderColor: '#e0e0e0', borderWidth: 1.5 }]} 
                activeOpacity={0.9}
                onPress={() => router.push('/Member-User/event-details')}
              >
                <Image 
                  source={{ uri: 'https://drive.google.com/uc?export=view&id=1d8S_sZ6ZX905mPh_amnwDTUQ54oki4Rh' }}
                  style={styles.announcementImage}
                  resizeMode="cover"
                />
                <View style={styles.announcementContent}>
                  <View style={styles.announcementHeader}>
                    <View style={[styles.announcementBadge, { backgroundColor: `${secondary}20` }]}>
                      <Text style={[styles.announcementBadgeText, { color: secondary }]}>NEW</Text>
                    </View>
                  </View>
                  <Text style={[styles.announcementText, { color: '#1a1a1a' }]}>Pastor Appreciation Day</Text>
                  <View style={styles.announcementFooter}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={[styles.announcementDate, { color: '#666' }]}>Sunday, October 12, 2025</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.announcementCard, { backgroundColor: '#ffffff', borderColor: '#e0e0e0', borderWidth: 1.5 }]}
                activeOpacity={0.9}
                onPress={() => router.push('/Member-User/event-details')}
              >
                <Image 
                  source={{ uri: 'https://drive.google.com/uc?export=view&id=1xYi-ocCx6p7-hfS8drA6pr1TcCBTUUEz' }}
                  style={styles.announcementImage}
                  resizeMode="cover"
                />
                <View style={styles.announcementContent}>
                  <View style={styles.announcementHeader}>
                    <View style={[styles.announcementBadge, { backgroundColor: '#8B6B4720' }]}>
                      <Text style={[styles.announcementBadgeText, { color: '#8B6B47' }]}>SOON</Text>
                    </View>
                  </View>
                  <Text style={[styles.announcementText, { color: '#1a1a1a' }]}>Faithful Servant Awardees</Text>
                  <View style={styles.announcementFooter}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={[styles.announcementDate, { color: '#666' }]}>Celebrating Our Faithful Servants</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </AnimatedCard>

        {/* Upcoming Events */}
        <AnimatedCard delay={400}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="megaphone" size={18} color={primary} />
                <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>
                  Upcoming Events
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: primary }]}>See All →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.eventScroll}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <TouchableOpacity 
                style={[styles.eventCard, { backgroundColor: '#ffffff', borderColor: '#e0e0e0', borderWidth: 1.5 }]} 
                activeOpacity={0.9}
                onPress={() => router.push('/Member-User/event-details')}
              >
                <Image 
                  source={{ uri: 'https://drive.google.com/uc?export=view&id=1Kaz4zQbcBoOQlNXtpBaxrupkp5ACrnJF' }}
                  style={styles.eventImage}
                  resizeMode="cover"
                />
                <View style={styles.eventContent}>
                  <View style={[styles.eventIconWrap, { backgroundColor: "#FFB74D" }]}>
                    <Ionicons name="star" size={20} color="#fff" />
                  </View>
                  <Text style={styles.eventTitle}>25 Years of El Elyon</Text>
                <View style={styles.eventFooter}>
                  <Ionicons name="calendar" size={12} color="#666" />
                  <Text style={styles.eventDate}>May 25, 2025</Text>
                </View>
                  <View style={styles.eventFooter}>
                    <Ionicons name="time" size={12} color="#666" />
                    <Text style={styles.eventDate}>1:00 PM</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.eventCard, { backgroundColor: '#ffffff', borderColor: '#e0e0e0', borderWidth: 1.5 }]} 
                activeOpacity={0.9}
                onPress={() => router.push('/Member-User/event-details')}
              >
                <Image 
                  source={{ uri: 'https://drive.google.com/uc?export=view&id=1jN5y5v_vHMp5XH6Uo8EGbUT1HIjBtMGA' }}
                  style={styles.eventImage}
                  resizeMode="cover"
                />
                <View style={styles.eventContent}>
                  <View style={[styles.eventIconWrap, { backgroundColor: "#66BB6A" }]}>
                    <Ionicons name="heart" size={20} color="#fff" />
                  </View>
                  <Text style={styles.eventTitle}>Better Half Presents</Text>
                <View style={styles.eventFooter}>
                  <Ionicons name="calendar" size={12} color="#666" />
                  <Text style={styles.eventDate}>March 10, 2025</Text>
                </View>
                  <View style={styles.eventFooter}>
                    <Ionicons name="time" size={12} color="#666" />
                    <Text style={styles.eventDate}>3:00 PM</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </AnimatedCard>

        {/* Calendar */}
        <AnimatedCard delay={500}>
          <View style={styles.section}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="calendar" size={18} color={primary} />
                  <Text style={[styles.sectionTitle, { color: "#1a1a1a" }]}>Calendar</Text>
                </View>
              </View>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarNav} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={20} color="#333333" />
                </TouchableOpacity>
                <Text style={styles.calendarMonth}>July 2024</Text>
                <TouchableOpacity style={styles.calendarNav} activeOpacity={0.7}>
                  <Ionicons name="chevron-forward" size={20} color="#333333" />
                </TouchableOpacity>
              </View>
              <View style={styles.calendarWeekRow}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <Text key={`weekday-${i}`} style={styles.calendarWeekDay}>{d}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {Array.from({ length: 35 }).map((_, idx) => {
                  const day = idx + 1;
                  const inMonth = day > 0 && day <= 30;
                  const eventForDay = calendarEventLookup[day];
                  const isEvent = !!eventForDay;
                  const isToday = day === 15;
                  return (
                    <TouchableOpacity 
                      key={idx} 
                      style={[
                        styles.calendarCell,
                        isToday && { backgroundColor: `${primary}30`, borderRadius: 8 },
                        isEvent && { backgroundColor: `${secondary}20`, borderRadius: 8 },
                      ]}
                      activeOpacity={0.7}
                      disabled={!inMonth}
                      onPress={() => {
                        if (isEvent && inMonth && eventForDay) {
                          setSelectedCalendarEvent(eventForDay);
                          setShowCalendarPreview(true);
                        }
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText, 
                        !inMonth && { color: '#5a625a' }, 
                        isEvent && { color: secondary, fontWeight: '800' },
                        isToday && { color: primary, fontWeight: '900' }
                      ]}>
                        {inMonth ? day : ''}
                      </Text>
                      {isEvent && <View style={[styles.eventDot, { backgroundColor: secondary }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </AnimatedCard>

        <Modal
          visible={showCalendarPreview && !!selectedCalendarEvent}
          transparent
          animationType="fade"
          onRequestClose={closeCalendarPreview}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.eventPreviewCard, { borderColor: `${primary}25` }]}>
              <TouchableOpacity style={styles.closeButton} onPress={closeCalendarPreview}>
                <Ionicons name="close" size={22} color="#1a1a1a" />
              </TouchableOpacity>
              {selectedCalendarEvent?.image ? (
                <Image source={{ uri: selectedCalendarEvent.image }} style={styles.eventPreviewImage} />
              ) : null}
              <View style={styles.eventPreviewBody}>
                {selectedCalendarEvent?.tag ? (
                  <View style={[styles.eventPreviewTag, { backgroundColor: `${secondary}20` }]}> 
                    <Text style={[styles.eventPreviewTagText, { color: secondary }]}>{selectedCalendarEvent.tag}</Text>
                  </View>
                ) : null}
                <Text style={styles.eventPreviewTitle}>{selectedCalendarEvent?.title}</Text>
                <Text style={styles.eventPreviewSummary}>{selectedCalendarEvent?.summary}</Text>
                <View style={styles.eventPreviewMetaRow}>
                  <Ionicons name="calendar-outline" size={16} color="#1a1a1a" />
                  <Text style={styles.eventPreviewMetaText}>{selectedCalendarEvent?.date}</Text>
                </View>
                <View style={styles.eventPreviewMetaRow}>
                  <Ionicons name="time-outline" size={16} color="#1a1a1a" />
                  <Text style={styles.eventPreviewMetaText}>{selectedCalendarEvent?.time}</Text>
                </View>
                <View style={styles.eventPreviewMetaRow}>
                  <Ionicons name="location-outline" size={16} color="#1a1a1a" />
                  <Text style={styles.eventPreviewMetaText}>{selectedCalendarEvent?.location}</Text>
                </View>
                <View style={styles.eventPreviewActions}>
                  <TouchableOpacity
                    style={[styles.eventPreviewButton, { backgroundColor: primary }]}
                    onPress={closeCalendarPreview}
                  >
                    <Text style={styles.eventPreviewButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 20 }} />
      </Animated.ScrollView>
      )}

      {/* Floating QR Button */}
      <TouchableOpacity
        style={[styles.fabQR, { backgroundColor: primary }]}
        onPress={generateQR}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code" size={28} color="#fff" />
      </TouchableOpacity>

      <MemberNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  headerLeft: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
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
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  welcomeSubtext: {
    fontSize: 14,
    fontWeight: "500",
    color: "#cfd6cf",
    marginTop: 4,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "500",
    color: "#0a1612",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  announcementScroll: {
    marginRight: -16,
  },
  announcementCard: {
    width: width - 80,
    marginRight: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  announcementImage: {
    width: '100%',
    height: 140,
  },
  announcementContent: {
    padding: 18,
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  announcementBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  announcementBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  announcementText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
    lineHeight: 22,
  },
  announcementFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  announcementDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  eventScroll: {
    marginRight: -16,
  },
  eventCard: {
    width: width - 100,
    marginRight: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  eventImage: {
    width: '100%',
    height: 120,
  },
  eventContent: {
    padding: 18,
  },
  eventIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
    marginBottom: 10,
    lineHeight: 20,
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNav: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  calendarMonth: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '800',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  calendarWeekDay: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    width: (width - 64) / 7,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarCell: {
    width: (width - 64) / 7,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 3,
    position: 'relative',
  },
  calendarDayText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '700',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 6,
  },
  
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 25,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  actionChipIcon: {
    width: 20,
    height: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipText: {
    fontSize: 9,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#ffffff',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryValue: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '900',
  },
  summaryChange: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextEventBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryFooterLabel: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryFooterText: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '800',
  },
  supportCard: {
    backgroundColor: '#f3f7f3',
    borderColor: '#e0e5df',
  },
  supportTextContainer: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  supportSubtitle: {
    fontSize: 13,
    color: '#4f5d4f',
    lineHeight: 18,
  },
  supportButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  fabQR: {
    position: 'absolute',
    right: 18,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  eventPreviewCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  eventPreviewImage: {
    width: '100%',
    height: 180,
  },
  eventPreviewBody: {
    padding: 16,
  },
  eventPreviewTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  eventPreviewTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  eventPreviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  eventPreviewSummary: {
    marginTop: 8,
    fontSize: 13,
    color: '#4f5d4f',
    lineHeight: 19,
  },
  eventPreviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  eventPreviewMetaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  eventPreviewActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  eventPreviewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  eventPreviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  geofenceInfoBox: {
    width: '100%',
    backgroundColor: '#f4f6f4',
    borderWidth: 1,
    borderColor: '#e0e5df',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  geofenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  geofenceBody: {
    marginTop: 6,
    fontSize: 13,
    color: '#4f5d4f',
    lineHeight: 18,
  },
  qrDisplayContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  permissionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonDisable: {
    backgroundColor: '#f0f0f0',
  },
  permissionButtonTextDisable: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  permissionButtonTextEnable: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  filterHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attendanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  attendanceDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterEmptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginVertical: 32,
  },
  attendanceCardWithImage: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  attendanceImage: {
    width: '100%',
    height: 140,
  },
  attendanceInfo: {
    padding: 12,
  },
  appealButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  appealButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  appealModalContent: {
    backgroundColor: '#fff',
    height: '90%',
    width: '95%',
    marginTop: 'auto',
    marginHorizontal: '2.5%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  appealModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  appealModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  appealFormContainer: {
    padding: 16,
  },
  appealSection: {
    marginBottom: 20,
  },
  appealSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  eventDetailsBox: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  eventDetailImage: {
    width: 100,
    height: 100,
  },
  eventDetailsText: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventDetailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  eventDetailsDate: {
    fontSize: 12,
    color: '#999',
  },
  appealReasonInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1a1a1a',
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontWeight: '600',
  },
  uploadedFileBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  uploadedFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  uploadedFileSize: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  submitAppealBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 20,
  },
  submitAppealBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  engagementSection: {
    width: '100%',
    marginVertical: 16,
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  engagementItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  engagementItemText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    width: '100%',
    marginTop: 8,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  notificationsModalContent: {
    backgroundColor: '#fff',
    height: '90%',
    width: '100%',
    marginTop: 'auto',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notificationsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  counselingHistoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  counselingHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  counselingHistoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  counselingHistoryInfo: {
    flex: 1,
  },
  counselingHistoryDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  counselingHistoryPastor: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestCounselingBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  requestCounselingBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  counselingModalContent: {
    backgroundColor: '#fff',
    height: '75%',
    maxHeight: '85%',
    width: '92%',
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  counselingFormContainer: {
    flex: 1,
    padding: 16,
  },
  counselingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  counselingHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  counselingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  counselingSubtitle: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  counselingFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  counselingFieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  counselingOptionalTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f5d4f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e8efe8',
    borderRadius: 10,
  },
  counselingHelperText: {
    fontSize: 12,
    color: '#777',
  },
  counselingConcernInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: '#1a1a1a',
    textAlignVertical: 'top',
    minHeight: 140,
    marginBottom: 16,
  },
  counselingDateInputContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  counselingDateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 40,
    justifyContent: 'center',
  },
  counselingDateText: {
    fontSize: 14,
  },
  counselingDateIcon: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  datePickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 8,
  },
  iosPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  iosPickerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  iosPickerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  counselingButtonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  counselingCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  counselingCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
  },
  counselingSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  counselingSubmitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  resourceSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  resourceSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  categoryFilter: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  resourceCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resourceCardImage: {
    width: 120,
    height: 140,
  },
  resourceCardContent: {
    flex: 1,
    padding: 12,
  },
  resourceCardCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resourceCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  resourceCardDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  resourceViewButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resourceViewButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  resourceDetailImage: {
    width: '100%',
    height: 250,
  },
  resourceDetailContent: {
    padding: 16,
  },
  resourceDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  resourceDetailCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resourceDetailName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resourceDetailDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
  },
  resourceDetailInfo: {
    marginBottom: 24,
  },
  resourceDetailInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resourceDetailInfoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  resourceDetailInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  requestResourceBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestResourceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  resourceModalContent: {
    backgroundColor: '#fff',
    height: '90%',
    width: '95%',
    marginTop: 'auto',
    marginHorizontal: '2.5%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  resourceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resourceModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  resourceInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resourceInfoImage: {
    width: 100,
    height: 100,
  },
  resourceInfoText: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  resourceInfoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  resourceInfoRate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  resourceFormSection: {
    marginBottom: 20,
  },
  resourceFormLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  resourcePurposeInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: '#1a1a1a',
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resourceDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  resourceDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  submitResourceBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitResourceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});