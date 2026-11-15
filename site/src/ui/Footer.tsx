import type { Manifest } from "../../../dataset/contract";
import { AI_NOTE, TEAM } from "./notes";

export function Footer({ manifest, onJudges }: { manifest: Manifest; onJudges: () => void }) {
  const nasa = manifest.datasets.filter((d) => d.agency === "NASA").length;
  return (
    <footer class="foot">
      <div>
        <h2>{TEAM}</h2>
        <p>Parallels, our entry for the NASA Space Apps Challenge 2026.</p>
      </div>
      <div>
        <h2>Data</h2>
        <p>
          {manifest.datasets.length} open datasets, {nasa} of them from NASA. Each one is listed with its link and licence in{" "}
          <button class="text-link" onClick={onJudges}>
            For judges
          </button>
          . The globes are real NASA images:{" "}
          <a href={import.meta.env.BASE_URL + "img/CREDITS.md"} target="_blank" rel="noreferrer">
            image credits
          </a>
          .
        </p>
      </div>
      <div>
        <h2>How we used AI</h2>
        <p data-testid="foot-ai-note">{AI_NOTE}</p>
      </div>
    </footer>
  );
}
