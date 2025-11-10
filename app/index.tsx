// app/index.tsx
import { router } from "expo-router"; // 👈 handles navigation
import React, { useEffect } from "react";
import { Dimensions, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../src/lib/supabaseClient";

const { width } = Dimensions.get("window");

export default function Index() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    const connect = async () => {
      const { error } = await supabase.from("branches").select("*").limit(1);
      if (error) console.error("❌ Supabase error:", error);
      else console.log("✅ Supabase connected!");
    };
    connect();

    scale.value = withRepeat(withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
    opacity.value = withTiming(1, { duration: 1500 });
    translateY.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.exp) });

    // 👇 Redirect to login after 3 seconds
    const timer = setTimeout(() => router.replace("/login"), 3000);
    return () => clearTimeout(timer);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.5,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "#0B6516", justifyContent: "center", alignItems: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: "#9C0808",
          },
          pulseStyle,
        ]}
      />

      <Svg width={width} height={150} viewBox={`0 0 ${width} 150`} style={{ position: "absolute", bottom: 0 }}>
        <Path
          d={`M0 50 Q${width / 2} 150 ${width} 50 L${width} 150 L0 150 Z`}
          fill="#9C0808"
          opacity={0.8}
        />
      </Svg>

      <Animated.View style={[textStyle]}>
        <Text
          style={{
            color: "white",
            fontSize: 38,
            fontWeight: "900",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          E-Elyon
        </Text>
        <Text
          style={{
            color: "#FFDCDC",
            fontSize: 14,
            marginTop: 6,
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          Connecting Faith • Empowering Service
        </Text>
      </Animated.View>
    </View>
  );
}
