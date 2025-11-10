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

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    // Looping pulsing animation
    scale.value = withRepeat(
      withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // Fade + slide up text
    opacity.value = withTiming(1, { duration: 1500 });
    translateY.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.exp) });
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
    <View
      style={{
        flex: 1,
        backgroundColor: "#0B6516", // main color
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Animated red pulsing circle */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "#9C0808",
          },
          pulseStyle,
        ]}
      />

      {/* Decorative curved shape at bottom */}
      <Svg
        width={width}
        height={150}
        viewBox={`0 0 ${width} 150`}
        style={{ position: "absolute", bottom: 0 }}
      >
        <Path
          d={`M0 50 Q${width / 2} 150 ${width} 50 L${width} 150 L0 150 Z`}
          fill="#9C0808"
          opacity={0.8}
        />
      </Svg>

      {/* Logo text */}
      <Animated.View style={[textStyle]}>
        <Text
          style={{
            color: "white",
            fontSize: 36,
            fontWeight: "800",
            letterSpacing: 1.5,
          }}
        >
          E-ELYON
        </Text>
        <Text
          style={{
            color: "#FFDCDC",
            fontSize: 14,
            marginTop: 6,
            letterSpacing: 1,
          }}
        >
          Connecting Faith • Empowering Service
        </Text>
      </Animated.View>
    </View>
  );
}
