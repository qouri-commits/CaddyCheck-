export type StoreRegion = "MA" | "TN" | "DZ" | "SA" | "AE" | "EG" | "FR" | "BE" | "GB" | "US" | "DE" | "ES" | "IT" | "GLOBAL" | "CUSTOM";

export interface Store {
  name: string;
  icon: string;
  region: StoreRegion;
  popular?: boolean;
  tags?: string[];
}

// Map currency code → most likely country regions (ordered by priority)
export const CURRENCY_TO_REGIONS: Record<string, StoreRegion[]> = {
  MAD: ["MA"],
  TND: ["TN"],
  DZD: ["DZ"],
  SAR: ["SA"],
  AED: ["AE"],
  EGP: ["EG"],
  EUR: ["FR", "BE", "DE", "ES", "IT"],
  GBP: ["GB"],
  USD: ["US"],
};

// Map language → fallback regions if currency is ambiguous
export const LANG_TO_REGIONS: Record<string, StoreRegion[]> = {
  ar: ["MA", "SA", "AE", "TN", "DZ", "EG"],
  fr: ["FR", "BE", "MA", "TN", "DZ"],
  en: ["GB", "US"],
};

export const DEFAULT_STORES: Store[] = [
  // ─── Morocco ──────────────────────────────────────────────────────────
  { name: "مرجان", icon: "storefront-outline", region: "MA", popular: true, tags: ["marjane", "hypermarché"] },
  { name: "مرجان ماركت", icon: "storefront-outline", region: "MA", tags: ["marjane market"] },
  { name: "كارفور", icon: "cart-outline", region: "MA", popular: true, tags: ["carrefour"] },
  { name: "كارفور ماركت", icon: "cart-outline", region: "MA", tags: ["carrefour market"] },
  { name: "بيم", icon: "basket-outline", region: "MA", popular: true, tags: ["bim"] },
  { name: "أسواق السلام", icon: "leaf-outline", region: "MA", tags: ["aswak", "assalam"] },
  { name: "لابيل في", icon: "storefront-outline", region: "MA", tags: ["label vie", "labelvie"] },
  { name: "أتاكاداو", icon: "cube-outline", region: "MA", tags: ["atacadao", "grossiste"] },
  { name: "أسيما", icon: "basket-outline", region: "MA", tags: ["acima"] },
  { name: "نيتو", icon: "storefront-outline", region: "MA", tags: ["netto"] },
  { name: "شيكافي", icon: "storefront-outline", region: "MA", tags: ["chikavie"] },
  { name: "إنتراكونتيننتال", icon: "globe-outline", region: "MA", tags: ["intercontinental"] },
  { name: "أومنيا", icon: "storefront-outline", region: "MA", tags: ["omnia"] },
  { name: "أريانة", icon: "basket-outline", region: "MA", tags: ["ariana"] },
  { name: "سيدي مبارك", icon: "storefront-outline", region: "MA", tags: ["sidi mbarek"] },
  { name: "هنا ماركت", icon: "home-outline", region: "MA", tags: ["hana market"] },
  { name: "سوق الجملة", icon: "cube-outline", region: "MA", tags: ["souk grossiste"] },
  { name: "البقالة", icon: "storefront-outline", region: "MA", tags: ["epicerie", "hanout"] },
  { name: "فرح ماركت", icon: "basket-outline", region: "MA", tags: ["farah market"] },

  // ─── Tunisia ──────────────────────────────────────────────────────────
  { name: "مونوبري", icon: "storefront-outline", region: "TN", popular: true, tags: ["monoprix"] },
  { name: "ماغرو", icon: "cube-outline", region: "TN", popular: true, tags: ["magro", "grossiste"] },
  { name: "جيان كاسينو", icon: "cart-outline", region: "TN", popular: true, tags: ["geant casino"] },
  { name: "كارفور تونس", icon: "cart-outline", region: "TN", tags: ["carrefour tunis"] },
  { name: "سيميدس", icon: "storefront-outline", region: "TN", tags: ["simeds"] },
  { name: "بريزا", icon: "basket-outline", region: "TN", tags: ["brisa"] },
  { name: "هايبر ماركت تونس", icon: "storefront-outline", region: "TN", tags: ["hypermart"] },
  { name: "كليك آند شوب", icon: "phone-portrait-outline", region: "TN", tags: ["click shop"] },
  { name: "أوشان تونس", icon: "basket-outline", region: "TN", tags: ["auchan tunis"] },

  // ─── Algeria ──────────────────────────────────────────────────────────
  { name: "بيم الجزائر", icon: "basket-outline", region: "DZ", popular: true, tags: ["bim algerie"] },
  { name: "كارفور الجزائر", icon: "cart-outline", region: "DZ", popular: true, tags: ["carrefour algerie"] },
  { name: "يونو", icon: "storefront-outline", region: "DZ", tags: ["uno"] },
  { name: "أرديس", icon: "storefront-outline", region: "DZ", tags: ["ardis"] },
  { name: "سيتي ماركت", icon: "business-outline", region: "DZ", tags: ["city market"] },
  { name: "ألفا ماركت", icon: "basket-outline", region: "DZ", tags: ["alfa market"] },
  { name: "أوشان الجزائر", icon: "basket-outline", region: "DZ", tags: ["auchan algerie"] },
  { name: "هايبر لاين", icon: "storefront-outline", region: "DZ", tags: ["hyperline"] },
  { name: "ماكسي مارشي", icon: "cube-outline", region: "DZ", tags: ["maxi marche"] },

  // ─── Saudi Arabia ─────────────────────────────────────────────────────
  { name: "بنده", icon: "storefront-outline", region: "SA", popular: true, tags: ["panda"] },
  { name: "هايبر بنده", icon: "storefront-outline", region: "SA", popular: true, tags: ["hyperpanda"] },
  { name: "العثيم", icon: "cart-outline", region: "SA", popular: true, tags: ["othaim"] },
  { name: "كارفور السعودية", icon: "cart-outline", region: "SA", tags: ["carrefour ksa"] },
  { name: "نستو", icon: "basket-outline", region: "SA", tags: ["nesto"] },
  { name: "لولو السعودية", icon: "storefront-outline", region: "SA", tags: ["lulu ksa"] },
  { name: "دانوب", icon: "leaf-outline", region: "SA", tags: ["danube"] },
  { name: "سافاكو", icon: "cube-outline", region: "SA", tags: ["saveco"] },
  { name: "أسواق المزرعة", icon: "leaf-outline", region: "SA", tags: ["mazraa"] },
  { name: "تمام", icon: "basket-outline", region: "SA", tags: ["tamam"] },

  // ─── UAE ─────────────────────────────────────────────────────────────
  { name: "لولو هايبر ماركت", icon: "storefront-outline", region: "AE", popular: true, tags: ["lulu hypermarket"] },
  { name: "كارفور الإمارات", icon: "cart-outline", region: "AE", popular: true, tags: ["carrefour uae"] },
  { name: "سبينيس", icon: "storefront-outline", region: "AE", tags: ["spinneys"] },
  { name: "يونيون كوب", icon: "people-outline", region: "AE", tags: ["union coop"] },
  { name: "ويست زون", icon: "business-outline", region: "AE", tags: ["west zone"] },
  { name: "نستو الإمارات", icon: "basket-outline", region: "AE", tags: ["nesto uae"] },
  { name: "كوب الإمارات", icon: "storefront-outline", region: "AE", tags: ["coop uae"] },
  { name: "شانجي ماركت", icon: "basket-outline", region: "AE", tags: ["changi market"] },

  // ─── Egypt ────────────────────────────────────────────────────────────
  { name: "كارفور مصر", icon: "cart-outline", region: "EG", popular: true, tags: ["carrefour egypt"] },
  { name: "سبينيس مصر", icon: "storefront-outline", region: "EG", tags: ["spinneys egypt"] },
  { name: "هايبر وان", icon: "storefront-outline", region: "EG", tags: ["hyper one"] },
  { name: "مكروبي", icon: "basket-outline", region: "EG", tags: ["makrobi", "metro market"] },
  { name: "كليو باتي", icon: "storefront-outline", region: "EG", tags: ["cleopatra"] },

  // ─── France ───────────────────────────────────────────────────────────
  { name: "Carrefour", icon: "cart-outline", region: "FR", popular: true, tags: ["carrefour france"] },
  { name: "Leclerc", icon: "storefront-outline", region: "FR", popular: true, tags: ["e.leclerc"] },
  { name: "Lidl", icon: "storefront-outline", region: "FR", popular: true, tags: ["lidl france"] },
  { name: "Auchan", icon: "basket-outline", region: "FR", tags: ["auchan france"] },
  { name: "Intermarché", icon: "storefront-outline", region: "FR", tags: ["intermarche", "itm"] },
  { name: "Super U", icon: "storefront-outline", region: "FR", tags: ["super u", "systeme u"] },
  { name: "Casino", icon: "storefront-outline", region: "FR", tags: ["casino france"] },
  { name: "Monoprix", icon: "storefront-outline", region: "FR", tags: ["monoprix france"] },
  { name: "Franprix", icon: "basket-outline", region: "FR", tags: ["franprix"] },
  { name: "Carrefour City", icon: "cart-outline", region: "FR", tags: ["carrefour city"] },
  { name: "Biocoop", icon: "leaf-outline", region: "FR", tags: ["bio coop"] },
  { name: "Grand Frais", icon: "leaf-outline", region: "FR", tags: ["grand frais"] },
  { name: "Action", icon: "pricetag-outline", region: "FR", tags: ["action france"] },

  // ─── Belgium ──────────────────────────────────────────────────────────
  { name: "Colruyt", icon: "storefront-outline", region: "BE", popular: true, tags: ["colruyt"] },
  { name: "Delhaize", icon: "storefront-outline", region: "BE", popular: true, tags: ["delhaize"] },
  { name: "Carrefour Belgique", icon: "cart-outline", region: "BE", tags: ["carrefour be"] },
  { name: "Lidl Belgique", icon: "storefront-outline", region: "BE", tags: ["lidl be"] },
  { name: "Aldi Belgique", icon: "basket-outline", region: "BE", tags: ["aldi be"] },

  // ─── UK ───────────────────────────────────────────────────────────────
  { name: "Tesco", icon: "storefront-outline", region: "GB", popular: true, tags: ["tesco uk"] },
  { name: "Sainsbury's", icon: "storefront-outline", region: "GB", popular: true, tags: ["sainsburys"] },
  { name: "ASDA", icon: "cart-outline", region: "GB", tags: ["asda"] },
  { name: "Morrisons", icon: "storefront-outline", region: "GB", tags: ["morrisons"] },
  { name: "Waitrose", icon: "leaf-outline", region: "GB", tags: ["waitrose"] },
  { name: "Co-op", icon: "people-outline", region: "GB", tags: ["coop uk"] },
  { name: "M&S Food", icon: "storefront-outline", region: "GB", tags: ["marks spencer"] },
  { name: "Lidl UK", icon: "storefront-outline", region: "GB", tags: ["lidl uk"] },
  { name: "Aldi UK", icon: "basket-outline", region: "GB", tags: ["aldi uk"] },
  { name: "Iceland", icon: "snow-outline", region: "GB", tags: ["iceland uk"] },

  // ─── USA ──────────────────────────────────────────────────────────────
  { name: "Walmart", icon: "cart-outline", region: "US", popular: true, tags: ["walmart"] },
  { name: "Target", icon: "storefront-outline", region: "US", popular: true, tags: ["target us"] },
  { name: "Kroger", icon: "basket-outline", region: "US", tags: ["kroger"] },
  { name: "Costco", icon: "cube-outline", region: "US", tags: ["costco"] },
  { name: "Whole Foods", icon: "leaf-outline", region: "US", tags: ["whole foods amazon"] },
  { name: "Trader Joe's", icon: "storefront-outline", region: "US", tags: ["trader joes"] },
  { name: "Aldi USA", icon: "basket-outline", region: "US", tags: ["aldi us"] },
  { name: "Safeway", icon: "storefront-outline", region: "US", tags: ["safeway"] },
  { name: "Publix", icon: "storefront-outline", region: "US", tags: ["publix"] },
  { name: "H-E-B", icon: "storefront-outline", region: "US", tags: ["heb"] },

  // ─── Global ───────────────────────────────────────────────────────────
  { name: "Carrefour", icon: "cart-outline", region: "GLOBAL", popular: true },
  { name: "Lidl", icon: "storefront-outline", region: "GLOBAL", popular: true },
  { name: "Aldi", icon: "basket-outline", region: "GLOBAL" },
  { name: "Spar", icon: "storefront-outline", region: "GLOBAL" },
  { name: "Costco", icon: "cube-outline", region: "GLOBAL" },
];

export function getRegionLabel(region: StoreRegion, t: (key: string) => string): string {
  switch (region) {
    case "MA": return t("storeMorocco");
    case "TN": return t("storeTunisia");
    case "DZ": return t("storeAlgeria");
    case "SA": return t("storeSaudi");
    case "AE": return t("storeUAE");
    case "EG": return t("storeEgypt");
    case "FR": return t("storeFrance");
    case "BE": return t("storeBelgium");
    case "GB": return t("storeUK");
    case "US": return t("storeUS");
    case "DE": return t("storeGermany");
    case "ES": return t("storeSpain");
    case "IT": return t("storeItaly");
    case "GLOBAL": return t("storeGlobal");
    case "CUSTOM": return t("myStores");
    default: return region;
  }
}
