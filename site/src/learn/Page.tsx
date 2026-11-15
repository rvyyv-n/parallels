import { useEffect } from "preact/hooks";
import { listPlaces, loadLabels, loadManifest, loadMatch } from "../data/load";
import { httpSource, Store } from "../data/store";
import { useAsync } from "../state";
import { Footer } from "../ui/Footer";
import { baseTarget, BODY_NAME, findHref, MONTH_COLUMNS, placeMonths, WORLD_NAME, worldOf, type World } from "./learn";
import { Analogs, CantCopy, Meet, Photos, Temps, Year } from "./Sections";

const store = new Store(httpSource(import.meta.env.BASE_URL + "data/"));

export function Learn() {
  const world = worldOf(location.search);
  const manifest = useAsync(() => loadManifest(), []);
  const labels = useAsync(() => loadLabels(), []);
  const target = manifest && baseTarget(manifest, world);
  const filter = manifest?.filters[0];
  const listing = useAsync(
    () => manifest && target && filter && listPlaces(manifest, { target, filter, yearRound: false, terrain: undefined }),
    [manifest],
  );
  const match = useAsync(() => listing && loadMatch(manifest!, target!, filter!, listing.places[0].cell), [listing]);
  const months = useAsync(
    () => listing && Promise.all(listing.places.map((p) => store.cell(manifest!.grid, MONTH_COLUMNS, p.cell).then(placeMonths))),
    [listing],
  );

  useEffect(() => {
    document.title = `Parallels: meet ${WORLD_NAME[world]}`;
  }, [world]);

  return (
    <>
      <header class="top learn-top">
        <a class="wordmark" href="./">
          <i aria-hidden="true" />
          Parallels
        </a>
        <nav class="learn-worlds" aria-label="World">
          {(["moon", "mars"] as World[]).map((w) => (
            <a key={w} class="chip" href={`?world=${w}`} aria-current={w === world ? "page" : undefined}>
              {BODY_NAME[w]}
            </a>
          ))}
        </nav>
      </header>
      <main class="learn" data-testid="learn" data-world={world}>
        {manifest && target && filter ? (
          <>
            <Meet manifest={manifest} target={target} world={world} />
            <Temps manifest={manifest} target={target} filter={filter} places={listing?.places} match={match} />
            <Year places={listing?.places} months={months} filter={filter} />
            <CantCopy manifest={manifest} world={world} />
            <Analogs labels={labels} world={world} />
            <Photos />
            <section class="learn-sec learn-end" aria-labelledby="end-h">
              <h2 id="end-h">Your turn</h2>
              <p class="learn-lede">See where Earth matches the base site, and where it breaks.</p>
              <a class="cta learn-find" data-testid="learn-find" href={findHref(target)}>
                Find your own place <span aria-hidden="true">→</span>
              </a>
            </section>
          </>
        ) : (
          <p class="loading">Loading…</p>
        )}
      </main>
      {manifest && <Footer manifest={manifest} onJudges={() => (location.href = "./#v=judges")} />}
    </>
  );
}
