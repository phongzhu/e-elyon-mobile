// app/Member-User/give-online.tsx (or wherever your GiveOnlineScreen lives)

import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GcashIcon,
  MayaIcon,
} from "../../components/ui/wallet-icons";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

type DonorNoteKey = "anonymous" | "family" | "individual";
type WalletKey = "Maya" | "GCash";

const parseAmountPHP = (raw: string) => {
  const cleaned = String(raw || "").replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

// NOTE: PayMongo payment_method_types are strict.
// If a method isn't enabled in your PayMongo account, the checkout can fail.
// We DO NOT disable buttons; we just handle errors gracefully.
const paymongoTypesForWallet = (wallet: WalletKey): string[] => {
  switch (wallet) {
    case "GCash":
      return ["gcash"];
    case "Maya":
      return ["paymaya"]; // commonly used for Maya in PayMongo
    default:
      return ["gcash"];
  }
};

const pickBranchId = (usersDetails: any): number | null => {
  if (!usersDetails) return null;
  if (Array.isArray(usersDetails)) {
    return usersDetails.length > 0
      ? (usersDetails[0]?.branch_id ?? null)
      : null;
  }
  return usersDetails?.branch_id ?? null;
};

export default function GiveOnlineScreen() {
  const insets = useSafeAreaInsets();

  const [branding, setBranding] = useState<any>(null);

  const [selectedWallet, setSelectedWallet] = useState<WalletKey | null>(null);

  const [selectedQuickAmount, setSelectedQuickAmount] = useState<string | null>(
    null,
  );
  const [customAmount, setCustomAmount] = useState("");

  // Weâ€™ll use this as a â€œReview & Payâ€ modal (not an instant success modal)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const donorNoteOptions: { key: DonorNoteKey; label: string }[] = [
    { key: "anonymous", label: "Anonymous (Donation - Anonymous)" },
    { key: "family", label: "By Family Giving" },
    { key: "individual", label: "Individual Donation" },
  ];
  const [donorNoteKey, setDonorNoteKey] = useState<DonorNoteKey>("individual");

  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("âŒ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  WebBrowser.maybeCompleteAuthSession();

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";

  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  const donorNoteLabel = useMemo(() => {
    return (
      donorNoteOptions.find((o) => o.key === donorNoteKey)?.label ||
      "Individual Donation"
    );
  }, [donorNoteKey]);

  const amountNum = useMemo(() => parseAmountPHP(customAmount), [customAmount]);

  const handleQuickGive = (amount: string) => {
    if (amount === "Other") {
      setSelectedQuickAmount(amount);
      setCustomAmount("");
    } else {
      setSelectedQuickAmount(amount);
      setCustomAmount(amount.replace("₱", "").replace(/,/g, ""));
    }
  };

  const validateForm = () => {
    if (!selectedWallet) return "Please select a payment method.";
    if (!customAmount || parseAmountPHP(customAmount) <= 0)
      return "Please enter a valid amount.";
    return null;
  };

  // This creates a PayMongo checkout via your Supabase Edge Function:
  // supabase.functions.invoke("create_paymongo_checkout", { body: {...} })
  const startPaymongoCheckout = async () => {
    const err = validateForm();
    if (err) {
      Alert.alert("Missing Info", err);
      return;
    }

    try {
      setIsPaying(true);

      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth?.user;
      if (!authUser) throw new Error("Not logged in");

      const { data: appUser, error: appUserErr } = await supabase
        .from("users")
        .select(
          "user_id, role, user_details_id, users_details:users_details(branch_id)",
        )
        .eq("auth_user_id", authUser.id)
        .eq("role", "member")
        .maybeSingle();
      if (appUserErr) {
        throw new Error(
          `Unable to read user record: ${appUserErr.message || appUserErr}`,
        );
      }
      if (!appUser) {
        throw new Error("No member role found for this account.");
      }

      const branchId = pickBranchId(appUser.users_details);

      const payment_method_types = paymongoTypesForWallet(selectedWallet!);

      // PayMongo requires HTTPS return URLs. For mobile (Expo Go), use a web URL
      // that can deep-link back into the app (e.g., your domain with a redirect).
      const webReturnBase =
        process.env.EXPO_PUBLIC_WEB_BASE_URL ||
        process.env.EXPO_PUBLIC_SITE_URL ||
        "";

      const buildReturnUrl = (status: "success" | "cancel") => {
        if (webReturnBase) {
          return `${webReturnBase}/Member-User/giving-result?status=${status}`;
        }
        return Linking.createURL("/Member-User/giving-result", {
          queryParams: { status },
        });
      };

      const successUrl = buildReturnUrl("success");
      const cancelUrl = buildReturnUrl("cancel");

      const payload = {
        amount_php: amountNum,
        wallet: selectedWallet,
        donor_note_key: donorNoteKey,
        donor_note_label: donorNoteLabel,
        payment_method_types,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          app_user_id: appUser.user_id,
          branch_id: branchId,
          // add anything else you need for your webhook/records
        },
      };

      const { data, error } = await supabase.functions.invoke(
        "create_paymongo_checkout",
        {
          body: payload,
        },
      );

      if (error) {
        let detailsMsg = "";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.clone === "function") {
            const parsed = await ctx.clone().json().catch(() => null);
            if (parsed) {
              detailsMsg =
                parsed?.error ||
                parsed?.message ||
                parsed?.details ||
                JSON.stringify(parsed);
            } else {
              const text = await ctx.clone().text().catch(() => "");
              detailsMsg = text;
            }
          } else if (ctx?._bodyInit?._data || ctx?._bodyBlob?._data) {
            const raw =
              ctx?._bodyInit?._data ??
              ctx?._bodyBlob?._data ??
              "";
            const rawText =
              typeof raw === "string"
                ? raw
                : raw?.text
                  ? String(raw.text)
                  : JSON.stringify(raw);
            const parsed =
              typeof rawText === "string" ? JSON.parse(rawText) : rawText;
            detailsMsg =
              parsed?.error ||
              parsed?.message ||
              parsed?.details ||
              JSON.stringify(parsed);
          } else {
            const rawBody = (error as any)?.context?.body;
            if (rawBody) {
              const parsed =
                typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
              detailsMsg =
                parsed?.error ||
                parsed?.message ||
                parsed?.details ||
                JSON.stringify(parsed);
            }
          }
        } catch {}

        const status = (error as any)?.context?.status;
        console.error("❌ create_paymongo_checkout error:", {
          status,
          context: (error as any)?.context,
          error,
        });

        Alert.alert(
          "Checkout Failed",
          detailsMsg ||
            (status ? `Server error (${status}).` : "") ||
            "Unable to start checkout. If this keeps failing, try another payment method.",
        );
        return;
      }

      const checkoutUrl = data?.checkout_url || data?.url || data?.checkoutUrl;
      if (!checkoutUrl) {
        console.error("âŒ Missing checkout_url in response:", data);
        Alert.alert(
          "Checkout Failed",
          "Checkout URL not returned by the server.",
        );
        return;
      }

      // Close the review modal before redirect
      setShowConfirmationModal(false);

      // Open PayMongo checkout
      const returnUrl = Linking.createURL("/Member-User/giving-result");
      if (Platform.OS === "web") {
        window.location.assign(checkoutUrl);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(
          checkoutUrl,
          returnUrl,
        );
        if (result.type === "success" && result.url) {
          router.replace({
            pathname: "/Member-User/giving-result",
            params: { url: result.url },
          });
        }
      }
    } catch (e: any) {
      console.error("âŒ startPaymongoCheckout failed:", e);
      Alert.alert(
        "Error",
        e?.message || "Something went wrong while starting checkout.",
      );
    } finally {
      setIsPaying(false);
    }
  };

  const handleSubmit = () => {
    const err = validateForm();
    if (err) {
      Alert.alert("Missing Info", err);
      return;
    }
    // Show â€œReview & Payâ€ modal
    setShowConfirmationModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}
        </View>

        <Text style={styles.headerTitle}>Giving</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/Member-User/profile")}
          >
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

        {/* Payment method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.walletRow}>
            <TouchableOpacity
              style={[
                styles.walletChip,
                styles.walletChipLogo,
                selectedWallet === "Maya" && {
                  borderColor: primary,
                  backgroundColor: `${primary}15`,
                },
              ]}
              onPress={() => setSelectedWallet("Maya")}
              activeOpacity={0.85}
            >
              <MayaIcon width={70} height={26} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.walletChip,
                styles.walletChipLogo,
                selectedWallet === "GCash" && {
                  borderColor: primary,
                  backgroundColor: `${primary}15`,
                },
              ]}
              onPress={() => setSelectedWallet("GCash")}
              activeOpacity={0.85}
            >
              <GcashIcon width={70} height={26} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick giving */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Giving</Text>
          <View style={styles.quickGivingButtons}>
            {["₱100", "₱500", "₱1,000", "Other"].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.quickGiveBtn,
                  {
                    borderColor:
                      selectedQuickAmount === amount ? primary : secondary,
                    backgroundColor:
                      selectedQuickAmount === amount ? primary : "#fff",
                  },
                ]}
                onPress={() => handleQuickGive(amount)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.quickGiveText,
                    {
                      color:
                        selectedQuickAmount === amount ? "#fff" : secondary,
                    },
                  ]}
                >
                  {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Donor Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donor Note</Text>
          <View style={styles.donorNoteRow}>
            {donorNoteOptions.map((opt) => {
              const active = donorNoteKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.donorNoteChip,
                    active && {
                      borderColor: primary,
                      backgroundColor: `${primary}15`,
                    },
                  ]}
                  onPress={() => setDonorNoteKey(opt.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.donorNoteText,
                      active && { color: primary, fontWeight: "700" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Amount */}
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

        {/* Submit */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: primary }]}
            activeOpacity={0.9}
            onPress={handleSubmit}
            disabled={isPaying}
          >
            {isPaying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Proceed to Payment</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Review & Pay Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View
              style={[
                styles.confirmIconBox,
                { backgroundColor: `${primary}20` },
              ]}
            >
              <Ionicons name="card-outline" size={54} color={primary} />
            </View>

            <Text style={styles.confirmTitle}>Review Your Giving</Text>

            <Text style={styles.confirmMessage}>
              Amount: ₱{amountNum.toFixed(2)} {"\n"}
              Payment Method: {selectedWallet} {"\n"}
              Donor Note: {donorNoteLabel}
            </Text>

            <Text style={[styles.confirmSubMessage, { marginTop: 6 }]}>
              You will be redirected to PayMongo to complete payment.
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                width: "100%",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: "#ccc",
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                  },
                ]}
                onPress={() => setShowConfirmationModal(false)}
                disabled={isPaying}
              >
                <Text
                  style={{
                    fontWeight: "700",
                    color: "#333",
                    textAlign: "center",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: primary,
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                  },
                ]}
                onPress={startPaymongoCheckout}
                disabled={isPaying}
              >
                {isPaying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Pay Now</Text>
                )}
              </TouchableOpacity>
            </View>
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
  walletChipLogo: {
    justifyContent: "center",
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
  secondaryBtn: {
    borderWidth: 1.5,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  quickGivingButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  donorNoteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  donorNoteChip: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
  },
  donorNoteText: {
    fontSize: 12,
    color: "#333",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f8ff",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#d0e8ff",
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#333",
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "85%",
    maxHeight: "70%",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
  },
  confirmModalContent: {
    backgroundColor: "#fff",
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
  },
  confirmSubMessage: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
});
