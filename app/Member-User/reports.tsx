import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabaseClient";
import MemberNavbar from "./member-navbar";

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [branding, setBranding] = useState<any>(null);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [showAnnualModal, setShowAnnualModal] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";

  // Mock financial data for transparency
  const monthlyFinancials = {
    income: [
      { category: "Tithes", amount: 185000, percentage: 65 },
      { category: "General Offerings", amount: 45000, percentage: 16 },
      { category: "Special Donations", amount: 32000, percentage: 11 },
      { category: "Ministry Contributions", amount: 18000, percentage: 6 },
      { category: "Other Income", amount: 5000, percentage: 2 },
    ],
    expenses: [
      { category: "Staff Salaries & Benefits", amount: 115000, percentage: 42 },
      { category: "Facilities & Utilities", amount: 48000, percentage: 18 },
      { category: "Missions & Outreach", amount: 35000, percentage: 13 },
      { category: "Ministry Programs", amount: 32000, percentage: 12 },
      { category: "Operations & Admin", amount: 25000, percentage: 9 },
      { category: "Maintenance & Repairs", amount: 16000, percentage: 6 },
    ],
    totalIncome: 285000,
    totalExpenses: 271000,
    netBalance: 14000,
  };

  const annualSummary = {
    year: 2024,
    quarters: [
      { quarter: "Q1", income: 820000, expenses: 780000, net: 40000 },
      { quarter: "Q2", income: 865000, expenses: 815000, net: 50000 },
      { quarter: "Q3", income: 890000, expenses: 835000, net: 55000 },
      { quarter: "Q4", income: 925000, expenses: 870000, net: 55000 },
    ],
    totalIncome: 3500000,
    totalExpenses: 3300000,
    netSurplus: 200000,
    reserves: 450000,
    projects: [
      { name: "Church Building Renovation", allocated: 120000, spent: 95000 },
      { name: "Community Outreach Programs", allocated: 80000, spent: 78000 },
      { name: "Youth Ministry Expansion", allocated: 50000, spent: 42000 },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          styles.header,
          { backgroundColor: primary, paddingTop: insets.top },
        ]}
      >
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/Member-User/reports")}>
            <Ionicons name="document-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Financial Transparency Header */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Transparency</Text>
          <Text style={styles.sectionSubtitle}>
            View how your contributions support church activities.
          </Text>
        </View>

        {/* Contribution Cards */}
        <View style={styles.cardsSection}>
          {/* Total Contributions */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#f5e6d3" }]}>
              <View style={styles.churchImagePlaceholder}>
                  <Ionicons name="storefront" size={40} color={secondary} />
                </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Total Contributions</Text>
              <Text style={styles.cardSubLabel}>(My Giving)</Text>
              <Text style={[styles.cardAmount, { color: secondary }]}>₱2,500</Text>
            </View>
          </View>

          {/* Total Church Funds */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#fffaf0" }]}>
              <View style={styles.churchImagePlaceholder}>
                <Ionicons name="business" size={40} color={primary} />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Total Church Funds</Text>
              <Text style={styles.cardSubLabel}>Collected</Text>
              <Text style={[styles.cardAmount, { color: primary }]}>₱12,500</Text>
            </View>
          </View>

          {/* Special Projects */}
          <View style={styles.cardItem}>
            <View style={[styles.cardImage, { backgroundColor: "#e8f4e8" }]}>
              <View style={styles.churchImagePlaceholder}>
                <Ionicons name="construct" size={40} color="#28a745" />
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>Special Projects</Text>
              <Text style={styles.cardSubLabel}>Spent</Text>
              <Text style={[styles.cardAmount, { color: "#28a745" }]}>₱4,200</Text>
            </View>
          </View>
        </View>

        {/* Report Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Categories</Text>
          
          <TouchableOpacity style={styles.reportItem} onPress={() => setShowFinancialModal(true)}>
            <View style={styles.reportIcon}>
              <Ionicons name="document-text" size={24} color={primary} />
            </View>
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Church Financial Reports</Text>
              <Text style={styles.reportDescription}>Detailed breakdown of all church finances</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportItem} onPress={() => setShowAnnualModal(true)}>
            <View style={styles.reportIcon}>
              <Ionicons name="calendar" size={24} color={primary} />
            </View>
            <View style={styles.reportContent}>
              <Text style={styles.reportTitle}>Annual Financial Summary</Text>
              <Text style={styles.reportDescription}>Year-end financial performance and impact</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Financial Report Modal */}
      <Modal
        visible={showFinancialModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFinancialModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Monthly Financial Report</Text>
              <TouchableOpacity onPress={() => setShowFinancialModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Summary Cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: `${secondary}15` }]}>
                  <Text style={styles.summaryLabel}>Total Income</Text>
                  <Text style={[styles.summaryAmount, { color: secondary }]}>₱{monthlyFinancials.totalIncome.toLocaleString()}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: `${primary}15` }]}>
                  <Text style={styles.summaryLabel}>Total Expenses</Text>
                  <Text style={[styles.summaryAmount, { color: primary }]}>₱{monthlyFinancials.totalExpenses.toLocaleString()}</Text>
                </View>
              </View>
              <View style={[styles.netBalanceCard, { backgroundColor: monthlyFinancials.netBalance >= 0 ? '#e8f5e9' : '#ffebee' }]}>
                <Text style={styles.summaryLabel}>Net Balance</Text>
                <Text style={[styles.summaryAmount, { color: monthlyFinancials.netBalance >= 0 ? '#2e7d32' : '#c62828' }]}>₱{monthlyFinancials.netBalance.toLocaleString()}</Text>
              </View>

              {/* Income Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Income Sources</Text>
                {monthlyFinancials.income.map((item, idx) => (
                  <View key={idx} style={styles.financialItem}>
                    <View style={styles.financialItemHeader}>
                      <Text style={styles.financialCategory}>{item.category}</Text>
                      <Text style={[styles.financialAmount, { color: secondary }]}>₱{item.amount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${item.percentage}%`, backgroundColor: secondary }]} />
                    </View>
                    <Text style={styles.percentageText}>{item.percentage}% of total income</Text>
                  </View>
                ))}
              </View>

              {/* Expense Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Expense Categories</Text>
                {monthlyFinancials.expenses.map((item, idx) => (
                  <View key={idx} style={styles.financialItem}>
                    <View style={styles.financialItemHeader}>
                      <Text style={styles.financialCategory}>{item.category}</Text>
                      <Text style={[styles.financialAmount, { color: primary }]}>₱{item.amount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${item.percentage}%`, backgroundColor: primary }]} />
                    </View>
                    <Text style={styles.percentageText}>{item.percentage}% of total expenses</Text>
                  </View>
                ))}
              </View>

              <View style={styles.disclaimer}>
                <Ionicons name="information-circle-outline" size={18} color="#666" />
                <Text style={styles.disclaimerText}>All figures are for the current month and subject to review.</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Annual Summary Modal */}
      <Modal
        visible={showAnnualModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnualModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Annual Financial Summary {annualSummary.year}</Text>
              <TouchableOpacity onPress={() => setShowAnnualModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Annual Overview */}
              <View style={styles.annualOverview}>
                <View style={[styles.annualCard, { backgroundColor: `${secondary}15` }]}>
                  <Ionicons name="trending-up" size={28} color={secondary} />
                  <Text style={styles.annualLabel}>Total Income</Text>
                  <Text style={[styles.annualAmount, { color: secondary }]}>₱{annualSummary.totalIncome.toLocaleString()}</Text>
                </View>
                <View style={[styles.annualCard, { backgroundColor: `${primary}15` }]}>
                  <Ionicons name="trending-down" size={28} color={primary} />
                  <Text style={styles.annualLabel}>Total Expenses</Text>
                  <Text style={[styles.annualAmount, { color: primary }]}>₱{annualSummary.totalExpenses.toLocaleString()}</Text>
                </View>
                <View style={[styles.annualCard, { backgroundColor: '#e8f5e9' }]}>
                  <Ionicons name="wallet" size={28} color="#2e7d32" />
                  <Text style={styles.annualLabel}>Net Surplus</Text>
                  <Text style={[styles.annualAmount, { color: '#2e7d32' }]}>₱{annualSummary.netSurplus.toLocaleString()}</Text>
                </View>
                <View style={[styles.annualCard, { backgroundColor: '#fff3e0' }]}>
                  <Ionicons name="shield-checkmark" size={28} color="#f57c00" />
                  <Text style={styles.annualLabel}>Reserves</Text>
                  <Text style={[styles.annualAmount, { color: '#f57c00' }]}>₱{annualSummary.reserves.toLocaleString()}</Text>
                </View>
              </View>

              {/* Quarterly Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Quarterly Performance</Text>
                {annualSummary.quarters.map((q, idx) => (
                  <View key={idx} style={styles.quarterCard}>
                    <View style={styles.quarterHeader}>
                      <Text style={styles.quarterLabel}>{q.quarter}</Text>
                      <Text style={[styles.quarterNet, { color: q.net >= 0 ? '#2e7d32' : '#c62828' }]}>
                        {q.net >= 0 ? '+' : ''}₱{q.net.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.quarterRow}>
                      <View style={styles.quarterItem}>
                        <Text style={styles.quarterItemLabel}>Income</Text>
                        <Text style={[styles.quarterItemValue, { color: secondary }]}>₱{q.income.toLocaleString()}</Text>
                      </View>
                      <View style={styles.quarterItem}>
                        <Text style={styles.quarterItemLabel}>Expenses</Text>
                        <Text style={[styles.quarterItemValue, { color: primary }]}>₱{q.expenses.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Special Projects */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Special Projects Allocation</Text>
                {annualSummary.projects.map((project, idx) => (
                  <View key={idx} style={styles.projectCard}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <View style={styles.projectRow}>
                      <View style={styles.projectItem}>
                        <Text style={styles.projectLabel}>Allocated</Text>
                        <Text style={styles.projectValue}>₱{project.allocated.toLocaleString()}</Text>
                      </View>
                      <View style={styles.projectItem}>
                        <Text style={styles.projectLabel}>Spent</Text>
                        <Text style={[styles.projectValue, { color: secondary }]}>₱{project.spent.toLocaleString()}</Text>
                      </View>
                      <View style={styles.projectItem}>
                        <Text style={styles.projectLabel}>Remaining</Text>
                        <Text style={[styles.projectValue, { color: '#2e7d32' }]}>₱{(project.allocated - project.spent).toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${(project.spent / project.allocated * 100)}%`, backgroundColor: secondary }]} />
                    </View>
                    <Text style={styles.percentageText}>{Math.round(project.spent / project.allocated * 100)}% utilized</Text>
                  </View>
                ))}
              </View>

              <View style={styles.disclaimer}>
                <Ionicons name="information-circle-outline" size={18} color="#666" />
                <Text style={styles.disclaimerText}>Annual report covers January to December {annualSummary.year}. Audited by certified accountants.</Text>
              </View>
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  cardsSection: {
    marginVertical: 12,
  },
  cardItem: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardImage: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  churchImagePlaceholder: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 2,
  },
  cardSubLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 12,
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "800",
  },
  netBalanceCard: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  breakdownSection: {
    marginTop: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },
  financialItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
  },
  financialItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  financialCategory: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },
  financialAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 11,
    color: "#888",
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  annualOverview: {
    marginTop: 16,
    gap: 12,
  },
  annualCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  annualLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  annualAmount: {
    fontSize: 20,
    fontWeight: "800",
  },
  quarterCard: {
    padding: 14,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 10,
  },
  quarterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  quarterLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
  },
  quarterNet: {
    fontSize: 16,
    fontWeight: "800",
  },
  quarterRow: {
    flexDirection: "row",
    gap: 12,
  },
  quarterItem: {
    flex: 1,
  },
  quarterItemLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
  },
  quarterItemValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  projectCard: {
    padding: 14,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 12,
  },
  projectName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    marginBottom: 10,
  },
  projectRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  projectItem: {
    flex: 1,
  },
  projectLabel: {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
  },
  projectValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },
});
