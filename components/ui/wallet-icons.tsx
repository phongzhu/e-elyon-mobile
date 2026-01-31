import React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { SvgUri } from "react-native-svg";

// Official E-Wallet logos styled to match Maya and GCash branding

const MAYA_SVG_URI = "https://upload.wikimedia.org/wikipedia/commons/e/e6/Maya_logo.svg";
const GCASH_SVG_URI = "https://upload.wikimedia.org/wikipedia/commons/5/52/GCash_logo.svg";

export function MayaIcon({
  width = 64,
  height = 24,
}: {
  width?: number;
  height?: number;
}) {
  return <SvgUri uri={MAYA_SVG_URI} width={width} height={height} />;
}

export function GcashIcon({
  width = 64,
  height = 24,
}: {
  width?: number;
  height?: number;
}) {
  return <SvgUri uri={GCASH_SVG_URI} width={width} height={height} />;
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
