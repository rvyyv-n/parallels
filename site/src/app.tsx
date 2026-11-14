import { listPlaces, loadManifest, loadMatch, queryKey, type Query } from "./data/load";
import { SHOWN_FROM } from "./scene/match-map";
import { useAsync, useView } from "./state";
import { Feature, placeName } from "./ui/Feature";
import { Picker } from "./ui/Picker";
import { Stage } from "./ui/Stage";

export function App() {
  const [view, setView] = useView();
  const manifest = useAsync(loadManifest, []);

  const target = manifest?.targets.find((t) => t.id === view.target) ?? manifest?.targets[0];
  const filter = manifest?.filters.find((f) => f.id === view.filter) ?? manifest?.filters[0];
  const terrain = manifest?.terrain_types.find((t) => t.key === view.terrain);
  const query: Query | undefined = target && filter && { target, filter, yearRound: view.yearRound, terrain };
  const key = query && queryKey(query);

  const listing = useAsync(() => manifest && query && listPlaces(manifest, query), [key]);
  const fresh = listing?.key === key ? listing : undefined;
  const top = fresh?.places[0];
  const topMatch = useAsync(() => manifest && target && filter && top && loadMatch(manifest, target, filter, top.cell), [key, top?.cell]);

  if (!manifest || !target || !filter) return <div class="loading">Parallels</div>;

  return (
    <>
      <header class="top">
        <a class="wordmark" href="#">
          <i aria-hidden="true" />
          Parallels
        </a>
        <nav>
          <a href="#checked">How we checked it</a>
          <a href="#v=judges">For judges</a>
          <button class="link">Tour</button>
        </nav>
      </header>
      <main>
        <section class="stage">
          <Stage target={target} listing={listing} openCell={view.place} onOpen={(cell) => setView({ place: cell })} />
          <div class="lead">
            <h1 class="claim">
              No place on Earth copies a Moon or Mars base whole. <em>Each part of a base has a best place to practise.</em>
            </h1>
            <Picker manifest={manifest} view={view} onChange={setView} />
            {top && (
              <Feature
                target={target}
                filter={filter}
                place={top}
                match={topMatch?.cell === top.cell ? topMatch : undefined}
                onOpen={() => setView({ place: top.cell })}
              />
            )}
            {fresh && fresh.places.length > 1 && (
              <ol class="runners" start={2} aria-label="Next best places, each at least 300 km from the others">
                {fresh.places.slice(1).map((p, i) => {
                  const { name, country } = placeName(p.region);
                  return (
                    <li key={p.cell}>
                      <button onClick={() => setView({ place: p.cell })}>
                        <span class="n">{i + 2}</span>
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
            Lit land: the closest {Math.round((1 - SHOWN_FROM) * 100)}% of matches. Each place is a square about 50 km wide.
          </p>
        </section>
      </main>
    </>
  );
}
