import Constants from "expo-constants";

export function getApiBase(): string {
  // Production APKs receive this at bundle time. This keeps the published
  // Android app independent from a Replit development hostname.
  const fromBuild = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (fromBuild) return `${fromBuild}/api`;

  // The static app.json carries the public production fallback.
  const fromExtra = Constants.expoConfig?.extra?.apiBase as string | undefined;
  if (fromExtra) return `${fromExtra}/api`;

  // In a web browser, derive from the current origin (works on preview and
  // published web deployments).
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return "";
}

export const API_BASE = getApiBase();
