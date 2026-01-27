import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image as RNImage,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import philippineAddresses from "../src/data/philippine_provinces_cities_municipalities_and_barangays_2019v2.json";
import { supabase } from "../src/lib/supabaseClient";

const { width, height } = Dimensions.get("window");

// Philippine phone number formatter
const formatPhilippinePhone = (value: string) => {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    digits = digits.slice(0, 12);
  } else if (digits.startsWith("9")) {
    digits = "63" + digits.slice(0, 10);
  } else if (digits.startsWith("0")) {
    digits = "63" + digits.slice(1, 11);
  } else {
    digits = digits.slice(0, 12);
  }

  if (digits.startsWith("63")) {
    if (digits[2] === "9") {
      return (
        "+" +
        digits.slice(0, 2) +
        " " +
        digits.slice(2, 5) +
        " " +
        digits.slice(5, 8) +
        " " +
        digits.slice(8, 12)
      );
    }
  }
  return "+" + digits;
};

export default function Signup() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [stage, setStage] = useState<
    "auth" | "otp" | "credentials" | "address"
  >("auth");
  const [branding, setBranding] = useState<any>(null);

  // Auth stage
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");

  // Credentials stage
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [suffixOpen, setSuffixOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [baptismalDate, setBaptismalDate] = useState("");
  const [gender, setGender] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchOpen, setBranchOpen] = useState(false);
  const [contactNumber, setContactNumber] = useState("");
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [showBaptismalDatePicker, setShowBaptismalDatePicker] = useState(false);
  const [branches, setBranches] = useState<
    { branch_id: number; name: string }[]
  >([]);

  // Address stage
  const [street, setStreet] = useState("");
  const [region, setRegion] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [province, setProvince] = useState("");
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [barangay, setBarangay] = useState("");
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [activeAddressDropdown, setActiveAddressDropdown] = useState<
    "region" | "province" | "city" | "barangay" | null
  >(null);

  // Derived address data from philippine_provinces_cities_municipalities_and_barangays_2019v2.json
  const regionOptions = Object.entries(philippineAddresses)
    .map(([key, value]: [string, any]) => ({
      label: value.region_name || key,
      value: key,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const provinceOptions =
    region && (philippineAddresses as any)[region]
      ? Object.keys((philippineAddresses as any)[region].province_list)
          .map((provinceName: string) => ({
            label: provinceName,
            value: provinceName,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : [];

  const cityOptions =
    province &&
    region &&
    (philippineAddresses as any)[region]?.province_list?.[province]
      ? Object.keys(
          (philippineAddresses as any)[region].province_list[province]
            .municipality_list,
        )
          .map((cityName: string) => ({
            label: cityName,
            value: cityName,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : [];

  const barangayOptions =
    region &&
    province &&
    city &&
    (philippineAddresses as any)[region]?.province_list?.[province]
      ?.municipality_list?.[city]?.barangay_list
      ? (philippineAddresses as any)[region].province_list[
          province
        ].municipality_list[city].barangay_list
          .map((b: string) => ({
            label: b,
            value: b,
          }))
          .sort((a: any, b: any) => a.label.localeCompare(b.label))
      : [];

  // Reset province/city/barangay when region changes
  useEffect(() => {
    if (region) {
      setProvince("");
      setCity("");
      setBarangay("");
    }
  }, [region]);

  // Reset dependent fields when province changes
  useEffect(() => {
    if (province) {
      setCity("");
      setBarangay("");
    }
  }, [province]);

  // Reset barangay when city changes
  useEffect(() => {
    if (city) {
      setBarangay("");
    }
  }, [city]);

  const [isLoading, setIsLoading] = useState(false);
  const otpRefs = React.useRef<(TextInput | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  // Fetch branding
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ui_settings")
        .select("*")
        .single();
      if (error) console.error("❌ Branding fetch error:", error);
      else setBranding(data);
    })();
  }, []);

  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.secondary_color || "#319658";
  const tertiary = branding?.tertiary_color || "#7ac29d";
  const systemName = branding?.system_name || "E-ELYON";
  const logo = branding?.logo_icon
    ? branding.logo_icon.startsWith("http")
      ? branding.logo_icon
      : supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data
          .publicUrl
    : null;

  // Animations
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(50);

  useEffect(() => {
    formOpacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    formTranslateY.value = withTiming(0, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [stage]);

  // ✅ Load branches from Supabase
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("branch_id, name");

      if (error) {
        console.error("Error fetching branches:", error);
      } else {
        setBranches((data as { branch_id: number; name: string }[]) || []);
      }
    };

    if (stage === "credentials") fetchBranches();
  }, [stage]);

  const formAnimStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

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

    setIsLoading(true);

    // Send 6-digit OTP to email (and create user if not existing)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    setIsLoading(false);

    if (error) {
      Alert.alert("Failed to send code", error.message);
      return;
    }

    setOtp(""); // clear old input
    setStage("otp");
  };

  // ✅ Step 2: Submit OTP
  const handleOTPSubmit = () => {
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      Alert.alert("Invalid OTP", "Please enter a valid 6-digit OTP.");
      return;
    }

    setIsLoading(true);

    // Verify OTP with Supabase
    supabase.auth
      .verifyOtp({
        email,
        token: otp,
        type: "email",
      })
      .then(async ({ data, error }) => {
        if (error) {
          setIsLoading(false);
          Alert.alert("OTP Failed", error.message);
          return;
        }

        // Set password after OTP verification
        const { error: pwError } = await supabase.auth.updateUser({
          password,
        });

        setIsLoading(false);

        if (pwError) {
          Alert.alert("Password Setup Failed", pwError.message);
          return;
        }

        setStage("credentials");
      });
  };

  // Resend OTP handler
  const handleResendOTP = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setIsLoading(false);

    if (error) Alert.alert("Resend failed", error.message);
    else Alert.alert("Sent", `A new code was sent to ${email}`);
  };

  // ✅ Step 3: Submit credentials
  const handleCredentialsSubmit = async () => {
    if (
      !firstName ||
      !lastName ||
      !gender ||
      !birthDate ||
      !contactNumber ||
      !branchId
    ) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }
    setStage("address");
  };

  // ✅ Step 4: Submit address and complete signup
  const handleAddressSubmit = () => {
    if (!street || !region || !city || !province) {
      Alert.alert("Missing Fields", "Please fill out all address fields.");
      return;
    }

    setIsLoading(true);
    (async () => {
      try {
        let photo_path: string | null = null;

        // ✅ Get the authenticated Supabase user UUID (auth.users.id) BEFORE inserts (RLS)
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr) {
          setIsLoading(false);
          Alert.alert(
            "Error",
            authErr.message || "Unable to read authenticated user.",
          );
          return;
        }

        const auth_user_id = authData?.user?.id;
        if (!auth_user_id) {
          setIsLoading(false);
          Alert.alert(
            "Error",
            "No authenticated user found. Verify OTP again.",
          );
          return;
        }

        // Upload profile image if selected
        if (profileImage) {
          try {
            setProfileImageUploading(true);

            const fileName = `${email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.jpg`;
            const objectKey = `profile_pics/${fileName}`;
            const res = await fetch(profileImage);
            const arrayBuffer = await res.arrayBuffer();

            const { error: uploadError } = await supabase.storage
              .from("profile_pics")
              .upload(objectKey, arrayBuffer, {
                contentType: "image/jpeg",
                upsert: true,
              });

            setProfileImageUploading(false);

            if (uploadError) {
              Alert.alert("Image Upload Failed", uploadError.message);
              return;
            }

            const { data: publicUrlData } = supabase.storage
              .from("profile_pics")
              .getPublicUrl(objectKey);

            photo_path = publicUrlData?.publicUrl ?? null;
          } catch (imgErr: any) {
            setProfileImageUploading(false);
            Alert.alert(
              "Image Upload Error",
              imgErr?.message || "Failed to upload image.",
            );
            return;
          }
        }

        // Prepare _member email
        const memberEmail = email.endsWith(".com")
          ? email.replace(".com", ".com_member")
          : email + "_member";

        // 1) Insert into users FIRST (user_details_id is nullable)
        const { data: insertedUser, error: usersInsertErr } = await supabase
          .from("users")
          .insert([
            {
              user_details_id: null,
              email: memberEmail,
              role: "member",
              is_active: true,
              auth_user_id,
            },
          ])
          .select("user_id")
          .single();

        if (usersInsertErr) {
          setIsLoading(false);
          Alert.alert(
            "Users insert failed",
            usersInsertErr.message || "Failed to save user.",
          );
          return;
        }

        const newUserId = insertedUser?.user_id;
        if (!newUserId) {
          setIsLoading(false);
          Alert.alert("Error", "User ID not returned.");
          return;
        }

        // 2) Insert into users_details, set joined_date to today
        const today = new Date().toISOString().split("T")[0];
        const { data: detailsData, error: detailsError } = await supabase
          .from("users_details")
          .insert([
            {
              auth_user_id, // ✅ required by RLS
              branch_id: branchId,
              first_name: firstName,
              middle_name: middleName || null,
              last_name: lastName,
              suffix: suffix || null,
              birthdate: birthDate,
              baptismal_date: baptismalDate || null,
              gender: gender,
              street,
              region,
              barangay: barangay || null,
              city,
              province,
              contact_number: contactNumber,
              photo_path,
              joined_date: today,
            },
          ])
          .select("user_details_id")
          .single();

        if (detailsError) {
          setIsLoading(false);
          Alert.alert(
            "Details insert failed",
            detailsError.message || "Failed to save user details.",
          );
          return;
        }

        const user_details_id = detailsData?.user_details_id;
        if (!user_details_id) {
          setIsLoading(false);
          Alert.alert("Error", "User details ID not returned.");
          return;
        }

        // 3) Update users.user_details_id
        const { error: usersUpdateErr } = await supabase
          .from("users")
          .update({ user_details_id })
          .eq("user_id", newUserId);

        if (usersUpdateErr) {
          setIsLoading(false);
          Alert.alert(
            "Users update failed",
            usersUpdateErr.message || "Failed to link user details.",
          );
          return;
        }

        router.replace("/login");
      } catch (err: any) {
        Alert.alert(
          "Unexpected Error",
          err?.message || "Something went wrong.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const renderAuthStage = () => (
    <Animated.View style={[formAnimStyle, { width: "100%", maxWidth: 420 }]}>
      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        EMAIL ADDRESS
      </Text>
      <View style={{ position: "relative", marginBottom: 20 }}>
        <Ionicons
          name="mail-outline"
          size={20}
          color={emailFocused ? primary : "#707070"}
          style={{ position: "absolute", left: 16, top: 18, zIndex: 1 }}
        />
        <TextInput
          placeholder="Enter your email"
          placeholderTextColor="#707070"
          style={{
            backgroundColor: emailFocused
              ? "rgba(255,255,255,1)"
              : "rgba(255,255,255,0.95)",
            borderRadius: 14,
            paddingVertical: 18,
            paddingLeft: 48,
            paddingRight: 16,
            fontSize: 15,
            borderWidth: 2,
            color: "#0a1612",
            borderColor: emailFocused ? primary : "rgba(11,101,22,0.2)",
            shadowColor: emailFocused ? primary : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: emailFocused ? 4 : 0,
          }}
          onChangeText={setEmail}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
        />
      </View>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        PASSWORD
      </Text>
      <View style={{ position: "relative", marginBottom: 20 }}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={passwordFocused ? primary : "#707070"}
          style={{ position: "absolute", left: 16, top: 18, zIndex: 1 }}
        />
        <TextInput
          placeholder="Enter your password"
          placeholderTextColor="#707070"
          style={{
            backgroundColor: passwordFocused
              ? "rgba(255,255,255,1)"
              : "rgba(255,255,255,0.95)",
            borderRadius: 14,
            paddingVertical: 18,
            paddingLeft: 48,
            paddingRight: 50,
            fontSize: 15,
            borderWidth: 2,
            color: "#0a1612",
            borderColor: passwordFocused ? primary : "rgba(11,101,22,0.2)",
            shadowColor: passwordFocused ? primary : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: passwordFocused ? 4 : 0,
          }}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={!showPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={{ position: "absolute", right: 16, top: 18, zIndex: 1 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={passwordFocused ? primary : "#707070"}
          />
        </TouchableOpacity>
      </View>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        CONFIRM PASSWORD
      </Text>
      <View style={{ position: "relative", marginBottom: 28 }}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={confirmPasswordFocused ? primary : "#707070"}
          style={{ position: "absolute", left: 16, top: 18, zIndex: 1 }}
        />
        <TextInput
          placeholder="Confirm your password"
          placeholderTextColor="#707070"
          style={{
            backgroundColor: confirmPasswordFocused
              ? "rgba(255,255,255,1)"
              : "rgba(255,255,255,0.95)",
            borderRadius: 14,
            paddingVertical: 18,
            paddingLeft: 48,
            paddingRight: 50,
            fontSize: 15,
            borderWidth: 2,
            color: "#0a1612",
            borderColor: confirmPasswordFocused
              ? primary
              : "rgba(11,101,22,0.2)",
            shadowColor: confirmPasswordFocused ? primary : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: confirmPasswordFocused ? 4 : 0,
          }}
          onChangeText={setConfirmPassword}
          value={confirmPassword}
          secureTextEntry={!showConfirmPassword}
          onFocus={() => setConfirmPasswordFocused(true)}
          onBlur={() => setConfirmPasswordFocused(false)}
        />
        <TouchableOpacity
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          style={{ position: "absolute", right: 16, top: 18, zIndex: 1 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
            size={22}
            color={confirmPasswordFocused ? primary : "#707070"}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleSignup}
        disabled={isLoading}
        style={{
          backgroundColor: isLoading ? "#555" : secondary,
          padding: 19,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 24,
          shadowColor: secondary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
            letterSpacing: 1.5,
          }}
        >
          {isLoading ? "CREATING ACCOUNT..." : "CONTINUE"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/login")}
        style={{ alignItems: "center", marginTop: 28 }}
      >
        <Text style={{ color: "#CCCCCC", fontSize: 14 }}>
          Already have an account?{" "}
          <Text
            style={{ color: secondary, fontWeight: "700", letterSpacing: 0.5 }}
          >
            Log in here
          </Text>
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const pickProfileImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access media library is required!",
      );
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (
      !pickerResult.canceled &&
      pickerResult.assets &&
      pickerResult.assets.length > 0
    ) {
      setProfileImage(pickerResult.assets[0].uri);
    }
  };

  const renderCredentialsStage = () => (
    <Animated.View style={[formAnimStyle, { width: "100%", maxWidth: 420 }]}>
      {/* Profile Picture Picker */}
      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        PROFILE PICTURE
      </Text>
      <TouchableOpacity
        onPress={pickProfileImage}
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
        disabled={profileImageUploading}
      >
        {profileImage ? (
          <View style={{ alignItems: "center" }}>
            <RNImage
              source={{ uri: profileImage }}
              style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: "#ccc",
              }}
              resizeMode="cover"
            />
            <Text style={{ color: "#888", fontSize: 12 }}>Change Photo</Text>
          </View>
        ) : (
          <View
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: "#e0e0e0",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              borderWidth: 2,
              borderColor: "#ccc",
            }}
          >
            <Ionicons name="camera-outline" size={32} color="#888" />
          </View>
        )}
      </TouchableOpacity>
      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        FIRST NAME *
      </Text>
      <TextInput
        placeholder="Enter your first name"
        placeholderTextColor="#707070"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 15,
          borderWidth: 2,
          color: "#0a1612",
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
        }}
        onChangeText={setFirstName}
        value={firstName}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        MIDDLE NAME
      </Text>
      <TextInput
        placeholder="Enter your middle name"
        placeholderTextColor="#707070"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 15,
          borderWidth: 2,
          color: "#0a1612",
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
        }}
        onChangeText={setMiddleName}
        value={middleName}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        LAST NAME *
      </Text>
      <TextInput
        placeholder="Enter your last name"
        placeholderTextColor="#707070"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 15,
          borderWidth: 2,
          color: "#0a1612",
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
        }}
        onChangeText={setLastName}
        value={lastName}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        SUFFIX
      </Text>
      <DropDownPicker
        open={suffixOpen}
        setOpen={setSuffixOpen}
        value={suffix}
        setValue={(callback) => {
          setSuffix((prev) => callback(prev));
        }}
        items={["", "Jr.", "Sr.", "II", "III", "IV"].map((v) => ({
          label: v || "Select Suffix",
          value: v,
        }))}
        listMode="SCROLLVIEW"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          paddingVertical: 2,
        }}
        textStyle={{ color: "#0a1612", fontSize: 15 }}
        dropDownContainerStyle={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          borderRadius: 12,
        }}
        containerStyle={{ marginBottom: 16 }}
        onOpen={() => setGenderOpen(false)}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        BIRTH DATE *
      </Text>
      <TouchableOpacity
        onPress={() => setShowBirthDatePicker(true)}
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: birthDate ? "#0a1612" : "#707070",
            fontSize: 15,
            fontWeight: "500",
          }}
        >
          {birthDate
            ? new Date(birthDate).toLocaleDateString()
            : "Select birth date"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={primary} />
      </TouchableOpacity>

      {showBirthDatePicker && (
        <DateTimePicker
          value={birthDate ? new Date(birthDate) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(event: any, selectedDate?: Date) => {
            if (event.type === "set" && selectedDate) {
              setBirthDate(selectedDate.toISOString().split("T")[0]);
            }
            setShowBirthDatePicker(false);
          }}
        />
      )}

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        BAPTISMAL DATE (Optional - Leave blank if not baptised at EECM)
      </Text>
      <TouchableOpacity
        onPress={() => setShowBaptismalDatePicker(true)}
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: baptismalDate ? "#0a1612" : "#707070",
            fontSize: 15,
            fontWeight: "500",
          }}
        >
          {baptismalDate
            ? new Date(baptismalDate).toLocaleDateString()
            : "Select baptismal date"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={primary} />
      </TouchableOpacity>

      {showBaptismalDatePicker && (
        <DateTimePicker
          value={baptismalDate ? new Date(baptismalDate) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(event: any, selectedDate?: Date) => {
            if (event.type === "set" && selectedDate) {
              setBaptismalDate(selectedDate.toISOString().split("T")[0]);
            }
            setShowBaptismalDatePicker(false);
          }}
        />
      )}

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        BRANCH (STREET-BASED) *
      </Text>
      <DropDownPicker
        open={branchOpen}
        setOpen={setBranchOpen}
        value={branchId}
        setValue={(callback) => {
          const next = callback(branchId) as number | null;
          setBranchId(next);
          const match = branches.find((b) => b.branch_id === next);
          setBranchName(match?.name || "");
        }}
        items={branches.map((b) => ({
          label: b.name || "Branch name not set",
          value: b.branch_id,
        }))}
        placeholder={
          branches.length ? "Select branch you attend" : "Loading branches..."
        }
        listMode="SCROLLVIEW"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          paddingVertical: 2,
        }}
        textStyle={{ color: "#0a1612", fontSize: 15 }}
        dropDownContainerStyle={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          borderRadius: 12,
        }}
        containerStyle={{ marginBottom: 24, zIndex: 5000 }}
        onOpen={() => {
          setSuffixOpen(false);
          setGenderOpen(false);
        }}
      />
      {branchName ? (
        <Text
          style={{
            color: "#4f5d4f",
            fontSize: 12,
            marginTop: -12,
            marginBottom: 22,
          }}
        >
          Selected branch: {branchName}
        </Text>
      ) : null}

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        GENDER *
      </Text>
      <DropDownPicker
        open={genderOpen}
        setOpen={setGenderOpen}
        value={gender}
        setValue={(callback) => {
          setGender((prev) => callback(prev));
        }}
        items={["Male", "Female"].map((v) => ({ label: v, value: v }))}
        listMode="SCROLLVIEW"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          paddingVertical: 2,
        }}
        textStyle={{ color: "#0a1612", fontSize: 15 }}
        dropDownContainerStyle={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderWidth: 2,
          borderColor: "rgba(11,101,22,0.2)",
          borderRadius: 12,
        }}
        containerStyle={{ marginBottom: 16 }}
        onOpen={() => setSuffixOpen(false)}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        CONTACT NUMBER *
      </Text>
      <TextInput
        placeholder="+63 9XX XXX XXXX"
        placeholderTextColor="#707070"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 15,
          borderWidth: 2,
          color: "#0a1612",
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 24,
        }}
        onChangeText={(text) => setContactNumber(formatPhilippinePhone(text))}
        value={contactNumber}
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        onPress={handleCredentialsSubmit}
        disabled={isLoading}
        style={{
          backgroundColor: isLoading ? "#555" : secondary,
          padding: 19,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 12,
          shadowColor: secondary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
            letterSpacing: 1.5,
          }}
        >
          CONTINUE
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setStage("auth")}
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
            letterSpacing: 1,
          }}
        >
          BACK
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAddressStage = () => (
    <Animated.View style={[formAnimStyle, { width: "100%", maxWidth: 420 }]}>
      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        STREET ADDRESS *
      </Text>
      <TextInput
        placeholder="Enter street address"
        placeholderTextColor="#707070"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 15,
          borderWidth: 2,
          color: "#0a1612",
          borderColor: "rgba(11,101,22,0.2)",
          marginBottom: 16,
        }}
        onChangeText={setStreet}
        value={street}
      />

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        REGION *
      </Text>
      <View
        style={{
          zIndex: activeAddressDropdown === "region" ? 5000 : 4000,
          marginBottom: 16,
        }}
      >
        <DropDownPicker
          open={regionOpen}
          setOpen={setRegionOpen}
          value={region}
          setValue={(callback) => {
            setRegion((prev) => callback(prev));
          }}
          items={regionOptions}
          placeholder="Select Region"
          listMode="SCROLLVIEW"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            paddingVertical: 2,
          }}
          textStyle={{ color: "#0a1612", fontSize: 15 }}
          dropDownContainerStyle={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            borderRadius: 12,
          }}
          onOpen={() => {
            setActiveAddressDropdown("region");
            setProvinceOpen(false);
            setCityOpen(false);
            setBarangayOpen(false);
          }}
          onClose={() => {
            setActiveAddressDropdown(null);
          }}
        />
      </View>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        PROVINCE *
      </Text>
      <View
        style={{
          zIndex: activeAddressDropdown === "province" ? 5000 : 1000,
          marginBottom: 16,
        }}
      >
        <DropDownPicker
          open={provinceOpen}
          setOpen={setProvinceOpen}
          value={province}
          setValue={(callback) => {
            setProvince((prev) => callback(prev));
          }}
          items={provinceOptions}
          disabled={!region}
          placeholder={!region ? "Select a region first" : "Select Province"}
          listMode="SCROLLVIEW"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            borderWidth: 2,
            borderColor: region ? "rgba(11,101,22,0.2)" : "rgba(200,0,0,0.3)",
            paddingVertical: 2,
          }}
          textStyle={{ color: "#0a1612", fontSize: 15 }}
          labelStyle={{ color: "#0a1612", fontSize: 15 }}
          dropDownContainerStyle={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            borderRadius: 12,
          }}
          onOpen={() => {
            setActiveAddressDropdown("province");
            setRegionOpen(false);
            setCityOpen(false);
            setBarangayOpen(false);
          }}
          onClose={() => {
            setActiveAddressDropdown(null);
          }}
        />
      </View>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        CITY *
      </Text>
      <View
        style={{
          zIndex: activeAddressDropdown === "city" ? 5000 : 500,
          marginBottom: 16,
        }}
      >
        <DropDownPicker
          open={cityOpen}
          setOpen={setCityOpen}
          value={city}
          setValue={(callback) => {
            setCity((prev) => callback(prev));
          }}
          items={cityOptions}
          disabled={!province}
          placeholder="Select City"
          listMode="SCROLLVIEW"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            paddingVertical: 2,
          }}
          textStyle={{ color: "#0a1612", fontSize: 15 }}
          dropDownContainerStyle={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            borderRadius: 12,
          }}
          onOpen={() => {
            setActiveAddressDropdown("city");
            setRegionOpen(false);
            setProvinceOpen(false);
            setBarangayOpen(false);
          }}
          onClose={() => {
            setActiveAddressDropdown(null);
          }}
        />
      </View>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 10,
          letterSpacing: 1.2,
        }}
      >
        BARANGAY
      </Text>
      <View
        style={{
          zIndex: activeAddressDropdown === "barangay" ? 5000 : 3000,
          marginBottom: 16,
        }}
      >
        <DropDownPicker
          open={barangayOpen}
          setOpen={setBarangayOpen}
          value={barangay}
          setValue={(callback) => {
            setBarangay((prev) => callback(prev));
          }}
          items={barangayOptions}
          disabled={!city}
          placeholder="Select Barangay"
          listMode="SCROLLVIEW"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: 14,
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            paddingVertical: 2,
          }}
          textStyle={{ color: "#0a1612", fontSize: 15 }}
          dropDownContainerStyle={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderWidth: 2,
            borderColor: "rgba(11,101,22,0.2)",
            borderRadius: 12,
          }}
          onOpen={() => {
            setActiveAddressDropdown("barangay");
            setRegionOpen(false);
            setProvinceOpen(false);
            setCityOpen(false);
          }}
          onClose={() => {
            setActiveAddressDropdown(null);
          }}
        />
      </View>

      <TouchableOpacity
        onPress={handleAddressSubmit}
        disabled={isLoading}
        style={{
          backgroundColor: isLoading ? "#555" : secondary,
          padding: 19,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 12,
          shadowColor: secondary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
            letterSpacing: 1.5,
          }}
        >
          {isLoading ? "COMPLETING..." : "COMPLETE SIGNUP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setStage("credentials")}
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
            letterSpacing: 1,
          }}
        >
          BACK
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderOTPStage = () => (
    <Animated.View
      style={[
        formAnimStyle,
        { width: "100%", maxWidth: 420, alignItems: "center" },
      ]}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Email Verification
      </Text>
      <Text
        style={{
          color: "#B0B0B0",
          fontSize: 14,
          marginBottom: 32,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        A 6-digit OTP has been sent to {email}. Please enter it below to
        continue.
      </Text>

      <Text
        style={{
          color: "#C8C8C8",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 20,
          letterSpacing: 1.2,
        }}
      >
        OTP CODE *
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginBottom: 28,
          gap: 8,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) otpRefs.current[index] = ref;
            }}
            placeholder="0"
            placeholderTextColor="#B0B0B0"
            style={{
              width: 50,
              height: 60,
              backgroundColor: "rgba(255,255,255,0.95)",
              borderRadius: 12,
              borderWidth: 2,
              borderColor: otp[index] ? primary : "rgba(11,101,22,0.2)",
              fontSize: 24,
              fontWeight: "700",
              color: "#0a1612",
              textAlign: "center",
              shadowColor: otp[index] ? primary : "transparent",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: otp[index] ? 2 : 0,
            }}
            onChangeText={(text) => {
              const digits = otp.split("");
              digits[index] = text.replace(/[^0-9]/g, "").slice(0, 1);
              setOtp(digits.join(""));

              // Auto-focus to next box if digit entered
              if (text && index < 5) {
                otpRefs.current[index + 1]?.focus();
              }
              // Auto-focus to previous box if deleted
              if (!text && index > 0) {
                otpRefs.current[index - 1]?.focus();
              }
            }}
            value={otp[index] || ""}
            keyboardType="numeric"
            maxLength={1}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={handleOTPSubmit}
        disabled={otp.length !== 6 || isLoading}
        style={{
          backgroundColor: otp.length === 6 ? secondary : "#999",
          padding: 19,
          borderRadius: 14,
          alignItems: "center",
          width: "100%",
          marginBottom: 12,
          shadowColor: secondary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
            letterSpacing: 1.5,
          }}
        >
          {isLoading ? "VERIFYING..." : "SUBMIT OTP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResendOTP}
        disabled={isLoading}
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          width: "100%",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: secondary,
            fontWeight: "700",
            fontSize: 14,
            letterSpacing: 1,
          }}
        >
          RESEND CODE
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setStage("auth")}
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          width: "100%",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.2)",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "700",
            fontSize: 14,
            letterSpacing: 1,
          }}
        >
          BACK
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0a1612",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
            minHeight: height,
          }}
        >
          {/* Background gradient */}
          <Svg width={width} height={height} style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient
                id="bgGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor={primary} stopOpacity="0.25" />
                <Stop offset="30%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="70%" stopColor="#0a1612" stopOpacity="0.95" />
                <Stop offset="100%" stopColor={secondary} stopOpacity="0.25" />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill="url(#bgGradient)" />
          </Svg>

          {/* Header */}
          <View style={{ marginBottom: 40, alignItems: "center" }}>
            {/* Logo Section with Diamond Border */}
            {logo ? (
              <View
                style={{
                  width: 100,
                  height: 100,
                  justifyContent: "center",
                  alignItems: "center",
                  transform: [{ rotate: "45deg" }],
                  marginBottom: 16,
                }}
              >
                <Svg
                  width={100}
                  height={100}
                  viewBox="0 0 200 200"
                  style={{ position: "absolute" }}
                >
                  <Defs>
                    <LinearGradient
                      id="diamondBorderGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#FFFFFF"
                        stopOpacity="0.95"
                      />
                      <Stop
                        offset="25%"
                        stopColor={tertiary}
                        stopOpacity="0.95"
                      />
                      <Stop
                        offset="50%"
                        stopColor={secondary}
                        stopOpacity="0.95"
                      />
                      <Stop offset="75%" stopColor={primary} stopOpacity="1" />
                      <Stop
                        offset="100%"
                        stopColor="#FFFFFF"
                        stopOpacity="0.8"
                      />
                    </LinearGradient>
                  </Defs>
                  <Path
                    d="M 100 10 L 190 100 L 100 190 L 10 100 Z"
                    stroke="url(#diamondBorderGrad)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <View
                  style={{
                    width: 70,
                    height: 70,
                    overflow: "hidden",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: [{ rotate: "-45deg" }],
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                  }}
                >
                  <RNImage
                    source={{ uri: logo }}
                    style={{ width: 60, height: 60, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                </View>
              </View>
            ) : null}

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 36,
                fontWeight: "800",
                letterSpacing: 4,
                textShadowColor: `${primary}dd`,
                textShadowOffset: { width: 0, height: 4 },
                textShadowRadius: 12,
              }}
            >
              {systemName}
            </Text>
            <Text
              style={{
                color: "#B0B0B0",
                fontSize: 12,
                marginTop: 8,
                letterSpacing: 2.5,
                fontWeight: "500",
              }}
            >
              {stage === "auth"
                ? "CREATE ACCOUNT"
                : stage === "credentials"
                  ? "YOUR DETAILS"
                  : stage === "address"
                    ? "ADDRESS DETAILS"
                    : "VERIFY EMAIL"}
            </Text>
          </View>

          {/* Dynamic Stage Rendering */}
          {stage === "auth" && renderAuthStage()}
          {stage === "credentials" && renderCredentialsStage()}
          {stage === "address" && renderAddressStage()}
          {stage === "otp" && renderOTPStage()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
