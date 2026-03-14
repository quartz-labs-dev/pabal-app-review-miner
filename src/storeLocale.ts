export const DEFAULT_STORE_COUNTRY = "us";
export const DEFAULT_STORE_LANG = "en";

export interface PlayMarket {
  country: string;
  lang: string;
}

const GLOBAL_IOS_COUNTRY_CODES = [
  "us",
  "ca",
  "mx",
  "br",
  "ar",
  "cl",
  "co",
  "pe",
  "gb",
  "ie",
  "fr",
  "de",
  "it",
  "es",
  "pt",
  "nl",
  "be",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "cz",
  "hu",
  "ro",
  "tr",
  "gr",
  "ua",
  "ru",
  "sa",
  "ae",
  "il",
  "za",
  "eg",
  "in",
  "id",
  "my",
  "sg",
  "th",
  "vn",
  "ph",
  "kr",
  "jp",
  "cn",
  "tw",
  "hk",
  "au",
  "nz"
] as const;

const PLAY_COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  us: "en",
  ca: "en",
  mx: "es",
  br: "pt",
  ar: "es",
  cl: "es",
  co: "es",
  pe: "es",
  gb: "en",
  ie: "en",
  fr: "fr",
  de: "de",
  it: "it",
  es: "es",
  pt: "pt",
  nl: "nl",
  be: "nl",
  se: "sv",
  no: "no",
  dk: "da",
  fi: "fi",
  pl: "pl",
  cz: "cs",
  hu: "hu",
  ro: "ro",
  tr: "tr",
  gr: "el",
  ua: "uk",
  ru: "ru",
  sa: "ar",
  ae: "ar",
  il: "he",
  za: "en",
  eg: "ar",
  in: "en",
  id: "id",
  my: "ms",
  sg: "en",
  th: "th",
  vn: "vi",
  ph: "en",
  kr: "ko",
  jp: "ja",
  tw: "zh",
  hk: "zh",
  au: "en",
  nz: "en"
};

const NORTH_AMERICA_COUNTRIES = ["us", "ca", "mx"] as const;
const GLOBAL_PLAY_COUNTRY_CODES = Object.keys(PLAY_COUNTRY_LANGUAGE_MAP);

function resolvePlayLang(country: string): string {
  return PLAY_COUNTRY_LANGUAGE_MAP[country] ?? DEFAULT_STORE_LANG;
}

function prioritizeNorthAmerica(countries: string[]): string[] {
  const northAmerica = countries.filter((country) => NORTH_AMERICA_COUNTRIES.includes(country as (typeof NORTH_AMERICA_COUNTRIES)[number]));
  const others = countries.filter((country) => !NORTH_AMERICA_COUNTRIES.includes(country as (typeof NORTH_AMERICA_COUNTRIES)[number]));
  return [...northAmerica, ...others];
}

export const GLOBAL_IOS_COUNTRIES: string[] = prioritizeNorthAmerica([...GLOBAL_IOS_COUNTRY_CODES]);
export const GLOBAL_PLAY_MARKETS: PlayMarket[] = prioritizeNorthAmerica([...GLOBAL_PLAY_COUNTRY_CODES]).map((country) => ({
  country,
  lang: resolvePlayLang(country)
}));

export function getPlayMarkets(globalMode: boolean): PlayMarket[] {
  if (!globalMode) {
    return [
      {
        country: DEFAULT_STORE_COUNTRY,
        lang: DEFAULT_STORE_LANG
      }
    ];
  }

  return GLOBAL_PLAY_MARKETS;
}

export function getIosCountries(globalMode: boolean): string[] {
  if (!globalMode) {
    return [DEFAULT_STORE_COUNTRY];
  }

  return GLOBAL_IOS_COUNTRIES;
}
