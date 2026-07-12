import { createContext, useContext, useState, useEffect } from "react";

export const ThemeCtx = createContext({ isDark: true });
export const useTheme = () => useContext(ThemeCtx);

export function makeTheme(isDark) {
  if (isDark) return {
    bgOuter:   "#000000",
    bgSidebar: "#1a1a1a",
    bgMain:    "#000000",
    bgCard:    "#242424",
    bgCardHov: "#2c2c2c",
    bgInput:   "#2f2f2f",
    bgActive:  "#1e2a40",
    bgBtn:     "#3b4460",
    border:    "#333333",
    border2:   "#3d3d3d",
    borderAct: "#4a5270",
    txtPrim:   "#ffffff",
    txtSec:    "#e0e0e0",
    txtTert:   "#b0b0b0",
    txtWhite:  "#ffffff",
    accent:    "#5b7cf5",
    accentLt:  "#7b97f8",
    green:     "#4db882",
    yellow:    "#e8a83a",
    red:       "#e05555",
    orange:    "#e07a35",
    purple:    "#00d4aa",
    teal:      "#38b4b4",
    pink:      "#ff6b6b",
  };
  return {
    bgOuter:   "#f0f2f5",
    bgSidebar: "#ffffff",
    bgMain:    "#f0f2f5",
    bgCard:    "#ffffff",
    bgCardHov: "#f7f8fa",
    bgInput:   "#f0f2f5",
    bgActive:  "#e8ecff",
    bgBtn:     "#3b4460",
    border:    "#e2e6ed",
    border2:   "#d0d5de",
    borderAct: "#5b7cf5",
    txtPrim:   "#000000",
    txtSec:    "#333333",
    txtTert:   "#666666",
    txtWhite:  "#ffffff",
    accent:    "#5b7cf5",
    accentLt:  "#4060e0",
    green:     "#2a9e5e",
    yellow:    "#c47e10",
    red:       "#d03030",
    orange:    "#c05a15",
    purple:    "#00b894",
    teal:      "#207a7a",
    pink:      "#e84393",
  };
}


export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const T = makeTheme(isDark);
  const toggleTheme = () => setIsDark(d => !d);
  return (
    <ThemeCtx.Provider value={{ isDark, T, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}
