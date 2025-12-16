import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
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

const { width } = Dimensions.get("window");

type EventItem = {
  id: number;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  image: string;
  location: string;
};

export default function EventsScreen() {
  const [branding, setBranding] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

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

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl
    : null;

  const branches = ["Bustos", "Talacsan", "Cavite", "San Roque", "Vizal Pampanga"];

  const events: EventItem[] = [
    {
      id: 1,
      title: "Sunday Service",
      subtitle:
        "Join us for our weekly worship service. We’ll have inspiring music, a powerful message, and a welcoming community.",
      date: "This Sunday",
      time: "10 AM",
      location: "Bustos Campus",
      image: "https://drive.google.com/uc?export=view&id=1etQu4ciwn_DjpIFvQqr_QTCZwiFDAg1G",
    },
    {
      id: 2,
      title: "Pastor's Appreciation Day",
      subtitle:
        "A special celebration to honor and appreciate our beloved pastor's dedicated service.",
      date: "Sunday, October 12, 2025",
      time: "9 AM",
      location: "Talacsan Campus",
      image: "https://drive.google.com/uc?export=view&id=1d8S_sZ6ZX905mPh_amnwDTUQ54oki4Rh",
    },
    {
      id: 3,
      title: "Family Fun Day",
      subtitle:
        "A special event for families with children. We’ll have activities, games, and snacks for all ages.",
      date: "July 15th",
      time: "2 PM",
      location: "Cavite Community Grounds",
      image: "https://drive.google.com/uc?export=view&id=1xYi-ocCx6p7-hfS8drA6pr1TcCBTUUEz",
    },
    {
      id: 4,
      title: "No Midweek Worship Service",
      subtitle: "Please note that there will be no midweek worship service this week.",
      date: "This Wednesday",
      time: "N/A",
      location: "San Roque",
      image: "https://drive.google.com/uc?export=view&id=1Aeh61gBWP8b4osmPX-PTuKaR_WkC18YL",
    },
    {
      id: 5,
      title: "Happy Father's Day",
      subtitle: "Celebrate and honor all the fathers in our community. Special blessings and recognition.",
      date: "June 16, 2025",
      time: "During Service",
      location: "Vizal Pampanga",
      image: "https://drive.google.com/uc?export=view&id=1jN5y5v_vHMp5XH6Uo8EGbUT1HIjBtMGA",
    },
    {
      id: 6,
      title: "ECCM: Bring One Win One Anniversary",
      subtitle: "Celebrating the anniversary of our Bring One Win One outreach program and its impact.",
      date: "May 25, 2025",
      time: "2:00 PM",
      location: "San Roque Grounds",
      image: "https://drive.google.com/uc?export=view&id=1Kaz4zQbcBoOQlNXtpBaxrupkp5ACrnJF",
    },
    {
      id: 7,
      title: "KIDS Ministry: Kids Summer Day Camp",
      subtitle: "An exciting summer day camp for kids with fun activities, learning, and fellowship.",
      date: "June - August 2025",
      time: "9:00 AM - 3:00 PM",
      location: "Cavite Kids Ministry Center",
      image: "https://drive.google.com/uc?export=view&id=1i00QukHtR2Ja1ys5QhLi-8YzNfIdE9Xu",
    },
  ];

  const recommendedBranch = branches[0];
  const nearestBranch = selectedBranch || recommendedBranch;
  const recommendedNearestEvent =
    events.find((event) =>
      event.location.toLowerCase().includes(nearestBranch.toLowerCase())
    ) || events[0];

  const interestEvent =
    events.find((event) => event.id !== recommendedNearestEvent.id) || recommendedNearestEvent;

  const filteredEvents = selectedBranch
    ? events.filter((event) =>
        event.location.toLowerCase().includes(selectedBranch.toLowerCase())
      )
    : events;

  const renderEvent = ({ item }: { item: EventItem }) => (
    <View style={[styles.card, { borderColor: "#E3E8E3" }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.cardDate, { color: "#777" }]}>{`${item.date} at ${item.time}`}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={3}>
          {item.subtitle}
        </Text>
        <TouchableOpacity
          style={[styles.viewBtn, { borderColor: secondary }]}
          activeOpacity={0.9}
          onPress={() =>
            router.push({
              pathname: "/Member-User/event-details",
              params: {
                id: String(item.id),
                title: item.title,
                subtitle: item.subtitle,
                date: item.date,
                time: item.time,
                location: item.location,
                image: item.image,
              },
            })
          }
        >
          <Text style={[styles.viewBtnText, { color: secondary }]}>View</Text>
        </TouchableOpacity>
      </View>
      <Image source={{ uri: item.image }} style={styles.cardImage} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F9F7" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

     

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
          <View style={[styles.searchBar, { borderColor: "#e0e5df" }]}>
            <Ionicons name="search" size={18} color="#8FA28E" />
            <TextInput
              placeholder="Search events"
              placeholderTextColor="#8FA28E"
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={[styles.section, { marginTop: -4 }]}>
          <Text style={styles.sectionTitle}>Our Branches</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 6 }}
          >
            {["All", ...branches].map((branch) => {
              const isActive = branch === "All" ? selectedBranch === null : selectedBranch === branch;
              const label = branch === "All" ? "All Branches" : branch;
              return (
                <TouchableOpacity
                  key={branch}
                  activeOpacity={0.85}
                  onPress={() => setSelectedBranch(branch === "All" ? null : branch)}
                  style={[
                    styles.branchChip,
                    { borderColor: isActive ? secondary : "#e0e5df", backgroundColor: "#fff" },
                  ]}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={isActive ? secondary : "#556857"}
                  />
                  <Text style={[styles.branchText, { color: isActive ? secondary : "#2c3a2c" }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.section, { marginTop: -8 }]}>
          <View style={[styles.recommendCard, { borderColor: "#e0e5df", backgroundColor: "#fff" }]}>
            <Text style={styles.recommendTitle}>Nearest church activity near you</Text>
            <Text style={styles.recommendSubtitle} numberOfLines={3}>
              Based on your recent visit, the closest branch is {nearestBranch}. We recommend joining {recommendedNearestEvent.title} on {recommendedNearestEvent.date} at {recommendedNearestEvent.time} in {recommendedNearestEvent.location}. Tap below if you want to join again and stay linked to your previous activity.
            </Text>
            <TouchableOpacity
              style={[styles.recommendButton, { backgroundColor: secondary }]}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/Member-User/event-details",
                  params: {
                    id: String(recommendedNearestEvent.id),
                    title: recommendedNearestEvent.title,
                    subtitle: recommendedNearestEvent.subtitle,
                    date: recommendedNearestEvent.date,
                    time: recommendedNearestEvent.time,
                    location: recommendedNearestEvent.location,
                    image: recommendedNearestEvent.image,
                  },
                })
              }
            >
              <Text style={styles.recommendButtonText}>Join this activity</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { marginTop: -8 }]}>
          <View style={[styles.recommendCard, { borderColor: "#e0e5df", backgroundColor: "#fff" }]}>
            <Text style={styles.recommendTitle}>You might be interested in</Text>
            <Text style={styles.recommendSubtitle} numberOfLines={3}>
              Here is another activity you may like: {interestEvent.title} on {interestEvent.date} at {interestEvent.time} in {interestEvent.location}. Join to build on your previous activity streak.
            </Text>
            <TouchableOpacity
              style={[styles.recommendButton, { backgroundColor: secondary }]}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/Member-User/event-details",
                  params: {
                    id: String(interestEvent.id),
                    title: interestEvent.title,
                    subtitle: interestEvent.subtitle,
                    date: interestEvent.date,
                    time: interestEvent.time,
                    location: interestEvent.location,
                    image: interestEvent.image,
                  },
                })
              }
            >
              <Text style={styles.recommendButtonText}>View this activity</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { marginTop: -4 }]}>
          <View style={styles.filterRow}>
            {["Date", "Type", "Category"].map((label) => (
              <TouchableOpacity key={label} style={[styles.filterChip, { borderColor: "#e0e5df" }]}>
                <Text style={styles.filterText}>{label}</Text>
                <Ionicons name="chevron-down" size={14} color="#556857" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { marginTop: -4 }]}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
        </View>

        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={renderEvent}
        />

        <View style={{ height: 12 }} />
      </ScrollView>

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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#2c3a2c",
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 13,
    color: "#2c3a2c",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 120,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardDate: {
    fontSize: 12,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2a1f",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#4f5d4f",
    lineHeight: 18,
  },
  viewBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardImage: {
    width: width * 0.3,
    height: 110,
    borderRadius: 12,
    backgroundColor: "#dfe5df",
  },
  branchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  branchText: {
    fontSize: 13,
    color: "#2c3a2c",
    fontWeight: "700",
  },
  recommendCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  recommendTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  recommendSubtitle: {
    fontSize: 13,
    color: "#4f5d4f",
    lineHeight: 18,
  },
  recommendButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recommendButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
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
});
