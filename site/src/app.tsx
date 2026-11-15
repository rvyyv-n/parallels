import type { ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Target, Validation } from "../../dataset/contract";
import { listPlaces, loadBase, loadManifest, loadMatch, loadPlace, loadValidation, queryKey, type PlaceInfo, type Query } from "./data/load";
import { percent } from "./data/match";
import { MAX_PLACES } from "./data/places";
import { SHOWN_FROM } from "./scene/match-map";
import { scrollToId, useAsync, useView } from "./state";
import { Base } from "./ui/Base";
import { BreaksChapter, MatchChapter, TestChapter } from "./ui/Chapters";
import { Checked } from "./ui/Checked";
import { Feature, NEW_FROM_KM, placeName } from "./ui/Feature";
import { Footer } from "./ui/Footer";
import { Judges } from "./ui/Judges";
import { CountUp, useReveal, useScrolled } from "./ui/motion";
import { isChecked, Picker } from "./ui/Picker";
import type { TerrainProps } from "./ui/Terrain";
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
  const listed = places.find((p) => p.cell === view.place);
  const wanted =
    manifest && fresh && view.place !== null && !listed && view.place >= 0 && view.place < manifest.grid.n ? view.place : undefined;
  const opened = useAsync(() => (wanted === undefined ? undefined : loadPlace(manifest!, fresh!, wanted)), [key, wanted]);
  const held = useRef<PlaceInfo | undefined>(undefined);
  const found = wanted === undefined ? (listed ?? places[0]) : opened?.cell === wanted ? opened : undefined;
  if (found || wanted === undefined) held.current = found;
  const selected = found ?? held.current;
  const rank = selected ? places.indexOf(selected) + 1 : 0;
  const loaded = useAsync(
    () => manifest && target && filter && selected && loadMatch(manifest, target, filter, selected.cell),
    [key, selected?.cell],
  );
  const match = loaded?.cell === selected?.cell ? loaded : undefined;
  const validation = useAsync(() => (target?.body === "mars" ? loadValidation() : undefined), [target?.body]);
  const planned = useAsync(() => (manifest && target && listing ? loadBase(manifest, target) : undefined), [target?.id, !!listing]);
  const plan = planned?.target === target?.id ? planned : undefined;
  const bestFor = rank === 0 ? plan?.places.find((p) => p.cell === selected?.cell)?.parts.map((p) => p.challenge.name) : undefined;
  const [Closeup, setCloseup] = useState<ComponentType<TerrainProps>>();
  const [closeup, setCloseupOpen] = useState(false);
  const [peek, setPeek] = useState<number>();

  useEffect(() => scrollTo(0, 0), [view.page]);
  useReveal();
  const scrolled = useScrolled();

  if (!manifest || !target || !filter) return <div class="loading">Parallels</div>;

  const chapter = selected && { manifest, target, filter, place: selected, match };

  const toJudges = () => setView({ page: "judges" });
  const openCloseup = () => {
    setCloseupOpen(true);
    if (!Closeup) import("./ui/Terrain").then((m) => setCloseup(() => m.default));
  };

  const top = (
    <header class="top" data-scrolled={scrolled || undefined}>
      <a class="wordmark" href="#">
        <i aria-hidden="true" />
        Parallels
      </a>
      <nav>
        {view.page === "main" && (
          <button class="link wide-only" onClick={() => scrollToId("checked")}>
            How we checked it
          </button>
        )}
        <button class="link" aria-current={view.page === "judges" ? "page" : undefined} onClick={toJudges}>
          For judges
        </button>
        <button class="link">Tour</button>
      </nav>
    </header>
  );

  if (view.page === "judges")
    return (
      <>
        {top}
        <Judges manifest={manifest} onBack={() => setView({ page: "main" })} />
      </>
    );

  return (
    <>
      {top}
      <main>
        <div class="story" ref={story}>
          <World
            story={story}
            target={target}
            listing={listing}
            selected={selected}
            plan={plan}
            peek={peek}
            onSelect={(cell) => setView({ place: cell })}
          />
          <div class="chapters">
            <section class="chapter" data-chapter="intro" id="intro">
              <div class="copy hero">
                <h1>
                  No place on Earth copies a Moon or Mars base. <em>But each part of a base has a best place to practise.</em>
                </h1>
                <p class="hero-sub">
                  We searched all of Earth’s land with NASA data. Every match shows where it holds and where it breaks.
                </p>
                <div class="hero-actions">
                  <button class="cta" onClick={() => scrollToId("find")}>
                    Find a place
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button class="ghost">Take the tour</button>
                  <a class="text-link learn-link" href="learn.html">
                    New to the Moon and Mars?
                  </a>
                </div>
                <dl class="hero-stats">
                  <div>
                    <dt>squares of land searched</dt>
                    <dd>
                      <CountUp value={manifest.grid.n} />
                    </dd>
                  </div>
                  <div>
                    <dt>base sites</dt>
                    <dd>
                      <CountUp value={manifest.targets.length} />
                    </dd>
                  </div>
                  <div>
                    <dt>mission filters</dt>
                    <dd>
                      <CountUp value={manifest.filters.length} />
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
            <section class="chapter" data-chapter="find" id="find" aria-label="Find a place">
              <div class="copy lead">
                <Picker manifest={manifest} view={view} onChange={setView} />
                {selected && (
                  <Feature
                    target={target}
                    filter={filter}
                    place={selected}
                    rank={rank}
                    bestFor={bestFor}
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
                            <span class="tags">
                              {p.terrain.key !== "none" && <span class="terrain">{p.terrain.name}</span>}
                              {p.nearestAnalogKm !== null && p.nearestAnalogKm >= NEW_FROM_KM && <em class="new">new</em>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {fresh && terrain && places.length < MAX_PLACES && (
                  <p class="few" data-testid="few">
                    {places.length === 0
                      ? `No ${terrain.name.toLowerCase()} place has enough data to be ranked here.`
                      : `Only ${places.length} distinct ${terrain.name.toLowerCase()} ${places.length === 1 ? "place" : "places"} can be ranked here.`}{" "}
                    This type covers {terrain.cells.toLocaleString("en")} of {manifest.grid.n.toLocaleString("en")} squares of land.
                  </p>
                )}
              </div>
              <p class="legend">
                <i aria-hidden="true" />
                Lit land: the closest {percent(1 - SHOWN_FROM)} of matches.
              </p>
            </section>
            {chapter && <MatchChapter {...chapter} />}
            {chapter && <BreaksChapter {...chapter} />}
            {chapter && <TestChapter {...chapter} onCloseup={openCloseup} />}
            {chapter && (
              <Base
                manifest={manifest}
                target={target}
                plan={plan}
                selected={selected.cell}
                onPeek={setPeek}
                onOpen={(cell) => {
                  setPeek(undefined);
                  setView({ place: cell });
                  scrollToId("find");
                }}
              />
            )}
          </div>
        </div>
        <Checked onJudges={toJudges} />
      </main>
      <Footer manifest={manifest} onJudges={toJudges} />
      {closeup && Closeup && selected && <Closeup place={selected} target={target} onClose={() => setCloseupOpen(false)} />}
    </>
  );
}
