import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import arStrings from "@/constants/i18n/ar.json";
import frStrings from "@/constants/i18n/fr.json";
import enStrings from "@/constants/i18n/en.json";
import { Language } from "@/types";
import { getRegionById, getRegionLabel } from "@/constants/regions";

type Strings = typeof arStrings;
export type Theme = "system" | "light" | "dark";

const STRINGS: Record<Language, Strings> = {
  ar: arStrings,
  fr: frStrings as unknown as Strings,
  en: enStrings as unknown as Strings,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  MAD: "درهم",
  USD: "$",
  EUR: "€",
  GBP: "£",
  TND: "د.ت",
  DZD: "دج",
  SAR: "﷼",
  AED: "د.إ",
  EGP: "ج.م",
};

interface LanguageContextType {
  language: Language;
  isRTL: boolean;
  flexDirection: "row" | "row-reverse";
  textAlign: "left" | "right";
  currency: string;
  currencySymbol: string;
  theme: Theme;
  homeRegionId: string | null;
  homeRegionLabel: string;
  t: (key: keyof Strings) => string;
  setLanguage: (lang: Language) => Promise<void>;
  changeLanguage: (lang: Language) => Promise<void>;
  changeCurrency: (code: string) => Promise<void>;
  changeTheme: (t: Theme) => Promise<void>;
  changeRegion: (regionId: string) => Promise<void>;
  isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  isRTL: true,
  flexDirection: "row-reverse",
  textAlign: "right",
  currency: "MAD",
  currencySymbol: "درهم",
  theme: "system",
  homeRegionId: null,
  homeRegionLabel: "",
  t: (key) => String(key),
  setLanguage: async () => {},
  changeLanguage: async () => {},
  changeCurrency: async () => {},
  changeTheme: async () => {},
  changeRegion: async () => {},
  isLoaded: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language,      setLanguageState]  = useState<Language>("ar");
  const [currency,      setCurrencyState]  = useState<string>("MAD");
  const [theme,         setThemeState]     = useState<Theme>("system");
  const [homeRegionId,  setHomeRegionId]   = useState<string | null>(null);
  const [isLoaded,      setIsLoaded]       = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([
      "app_language",
      "user_language",
      "app_currency",
      "caddycheck_currency",
      "caddycheck_theme",
      "caddycheck_home_region",
    ]).then((pairs) => {
      const langVal     = (pairs[0][1] as Language | null) ?? (pairs[1][1] as Language | null) ?? "ar";
      const currVal     = pairs[2][1] ?? pairs[3][1] ?? "MAD";
      const themeVal    = (pairs[4][1] as Theme | null) ?? "system";
      const regionVal   = pairs[5][1] ?? null;
      setLanguageState(langVal);
      setCurrencyState(currVal);
      setThemeState(themeVal);
      setHomeRegionId(regionVal);
      setIsLoaded(true);
    });
  }, []);

  const changeLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.multiSet([
      ["app_language", lang],
      ["user_language", lang],
    ]);
  }, []);

  const changeCurrency = useCallback(async (code: string) => {
    setCurrencyState(code);
    await AsyncStorage.multiSet([
      ["app_currency", code],
      ["caddycheck_currency", code],
    ]);
  }, []);

  const changeTheme = useCallback(async (t: Theme) => {
    setThemeState(t);
    await AsyncStorage.setItem("caddycheck_theme", t);
  }, []);

  const changeRegion = useCallback(async (regionId: string) => {
    const region = getRegionById(regionId);
    if (!region) return;
    setHomeRegionId(regionId);
    // Auto-set the matching currency
    setCurrencyState(region.currency);
    await AsyncStorage.multiSet([
      ["caddycheck_home_region", regionId],
      ["app_currency",           region.currency],
      ["caddycheck_currency",    region.currency],
    ]);
  }, []);

  const t = useCallback(
    (key: keyof Strings): string => {
      const strings = STRINGS[language];
      return (strings as Record<string, string>)[key as string] ?? String(key);
    },
    [language]
  );

  const isRTL         = language === "ar";
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency;

  // Build a human-readable label for the home region
  const homeRegionLabel = homeRegionId
    ? (() => {
        const r = getRegionById(homeRegionId);
        return r ? getRegionLabel(r, language as Language) : "";
      })()
    : "";

  const value: LanguageContextType = {
    language,
    isRTL,
    flexDirection: isRTL ? "row-reverse" : "row",
    textAlign: isRTL ? "right" : "left",
    currency,
    currencySymbol,
    theme,
    homeRegionId,
    homeRegionLabel,
    t,
    setLanguage: changeLanguage,
    changeLanguage,
    changeCurrency,
    changeTheme,
    changeRegion,
    isLoaded,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
