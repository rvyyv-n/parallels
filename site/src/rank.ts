import type { Manifest } from "./contract";
import type { Cols } from "./data";
import { km } from "./score";

export const LIST = 20;
export const APART_KM = 800;
export const PER_COUNTRY = 2;

const WORLD: Record<string, string[]> = {
  "North America": ["United States of America", "Canada", "Mexico", "Greenland", "Saint Pierre and Miquelon", "Bermuda", "Clipperton Island"],
  "Central America and the Caribbean": [
    "Belize", "Guatemala", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama", "Cuba", "Jamaica", "Haiti", "Dominican Republic",
    "Puerto Rico", "The Bahamas", "Turks and Caicos Islands", "Cayman Islands", "US Naval Base Guantanamo Bay", "Anguilla", "Antigua and Barbuda",
    "Aruba", "Barbados", "British Virgin Islands", "Caribbean Netherlands", "Curaçao", "Dominica", "Grenada", "Montserrat", "Saint Barthelemy",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin", "Saint Vincent and the Grenadines", "Sint Maarten", "Trinidad and Tobago",
    "United States Virgin Islands",
  ],
  "South America": [
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela",
    "Falkland Islands", "South Georgia and the Islands",
  ],
  Europe: [
    "Aland", "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Czech Republic", "Denmark",
    "Estonia", "Faroe Islands", "Finland", "France", "Germany", "Gibraltar", "Greece", "Guernsey", "Hungary", "Iceland", "Ireland", "Isle of Man",
    "Italy", "Jersey", "Kosovo", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Macedonia", "Malta", "Moldova", "Monaco", "Montenegro",
    "Netherlands", "Norway", "Poland", "Portugal", "Republic of Serbia", "Romania", "San Marino", "Slovakia", "Slovenia", "Spain", "Sweden",
    "Switzerland", "Ukraine", "United Kingdom", "Vatican",
  ],
  Russia: ["Russia"],
  Africa: [
    "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
    "Democratic Republic of the Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
    "Guinea Bissau", "Ivory Coast", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco",
    "Mozambique", "Namibia", "Niger", "Nigeria", "Republic of the Congo", "Rwanda", "S. Sudan", "Saint Helena", "Sao Tome and Principe", "Senegal",
    "Seychelles", "Sierra Leone", "Somalia", "Somaliland", "South Africa", "Sudan", "Swaziland", "Togo", "Tunisia", "Uganda",
    "United Republic of Tanzania", "Western Sahara", "Zambia", "Zimbabwe",
  ],
  "Middle East and Central Asia": [
    "Afghanistan", "Akrotiri Sovereign Base Area", "Armenia", "Azerbaijan", "Bahrain", "Baykonur Cosmodrome", "Cyprus", "Dhekelia Sovereign Base Area",
    "Gaza Strip", "Georgia", "Iran", "Iraq", "Israel", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Lebanon", "Northern Cyprus", "Oman",
    "Pakistan", "Qatar", "Saudi Arabia", "Syria", "Tajikistan", "Turkey", "Turkmenistan", "United Arab Emirates", "Uzbekistan", "West Bank", "Yemen",
  ],
  "South Asia": ["India", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka", "Maldives", "Siachen Glacier", "British Indian Ocean Territory"],
  "East Asia": ["China", "Mongolia", "Japan", "North Korea", "South Korea", "Taiwan", "Hong Kong S.A.R.", "Macau S.A.R"],
  "Southeast Asia": ["Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam", "Malaysia", "Singapore", "Indonesia", "Philippines", "Brunei", "East Timor", "Spratly Is."],
  "Australia and Oceania": [
    "Australia", "New Zealand", "Papua New Guinea", "Fiji", "Solomon Islands", "Vanuatu", "New Caledonia", "Samoa", "American Samoa", "Tonga",
    "Kiribati", "Tuvalu", "Nauru", "Palau", "Marshall Islands", "Federated States of Micronesia", "Guam", "Northern Mariana Islands", "Cook Islands",
    "Niue", "French Polynesia", "Wallis and Futuna", "Pitcairn Islands", "Norfolk Island", "Ashmore and Cartier Islands", "Coral Sea Islands",
    "Indian Ocean Territories", "United States Minor Outlying Islands",
  ],
  Antarctica: ["Antarctica", "French Southern and Antarctic Lands", "Heard Island and McDonald Islands"],
};

const REGION = new Map(Object.entries(WORLD).flatMap(([r, cs]) => cs.map((c) => [c, r] as const)));

export const OTHER = "Other places";

export function countryOf(m: Manifest, cells: Cols, i: number): string | null {
  const r = cells.region?.[i];
  const s = Number.isFinite(r) ? m.regions[r] : undefined;
  if (!s) return null;
  return s.slice(s.lastIndexOf(",") + 1).trim() || null;
}

export const worldOf = (country: string | null) => (country && REGION.get(country)) || OTHER;

export const isNew = (m: Manifest, cells: Cols, i: number) => {
  const far = cells.nearest_analog_km?.[i];
  return Number.isFinite(far) && far > (m.scoring.rare_km ?? 100);
};

export interface Spread {
  ids: number[];
  pool: number;
}

export function spread(m: Manifest, score: Float32Array, cells: Cols, keep: (i: number) => boolean, known: boolean, k = LIST): Spread {
  const order: number[] = [];
  let pool = 0;
  for (let i = 0; i < score.length; i++) {
    if (Number.isNaN(score[i]) || !keep(i)) continue;
    pool++;
    if (known || isNew(m, cells, i)) order.push(i);
  }
  order.sort((a, b) => score[b] - score[a] || a - b);
  const ids: number[] = [];
  const per = new Map<string, number>();
  for (const i of order) {
    if (ids.length === k) break;
    const c = countryOf(m, cells, i);
    if (c && (per.get(c) ?? 0) >= PER_COUNTRY) continue;
    if (ids.some((p) => km(cells.lat[p], cells.lon[p], cells.lat[i], cells.lon[i]) < APART_KM)) continue;
    ids.push(i);
    if (c) per.set(c, (per.get(c) ?? 0) + 1);
  }
  return { ids, pool };
}

export const BANDS = [
  { min: 0.9, cls: "b-vc", word: "very close" },
  { min: 0.75, cls: "b-c", word: "close" },
  { min: 0.5, cls: "b-p", word: "partly" },
  { min: -Infinity, cls: "b-f", word: "far off" },
];

export const bandOf = (v: number) => (Number.isFinite(v) ? BANDS.find((b) => v >= b.min)! : null);

const SHORT: Record<string, string> = {
  surface: "Surface",
  resources: "Resources",
  dryness: "Dryness",
  heat: "Heat swing",
  shelter: "Shelter",
  light: "Light",
  industrial: "Industry",
  dust: "Dust",
  atmosphere: "Air",
  life: "Life",
};

export const shortName = (id: string, name: string) => SHORT[id] ?? name.split(" ")[0];
