// app/index.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, Text, View } from "react-native";
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
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
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
  const secondary = branding?.secondary_color || "#319658";
  const tertiary = branding?.tertiary_color || "#7ac29d";
  const logo = branding?.logo_icon
    ? `${branding.logo_icon.startsWith("http") ? branding.logo_icon : `${supabase.storage.from("logos").getPublicUrl(branding.logo_icon).data.publicUrl}`}`
    : null;
  const systemName = branding?.system_name || "E-ELYON";
  const description = branding?.description || "Connecting Faith • Empowering Service";

  // Core animations
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(360);
  const glowPulse = useSharedValue(0);
  const particlesOpacity = useSharedValue(0);
  const particlesY = useSharedValue(50);
  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.8);
  const ringScale1 = useSharedValue(0);
  const ringScale2 = useSharedValue(0);
  const ringScale3 = useSharedValue(0);
  const ringScale4 = useSharedValue(0);
  const crossBeams = useSharedValue(0);
  const energyWave = useSharedValue(0);
  const backgroundPulse = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const orbitRotation = useSharedValue(0);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    const connect = async () => {
      const { error } = await supabase.from("branches").select("*").limit(1);
      if (error) console.error("❌ Supabase error:", error);
      else console.log("✅ Supabase connected!");
    };
    connect();

    // Logo dramatic entrance with smoother elastic bounce
    logoScale.value = withDelay(
      400,
      withSequence(
        withTiming(1.35, { duration: 800, easing: Easing.out(Easing.back(2.5)) }),
        withTiming(0.92, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.05, { duration: 250, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) })
      )
    );
    
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    
    logoRotate.value = withDelay(
      400,
      withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );

    // Smoother pulsing glow effect
    glowPulse.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Shimmer effect for logo
    shimmer.value = withDelay(
      1000,
      withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      )
    );

    // Orbital rotation
    orbitRotation.value = withDelay(
      800,
      withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      )
    );

    // Energy rings expanding with stagger
    ringScale1.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(3.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );

    ringScale2.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(3.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );

    ringScale3.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(3.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );

    ringScale4.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(3.5, { duration: 2500, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );

    // Softer cross light beams
    crossBeams.value = withDelay(
      900,
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
        withTiming(0.6, { duration: 500, easing: Easing.inOut(Easing.ease) })
      )
    );

    // Continuous energy wave
    energyWave.value = withDelay(
      700,
      withRepeat(
        withTiming(1, { duration: 3500, easing: Easing.linear }),
        -1,
        false
      )
    );

    // Smoother floating particles
    particlesOpacity.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 3000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    particlesY.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(-40, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
          withTiming(50, { duration: 3500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Text with smoother scale and opacity
    textOpacity.value = withDelay(1300, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));
    textScale.value = withDelay(
      1300,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.back(1.2)) })
    );

    // Subtle background pulse
    backgroundPulse.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Fade out animation before navigation
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
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` }
    ],
    opacity: logoOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value * 0.7,
    transform: [{ scale: 1 + glowPulse.value * 0.15 }],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ scale: textScale.value }],
  }));

  const particleAnimStyle = useAnimatedStyle(() => ({
    opacity: particlesOpacity.value,
    transform: [{ translateY: particlesY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale1.value }],
    opacity: interpolate(ringScale1.value, [0, 1, 3.5], [0, 0.7, 0]),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale2.value }],
    opacity: interpolate(ringScale2.value, [0, 1, 3.5], [0, 0.6, 0]),
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale3.value }],
    opacity: interpolate(ringScale3.value, [0, 1, 3.5], [0, 0.5, 0]),
  }));

  const ring4Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale4.value }],
    opacity: interpolate(ringScale4.value, [0, 1, 3.5], [0, 0.4, 0]),
  }));

  const beamsStyle = useAnimatedStyle(() => ({
    opacity: crossBeams.value,
  }));

  const waveStyle = useAnimatedStyle(() => {
    const translateX = interpolate(energyWave.value, [0, 1], [-width, width]);
    return {
      transform: [{ translateX }],
      opacity: interpolate(energyWave.value, [0, 0.5, 1], [0, 0.6, 0]),
    };
  });

  const bgPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backgroundPulse.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.2, 0.5, 0.2]),
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotation.value}deg` }],
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
      {/* Animated gradient background with vignette */}
      <Animated.View style={[bgPulseStyle, { position: "absolute", width: width * 1.3, height: height * 1.3 }]}>
        <Svg width={width * 1.3} height={height * 1.3}>
          <Defs>
            <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={primary} stopOpacity="1" />
              <Stop offset="25%" stopColor="#0a0a0a" stopOpacity="0.98" />
              <Stop offset="50%" stopColor="#141414" stopOpacity="0.95" />
              <Stop offset="75%" stopColor="#0a0a0a" stopOpacity="0.98" />
              <Stop offset="100%" stopColor={secondary} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="vignette" x1="50%" y1="50%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect width={width * 1.3} height={height * 1.3} fill="url(#bgGradient)" />
          <Rect width={width * 1.3} height={height * 1.3} fill="url(#vignette)" />
        </Svg>
      </Animated.View>

      {/* Energy wave sweep */}
      <Animated.View style={[waveStyle, { position: "absolute", width: width * 0.4, height }]}>
        <Svg width={width * 0.4} height={height}>
          <Defs>
            <LinearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={primary} stopOpacity="0" />
              <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <Stop offset="70%" stopColor={secondary} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={tertiary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width={width * 0.4} height={height} fill="url(#waveGradient)" />
        </Svg>
      </Animated.View>

      {/* Orbital particles - subtle */}
      <Animated.View style={[orbitStyle, { position: "absolute", width: 350, height: 350 }]}>
        <Svg width={350} height={350}>
          <Circle cx={175} cy={40} r={3} fill={primary} opacity={0.6} />
          <Circle cx={310} cy={175} r={2.5} fill={secondary} opacity={0.6} />
          <Circle cx={175} cy={310} r={3} fill={tertiary} opacity={0.6} />
          <Circle cx={40} cy={175} r={2.5} fill="#FFFFFF" opacity={0.5} />
        </Svg>
      </Animated.View>

      {/* Expanding energy rings - reduced quantity */}
      <Animated.View style={[ring1Style, { position: "absolute" }]}>
        <Svg width={300} height={300}>
          <Circle cx={150} cy={150} r={100} stroke={primary} strokeWidth="3" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View style={[ring2Style, { position: "absolute" }]}>
        <Svg width={300} height={300}>
          <Circle cx={150} cy={150} r={100} stroke={secondary} strokeWidth="2.5" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View style={[ring3Style, { position: "absolute" }]}>
        <Svg width={300} height={300}>
          <Circle cx={150} cy={150} r={100} stroke={tertiary} strokeWidth="2" fill="none" />
        </Svg>
      </Animated.View>

      {/* Enhanced central glow - simplified */}
      <Animated.View style={[glowStyle, { position: "absolute" }]}>
        <Svg width={450} height={450}>
          <Defs>
            <LinearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={primary} stopOpacity="0.4" />
              <Stop offset="50%" stopColor={secondary} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={tertiary} stopOpacity="0.3" />
            </LinearGradient>
          </Defs>
          <Circle cx={225} cy={225} r={130} fill="url(#glowGradient)" />
          <Circle cx={225} cy={225} r={80} fill="url(#glowGradient)" opacity={0.6} />
        </Svg>
      </Animated.View>

      {/* Softer light beams */}
      <Animated.View style={[beamsStyle, { position: "absolute" }]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {/* Vertical beam */}
          <Rect x={width / 2 - 30} y={0} width={60} height={height} fill="url(#beamGradient)" />
          {/* Horizontal beam */}
          <Rect x={0} y={height / 2 - 30} width={width} height={60} fill="url(#beamGradient)" transform={`rotate(90 ${width / 2} ${height / 2})`} />
        </Svg>
      </Animated.View>

      {/* Shimmer effect over logo - subtle */}
      <Animated.View style={[shimmerStyle, { position: "absolute" }]}>
        <Svg width={250} height={250}>
          <Defs>
            <LinearGradient id="shimmerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Circle cx={125} cy={125} r={100} fill="url(#shimmerGrad)" />
        </Svg>
      </Animated.View>

      {/* Enhanced diamond with logo OR default cross */}
      <Animated.View style={[logoAnimStyle]}>
        {logo ? (
          // Display uploaded logo in diamond shape
          <View style={{ width: 240, height: 240, alignItems: "center", justifyContent: "center" }}>
            <Svg width={240} height={240} viewBox="0 0 240 240" style={{ position: "absolute" }}>
              <Defs>
                <LinearGradient id="logoDiamondBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={primary} />
                  <Stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <Stop offset="25%" stopColor={secondary} />
                  <Stop offset="38%" stopColor={tertiary} />
                  <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <Stop offset="62%" stopColor={primary} />
                  <Stop offset="75%" stopColor={secondary} stopOpacity="0.95" />
                  <Stop offset="88%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor={tertiary} />
                </LinearGradient>
                <LinearGradient id="logoDiamondFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={primary} stopOpacity="0.2" />
                  <Stop offset="50%" stopColor={secondary} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={tertiary} stopOpacity="0.2" />
                </LinearGradient>
              </Defs>
              
              {/* Outer glow shadow */}
              <Path
                d="M 120 5 L 235 120 L 120 235 L 5 120 Z"
                fill="#000000"
                opacity={0.5}
                transform="translate(5, 5)"
              />
              
              {/* Main diamond border with jewel gradient */}
              <Path
                d="M 120 5 L 235 120 L 120 235 L 5 120 Z"
                fill="url(#logoDiamondFill)"
                stroke="url(#logoDiamondBorder)"
                strokeWidth="5"
              />
              
              {/* Inner border for depth */}
              <Path
                d="M 120 20 L 220 120 L 120 220 L 20 120 Z"
                fill="none"
                stroke="url(#logoDiamondBorder)"
                strokeWidth="2.5"
                opacity={0.6}
              />
              
              {/* Innermost highlight */}
              <Path
                d="M 120 35 L 205 120 L 120 205 L 35 120 Z"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                opacity={0.3}
              />
              
              {/* Facet highlights for jewel effect */}
              <Path d="M 120 5 L 120 120 L 5 120 Z" fill="#FFFFFF" opacity={0.1} />
              <Path d="M 120 5 L 120 120 L 235 120 Z" fill="#FFFFFF" opacity={0.07} />
              
              {/* Top sparkle highlight */}
              <Path
                d="M 120 5 L 155 40 L 120 75 L 85 40 Z"
                fill="#FFFFFF"
                opacity={0.3}
              />
            </Svg>
            
            {/* Logo image clipped to diamond shape */}
            <View style={{ position: "absolute", width: 190, height: 190, overflow: "hidden", transform: [{ rotate: "45deg" }] }}>
              <Image
                source={{ uri: logo }}
                style={{
                  width: 190,
                  height: 190,
                  resizeMode: "contain",
                  transform: [{ rotate: "-45deg" }],
                }}
              />
            </View>
          </View>
        ) : (
          // Default diamond with cross
          <>
            <Svg width={220} height={220} viewBox="0 0 220 220">
              <Defs>
                <LinearGradient id="diamondMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={primary} stopOpacity="0.35" />
                  <Stop offset="50%" stopColor={secondary} stopOpacity="0.55" />
                  <Stop offset="100%" stopColor={tertiary} stopOpacity="0.35" />
                </LinearGradient>
                <LinearGradient id="diamondBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={primary} />
                  <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <Stop offset="50%" stopColor={secondary} />
                  <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor={tertiary} />
                </LinearGradient>
              </Defs>
              
              {/* Shadow layer */}
              <Path
                d="M 110 10 L 210 110 L 110 210 L 10 110 Z"
                fill="#000000"
                opacity={0.4}
                transform="translate(4, 4)"
              />
              
              {/* Main diamond */}
              <Path
                d="M 110 10 L 210 110 L 110 210 L 10 110 Z"
                fill="url(#diamondMain)"
                stroke="url(#diamondBorder)"
                strokeWidth="4"
              />
              
              {/* Inner facets */}
              <Path d="M 110 10 L 110 110 L 10 110 Z" fill={primary} opacity={0.18} />
              <Path d="M 110 10 L 110 110 L 210 110 Z" fill={secondary} opacity={0.18} />
              <Path d="M 110 210 L 110 110 L 10 110 Z" fill={secondary} opacity={0.12} />
              <Path d="M 110 210 L 110 110 L 210 110 Z" fill={primary} opacity={0.12} />
              
              {/* Highlight */}
              <Path
                d="M 110 10 L 150 50 L 110 90 L 70 50 Z"
                fill="#FFFFFF"
                opacity={0.2}
              />
              
              {/* Inner border */}
              <Path
                d="M 110 25 L 195 110 L 110 195 L 25 110 Z"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                opacity={0.25}
              />
            </Svg>

            {/* Cross overlay */}
            <View style={{ position: "absolute" }}>
              <Svg width={110} height={110} viewBox="0 0 110 110">
                <Defs>
                  <LinearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="50%" stopColor="#F8F8F8" />
                    <Stop offset="100%" stopColor="#F0F0F0" />
                  </LinearGradient>
                </Defs>
                
                {/* Cross glow layers */}
                <G opacity={0.5}>
                  <Circle cx="55" cy="55" r="36" fill={primary} />
                  <Circle cx="55" cy="55" r="28" fill={secondary} />
                  <Circle cx="55" cy="55" r="22" fill="#FFFFFF" opacity={0.35} />
                </G>
                
                {/* Main cross with rounded edges */}
                <Path
                  d="M 44 12 L 66 12 L 66 44 L 98 44 L 98 66 L 66 66 L 66 98 L 44 98 L 44 66 L 12 66 L 12 44 L 44 44 Z"
                  fill="url(#crossGrad)"
                  strokeWidth="2.5"
                  stroke="#FFFFFF"
                  opacity={0.98}
                />
                
                {/* Inner highlight */}
                <Path
                  d="M 48 18 L 62 18 L 62 48 L 92 48 L 92 62 L 62 62 L 62 92 L 48 92 L 48 62 L 18 62 L 18 48 L 48 48 Z"
                  fill="#FFFFFF"
                  opacity={0.35}
                />
              </Svg>
            </View>
          </>
        )}
      </Animated.View>

      {/* Cleaner floating particles */}
      <Animated.View style={[particleAnimStyle, { position: "absolute" }]}>
        <Svg width={width} height={height}>
          {/* Left side particles */}
          <Circle cx={width * 0.15} cy={height * 0.3} r={3} fill={primary} opacity={0.8} />
          <Circle cx={width * 0.12} cy={height * 0.5} r={2} fill={secondary} opacity={0.7} />
          <Circle cx={width * 0.18} cy={height * 0.7} r={2.5} fill={tertiary} opacity={0.75} />
          
          {/* Right side particles */}
          <Circle cx={width * 0.85} cy={height * 0.35} r={3} fill={secondary} opacity={0.8} />
          <Circle cx={width * 0.88} cy={height * 0.55} r={2} fill={primary} opacity={0.7} />
          <Circle cx={width * 0.82} cy={height * 0.75} r={2.5} fill={tertiary} opacity={0.75} />
          
          {/* Top particles */}
          <Circle cx={width * 0.4} cy={height * 0.15} r={2} fill="#FFFFFF" opacity={0.8} />
          <Circle cx={width * 0.6} cy={height * 0.18} r={2} fill="#FFFFFF" opacity={0.75} />
          
          {/* Bottom particles */}
          <Circle cx={width * 0.35} cy={height * 0.85} r={2} fill={primary} opacity={0.7} />
          <Circle cx={width * 0.65} cy={height * 0.88} r={2} fill={secondary} opacity={0.7} />
        </Svg>
      </Animated.View>

      {/* Brand name with cleaner styling */}
      <Animated.View style={[textAnimStyle, { position: "absolute", top: height * 0.62, alignItems: "center" }]}>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 54,
            fontWeight: "900",
            letterSpacing: 8,
            textShadowColor: `${primary}cc`,
            textShadowOffset: { width: 0, height: 4 },
            textShadowRadius: 20,
          }}
        >
          {systemName.toUpperCase()}
        </Text>
        
        {/* Simple elegant underline */}
        <Svg width={280} height={4} style={{ marginTop: 14 }}>
          <Defs>
            <LinearGradient id="underlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={primary} stopOpacity="0.2" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <Stop offset="100%" stopColor={secondary} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Rect width={280} height={4} fill="url(#underlineGrad)" rx={2} />
        </Svg>
      </Animated.View>

      {/* Tagline with minimal decoration */}
      <Animated.View style={[textAnimStyle, { position: "absolute", top: height * 0.7, alignItems: "center", paddingHorizontal: 30 }]}>
        <Text
          style={{
            color: "#D5D5D5",
            fontSize: 13,
            letterSpacing: 2.5,
            fontWeight: "500",
            textAlign: "center",
            textShadowColor: "rgba(0, 0, 0, 0.6)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }}
        >
          {description}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}