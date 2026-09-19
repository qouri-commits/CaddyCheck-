export interface Region {
  id: string;
  city: string;
  cityAr: string;
  cityFr: string;
  country: string;
  countryAr: string;
  countryFr: string;
  flag: string;
  currency: string;
  countryCode: string;
}

export const REGIONS: Region[] = [
  // ─── Morocco 🇲🇦 ─────────────────────────────────────────────────────────
  { id: "ma-casablanca",  city: "Casablanca",  cityAr: "الدار البيضاء", cityFr: "Casablanca",  country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-rabat",       city: "Rabat",        cityAr: "الرباط",        cityFr: "Rabat",        country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-marrakech",   city: "Marrakech",    cityAr: "مراكش",          cityFr: "Marrakech",    country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-fes",         city: "Fès",          cityAr: "فاس",            cityFr: "Fès",          country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-tanger",      city: "Tanger",       cityAr: "طنجة",           cityFr: "Tanger",       country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-agadir",      city: "Agadir",       cityAr: "أكادير",         cityFr: "Agadir",       country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-meknes",      city: "Meknès",       cityAr: "مكناس",          cityFr: "Meknès",       country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-oujda",       city: "Oujda",        cityAr: "وجدة",           cityFr: "Oujda",        country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-kenitra",     city: "Kénitra",      cityAr: "القنيطرة",       cityFr: "Kénitra",      country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-tetouan",     city: "Tétouan",      cityAr: "تطوان",          cityFr: "Tétouan",      country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-safi",        city: "Safi",         cityAr: "آسفي",           cityFr: "Safi",         country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },
  { id: "ma-benimelal",   city: "Béni Mellal",  cityAr: "بني ملال",       cityFr: "Béni Mellal",  country: "Morocco",  countryAr: "المغرب", countryFr: "Maroc",   flag: "🇲🇦", currency: "MAD", countryCode: "MA" },

  // ─── Tunisia 🇹🇳 ─────────────────────────────────────────────────────────
  { id: "tn-tunis",       city: "Tunis",        cityAr: "تونس",           cityFr: "Tunis",        country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-sfax",        city: "Sfax",         cityAr: "صفاقس",          cityFr: "Sfax",         country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-sousse",      city: "Sousse",       cityAr: "سوسة",           cityFr: "Sousse",       country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-bizerte",     city: "Bizerte",      cityAr: "بنزرت",          cityFr: "Bizerte",      country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-monastir",    city: "Monastir",     cityAr: "المنستير",       cityFr: "Monastir",     country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-gabes",       city: "Gabès",        cityAr: "قابس",           cityFr: "Gabès",        country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },
  { id: "tn-kairouan",    city: "Kairouan",     cityAr: "القيروان",       cityFr: "Kairouan",     country: "Tunisia",  countryAr: "تونس",   countryFr: "Tunisie", flag: "🇹🇳", currency: "TND", countryCode: "TN" },

  // ─── Algeria 🇩🇿 ─────────────────────────────────────────────────────────
  { id: "dz-alger",       city: "Alger",        cityAr: "الجزائر",        cityFr: "Alger",        country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-oran",        city: "Oran",         cityAr: "وهران",          cityFr: "Oran",         country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-constantine", city: "Constantine",  cityAr: "قسنطينة",        cityFr: "Constantine",  country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-annaba",      city: "Annaba",       cityAr: "عنابة",          cityFr: "Annaba",       country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-setif",       city: "Sétif",        cityAr: "سطيف",           cityFr: "Sétif",        country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-tlemcen",     city: "Tlemcen",      cityAr: "تلمسان",         cityFr: "Tlemcen",      country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },
  { id: "dz-blida",       city: "Blida",        cityAr: "البليدة",        cityFr: "Blida",        country: "Algeria",  countryAr: "الجزائر",countryFr: "Algérie", flag: "🇩🇿", currency: "DZD", countryCode: "DZ" },

  // ─── Saudi Arabia 🇸🇦 ────────────────────────────────────────────────────
  { id: "sa-riyadh",      city: "Riyadh",       cityAr: "الرياض",         cityFr: "Riyad",        country: "Saudi Arabia", countryAr: "السعودية", countryFr: "Arabie Saoudite", flag: "🇸🇦", currency: "SAR", countryCode: "SA" },
  { id: "sa-jeddah",      city: "Jeddah",       cityAr: "جدة",            cityFr: "Djeddah",      country: "Saudi Arabia", countryAr: "السعودية", countryFr: "Arabie Saoudite", flag: "🇸🇦", currency: "SAR", countryCode: "SA" },
  { id: "sa-makkah",      city: "Makkah",       cityAr: "مكة المكرمة",    cityFr: "La Mecque",    country: "Saudi Arabia", countryAr: "السعودية", countryFr: "Arabie Saoudite", flag: "🇸🇦", currency: "SAR", countryCode: "SA" },
  { id: "sa-madinah",     city: "Madinah",      cityAr: "المدينة المنورة",cityFr: "Médine",       country: "Saudi Arabia", countryAr: "السعودية", countryFr: "Arabie Saoudite", flag: "🇸🇦", currency: "SAR", countryCode: "SA" },
  { id: "sa-dammam",      city: "Dammam",       cityAr: "الدمام",         cityFr: "Dammam",       country: "Saudi Arabia", countryAr: "السعودية", countryFr: "Arabie Saoudite", flag: "🇸🇦", currency: "SAR", countryCode: "SA" },

  // ─── UAE 🇦🇪 ──────────────────────────────────────────────────────────────
  { id: "ae-dubai",       city: "Dubai",        cityAr: "دبي",            cityFr: "Dubaï",        country: "UAE",      countryAr: "الإمارات",countryFr: "Émirats", flag: "🇦🇪", currency: "AED", countryCode: "AE" },
  { id: "ae-abudhabi",    city: "Abu Dhabi",    cityAr: "أبوظبي",         cityFr: "Abu Dhabi",    country: "UAE",      countryAr: "الإمارات",countryFr: "Émirats", flag: "🇦🇪", currency: "AED", countryCode: "AE" },
  { id: "ae-sharjah",     city: "Sharjah",      cityAr: "الشارقة",        cityFr: "Charjah",      country: "UAE",      countryAr: "الإمارات",countryFr: "Émirats", flag: "🇦🇪", currency: "AED", countryCode: "AE" },
  { id: "ae-ajman",       city: "Ajman",        cityAr: "عجمان",          cityFr: "Ajman",        country: "UAE",      countryAr: "الإمارات",countryFr: "Émirats", flag: "🇦🇪", currency: "AED", countryCode: "AE" },

  // ─── Egypt 🇪🇬 ───────────────────────────────────────────────────────────
  { id: "eg-cairo",       city: "Cairo",        cityAr: "القاهرة",        cityFr: "Le Caire",     country: "Egypt",    countryAr: "مصر",    countryFr: "Égypte",  flag: "🇪🇬", currency: "EGP", countryCode: "EG" },
  { id: "eg-alexandria",  city: "Alexandria",   cityAr: "الإسكندرية",     cityFr: "Alexandrie",   country: "Egypt",    countryAr: "مصر",    countryFr: "Égypte",  flag: "🇪🇬", currency: "EGP", countryCode: "EG" },
  { id: "eg-giza",        city: "Giza",         cityAr: "الجيزة",         cityFr: "Gizeh",        country: "Egypt",    countryAr: "مصر",    countryFr: "Égypte",  flag: "🇪🇬", currency: "EGP", countryCode: "EG" },
  { id: "eg-luxor",       city: "Luxor",        cityAr: "الأقصر",         cityFr: "Louxor",       country: "Egypt",    countryAr: "مصر",    countryFr: "Égypte",  flag: "🇪🇬", currency: "EGP", countryCode: "EG" },

  // ─── France 🇫🇷 ──────────────────────────────────────────────────────────
  { id: "fr-paris",       city: "Paris",        cityAr: "باريس",          cityFr: "Paris",        country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-lyon",        city: "Lyon",         cityAr: "ليون",           cityFr: "Lyon",         country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-marseille",   city: "Marseille",    cityAr: "مرسيليا",        cityFr: "Marseille",    country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-toulouse",    city: "Toulouse",     cityAr: "تولوز",          cityFr: "Toulouse",     country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-bordeaux",    city: "Bordeaux",     cityAr: "بوردو",          cityFr: "Bordeaux",     country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-nice",        city: "Nice",         cityAr: "نيس",            cityFr: "Nice",         country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },
  { id: "fr-strasbourg",  city: "Strasbourg",   cityAr: "ستراسبورغ",      cityFr: "Strasbourg",   country: "France",   countryAr: "فرنسا",  countryFr: "France",  flag: "🇫🇷", currency: "EUR", countryCode: "FR" },

  // ─── Belgium 🇧🇪 ─────────────────────────────────────────────────────────
  { id: "be-brussels",    city: "Brussels",     cityAr: "بروكسل",         cityFr: "Bruxelles",    country: "Belgium",  countryAr: "بلجيكا", countryFr: "Belgique",flag: "🇧🇪", currency: "EUR", countryCode: "BE" },
  { id: "be-liege",       city: "Liège",        cityAr: "لييج",           cityFr: "Liège",        country: "Belgium",  countryAr: "بلجيكا", countryFr: "Belgique",flag: "🇧🇪", currency: "EUR", countryCode: "BE" },
  { id: "be-ghent",       city: "Ghent",        cityAr: "غنت",            cityFr: "Gand",         country: "Belgium",  countryAr: "بلجيكا", countryFr: "Belgique",flag: "🇧🇪", currency: "EUR", countryCode: "BE" },
  { id: "be-antwerp",     city: "Antwerp",      cityAr: "أنتويرب",        cityFr: "Anvers",       country: "Belgium",  countryAr: "بلجيكا", countryFr: "Belgique",flag: "🇧🇪", currency: "EUR", countryCode: "BE" },

  // ─── UK 🇬🇧 ───────────────────────────────────────────────────────────────
  { id: "gb-london",      city: "London",       cityAr: "لندن",           cityFr: "Londres",      country: "UK",       countryAr: "المملكة المتحدة", countryFr: "Royaume-Uni", flag: "🇬🇧", currency: "GBP", countryCode: "GB" },
  { id: "gb-manchester",  city: "Manchester",   cityAr: "مانشستر",        cityFr: "Manchester",   country: "UK",       countryAr: "المملكة المتحدة", countryFr: "Royaume-Uni", flag: "🇬🇧", currency: "GBP", countryCode: "GB" },
  { id: "gb-birmingham",  city: "Birmingham",   cityAr: "برمنغهام",       cityFr: "Birmingham",   country: "UK",       countryAr: "المملكة المتحدة", countryFr: "Royaume-Uni", flag: "🇬🇧", currency: "GBP", countryCode: "GB" },
  { id: "gb-leeds",       city: "Leeds",        cityAr: "ليدز",           cityFr: "Leeds",        country: "UK",       countryAr: "المملكة المتحدة", countryFr: "Royaume-Uni", flag: "🇬🇧", currency: "GBP", countryCode: "GB" },

  // ─── USA 🇺🇸 ──────────────────────────────────────────────────────────────
  { id: "us-newyork",     city: "New York",     cityAr: "نيويورك",        cityFr: "New York",     country: "USA",      countryAr: "الولايات المتحدة", countryFr: "États-Unis", flag: "🇺🇸", currency: "USD", countryCode: "US" },
  { id: "us-losangeles",  city: "Los Angeles",  cityAr: "لوس أنجلوس",     cityFr: "Los Angeles",  country: "USA",      countryAr: "الولايات المتحدة", countryFr: "États-Unis", flag: "🇺🇸", currency: "USD", countryCode: "US" },
  { id: "us-chicago",     city: "Chicago",      cityAr: "شيكاغو",         cityFr: "Chicago",      country: "USA",      countryAr: "الولايات المتحدة", countryFr: "États-Unis", flag: "🇺🇸", currency: "USD", countryCode: "US" },
  { id: "us-houston",     city: "Houston",      cityAr: "هيوستن",         cityFr: "Houston",      country: "USA",      countryAr: "الولايات المتحدة", countryFr: "États-Unis", flag: "🇺🇸", currency: "USD", countryCode: "US" },
];

// Group regions by country code
export function getGroupedRegions(searchQuery: string, language: "ar" | "fr" | "en"): { countryCode: string; label: string; flag: string; regions: Region[] }[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q.length === 0 ? REGIONS : REGIONS.filter((r) => {
    const city = language === "ar" ? r.cityAr : language === "fr" ? r.cityFr : r.city;
    const country = language === "ar" ? r.countryAr : language === "fr" ? r.countryFr : r.country;
    return city.toLowerCase().includes(q) || country.toLowerCase().includes(q) || r.city.toLowerCase().includes(q);
  });

  const map = new Map<string, { label: string; flag: string; regions: Region[] }>();
  for (const r of filtered) {
    if (!map.has(r.countryCode)) {
      const label = language === "ar" ? r.countryAr : language === "fr" ? r.countryFr : r.country;
      map.set(r.countryCode, { label, flag: r.flag, regions: [] });
    }
    map.get(r.countryCode)!.regions.push(r);
  }

  return Array.from(map.entries()).map(([countryCode, val]) => ({ countryCode, ...val }));
}

export function getRegionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

export function getRegionLabel(region: Region, language: "ar" | "fr" | "en"): string {
  const city = language === "ar" ? region.cityAr : language === "fr" ? region.cityFr : region.city;
  return `${region.flag} ${city}`;
}
