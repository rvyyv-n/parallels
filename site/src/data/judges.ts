import type { Dataset } from "../../../dataset/contract";

export const AGENCIES: Dataset["agency"][] = ["NASA", "USGS", "ESA", "partner", "other", "computed"];

export const AGENCY_NAMES: Record<Dataset["agency"], string> = {
  NASA: "NASA",
  USGS: "USGS",
  ESA: "ESA",
  partner: "Partner agencies",
  other: "Other sources",
  computed: "Worked out here",
};

export function byAgency(datasets: Dataset[]): { agency: Dataset["agency"]; datasets: Dataset[] }[] {
  return AGENCIES.map((agency) => ({ agency, datasets: datasets.filter((d) => d.agency === agency) })).filter(
    (g) => g.datasets.length > 0,
  );
}

export const sentences = (text: string) => text.split(/(?<=\.)\s+(?=[A-Z])/);
