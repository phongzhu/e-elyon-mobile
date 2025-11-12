 
import { Picker } from "@react-native-picker/picker";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { OAUTH_REDIRECT_URL, supabase } from "../src/lib/supabaseClient";

export default function Signup() {
  const [stage, setStage] = useState<"auth" | "details">("auth");

  // Auth stage
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Details stage
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [gender, setGender] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ branch_id: number; name: string }[]>([]);

  const suffixOptions = ["", "Jr.", "Sr.", "II", "III", "IV"];
  const genderOptions = ["Male", "Female"];

  // ✅ Load branches from Supabase
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("branch_id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching branches:", error);
      } else {
        setBranches(data || []);
      }
    };

    if (stage === "details") fetchBranches();
  }, [stage]);

  // ✅ Step 1: Email/password signup
  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    const memberEmail = email.includes("_member")
      ? email
      : email.replace("@", "_member@");

    const { error } = await supabase.auth.signUp({
      email: memberEmail,
      password,
      options: { data: { role: "MEMBER" } },
    });

    if (error) {
      Alert.alert("Signup failed", error.message);
    } else {
      Alert.alert(
        "Verify Email",
        "A verification link has been sent to your email. Once verified, please complete your account details."
      );
      setStage("details");
    }
  };

  // ✅ Step 1 (alternative): Google OAuth signup
  const handleGoogleSignup = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ensure Supabase redirects back to the app after OAuth
        redirectTo: OAUTH_REDIRECT_URL,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      Alert.alert("Google Sign-up Failed", error.message);
      return;
    }

    // Open the OAuth URL in the system browser so the user can authenticate
    if (data?.url) {
      try {
        await Linking.openURL(data.url);
      } catch {
        // Fallback: show URL so developer can open it manually
        Alert.alert("Open browser failed", data.url);
      }
    }
  };

  // ✅ Step 2: Insert user details
  const handleDetailsSubmit = async () => {
    if (!firstName || !lastName || !gender || !branchId) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        Alert.alert("Error", "User not authenticated.");
        return;
      }

      const { error } = await supabase.from("users_details").insert([
        {
          branch_id: branchId,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          suffix: suffix || null,
          gender,
          contact_number: contactNumber || null,
          status: "ACTIVE",
        },
      ]);

      if (error) throw error;

      Alert.alert("Success!", "Account details saved successfully.");
      router.replace("/login");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  // ======================================================
  // RENDER: Account Details Form
  // ======================================================
  if (stage === "details") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: "#0B6516", padding: 20 }}
        contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
      >
        <Text style={styles.header}>Account Setup</Text>

        {/* Branch Dropdown */}
        <View style={styles.dropdown}>
          <Picker
            selectedValue={branchId}
            onValueChange={(v: any) =>
              setBranchId(v === null || v === undefined ? null : Number(v))
            }
            style={{ color: "black" }}
          >
            <Picker.Item label="Select Branch" value={null} />
            {branches.map((b) => (
              <Picker.Item key={b.branch_id} label={b.name} value={b.branch_id} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="First Name"
          placeholderTextColor="#ccc"
          style={styles.input}
          onChangeText={setFirstName}
          value={firstName}
        />
        <TextInput
          placeholder="Middle Name"
          placeholderTextColor="#ccc"
          style={styles.input}
          onChangeText={setMiddleName}
          value={middleName}
        />
        <TextInput
          placeholder="Last Name"
          placeholderTextColor="#ccc"
          style={styles.input}
          onChangeText={setLastName}
          value={lastName}
        />

        {/* Suffix */}
        <View style={styles.dropdown}>
          <Picker
            selectedValue={suffix}
            onValueChange={(v: any) => setSuffix(String(v))}
            style={{ color: "black" }}
          >
            {suffixOptions.map((opt) => (
              <Picker.Item key={opt} label={opt || "Select Suffix"} value={opt} />
            ))}
          </Picker>
        </View>

        {/* Gender */}
        <View style={styles.dropdown}>
          <Picker
            selectedValue={gender}
            onValueChange={(v: any) => setGender(String(v))}
            style={{ color: "black" }}
          >
            <Picker.Item label="Select Gender" value="" />
            {genderOptions.map((g) => (
              <Picker.Item key={g} label={g} value={g} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="Contact Number"
          placeholderTextColor="#ccc"
          style={styles.input}
          onChangeText={setContactNumber}
          value={contactNumber}
          keyboardType="phone-pad"
        />

        <TouchableOpacity style={styles.redBtn} onPress={handleDetailsSubmit}>
          <Text style={styles.btnText}>Save Details</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ======================================================
  // RENDER: Signup Stage
  // ======================================================
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create Account</Text>

      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignup}>
        <Text style={styles.btnText}>Sign up with Google</Text>
      </TouchableOpacity>

      <Text style={{ color: "white", marginVertical: 16 }}>— OR —</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#ccc"
        style={styles.input}
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#ccc"
        secureTextEntry
        style={styles.input}
        onChangeText={setPassword}
        value={password}
      />
      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#ccc"
        secureTextEntry
        style={styles.input}
        onChangeText={setConfirmPassword}
        value={confirmPassword}
      />

      <TouchableOpacity style={styles.redBtn} onPress={handleSignup}>
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={{ color: "white", marginTop: 20 }}>
          Already have an account?{" "}
          <Text style={{ color: "#FFDCDC", fontWeight: "700" }}>Log in here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ======================================================
// Styles
// ======================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B6516",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    color: "white",
    fontSize: 28,
    fontWeight: "800" as any,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dropdown: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 12,
  },
  redBtn: {
    width: "100%",
    backgroundColor: "#9C0808",
    padding: 14,
    borderRadius: 8,
    alignItems: "center" as any,
    marginTop: 10,
  },
  googleBtn: {
    width: "100%",
    backgroundColor: "#DB4437",
    padding: 14,
    borderRadius: 8,
    alignItems: "center" as any,
  },
  btnText: {
    color: "white",
    fontWeight: "600" as any,
    fontSize: 16,
  },
}) as any;
