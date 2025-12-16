import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// Official E-Wallet logos styled to match Maya and GCash branding

export function MayaIcon({ width = 28, height = 28 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="mayaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#00D97E" />
          <Stop offset="100%" stopColor="#00A85A" />
        </LinearGradient>
      </Defs>
      <Rect x={2} y={2} width={44} height={44} rx={10} fill="url(#mayaGrad)" />
      <Path 
        d="M14 30 L18 18 L22 30 M26 30 L30 18 L34 30" 
        stroke="#fff" 
        strokeWidth={3} 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <Path d="M16 25h4 M28 25h4" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function GcashIcon({ width = 28, height = 28 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="gcashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#007DFF" />
          <Stop offset="100%" stopColor="#0055CC" />
        </LinearGradient>
      </Defs>
      <Rect x={2} y={2} width={44} height={44} rx={10} fill="url(#gcashGrad)" />
      <Path 
        d="M18 18 C18 14 20 12 24 12 C28 12 30 14 30 18 L30 22 L26 22" 
        stroke="#fff" 
        strokeWidth={3.5} 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <Circle cx={24} cy={30} r={8} stroke="#fff" strokeWidth={3} fill="none" />
      <Path d="M22 30h4" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function BankIcon({ width = 28, height = 28 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 48 48">
      <Rect x={2} y={2} width={44} height={44} rx={10} fill="#2D3748" />
      <Path d="M24 12 L38 20 L10 20 Z" fill="#fff" />
      <Rect x={12} y={22} width={4} height={12} fill="#fff" />
      <Rect x={22} y={22} width={4} height={12} fill="#fff" />
      <Rect x={32} y={22} width={4} height={12} fill="#fff" />
      <Rect x={10} y={36} width={28} height={3} fill="#fff" />
    </Svg>
  );
}
