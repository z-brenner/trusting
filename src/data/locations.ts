import countries from "./countries.json";

export type Country = { code: string; name: string; numeric: string; eu: boolean; eea: boolean };

export const COUNTRIES: Country[] = countries as Country[];

/** Non-country location codes an administrator can disclose. */
export const REGIONS = [
  { code: "EU", name: "European Union", description: "Any EU member state" },
  { code: "EEA", name: "European Economic Area", description: "EU plus Iceland, Liechtenstein and Norway" },
  { code: "GLOBAL", name: "Global", description: "Vendor processes data in multiple regions worldwide" },
] as const;

export type LocationCode = string;

const countryByCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function locationName(code: string): string {
  const region = REGIONS.find((r) => r.code === code);
  if (region) return region.name;
  return countryByCode.get(code)?.name ?? code;
}

export function isValidLocation(code: string): boolean {
  return REGIONS.some((r) => r.code === code) || countryByCode.has(code);
}

/** Expand region codes to the ISO country codes that should be highlighted on a map. */
export function expandLocationToCountries(code: string): string[] {
  if (code === "EU") return COUNTRIES.filter((c) => c.eu).map((c) => c.code);
  if (code === "EEA") return COUNTRIES.filter((c) => c.eea).map((c) => c.code);
  if (code === "GLOBAL") return [];
  return countryByCode.has(code) ? [code] : [];
}

export function countryByNumeric(numeric: string): Country | undefined {
  return COUNTRIES.find((c) => c.numeric === numeric);
}

export const ALL_LOCATION_OPTIONS = [
  ...REGIONS.map((r) => ({ code: r.code, name: r.name, group: "Regions" })),
  ...COUNTRIES.map((c) => ({ code: c.code, name: c.name, group: "Countries" })),
];
