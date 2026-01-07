import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function MinistryScreen() {
  const [branding, setBranding] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRequestConfirm, setShowRequestConfirm] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showMyMinistryModal, setShowMyMinistryModal] = useState(false);
  const [selectedMinistry, setSelectedMinistry] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showTaskDoneConfirm, setShowTaskDoneConfirm] = useState(false);
  const [taskDoneMessage, setTaskDoneMessage] = useState<string>("");
  const [showNotGoingModal, setShowNotGoingModal] = useState(false);
  const [notGoingReason, setNotGoingReason] = useState("");
  const [wantSubstitute, setWantSubstitute] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showSubstituteConfirm, setShowSubstituteConfirm] = useState(false);
  const [showSubstituteAcceptedConfirm, setShowSubstituteAcceptedConfirm] = useState(false);

  const notifications = [
    {
      id: 1,
      type: "event",
      title: "Youth Fellowship Starting Soon",
      message: "Youth Fellowship is starting in 30 minutes at the main church. Join us!",
      time: "5 mins ago",
      icon: "people",
      read: false,
    },
    {
      id: 2,
      type: "location",
      title: "Near Bustos Campus",
      message: "You are near Bustos Campus. Sunday Service starts at 10:00 AM today.",
      time: "1 hour ago",
      icon: "location",
      read: false,
    },
    {
      id: 3,
      type: "reminder",
      title: "Pastor Appreciation Day",
      message: "Don't forget! Pastor Appreciation Day is this Sunday, October 12.",
      time: "2 hours ago",
      icon: "calendar",
      read: true,
    },
    {
      id: 4,
      type: "branch",
      title: "Cavite Branch Activity",
      message: "Special Family Fun Day at Cavite Community Grounds. RSVP now!",
      time: "Yesterday",
      icon: "home",
      read: true,
    },
    {
      id: 5,
      type: "attendance",
      title: "Attendance Recorded",
      message: "Your attendance at Sunday Worship Service has been validated.",
      time: "2 days ago",
      icon: "checkmark-circle",
      read: true,
    },
  ];

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  // Configure notifications and request permission
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  const ministries = [
    { id: 1, name: "Iron Men", description: "Men's fellowship and leadership group", members: 28, image: "https://scontent.fmnl9-4.fna.fbcdn.net/v/t1.15752-9/597231628_824312293933713_6482925382131957249_n.png?_nc_cat=105&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeEUjCGRG06tKw0g84SJ2kXZ0tqflpytuyrS2p-WnK27Ko1CVRVo47OT2GXVijm5YsH-3V0-MBVztCM1LpBddxPU&_nc_ohc=RpRtAGB9dIUQ7kNvwEL5IOC&_nc_oc=AdnHYRkkU7crSb0qR2UwzugNc_iGmtpUHaEHFfvfHltEPPar9k8wQZd7cM1qvYReJYk&_nc_zt=23&_nc_ht=scontent.fmnl9-4.fna&oh=03_Q7cD4AGJrH4AFmIbj0BUNmF6EGImRNhWqu3kbxvun4VaZRUXaQ&oe=6968EC98" },
    { id: 2, name: "Women at Work", description: "Women's ministry for fellowship and service", members: 32, image: "https://scontent.fmnl9-7.fna.fbcdn.net/v/t1.15752-9/597949346_1155900569645231_1597258750514702910_n.png?_nc_cat=104&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeHX9m8sHU_Z6pi2bAMfNyBNOkvVCi96HiI6S9UKL3oeIn3TtEFi5oEwOMDxkMjmw36vnGGNe65CKPrWBv8192_-&_nc_ohc=2XeLMskwSu8Q7kNvwEmRXvW&_nc_oc=AdmZxSqkUhrybKN6JuezWqf2bLxLrMygt3TWAO3HhZBw68iAdtYayjazG9F2KHwcBrs&_nc_zt=23&_nc_ht=scontent.fmnl9-7.fna&oh=03_Q7cD4AEtUGhKNniZR3oepoMn3vdros2CHeIfmcLHj_UHFZNOkA&oe=6968DB01" },
    { id: 3, name: "Seniors", description: "Senior citizens ministry", members: 19, image: "https://images.squarespace-cdn.com/content/v1/508da03be4b0d28844ddf21c/b6b91500-d4a5-47de-a8c7-451b4a7d9f70/seniors+3.jpg?format=2500w" },
    { id: 4, name: "Youth Movers", description: "Youth ministry for teens and young adults", members: 45, image: "https://scontent.fmnl9-6.fna.fbcdn.net/v/t1.15752-9/597860634_862349562832387_3194540810096496538_n.png?_nc_cat=103&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeFwJkMvFXaTi24rFf7GtwmTrWU-h6lICEytZT6HqUgITMdbH7lkjdjz-eIXEhsSHEi4e_Dh4-ov7mRttFh1t_n1&_nc_ohc=mS5TdMwoX90Q7kNvwEVq_4j&_nc_oc=AdnEURhn-9y72CcjX_nSbdi2o98XWQ0Lt3kT7kGTXpIkPNpznGuzx2tVdyG_p0YYIAc&_nc_zt=23&_nc_ht=scontent.fmnl9-6.fna&oh=03_Q7cD4AGhqtK0SNfhPMFgo5p7MgSvrI0fFzo-qUHZteKWJVjSYg&oe=6968E7AB" },
    { id: 5, name: "Couples", description: "Married couples ministry", members: 22, image: "https://tse4.mm.bing.net/th/id/OIP.APcNJG8upwlvaf9Y7g2QxAHaEo?pid=Api&P=0&h=180" },
    { id: 6, name: "Kids", description: "Children's Sunday school ministry", members: 68, image: "https://lh3.googleusercontent.com/d/1mMKqJvX3HZA3SFTfKIDci3IsXZWFnJ1P=w400" },
    { id: 7, name: "S.O.S", description: "Support and service ministry", members: 15, image: "https://lh3.googleusercontent.com/d/1fR_33lLkVUVmS8S_AJv8lINmhDHflG-t=w400" },
    { id: 8, name: "Evangelism", description: "Evangelism and outreach ministry", members: 24, image: "https://lh3.googleusercontent.com/d/1NinbnWn7zzbROn74TD-GvO6JrcySJj17=w400" },
    { id: 9, name: "Usher", description: "Ushers and welcoming team", members: 31, image: "https://lh3.googleusercontent.com/d/1ApOlySWNoqg37Id9oVxeSdDMuD9FyTYG=w400" },
    { id: 10, name: "Praise and Worship Team", description: "Music and worship team", members: 26, image: "https://lh3.googleusercontent.com/d/17dIMFxjAOpTTFnaK0GcI9nj2Ts1ZQB5j=w400" },
    { id: 11, name: "Marshall", description: "Security and crowd management ministry", members: 20, image: "https://lh3.googleusercontent.com/d/1vUH7zt9b4RRXeMoWQHYkCUp8PkNBP0wY=w400" },
  ];

  const memberSnapshot = {
    status: "Active Member",
    aiEligible: true,
    attendanceStreak: 6,
    weeksServed: 12,
    roles: ["Usher"],
  };

  const assignedTasks = [
    {
      id: 101,
      title: "Welcome Guests at Main Entrance",
      when: "Sun, 9:00 AM",
      ministry: "Usher",
      status: "Assigned",
    },
    {
      id: 102,
      title: "Guide Members to Seats - Children's Area",
      when: "Sun, 9:30 AM",
      ministry: "Usher",
      status: "Pending Acceptance",
    },
  ];

  const ministryMembers: { [key: string]: { name: string; role: string }[] } = {
    "Usher": [
      { name: "John Smith", role: "Head Usher" },
      { name: "Maria Garcia", role: "Assistant" },
      { name: "David Lee", role: "Member" },
      { name: "Sarah Johnson", role: "Member" },
      { name: "Michael Brown", role: "Member" },
      { name: "Emma Wilson", role: "Member" },
    ],
    "Praise and Worship Team": [
      { name: "Pastor Ethan", role: "Lead" },
      { name: "Rachel Kim", role: "Vocalist" },
      { name: "James Martinez", role: "Guitarist" },
      { name: "Olivia Bennett", role: "Bassist" },
    ],
    "Iron Men": [
      { name: "Pastor Samuel", role: "Leader" },
      { name: "Robert Taylor", role: "Co-Leader" },
      { name: "Christopher Anderson", role: "Member" },
    ],
  };

  const ministryEvents = [
    {
      id: 201,
      title: "Worship Team Practice",
      time: "Sat, 10:00 AM",
      location: "Main Sanctuary",
      rsvp: "Going",
    },
    {
      id: 202,
      title: "Youth Service",
      time: "Sun, 2:00 PM",
      location: "Youth Hall",
      rsvp: "Maybe",
    },
  ];

  const handleRequestSubmit = () => {
    setShowRequestModal(false);
    setShowRequestConfirm(true);
    setSelectedRole(null);
    setAvailability("");
    setNote("");
  };

  const handleJoinMinistry = (ministry: any) => {
    setSelectedMinistry(ministry);
    setShowJoinModal(true);
  };

  const handleViewMembers = (ministry: any) => {
    setSelectedMinistry(ministry);
    setShowMembersModal(true);
  };

  const handleJoinSubmit = () => {
    setShowJoinModal(false);
    setShowRequestConfirm(true);
    setSelectedMinistry(null);
    setSelectedRole(null);
    setAvailability("");
    setNote("");
  };

  const handleViewMyMinistry = () => {
    const usherMinistry = ministries.find(m => m.name === "Usher");
    setSelectedMinistry(usherMinistry);
    setShowMyMinistryModal(true);
  };

  useEffect(() => {
    // initialize tasks and events when component mounts
    setTasks(assignedTasks);
    setEvents(ministryEvents);
  }, []);

  const handleMarkDone = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setTaskDoneMessage(
      `“${task?.title || "Task"}” marked done. Your members will be notified that you’ve completed it.`
    );
    setShowTaskDoneConfirm(true);
  };

  const handleAcceptTask = (taskId: number) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "Assigned" } : t)));
  };

  const handleDeclineTask = (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleRsvpGoing = (eventId: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const handleRsvpNotGoing = (eventItem: any) => {
    setSelectedEvent(eventItem);
    setNotGoingReason("");
    setWantSubstitute(false);
    setShowNotGoingModal(true);
    // Ensure parent modal doesn't obscure the Not Going modal
    setShowMyMinistryModal(false);
  };

  const submitNotGoing = () => {
    setShowNotGoingModal(false);
    if (wantSubstitute) {
      // stub: create a confirmation that a push notification has been sent
      setShowSubstituteConfirm(true);
    }
    // Optionally, we could keep the activities list intact when Not Going is chosen.
    // If you want to remove the event on Not Going, uncomment below:
    // setEvents((prev) => prev.filter((e) => e.id !== selectedEvent?.id));
  };

  const acknowledgeSubstituteRequest = () => {
    // Close the initial substitute request confirmation
    setShowSubstituteConfirm(false);
    // Send a local push notification to the user's device
    Notifications.scheduleNotificationAsync({
      content: {
        title: "Substitute Confirmed",
        body: `A member has agreed to substitute for ${selectedEvent?.title || "your activity"}.`,
        data: { type: "substitute", eventId: selectedEvent?.id },
      },
      trigger: null, // deliver immediately
    });
    // Optionally show a confirmation modal to guide the user to notifications UI
    setShowSubstituteAcceptedConfirm(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Ministry</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowNotifications(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            <View style={[styles.badge, { backgroundColor: secondary }]}>
              <Text style={styles.badgeText}>{notifications.filter((n) => !n.read).length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/profile")}>
            <Ionicons name="person-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Ministry Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusCard, { backgroundColor: `${secondary}15`, borderColor: secondary }]}>
              <Text style={styles.statusLabel}>Member Status</Text>
              <Text style={[styles.statusValue, { color: secondary }]}>{memberSnapshot.status}</Text>
              <Text style={styles.statusSub}>Attendance streak: {memberSnapshot.attendanceStreak} weeks</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: `${primary}12`, borderColor: primary }]}>
              <Text style={styles.statusLabel}>AI Assignments</Text>
              <Text style={[styles.statusValue, { color: primary }]}>{memberSnapshot.aiEligible ? "Eligible" : "Not yet eligible"}</Text>
              <Text style={styles.statusSub}>Served {memberSnapshot.weeksServed} weeks in ministries</Text>
            </View>
          </View>
          <View style={[styles.rolePillWrap, { borderColor: `${primary}20` }]}>
            <Text style={styles.pillLabel}>Current Roles</Text>
            <View style={styles.pillChips}>
              {memberSnapshot.roles.map((role) => (
                <View key={role} style={[styles.rolePill, { backgroundColor: `${primary}10` }]}> 
                  <Text style={[styles.rolePillText, { color: primary }]}>{role}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

      
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Ministry</Text>
          {ministries.find(m => m.name === "Usher") && (
            <View style={[styles.ministryCard, styles.ministryCardWithTag]}>
              <View style={[styles.cardBlobTopRight, { backgroundColor: `${secondary}15` }]} />
              <View style={[styles.cardBlobBottomLeft, { backgroundColor: `${primary}0D` }]} />
              <View style={styles.ministryContent}>
                <View style={styles.ministryHeader}>
                  <Image
                    source={{ uri: "https://scontent.fmnl9-6.fna.fbcdn.net/v/t1.15752-9/597563695_1738614776832649_4365066983560737174_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeFvfMKwYAUlvezajqOMT3gSnq8mm0Hdn0yeryabQd2fTGGQutz0xs5kArk0SUVPEAAFhya1okjLHJw2RN0rPPon&_nc_ohc=A9hFqvKExhgQ7kNvwFOVIVq&_nc_oc=AdnVT6pxaE3g9Xg-to38Q7mX8MeUEMhyj8Kf89y8c5AljcU0Z2G4hdm6JK1NN1JlDTg&_nc_zt=23&_nc_ht=scontent.fmnl9-6.fna&oh=03_Q7cD4AGr6Ychxr4g9QUFZGbUYb7tZ2-cOyJDhfqAE0FliUZBAA&oe=6968E9C2" }}
                    style={[styles.ministryImage, { borderColor: secondary }]}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.ministryName}>Usher</Text>
                    <Text style={styles.ministryDescription}>
                      Ushers and welcoming team
                    </Text>
                  </View>
                </View>
                <View style={styles.ministryFooter}>
                  <Text style={styles.ministryMembers}>31 members</Text>
                  <TouchableOpacity style={styles.viewBtn} onPress={handleViewMyMinistry}>
                    <Text style={[styles.viewBtnText, { color: secondary }]}>View</Text>
                    <Ionicons name="chevron-forward" size={16} color={secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Join a Ministry</Text>
          <FlatList
            data={ministries.filter(m => m.name !== "Usher")}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.ministryCard}>
                <View style={[styles.cardBlobTopRight, { backgroundColor: `${secondary}18` }]} />
                <View style={[styles.cardBlobBottomLeft, { backgroundColor: `${primary}10` }]} />
                <View style={styles.ministryContent}>
                  <View style={styles.ministryHeader}>
                    <Image
                      source={{ uri: item.image }}
                      style={[styles.ministryImage, { borderColor: secondary }]}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.ministryName}>{item.name}</Text>
                      <Text style={styles.ministryDescription}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ministryFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.ministryMembers}>
                        {item.members} members
                      </Text>
                      <TouchableOpacity 
                        style={styles.viewMembersBtn}
                        onPress={() => handleViewMembers(item)}
                      >
                        <Ionicons name="eye-outline" size={16} color={secondary} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.joinBtn,
                        { backgroundColor: secondary },
                      ]}
                      onPress={() => handleJoinMinistry(item)}
                    >
                      <Text style={styles.joinBtnText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Request Ministry Involvement</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Select Ministry</Text>
            <View style={styles.roleSelectRow}>
              {ministries.map((m) => {
                const isActive = selectedRole === m.name;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.roleChip, { borderColor: isActive ? primary : "#e0e6df", backgroundColor: isActive ? `${primary}12` : "#f9f9f9" }]}
                    onPress={() => setSelectedRole(m.name)}
                  >
                    <Text style={[styles.roleChipText, { color: isActive ? primary : "#2d362d" }]}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Availability</Text>
            <TextInput
              placeholder="e.g. Sundays 8-12, Wednesdays 6-9"
              placeholderTextColor="#8a938a"
              value={availability}
              onChangeText={setAvailability}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Notes / Skills</Text>
            <TextInput
              placeholder="Share your skills, preferences, or constraints"
              placeholderTextColor="#8a938a"
              value={note}
              onChangeText={setNote}
              style={[styles.input, { height: 96 }]}
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={handleRequestSubmit}
            >
              <Text style={styles.primaryCtaText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Task Done Confirmation */}
      <Modal
        visible={showTaskDoneConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTaskDoneConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}> 
              <Ionicons name="checkmark-done-circle" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Task Completed</Text>
            <Text style={styles.confirmText}>{taskDoneMessage}</Text>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={() => setShowTaskDoneConfirm(false)}
            >
              <Text style={styles.primaryCtaText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Not Going Modal */}
      <Modal
        visible={showNotGoingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotGoingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Not Going</Text>
              <TouchableOpacity onPress={() => setShowNotGoingModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Event</Text>
            <View style={[styles.infoBox, { marginBottom: 8 }]}>
              <Text style={styles.infoText}>{selectedEvent?.title}</Text>
              <Text style={[styles.infoText, { marginTop: 4 }]}>{selectedEvent?.time} • {selectedEvent?.location}</Text>
            </View>
            <Text style={styles.fieldLabel}>Why are you not going?</Text>
            <TextInput
              placeholder="Share your reason..."
              placeholderTextColor="#8a938a"
              value={notGoingReason}
              onChangeText={setNotGoingReason}
              style={[styles.input, { height: 80, marginBottom: 12 }]}
              multiline
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Request a substitute?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.rsvpPill, { borderColor: wantSubstitute ? '#e5e8e5' : primary, backgroundColor: wantSubstitute ? '#f3f5f3' : `${primary}15` }]}
                  onPress={() => setWantSubstitute(false)}
                >
                  <Text style={[styles.rsvpPillText, { color: wantSubstitute ? '#4d5a4d' : primary }]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpPill, { borderColor: wantSubstitute ? primary : '#e5e8e5', backgroundColor: wantSubstitute ? `${primary}15` : '#f3f5f3' }]}
                  onPress={() => setWantSubstitute(true)}
                >
                  <Text style={[styles.rsvpPillText, { color: wantSubstitute ? primary : '#4d5a4d' }]}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 16 }]}
              activeOpacity={0.9}
              onPress={submitNotGoing}
            >
              <Text style={styles.primaryCtaText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Substitute Confirmation */}
      <Modal
        visible={showSubstituteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubstituteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}> 
              <Ionicons name="notifications" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Substitute Requested</Text>
            <Text style={styles.confirmText}>
              A push notification has been sent to your ministry team about the needed substitute.
            </Text>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={acknowledgeSubstituteRequest}
            >
              <Text style={styles.primaryCtaText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Substitute Accepted (User notification) */}
      <Modal
        visible={showSubstituteAcceptedConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubstituteAcceptedConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${primary}20` }]}> 
              <Ionicons name="checkmark-circle" size={56} color={primary} />
            </View>
            <Text style={styles.confirmTitle}>Substitute Confirmed</Text>
            <Text style={styles.confirmText}>
              A member has agreed to be your substitute. We’ve added a notification to your inbox.
            </Text>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={() => {
                setShowSubstituteAcceptedConfirm(false);
                setShowNotifications(true);
              }}
            >
              <Text style={styles.primaryCtaText}>View Notification</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>Ministry Application</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={[styles.ministryPreview, { borderColor: secondary }]}>
                <Ionicons name={selectedMinistry?.icon} size={32} color={secondary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.ministryPreviewName}>{selectedMinistry?.name}</Text>
                  <Text style={styles.ministryPreviewDesc}>{selectedMinistry?.description}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Availability</Text>
              <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]}>
                <Text style={{ color: '#8a938a' }}>Select Availability</Text>
                <Ionicons name="calendar-outline" size={20} color={secondary} style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Relevant Skills/Experience</Text>
              <TextInput
                placeholder="Input here..."
                placeholderTextColor="#8a938a"
                value={note}
                onChangeText={setNote}
                style={[styles.input, { height: 80 }]}
                multiline
              />

              <Text style={styles.fieldLabel}>Personal Message/Notes</Text>
              <TextInput
                placeholder="Input here..."
                placeholderTextColor="#8a938a"
                value={availability}
                onChangeText={setAvailability}
                style={[styles.input, { height: 80 }]}
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: secondary, marginTop: 8 }]}
              activeOpacity={0.9}
              onPress={handleJoinSubmit}
            >
              <Text style={styles.primaryCtaText}>Submit Application</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryCta}
              activeOpacity={0.9}
              onPress={() => setShowJoinModal(false)}
            >
              <Text style={styles.secondaryCtaText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.membersModalContent}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>{selectedMinistry?.name}</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={[styles.memberCountBox, { backgroundColor: `${primary}12`, borderColor: primary }]}>
              <Text style={[styles.memberCountText, { color: primary }]}>{selectedMinistry?.members} Members</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {ministryMembers[selectedMinistry?.name]?.length > 0 ? (
                ministryMembers[selectedMinistry?.name]?.map((member, idx) => (
                  <View key={idx} style={styles.memberItem}>
                    <View style={[styles.memberAvatar, { backgroundColor: `${secondary}25` }]}>
                      <Ionicons name="person-circle" size={40} color={secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noMembersText}>Members list coming soon</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMyMinistryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMyMinistryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.membersModalContent, { maxHeight: "85%" }]}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>{selectedMinistry?.name}</Text>
              <TouchableOpacity onPress={() => setShowMyMinistryModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              {/* Ministry Info */}
              <View style={[styles.infoBox, { backgroundColor: `${secondary}10`, borderColor: secondary }]}>
                <Text style={[styles.infoLabel, { color: secondary }]}>Ministry Description</Text>
                <Text style={styles.infoText}>{selectedMinistry?.description}</Text>
              </View>

              {/* Members Count */}
              <View style={[styles.memberCountBox, { backgroundColor: `${primary}12`, borderColor: primary, marginTop: 12 }]}>
                <Text style={[styles.memberCountText, { color: primary }]}>{selectedMinistry?.members} Members</Text>
              </View>

              {/* Ministry Activities/Events */}
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Your Ministry Activities</Text>
              {events.map((event) => (
                <View key={event.id} style={styles.activityCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{event.title}</Text>
                    <Text style={styles.activityMeta}>{event.time} • {event.location}</Text>
                  </View>
                  <View style={styles.rsvpPillRow}>
                    {(["Going", "Not Going"] as const).map((option) => {
                      const isActive = event.rsvp === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.rsvpPill,
                            { backgroundColor: isActive ? `${primary}15` : "#f3f5f3", borderColor: isActive ? primary : "#e5e8e5" },
                          ]}
                          onPress={() =>
                            option === "Going" ? handleRsvpGoing(event.id) : handleRsvpNotGoing(event)
                          }
                        >
                          <Text style={[styles.rsvpPillText, { color: isActive ? primary : "#4d5a4d" }]}>{option}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Assigned Tasks */}
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Your Assigned Tasks</Text>
              {tasks.map((task) => (
                <View key={task.id} style={[styles.taskCard, { marginBottom: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>{task.when}</Text>
                    <Text style={styles.taskStatus}>{task.status}</Text>
                  </View>
                  {task.status === "Pending Acceptance" ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.taskAction, { backgroundColor: primary }]}
                        activeOpacity={0.85}
                        onPress={() => handleAcceptTask(task.id)}
                      >
                        <Text style={styles.taskActionText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.taskAction, { backgroundColor: "#c0392b" }]}
                        activeOpacity={0.85}
                        onPress={() => handleDeclineTask(task.id)}
                      >
                        <Text style={styles.taskActionText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.taskAction, { backgroundColor: primary }]}
                      activeOpacity={0.85}
                      onPress={() => handleMarkDone(task.id)}
                    >
                      <Text style={styles.taskActionText}>Mark Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Ministry Members */}
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Ministry Team</Text>
              {ministryMembers[selectedMinistry?.name]?.length > 0 ? (
                ministryMembers[selectedMinistry?.name]?.map((member, idx) => (
                  <View key={idx} style={styles.memberItem}>
                    <View style={[styles.memberAvatar, { backgroundColor: `${secondary}25` }]}>
                      <Ionicons name="person-circle" size={40} color={secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberRole}>{member.role}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noMembersText}>Members list coming soon</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRequestConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIconBox, { backgroundColor: `${secondary}20` }]}> 
              <Ionicons name="checkmark-circle" size={56} color={secondary} />
            </View>
            <Text style={styles.confirmTitle}>Request Submitted</Text>
            <Text style={styles.confirmText}>
              Thanks for volunteering! Your ministry involvement request was sent. An admin will review and update your assignments soon.
            </Text>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: primary, marginTop: 12 }]}
              activeOpacity={0.9}
              onPress={() => setShowRequestConfirm(false)}
            >
              <Text style={styles.primaryCtaText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotifications}
        transparent
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
                    { backgroundColor: notif.read ? "#fff" : `${primary}08` },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.notificationIcon, { backgroundColor: `${primary}20` }]}>
                    <Ionicons name={notif.icon as any} size={22} color={primary} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notif.title}</Text>
                      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: secondary }]} />}
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

      <MemberNavbar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    backgroundColor: "rgba(255,255,255,0.3)",
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
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
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
  statusRow: {
    flexDirection: "row",
    gap: 12,
  },
  statusCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  statusLabel: {
    fontSize: 12,
    color: "#4c5b4c",
    fontWeight: "600",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 12,
    color: "#667266",
  },
  rolePillWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8faf8",
  },
  pillLabel: {
    fontSize: 12,
    color: "#4c5b4c",
    fontWeight: "700",
    marginBottom: 8,
  },
  pillChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rolePill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e8e5",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
    gap: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  taskMeta: {
    fontSize: 12,
    color: "#627062",
    marginTop: 2,
  },
  taskStatus: {
    fontSize: 12,
    color: "#8a958a",
    marginTop: 4,
  },
  taskAction: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  taskActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  primaryCta: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryCtaText: {
    color: "#fff",
    fontWeight: "800",
  },
  eventCard: {
    borderWidth: 1,
    borderColor: "#e5e8e5",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  eventMeta: {
    fontSize: 12,
    color: "#627062",
    marginTop: 2,
  },
  rsvpPillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  rsvpPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  rsvpPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  ministryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  ministryCardWithTag: {
    paddingTop: 40,
  },
  ministryContent: {
    gap: 10,
  },
  ministryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ministryImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f4f1",
    borderWidth: 1,
  },
  ministryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a1f",
    marginBottom: 4,
  },
  ministryDescription: {
    fontSize: 13,
    color: "#627062",
  },
  ministryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ministryMembers: {
    fontSize: 12,
    color: "#6b776b",
  },
  cardBlobTopRight: {
    position: "absolute",
    top: -36,
    right: -28,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cardBlobBottomLeft: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  tagPill: {
    position: "absolute",
    top: 12,
    left: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 1,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  joinBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  joinBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  requestModalContent: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  fieldLabel: {
    fontSize: 12,
    color: "#4c5b4c",
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  roleSelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipText: {
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dfe4de",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#f7faf7",
    color: "#1f2a1f",
  },
  confirmModalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 6,
    textAlign: "center",
  },
  confirmText: {
    fontSize: 13,
    color: "#3e473e",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
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
  viewMembersBtn: {
    padding: 6,
  },
  secondaryCta: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  secondaryCtaText: {
    color: "#333",
    fontWeight: "800",
  },
  ministryPreview: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f8faf8",
  },
  ministryPreviewName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
    marginBottom: 2,
  },
  ministryPreviewDesc: {
    fontSize: 12,
    color: "#5a6a5a",
  },
  membersModalContent: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  memberCountBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  memberCountText: {
    fontSize: 14,
    fontWeight: "800",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  memberRole: {
    fontSize: 12,
    color: "#667266",
    marginTop: 2,
  },
  noMembersText: {
    textAlign: "center",
    color: "#888",
    marginTop: 20,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginBottom: 10,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f8faf8",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 18,
  },
  activityCard: {
    borderWidth: 1,
    borderColor: "#e5e8e5",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  activityMeta: {
    fontSize: 12,
    color: "#627062",
    marginTop: 2,
  },
});
