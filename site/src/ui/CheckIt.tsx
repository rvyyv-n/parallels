import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import type { Match } from "../data/match";
import { sheet, sheetName, trekUrl, worldviewUrl } from "../data/sheet";
import { bodyName } from "./Feature";
import "./checkit.css";

export interface CheckItProps {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  place: PlaceInfo;
  match: Match | undefined;
}

function viewAddress(target: Target, filter: MissionFilter, match: Match) {
  const q = new URLSearchParams(location.hash.replace(/^#/, ""));
  q.set("t", target.id);
  q.set("f", filter.id);
  q.set("p", String(match.cell));
  q.delete("v");
  return `${location.origin}${location.pathname}#${q}`;
}

export function CheckIt({ manifest, target, filter, place, match }: CheckItProps) {
  const download = () => {
    if (!match) return;
    const csv = sheet(manifest, target, filter, place, match, viewAddress(target, filter, match));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = sheetName(target, filter, match);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div class="checkit" data-testid="checkit">
      <h3 class="checkit-label">Check it yourself</h3>
      <ul class="checkit-links">
        <li>
          <button class="text-link" data-testid="checkit-csv" disabled={!match} onClick={download}>
            Download every value (CSV)
          </button>
        </li>
        <li>
          <a class="text-link" data-testid="checkit-worldview" href={worldviewUrl(place.lat, place.lon, manifest.generated)} target="_blank" rel="noreferrer">
            This place in NASA Worldview
          </a>
        </li>
        <li>
          <a class="text-link" data-testid="checkit-trek" href={trekUrl(target)} target="_blank" rel="noreferrer">
            Base site in NASA {bodyName(target)} Trek
          </a>
        </li>
      </ul>
    </div>
  );
}
