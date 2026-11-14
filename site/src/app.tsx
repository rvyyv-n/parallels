import { useRef } from "preact/hooks";
import type { Target, Validation } from "../../dataset/contract";
import { listPlaces, loadManifest, loadMatch, loadValidation, queryKey, type Query } from "./data/load";
import { percent } from "./data/match";
import { SHOWN_FROM } from "./scene/match-map";
import { scrollToId, useAsync, useView } from "./state";
import { BreaksChapter, MatchChapter, TestChapter } from "./ui/Chapters";
import { Feature, placeName } from "./ui/Feature";
import { isChecked, Picker } from "./ui/Picker";
import { World } from "./ui/World";

function caution(target: Target, validation: Validation | undefined): string | undefined {
  if (!isChecked(target)) return "Scored, but not checked against test places.";
  if (target.body !== "mars") return undefined;
  const surface = validation?.more_runs?.[0]?.tests
    .filter((t) => t.body === "mars")
    .flatMap((t) => t.checks)
    .find((c) => c.name.startsWith("Surface:") && c.passed === false && c.result !== null);
  return surface
    ? `Caution: our Mars Surface check misses its pass mark (${percent(surface.result!)} against ${percent(surface.pass_mark)}), and this ranking rests on it.`
    : undefined;
}

export function App() {
  const [view, setView] = useView();
  const story = useRef<HTMLDivElement>(null);
  const manifest = useAsync(loadManifest, []);

  const target = manifest?.targets.find((t) => t.id === view.target) ?? manifest?.targets[0];
  const filter = manifest?.filters.find((f) => f.id === view.filter) ?? manifest?.filters[0];
  const terrain = manifest?.terrain_types.find((t) => t.key === view.terrain);
  const query: Query | undefined = target && filter && { target, filter, yearRound: view.yearRound, terrain };
  const key = query && queryKey(query);

  const listing = useAsync(() => manifest && query && listPlaces(manifest, query), [key]);
  const fresh = listing?.key === key ? listing : undefined;
  const places = fresh?.places ?? [];
  const selected = places.find((p) => p.cell === view.place) ?? places[0];
  const rank = selected ? places.indexOf(selected) + 1 : 0;
  const loaded = useAsync(
    () => manifest && target && filter && selected && loadMatch(manifest, target, filter, selected.cell),
    [key, selected?.cell],
  );
  const match = loaded?.cell === selected?.cell ? loaded : undefined;
  const validation = useAsync(() => (target?.body === "mars" ? loadValidation() : undefined), [target?.body]);

  if (!manifest || !target || !filter) return <div class="loading">Parallels</div>;

  const chapter = selected && { manifest, target, filter, place: selected, match };

  return (
    <>
      <header class="top">
        <a class="wordmark" href="#">
          <i aria-hidden="true" />
          Parallels
        </a>
        <nav>
          <button class="link" onClick={() => scrollToId("checked")}>
            How we checked it
          </button>
          <button class="link" onClick={() => setView({ page: "judges" })}>
            For judges
          </button>
          <button class="link">Tour</button>
        </nav>
      </header>
      <main>
        <div class="story" ref={story}>
          <World story={story} target={target} listing={listing} selected={selected} onSelect={(cell) => setView({ place: cell })} />
          <div class="chapters">
            <section class="chapter" data-chapter="find" id="find">
              <div class="copy lead">
                <h1 class="claim">
                  No place on Earth copies a Moon or Mars base whole. <em>Each part of a base has a best place to practise.</em>
                </h1>
                <Picker manifest={manifest} view={view} onChange={setView} />
                {selected && (
                  <Feature
                    target={target}
                    filter={filter}
                    place={selected}
                    rank={rank}
                    match={match}
                    caution={caution(target, validation)}
                    onOpen={() => scrollToId("match")}
                  />
                )}
                {places.length > 1 && (
                  <ol class="runners" aria-label="Best places, each at least 300 km from the others">
                    {places.map((p, i) => {
                      const { name, country } = placeName(p.region);
                      return (
                        <li key={p.cell}>
                          <button aria-pressed={p.cell === selected?.cell} onClick={() => setView({ place: p.cell })}>
                            <span class="n">{i + 1}</span>
                            <span class="name">{name}</span>
                            {country && <span class="country">{country}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              <p class="legend">
                <i aria-hidden="true" />
                {manifest.grid.n.toLocaleString("en")} squares of land searched. Lit: the closest {percent(1 - SHOWN_FROM)}.
              </p>
            </section>
            {chapter && <MatchChapter {...chapter} />}
            {chapter && <BreaksChapter {...chapter} />}
            {chapter && <TestChapter {...chapter} />}
          </div>
        </div>
        <section class="after" id="checked">
          <h2>How we checked it</h2>
        </section>
      </main>
    </>
  );
}
