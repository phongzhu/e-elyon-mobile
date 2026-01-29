import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MemberNavbar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const navItems = [
    { name: "Home", icon: "home", route: "/Member-User/Member-Dashboard" },
    { name: "Events", icon: "calendar", route: "/Member-User/events" },
    { name: "Giving", icon: "cash-outline", route: "/Member-User/giving" },
    { name: "Ministry", icon: "people", route: "/Member-User/ministry" },
    { name: "Profile", icon: "person", route: "/Member-User/profile" },
  ];

  const isActive = (route: string) => pathname === route;

  return (
    <View style={[styles.navbar, { paddingBottom: 12 + insets.bottom }]}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.name}
          onPress={() => router.push(item.route as any)}
          style={styles.navItem}
        >
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
