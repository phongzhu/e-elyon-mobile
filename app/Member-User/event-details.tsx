import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../src/lib/supabaseClient";

export default function EventDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [branding, setBranding] = useState<any>(null);
  const [showRsvpConfirm, setShowRsvpConfirm] = useState(false);

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

  const title = (params.title as string) || "EECM 25 Years Anniversary";
  const subtitle =
    (params.subtitle as string) ||
    "Join us as we give thanks for 25 years of God’s amazing grace!";
  const date = (params.date as string) || "May 25, 2025";
  const time = (params.time as string) || "10:00 AM - 1:00 PM";
  const location = (params.location as string) || "San Rafael, Victory Coliseum";
  const image =
    (params.image as string) ||
    "https://images.unsplash.com/photo-1515165562835-c4c46905b01c?w=1200&q=80";
  const mapImage =
    "https://drive.google.com/uc?export=view&id=1pjCtJy7JVbzX0J8jAcNvQlrTtbGITvg2";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Event Details</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/profile")}>
            <Ionicons name="person-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: image }} style={styles.hero} />

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.infoBlock}>
            <InfoRow icon="calendar-outline" label={date} />
            <InfoRow icon="time-outline" label={time} />
            <InfoRow icon="location-outline" label={location} />
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: primary }]}
            onPress={() => setShowRsvpConfirm(true)}
          > 
            <Text style={styles.ctaText}>RSVP</Text>
          </TouchableOpacity>

          <Image
            source={{
              uri: mapImage,
            }}
            style={styles.map}
          />

          <View style={{ marginTop: 18 }}>
            <Text style={styles.sectionTitle}>Who’s Attending</Text>
            <View style={styles.avatarRow}>
              {avatars.map((src, idx) => (
                <Image key={idx} source={{ uri: src }} style={[styles.avatar, idx > 0 && { marginLeft: -10 }]} />
              ))}
            </View>
          </View>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      <Modal
        visible={showRsvpConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRsvpConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: `${primary}30` }]}> 
            <Ionicons name="checkmark-circle" size={56} color={primary} />
            <Text style={styles.modalTitle}>RSVP Received</Text>
            <Text style={styles.modalMessage}>
              Thank you! We’ve recorded your RSVP. We’ll reach out with any updates about this event.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primary }]}
              onPress={() => setShowRsvpConfirm(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color="#1f2a1f" />
      </View>
      <Text style={styles.infoText}>{label}</Text>
    </View>
  );
}

const avatars = [
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/women/32.jpg",
  "https://randomuser.me/api/portraits/men/45.jpg",
  "https://randomuser.me/api/portraits/women/12.jpg",
  "https://randomuser.me/api/portraits/men/14.jpg",
];

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  hero: {
    width: "100%",
    height: 220,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#3b463b",
  },
  infoBlock: {
    marginTop: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eef3ec",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#1f2a1f",
  },
  cta: {
    marginTop: 16,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  ctaText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  map: {
    marginTop: 16,
    width: "100%",
    height: 190,
    borderRadius: 12,
    backgroundColor: "#dfe5df",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2a1f",
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
  },
  modalTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2a1f",
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    color: "#3b463b",
    textAlign: "center",
    lineHeight: 20,
  },
  modalButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
