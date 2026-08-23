/** Prism brand palette — see CLAUDE.md "Brand". */
export const colors = {
  /** Primary brand gradient, left to right. */
  gradient: ["#FE3F2D", "#FF6C22", "#FFB255"] as const,
  /** Wordmark / accent gold. */
  gold: "#FEBD59",

  primary: "#FE3F2D",
  primaryDark: "#D8331F",

  background: "#FFFFFF",
  /** Screen/page background — a shade darker than surfaceMuted so white
   * Cards (colors.surface) have visible contrast against the page, while
   * surfaceMuted elements (inputs, pill tracks) still read lighter than
   * the page around them. */
  pageBackground: "#F1ECE7",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F5F3",
  border: "#ECE7E2",

  textPrimary: "#1A1512",
  textSecondary: "#6B6259",
  textInverse: "#FFFFFF",

  success: "#1F9254",
  warning: "#F5A623",
  danger: "#E43D3D",

  overlay: "rgba(26, 21, 18, 0.5)",
} as const;

export type ColorToken = keyof typeof colors;
