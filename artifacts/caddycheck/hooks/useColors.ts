import { useColorScheme } from "react-native";

import colors from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Returns design tokens for the effective color scheme.
 * Respects the user's manual theme override (system / light / dark).
 */
export function useColors() {
  const systemScheme = useColorScheme();
  const { theme } = useLanguage();
  const effectiveScheme =
    theme === "system" ? (systemScheme ?? "light") : theme;
  const palette = effectiveScheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
