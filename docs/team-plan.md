# Team plan

Our final idea. The approach is ours, from our planning board. Claude checked it against the available data and against our local [Challenge Guide](challenge-guide.pdf), suggested refinements, and we kept the ones listed at the end.

## Approach

No single place on Earth can simulate everything about a Moon or Mars base. So we split base-building into specific challenges, and match each challenge to the Earth sites best suited to test it.

Within each challenge we score only what both sides can measure. Parts without data on both sides are shown as labels, marked as not scored, with the reason.

## Mission filters

Users pick what they're testing, and the challenges below are weighted to match:

- **Rover mobility:** Surface, Dust
- **Life support:** Resources, Heat swing, Polar light and power (Moon), Atmosphere and dust (Mars)
- **Habitat structure:** ground strength, Shelter, Heat swing

Users can also set the weights by hand.

## Terrain types

Every Earth match is tagged with a terrain type, worked out from the data so the rule is visible:

- **Arid basin:** very dry (aridity index) and low-lying
- **High-altitude volcanic field:** volcanic rock (rock map) and high ground
- **Salt flat:** evaporite rock (rock map) and very dry
- **Frozen ground:** permafrost
- **Cave or lava tube:** a list of known sites, not mapped (see Shelter)

Users can filter matches by type. A clustering step also groups Earth places with similar values, and we check that the groups line up with the tags.

## Moon

**Surface** (shared)
- Ruggedness: rover ops, construction stability
- Ground strength: load from builds and landers (estimated from stand-in data, and marked as an estimate)
- Landing safety: slope and rockiness, against NASA's landing limit of slopes under 10°
- Rock type: the pale highland rock of the south pole

**Resources** (shared)
- Water: ice-cemented ground
- Oxygen from local rock

**Dryness** (shared)
- Aridity: rain against evaporation. The Moon is completely dry

**Heat swing** (shared)
- Extreme cold and large day-to-night or seasonal temperature changes
- Thermal inertia: how fast the ground heats and cools

**Shelter** (shared)
- Caves and lava tubes (label only: no global cave map exists for Earth, the Moon or Mars; we list known sites)

**Polar light and power** (Moon only)
- Low sun, long shadows, permanent darkness, and sites for solar power

**Industrial sites** (Moon only)
- Long, flat strips for landing pads, solar farms, roads, or a railgun
- Built from the Surface scores

**Dust** (label only)
- Fine, sharp grains and how they affect designs
- Not scored: Moon dust is known only from Apollo samples, and Earth has no map of grain shape

## Mars

**Surface** (shared)
- Ruggedness: rover ops, construction stability
- Ground strength: load from builds and landers (estimated from stand-in data, and marked as an estimate)
- Landing safety: slope and rockiness
- Minerals: clays, sulfates, carbonates, olivine

**Resources** (shared)
- Water: buried ground ice
- Hydrated minerals (clays, sulfates)
- Perchlorates (label only: known from a few sites, not mapped)

**Dryness** (shared)
- Aridity: rain against evaporation

**Heat swing** (shared)
- Cold and day-to-night temperature changes
- Thermal inertia: how fast the ground heats and cools

**Shelter** (shared)
- Caves and lava tubes (label only, as on the Moon)

**Atmosphere and dust** (Mars only)
- Wind, dust storms and dust cover
- Effect on surface ops, habitats and design
- Compared by how often dust is lifted, not by wind speed, because Mars air is about 1% as thick as Earth's
- UV: Earth's strongest UV, on high, dry ground, against Mars's unshielded surface

**Signs of life** (Mars only)
- Places to practise searching for past life, built on the hydrated-minerals data

## Every challenge

- **Seasons.** Each site shows its best months to test, its freeze–thaw months and its rainy or monsoon months. A site that's only usable part of the year scores lower for year-round testing.
- **Earth can't copy:** low gravity, the Moon's vacuum, Mars's thin air, and space radiation, which Earth's magnetic field and thick air block.

## Scoring

- **Same scale on both sides.** The global search runs on one 0.5° grid. Terrain is compared at the planet map's own scale. Every value shows its resolution.
- **Per trait:** how close a place gets to the target, ranked against all of Earth's land.
- **Overall:** the trait scores combined with the mission filter's weights. The total is never shown without the trait bars.
- **Checked on known analogs** before we trust it ([guidelines](guidelines.md#2-doing-the-science-honestly)).

Details: [Claude's plan](claudes-plan.md#3-method).

## To consider

Ancient water landscapes, such as Mars's valley networks.

## Changes from the board

The original board version is in git history. Claude suggested these changes and we accepted them:

- Bearing capacity became ground strength, marked as an estimate, because nothing measures it directly.
- Landing safety added under Surface (our placement).
- Ilmenite became oxygen from local rock, because ilmenite is rare at the Moon's south pole.
- Moon dust became a label, and Mars dust joined Atmosphere, because dust grain data is too thin to score.
- The railgun strip became industrial sites, with the railgun as one example.
- Heat swing, polar light and power, shelter, and signs of life moved up from "to consider".
- Mars wind is compared by dust activity, not speed.

To meet the Challenge Guide's benchmarks:

- Mission filters for rover mobility, life support and habitat structure.
- Terrain types, with clustering; salt flats replace "salts and brines" from "to consider".
- Dryness (aridity), thermal inertia, rock type and minerals, and Mars UV added as traits.
- Seasons: best months, freeze–thaw and monsoons.
- A scoring section, answering the guide's questions on resolution and distance measures.
