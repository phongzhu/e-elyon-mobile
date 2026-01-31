import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../src/lib/supabaseClient";

type Receipt = {
  transaction_id: number;
  donation_id: number | null;
  amount: number | null;
  transaction_date: string | null;
  status: string | null;
  notes: string | null;
};

export default function GivingResultScreen() {
  const params = useLocalSearchParams();
  const statusParam = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const txParam = Array.isArray(params.transaction_id)
    ? params.transaction_id[0]
    : params.transaction_id;
  const donationParam = Array.isArray(params.donation_id)
    ? params.donation_id[0]
    : params.donation_id;
  const urlParam = Array.isArray(params.url) ? params.url[0] : params.url;
  const parsedUrl = urlParam ? Linking.parse(String(urlParam)) : null;
  const parsedParams = parsedUrl?.queryParams ?? {};

  const pickParam = (value: unknown, fallback: unknown) => {
    const v = Array.isArray(value) ? value[0] : value;
    return v ?? fallback;
  };

  const status = String(
    pickParam(statusParam, parsedParams.status ?? "unknown"),
  )
    .toLowerCase()
    .trim();
  const txIdRaw = pickParam(txParam, parsedParams.transaction_id);
  const donationIdRaw = pickParam(donationParam, parsedParams.donation_id);
  const txId = txIdRaw ? Number(txIdRaw) : null;
  const donationId = donationIdRaw ? Number(donationIdRaw) : null;

  const [updateState, setUpdateState] = useState<
    "idle" | "updating" | "done" | "error"
  >("idle");
  const [branding, setBranding] = useState<any>(null);
  const [receiptState, setReceiptState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const isSuccess = status === "success";
  const title = isSuccess ? "Payment Successful" : "Payment Not Completed";
  const message = isSuccess
    ? "Thank you! Your giving was received."
    : "Your payment did not complete. You can try again.";

  const iconName = isSuccess ? "checkmark-circle" : "close-circle";
  const iconColor = isSuccess ? "#2e7d32" : "#c62828";

  const buttonText = isSuccess ? "Back to Giving" : "Try Again";
  const onPress = () => {
    if (isSuccess) {
      router.replace("/Member-User/giving");
    } else {
      router.replace("/Member-User/give-online");
    }
  };

  const statusNote = useMemo(() => {
    if (status === "cancel") return "Status: Cancelled";
    if (status === "dismiss") return "Status: Dismissed";
    if (status === "success") {
      if (updateState === "updating") return "Status: Completing...";
      if (updateState === "done") return "Status: Completed";
      if (updateState === "error") return "Status: Completed (sync failed)";
      return "Status: Completed";
    }
    return "Status: Unknown";
  }, [status, updateState]);

  const primary = branding?.primary_color || "#064622";

  useEffect(() => {
    const run = async () => {
      if (!isSuccess || !txId || updateState !== "idle") return;
      setUpdateState("updating");
      const { error } = await supabase.functions.invoke(
        "mark_transaction_completed",
        { body: { transaction_id: txId } },
      );
      if (error) {
        console.error("update transaction status failed:", error);
        setUpdateState("error");
      } else {
        setUpdateState("done");
      }
    };
    run();
  }, [isSuccess, txId, updateState]);

  useEffect(() => {
    const loadReceipt = async () => {
      if (!isSuccess || !txId || receiptState !== "idle") return;
      setReceiptState("loading");
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "transaction_id, donation_id, amount, transaction_date, status, notes",
        )
        .eq("transaction_id", txId)
        .maybeSingle();
      if (error) {
        console.error("receipt fetch error:", error);
        setReceiptState("error");
        return;
      }
      if (data) {
        setReceipt(data as Receipt);
        setReceiptState("done");
      } else {
        setReceiptState("error");
      }
    };
    loadReceipt();
  }, [isSuccess, txId, receiptState]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name={iconName} size={64} color={iconColor} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.status}>{statusNote}</Text>
        {isSuccess ? (
          <View style={styles.receiptBox}>
            <Text style={styles.receiptTitle}>Receipt</Text>
            <Text style={styles.receiptRow}>Transaction ID: {txId ?? "-"}</Text>
            <Text style={styles.receiptRow}>
              Donation ID: {donationId ?? receipt?.donation_id ?? "-"}
            </Text>
            <Text style={styles.receiptRow}>
              Amount:{" "}
              {receipt?.amount != null
                ? `PHP ${Number(receipt.amount).toFixed(2)}`
                : "-"}
            </Text>
            <Text style={styles.receiptRow}>
              Status: {receipt?.status ?? "completed"}
            </Text>
            <Text style={styles.receiptRow}>
              Date:{" "}
              {receipt?.transaction_date
                ? new Date(receipt.transaction_date).toLocaleString()
                : "-"}
            </Text>
            {receiptState === "loading" ? (
              <Text style={styles.receiptHint}>Loading receipt...</Text>
            ) : receiptState === "error" ? (
              <Text style={styles.receiptHint}>Receipt not available yet.</Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: primary }]}
          onPress={onPress}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  status: {
    marginTop: 6,
    fontSize: 12,
    color: "#777",
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  receiptBox: {
    width: "100%",
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginBottom: 6,
  },
  receiptRow: {
    fontSize: 12,
    color: "#444",
    marginTop: 4,
  },
  receiptHint: {
    marginTop: 8,
    fontSize: 11,
    color: "#888",
  },
});
