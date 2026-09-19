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

const LANGUAGES: readonly Language[] = ["ar", "fr", "en"];
const THEMES: readonly Theme[] = ["system", "light", "dark"];
const HYDRATION_TIMEOUT_MS = 2000;

function isLanguage(value: string | null): value is Language {
  return value !== null && LANGUAGES.includes(value as Language);
}

function isTheme(value: string | null): value is Theme {
  return value !== null && THEMES.includes(value as Theme);
}

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

async function persist(
  operation: () => Promise<unknown>,
  setting: string
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error(`Failed to persist ${setting}:`, error);
  }
}

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
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setIsLoaded(true);
    }, HYDRATION_TIMEOUT_MS);

    const hydrate = async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          "app_language",
          "user_language",
          "app_currency",
          "caddycheck_currency",
          "caddycheck_theme",
          "caddycheck_home_region",
        ]);
        if (!active) return;

        const primaryLanguage = pairs[0][1];
        const legacyLanguage = pairs[1][1];
        const primaryCurrency = pairs[2][1];
        const legacyCurrency = pairs[3][1];
        const storedTheme = pairs[4][1];
        const storedRegion = pairs[5][1];

        setLanguageState(
          isLanguage(primaryLanguage)
            ? primaryLanguage
            : isLanguage(legacyLanguage)
              ? legacyLanguage
              : "ar"
        );
        setCurrencyState(
          primaryCurrency && primaryCurrency in CURRENCY_SYMBOLS
            ? primaryCurrency
            : legacyCurrency && legacyCurrency in CURRENCY_SYMBOLS
              ? legacyCurrency
              : "MAD"
        );
        setThemeState(isTheme(storedTheme) ? storedTheme : "system");
        setHomeRegionId(
          storedRegion && getRegionById(storedRegion) ? storedRegion : null
        );
      } catch (error) {
        console.error("Failed to hydrate app preferences:", error);
      } finally {
        if (active) {
          clearTimeout(timeout);
          setIsLoaded(true);
        }
      }
    };

    void hydrate();

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  const changeLanguage = useCallback(async (lang: Language) => {
    if (!isLanguage(lang)) {
      console.error("Ignoring unsupported language:", lang);
      return;
    }
    setLanguageState(lang);
    await persist(
      () =>
        AsyncStorage.multiSet([
          ["app_language", lang],
          ["user_language", lang],
        ]),
      "language"
    );
  }, []);

  const changeCurrency = useCallback(async (code: string) => {
    if (!(code in CURRENCY_SYMBOLS)) {
      console.error("Ignoring unsupported currency:", code);
      return;
    }
    setCurrencyState(code);
    await persist(
      () =>
        AsyncStorage.multiSet([
          ["app_currency", code],
          ["caddycheck_currency", code],
        ]),
      "currency"
    );
  }, []);

  const changeTheme = useCallback(async (t: Theme) => {
    if (!isTheme(t)) {
      console.error("Ignoring unsupported theme:", t);
      return;
    }
    setThemeState(t);
    await persist(
      () => AsyncStorage.setItem("caddycheck_theme", t),
      "theme"
    );
  }, []);

  const changeRegion = useCallback(async (regionId: string) => {
    const region = getRegionById(regionId);
    if (!region) return;
    setHomeRegionId(regionId);
    // Auto-set the matching currency
    setCurrencyState(region.currency);
    await persist(
      () =>
        AsyncStorage.multiSet([
          ["caddycheck_home_region", regionId],
          ["app_currency",           region.currency],
          ["caddycheck_currency",    region.currency],
        ]),
      "home region"
    );
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
