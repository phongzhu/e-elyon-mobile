// app/index.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Image, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";
import { supabase } from "../src/lib/supabaseClient";

const { width, height } = Dimensions.get("window");

export default function Index() {
  const [branding, setBranding] = useState<any>(null);

  // Fetch UI branding
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ui_settings").select("*").single();
      if (error) console.error("❌ Branding fetch error:", error);
      else {
        console.log("✅ Branding loaded:", data);
        setBranding(data);
      }
    })();
  }, []);

  // Dynamic colors from branding
  const primary = branding?.primary_color || "#064622";
  const secondary = branding?.primary_color || "#319658";
  const tertiary = branding?.tertiary_color || "#7ac29d";
  const logo = branding?.logo_icon
    ? `${branding.logo_icon.startsWith("http") ? branding.logo_icon : `${supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl}`}`
    : null;
  const systemName = branding?.system_name || "E-ELYON";
  const description = branding?.description || "Connecting Faith • Empowering Service";

  // Core animations
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const particlesOpacity = useSharedValue(0);
  const particlesY = useSharedValue(50);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const ringScale1 = useSharedValue(0);
  const ringScale2 = useSharedValue(0);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    const connect = async () => {
      const { error } = await supabase.from("branches").select("*").limit(1);
      if (error) console.error("❌ Supabase error:", error);
      else console.log("✅ Supabase connected!");
    };
    connect();

    // Logo entrance
    logoScale.value = withDelay(
      400,
      withSequence(
        withTiming(1.2, { duration: 700, easing: Easing.out(Easing.back(1.8)) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) })
      )
    );
    
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 700 }));

    // Subtle glow pulse
    glowPulse.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Subtle rings
    ringScale1.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );

    ringScale2.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );

    // Floating particles
    particlesOpacity.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 3000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    particlesY.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(-30, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
          withTiming(50, { duration: 3500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Text animation
    textOpacity.value = withDelay(1200, withTiming(1, { duration: 800 }));
    textTranslateY.value = withDelay(
      1200,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    // Fade out before navigation
    const fadeTimer = setTimeout(() => {
      fadeOut.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) });
    }, 5400);

    const timer = setTimeout(() => router.replace("/login"), 6000);
    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
    };
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value * 0.4,
    transform: [{ scale: 1 + glowPulse.value * 0.1 }],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale1.value }],
    opacity: interpolate(ringScale1.value, [0.5, 1.5, 2.5], [0, 0.3, 0]),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale2.value }],
    opacity: interpolate(ringScale2.value, [0.5, 1.5, 2.5], [0, 0.25, 0]),
  }));

  const particleAnimStyle = useAnimatedStyle(() => ({
    opacity: particlesOpacity.value,
    transform: [{ translateY: particlesY.value }],
  }));

  const fadeOutStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
  }));

  return (
    <Animated.View
      style={[
        fadeOutStyle,
        {
          flex: 1,
          backgroundColor: "#000000",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        },
      ]}
    >
      {/* Simple gradient background */}
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={primary} stopOpacity="0.15" />
            <Stop offset="50%" stopColor="#000000" stopOpacity="1" />
            <Stop offset="100%" stopColor={secondary} stopOpacity="0.15" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#bgGradient)" />
      </Svg>

      {/* Subtle expanding rings */}
      <Animated.View style={[ring1Style, { position: "absolute" }]}>
        <Svg width={280} height={280}>
          <Circle cx={140} cy={140} r={100} stroke={primary} strokeWidth="2" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View style={[ring2Style, { position: "absolute" }]}>
        <Svg width={280} height={280}>
          <Circle cx={140} cy={140} r={100} stroke={secondary} strokeWidth="2" fill="none" />
        </Svg>
      </Animated.View>

      {/* Subtle glow */}
      <Animated.View style={[glowStyle, { position: "absolute" }]}>
        <Svg width={300} height={300}>
          <Defs>
            <LinearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={primary} stopOpacity="0.3" />
              <Stop offset="50%" stopColor={secondary} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={tertiary} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Circle cx={150} cy={150} r={100} fill="url(#glowGradient)" />
        </Svg>
      </Animated.View>

      {/* Floating particles */}
      <Animated.View style={[particleAnimStyle, { position: "absolute" }]}>
        <Svg width={width} height={height}>
          {/* Left side particles */}
          <Circle cx={width * 0.15} cy={height * 0.3} r={3} fill={primary} opacity={0.7} />
          <Circle cx={width * 0.12} cy={height * 0.5} r={2} fill={secondary} opacity={0.6} />
          <Circle cx={width * 0.18} cy={height * 0.7} r={2.5} fill={tertiary} opacity={0.65} />
          
          {/* Right side particles */}
          <Circle cx={width * 0.85} cy={height * 0.35} r={3} fill={secondary} opacity={0.7} />
          <Circle cx={width * 0.88} cy={height * 0.55} r={2} fill={primary} opacity={0.6} />
          <Circle cx={width * 0.82} cy={height * 0.75} r={2.5} fill={tertiary} opacity={0.65} />
          
          {/* Top particles */}
          <Circle cx={width * 0.4} cy={height * 0.15} r={2} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={width * 0.6} cy={height * 0.18} r={2} fill="#FFFFFF" opacity={0.5} />
          
          {/* Bottom particles */}
          <Circle cx={width * 0.35} cy={height * 0.85} r={2} fill={primary} opacity={0.6} />
          <Circle cx={width * 0.65} cy={height * 0.88} r={2} fill={secondary} opacity={0.6} />
        </Svg>
      </Animated.View>

      {/* Logo with hexagon shape */}
      <Animated.View style={[logoAnimStyle]}>
        <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
          {/* Hexagon shape */}
          <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient id="hexBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={primary} />
                <Stop offset="50%" stopColor={secondary} />
                <Stop offset="100%" stopColor={tertiary} />
              </LinearGradient>
              <LinearGradient id="hexFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={primary} stopOpacity="0.15" />
                <Stop offset="50%" stopColor={secondary} stopOpacity="0.2" />
                <Stop offset="100%" stopColor={tertiary} stopOpacity="0.15" />
              </LinearGradient>
              <ClipPath id="hexClip">
                <Polygon points="110,25 185,67.5 185,152.5 110,195 35,152.5 35,67.5" />
              </ClipPath>
            </Defs>
            
            {/* Main hexagon */}
            <Polygon
              points="110,15 195,65 195,155 110,205 25,155 25,65"
              fill="url(#hexFill)"
              stroke="url(#hexBorder)"
              strokeWidth="3"
            />
            
            {/* Inner hexagon for depth */}
            <Polygon
              points="110,30 180,72.5 180,147.5 110,190 40,147.5 40,72.5"
              fill="none"
              stroke="url(#hexBorder)"
              strokeWidth="1.5"
              opacity={0.4}
            />
          </Svg>
          
          {/* Logo image clipped to hexagon */}
          {logo && (
            <Svg width={220} height={220} viewBox="0 0 220 220" style={{ position: "absolute" }}>
              <Defs>
                <ClipPath id="logoHexClip">
                  <Polygon points="110,25 185,67.5 185,152.5 110,195 35,152.5 35,67.5" />
                </ClipPath>
              </Defs>
              <Image
                href={logo}
                x="35"
                y="25"
                width="150"
                height="170"
                clipPath="url(#logoHexClip)"
                preserveAspectRatio="xMidYMid slice"
              />
            </Svg>
          )}
        </View>
      </Animated.View>

      {/* Brand name - clean and minimal */}
      <Animated.View style={[textAnimStyle, { position: "absolute", top: height * 0.62, alignItems: "center" }]}>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 48,
            fontWeight: "700",
            letterSpacing: 6,
            textShadowColor: `${primary}66`,
            textShadowOffset: { width: 0, height: 3 },
            textShadowRadius: 12,
          }}
        >
          {systemName.toUpperCase()}
        </Text>
      </Animated.View>

      {/* Tagline - minimal styling */}
      <Animated.View style={[textAnimStyle, { position: "absolute", top: height * 0.7, alignItems: "center", paddingHorizontal: 40 }]}>
        <Text
          style={{
            color: "#B8B8B8",
            fontSize: 13,
            letterSpacing: 2,
            fontWeight: "400",
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}