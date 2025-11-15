import React, { useEffect } from "react";
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
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  // Core animations
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-180);
  const particlesOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(30);
  const waveProgress = useSharedValue(0);
  const circleScale1 = useSharedValue(0.5);
  const circleScale2 = useSharedValue(0.5);
  const circleScale3 = useSharedValue(0.5);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Logo entrance with rotation and scale
    logoScale.value = withDelay(
      200,
      withSequence(
        withTiming(1.15, { duration: 700, easing: Easing.out(Easing.back(1.8)) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) })
      )
    );
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    logoRotate.value = withDelay(
      200,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    // Expanding circles (ripple effect)
    circleScale1.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );

    circleScale2.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );

    circleScale3.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(2.5, { duration: 2500, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 0 })
        ),
        -1,
        false
      )
    );

    // Particles fade in
    particlesOpacity.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 3000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // Text animation
    textOpacity.value = withDelay(900, withTiming(1, { duration: 1000 }));
    textTranslateY.value = withDelay(
      900,
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    // Wave animation
    waveProgress.value = withDelay(
      500,
      withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // Shimmer effect
    shimmer.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` }
    ],
    opacity: logoOpacity.value,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const particleAnimStyle = useAnimatedStyle(() => ({
    opacity: particlesOpacity.value,
  }));

  const circle1Style = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale1.value }],
    opacity: interpolate(circleScale1.value, [0.5, 2.5], [0.4, 0]),
  }));

  const circle2Style = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale2.value }],
    opacity: interpolate(circleScale2.value, [0.5, 2.5], [0.3, 0]),
  }));

  const circle3Style = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale3.value }],
    opacity: interpolate(circleScale3.value, [0.5, 2.5], [0.25, 0]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value * 0.3,
  }));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0a1612",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Dynamic gradient background */}
      <Svg
        width={width}
        height={height}
        style={{ position: "absolute" }}
      >
        <Defs>
          <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0B6516" stopOpacity="0.08" />
            <Stop offset="50%" stopColor="#1a4d2e" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#9C0808" stopOpacity="0.08" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#bgGradient)" />
      </Svg>

      {/* Decorative corner elements */}
      <Svg
        width={width}
        height={height}
        style={{ position: "absolute", opacity: 0.15 }}
      >
        {/* Top left corner */}
        <Path
          d={`M 0 0 L ${width * 0.15} 0 L 0 ${height * 0.15} Z`}
          fill="#0B6516"
        />
        {/* Top right corner */}
        <Path
          d={`M ${width} 0 L ${width * 0.85} 0 L ${width} ${height * 0.15} Z`}
          fill="#9C0808"
        />
        {/* Bottom left corner */}
        <Path
          d={`M 0 ${height} L ${width * 0.15} ${height} L 0 ${height * 0.85} Z`}
          fill="#9C0808"
        />
        {/* Bottom right corner */}
        <Path
          d={`M ${width} ${height} L ${width * 0.85} ${height} L ${width} ${height * 0.85} Z`}
          fill="#0B6516"
        />
      </Svg>

      {/* Expanding ripple circles */}
      <Animated.View style={[circle1Style, { position: "absolute" }]}>
        <Svg width={200} height={200}>
          <Circle
            cx={100}
            cy={100}
            r={80}
            stroke="#0B6516"
            strokeWidth="2"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[circle2Style, { position: "absolute" }]}>
        <Svg width={200} height={200}>
          <Circle
            cx={100}
            cy={100}
            r={80}
            stroke="#9C0808"
            strokeWidth="2"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[circle3Style, { position: "absolute" }]}>
        <Svg width={200} height={200}>
          <Circle
            cx={100}
            cy={100}
            r={80}
            stroke="#0B6516"
            strokeWidth="2"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Central diamond shape */}
      <Animated.View style={[logoAnimStyle]}>
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Defs>
            <LinearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0B6516" stopOpacity="0.2" />
              <Stop offset="50%" stopColor="#1a4d2e" stopOpacity="0.3" />
              <Stop offset="100%" stopColor="#9C0808" stopOpacity="0.2" />
            </LinearGradient>
            <LinearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0B6516" />
              <Stop offset="100%" stopColor="#9C0808" />
            </LinearGradient>
          </Defs>
          {/* Outer diamond */}
          <Path
            d="M 80 10 L 150 80 L 80 150 L 10 80 Z"
            fill="url(#diamondGradient)"
            stroke="url(#borderGradient)"
            strokeWidth="2"
          />
          {/* Inner diamond */}
          <Path
            d="M 80 30 L 130 80 L 80 130 L 30 80 Z"
            fill="none"
            stroke="url(#borderGradient)"
            strokeWidth="1.5"
            opacity={0.6}
          />
        </Svg>
      </Animated.View>

      {/* Stylized cross with glow */}
      <Animated.View style={[logoAnimStyle, { position: "absolute" }]}>
        <Svg width={80} height={80} viewBox="0 0 80 80">
          <Defs>
            <LinearGradient id="crossGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="100%" stopColor="#E8E8E8" />
            </LinearGradient>
          </Defs>
          {/* Glow behind cross */}
          <Circle cx="40" cy="40" r="25" fill="#0B6516" opacity={0.2} />
          <Circle cx="40" cy="40" r="18" fill="#9C0808" opacity={0.15} />
          {/* Cross shape */}
          <Path
            d="M 35 15 L 45 15 L 45 35 L 65 35 L 65 45 L 45 45 L 45 65 L 35 65 L 35 45 L 15 45 L 15 35 L 35 35 Z"
            fill="url(#crossGradient)"
          />
        </Svg>
      </Animated.View>

      {/* Shimmer effect */}
      <Animated.View style={[shimmerStyle, { position: "absolute" }]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="shimmerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x={width * 0.3}
            y={height * 0.35}
            width={width * 0.4}
            height={height * 0.3}
            fill="url(#shimmerGradient)"
          />
        </Svg>
      </Animated.View>

      {/* Floating ambient particles */}
      <Animated.View style={[particleAnimStyle, { position: "absolute" }]}>
        <Svg width={width} height={height}>
          <Circle cx={width * 0.1} cy={height * 0.2} r={2} fill="#0B6516" opacity={0.8} />
          <Circle cx={width * 0.9} cy={height * 0.25} r={3} fill="#9C0808" opacity={0.7} />
          <Circle cx={width * 0.15} cy={height * 0.75} r={2.5} fill="#0B6516" opacity={0.9} />
          <Circle cx={width * 0.85} cy={height * 0.7} r={2} fill="#9C0808" opacity={0.8} />
          <Circle cx={width * 0.25} cy={height * 0.4} r={1.5} fill="#FFFFFF" opacity={0.6} />
          <Circle cx={width * 0.75} cy={height * 0.35} r={2} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={width * 0.2} cy={height * 0.85} r={2.5} fill="#9C0808" opacity={0.7} />
          <Circle cx={width * 0.8} cy={height * 0.15} r={2} fill="#0B6516" opacity={0.8} />
        </Svg>
      </Animated.View>

      {/* Brand name */}
      <Animated.View style={[logoAnimStyle, { position: "absolute", top: height * 0.62, alignItems: "center" }]}>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 52,
            fontWeight: "700",
            letterSpacing: 6,
            textShadowColor: "rgba(11, 101, 22, 0.6)",
            textShadowOffset: { width: 0, height: 3 },
            textShadowRadius: 12,
          }}
        >
          E-ELYON
        </Text>
        {/* Underline accent */}
        <Svg width={220} height={3} style={{ marginTop: 10 }}>
          <Defs>
            <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#0B6516" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#9C0808" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0B6516" stopOpacity="0.3" />
            </LinearGradient>
          </Defs>
          <Rect width={220} height={3} fill="url(#lineGradient)" rx={1.5} />
        </Svg>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[textAnimStyle, { position: "absolute", top: height * 0.71, alignItems: "center" }]}>
        <Text
          style={{
            color: "#B8B8B8",
            fontSize: 14,
            letterSpacing: 2.5,
            fontWeight: "500",
            textTransform: "uppercase",
          }}
        >
          Connecting Faith
        </Text>
        <Text
          style={{
            color: "#9C9C9C",
            fontSize: 14,
            letterSpacing: 2.5,
            fontWeight: "400",
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          Empowering Service
        </Text>
      </Animated.View>

      {/* Bottom decorative element */}
      <View style={{ position: "absolute", bottom: 40, width: width * 0.6, height: 2 }}>
        <Svg width={width * 0.6} height={2}>
          <Defs>
            <LinearGradient id="bottomLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#0B6516" stopOpacity="0" />
              <Stop offset="50%" stopColor="#9C0808" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#0B6516" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width={width * 0.6} height={2} fill="url(#bottomLineGradient)" />
        </Svg>
      </View>
    </View>
  );
}