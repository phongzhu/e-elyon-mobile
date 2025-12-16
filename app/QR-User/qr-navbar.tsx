import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function QRNavbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Attendance Records", icon: "list-outline", route: "/QR-User/attendance-records" },
    { name: "Dashboard", icon: "home", route: "/QR-User/QR-Dashboard" },
  ];

  const isActive = (route: string) => pathname === route;

  return (
    <View style={styles.navbar}>
      {navItems.map((item) => (
        <Link key={item.name} href={item.route as any} asChild>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons
              name={item.icon as any}
              size={28}
              color={isActive(item.route) ? "#064622" : "#999"}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isActive(item.route) ? "#064622" : "#999" },
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingVertical: 12,
    paddingBottom: 20,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
  },
});
