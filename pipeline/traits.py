BODIES = ("moon", "mars")

KNOWN_ANALOG_GROUPS = ("moon-analog", "mars-analog", "moon-basalt")

INPUTS = {
    "ts_coldest": ("climate", "ts_coldest"),
    "ts_hottest": ("climate", "ts_hottest"),
    "ts_annual": ("climate", "ts_annual"),
    "swing_year": ("climate", "swing_year"),
    "swing_day_ground": ("climate", "swing_day_ground"),
    "swing_day_air": ("climate", "swing_day_air"),
    "frozen_months": ("climate", "frozen_months"),
    "precip_mm_yr": ("climate", "precip_mm_yr"),
    "aridity": ("climate", "aridity"),
    "sun_height": ("climate", "sun_height"),
    "aod": ("climate", "aod"),
    "uv_index": ("climate", "uv_index"),
    "m_freeze": ("climate", "m_freeze"),
    "m_rain": ("climate", "m_rain"),
    "m_best": ("climate", "m_best"),
    "usable": ("climate", "usable"),
    "land_frac": ("climate", "land_frac"),
    "region": ("climate", "region_id"),
    "slope_240": ("terrain", "slope_240"),
    "safe10_240": ("terrain", "safe10_240"),
    "flat5_240": ("terrain", "flat5_240"),
    "relief_240": ("terrain", "relief_240"),
    "slope_200": ("terrain", "slope_200"),
    "safe10_200": ("terrain", "safe10_200"),
    "flat5_200": ("terrain", "flat5_200"),
    "relief_200": ("terrain", "relief_200"),
    "elev_mean": ("terrain", "elev_mean"),
    "rock_plutonic": ("surface", "rock_plutonic"),
    "rock_volcanic": ("surface", "rock_volcanic"),
    "rock_evaporite": ("surface", "rock_evaporite"),
    "bare_share": ("surface", "bare_share"),
    "ice_share": ("surface", "ice_share"),
    "veg_share": ("surface", "veg_share"),
}

MINERAL_GROUPS = {
    "clays": ["kaolinite", "montmorillonite", "illite", "chlorite", "vermiculite"],
    "carbonates": ["calcite", "dolomite"],
    "sulfates": ["gypsum"],
    "iron_oxides": ["hematite", "goethite"],
}

MINERAL_NAMES = {
    "clays": "clays",
    "carbonates": "carbonates",
    "sulfates": "sulfates",
    "iron_oxides": "iron oxides",
}

DERIVED = {
    "minerals_seen": "Number of the four mineral groups (clays, carbonates, sulfates, iron oxides) that NASA EMIT reports in the cell.",
    "mineral_groups": "Which mineral groups EMIT reports: bit 1 clays, bit 2 carbonates, bit 4 sulfates, bit 8 iron oxides.",
    "terrain_type": "Terrain type id, see terrain_types.",
    "ice": "Percent of the cell under permanent snow and ice (MODIS land cover).",
    "cluster": "k-means cluster, 255 when an input is missing.",
    "nearest_analog_km": "Distance to the nearest known analog in our test list.",
}

PUBLISHED = {
    "dry": {
        "value": 0.0,
        "stat": "no rain at all",
        "dataset": "nasa-fact-sheets",
        "resolution": "whole body",
        "kind": "published",
        "note": "The Moon has no air and no liquid water; Mars has no rain today. Both sit at the dry end of the aridity scale.",
    },
    "bare": {
        "value": 100.0,
        "stat": "share of bare ground",
        "dataset": "nasa-fact-sheets",
        "resolution": "whole body",
        "kind": "published",
        "note": "No plants grow on the Moon or Mars, so all of the ground is bare.",
    },
    "basalt_rock": {
        "value": 100.0,
        "stat": "main rock of the crust and the crater floor",
        "dataset": "farley-2022",
        "resolution": "region",
        "kind": "published",
        "note": "Mars's crust is basalt, and Jezero's crater floor is igneous rock (Farley et al. 2022).",
    },
    "highland_rock": {
        "value": 100.0,
        "stat": "share of the ground in pale highland rock",
        "dataset": "nasa-moon-composition",
        "resolution": "region",
        "kind": "published",
        "note": "The south pole lies in the lunar highlands, made of pale, feldspar-rich anorthosite.",
    },
}

MARS_MINERALS = {
    "mars-jezero": {
        "groups": ["clays", "carbonates", "sulfates"],
        "dataset": "mars-jezero-minerals",
        "note": "Clays and carbonates mapped from orbit by CRISM in the crater's delta and floor; sulfate salts found by Perseverance on the crater floor.",
    },
    "mars-gale": {
        "groups": ["clays", "sulfates", "iron_oxides"],
        "dataset": "mars-gale-minerals",
        "note": "Clays, sulfates and hematite reported by Curiosity on Mount Sharp.",
    },
}

TRAITS = [
    {
        "id": "cold",
        "label": "Coldest ground temperature",
        "unit": "°C",
        "digits": 0,
        "plain": "How cold the ground surface gets in the coldest month. Both sides are ground temperatures, not air.",
        "column": {"moon": "ts_coldest", "mars": "ts_coldest"},
        "earth_stat": "coldest single hour of ground-surface temperature in the NASA POWER record (record low of TS_MIN), an extreme like the Moon's winter minimum and Mars's night minimum",
        "target": {"moon": ("t_min_k", -273.15), "mars": ("t_min_ground_c", 0.0)},
        "scored_by": "distance",
        "note": "All three sides are extremes: Earth's coldest hour on record, the Moon's winter minimum (Diviner) and Jezero's night minimum.",
    },
    {
        "id": "season_swing",
        "label": "Yearly temperature swing",
        "unit": "°C",
        "digits": 0,
        "plain": "Gap between the warmest and coldest months of the year at ground level.",
        "column": {"moon": "swing_year"},
        "earth_stat": "hottest hour minus coldest hour of ground-surface temperature in the NASA POWER record (record extremes), like Diviner's summer maximum minus winter minimum",
        "target": {"moon": ("t_swing_k", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "day_swing_ground",
        "label": "Day-to-night swing (ground)",
        "unit": "°C",
        "digits": 0,
        "plain": "How much the ground surface cools from day to night. Ground is compared with ground.",
        "column": {"mars": "swing_day_ground"},
        "earth_stat": "yearly average of the daily range of ground-surface temperature (NASA POWER TS_RANGE)",
        "target": {"mars": ("daily_ground_swing_c", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "day_swing_air",
        "label": "Day-to-night swing (air)",
        "unit": "°C",
        "digits": 0,
        "plain": "How much the air near the ground cools from day to night. Air is compared with air.",
        "column": {"mars": "swing_day_air"},
        "earth_stat": "yearly average of the daily range of air temperature at 2 m (NASA POWER T2M_RANGE)",
        "target": {"mars": ("daily_swing_c", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "dry",
        "label": "Dryness (aridity index)",
        "unit": "",
        "digits": 2,
        "plain": "Rain and snow divided by how much water the air could evaporate. Below 0.05 is hyper-arid. The Moon is completely dry and Mars has no rain, so the target is 0.",
        "column": {"moon": "aridity", "mars": "aridity"},
        "target": {"moon": ("dry",), "mars": ("dry",)},
        "scored_by": "distance",
        "earth_stat": "yearly rain and snow (NASA POWER) divided by potential evaporation computed by us (Hargreaves method)",
        "note": "Potential evaporation is computed by us from NASA POWER temperatures and latitude (Hargreaves method). On ice sheets, where yearly evaporation is under 10 mm, the index is not defined, so those cells show no data for dryness.",
    },
    {
        "id": "sun_height",
        "label": "Noon sun height",
        "unit": "°",
        "digits": 1,
        "plain": "How high the sun gets at noon, averaged over a year. Near the Moon's south pole it skims the horizon, so shadows are long.",
        "column": {"moon": "sun_height", "mars": "sun_height"},
        "earth_stat": "yearly average of the noon sun height, computed from latitude",
        "target": {"moon": ("noon_sun_deg", 0.0), "mars": ("noon_sun_deg", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "slope",
        "label": "Typical slope",
        "unit": "°",
        "digits": 1,
        "plain": "How steep the ground usually is, measured at the planet map's own scale. Rovers and builders want it gentle.",
        "column": {"moon": "slope_240", "mars": "slope_200"},
        "target": {"moon": ("slope_median_deg", 0.0), "mars": ("slope_median_deg", 0.0)},
        "scored_by": "distance",
        "note": "This trait's Earth side is ESA data: Copernicus GLO-90 heights read at about 180 m, resampled to 240 m for the Moon and 200 m for Mars, the same method used on the planet maps. The cell value is the median over its blocks of about 10 km.",
    },
    {
        "id": "relief",
        "label": "Height range",
        "unit": "m",
        "digits": 0,
        "plain": "Difference between the high and low ground in a 10 km patch.",
        "column": {"moon": "relief_240", "mars": "relief_200"},
        "target": {"moon": ("relief_m", 0.0), "mars": ("relief_m", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "safe10",
        "label": "Ground under 10°",
        "unit": "%",
        "digits": 0,
        "plain": "Share of the ground flatter than NASA's 10° landing limit.",
        "column": {"moon": "safe10_240", "mars": "safe10_200"},
        "target": {"moon": ("share_under_10", 0.0, 100.0), "mars": ("share_under_10", 0.0, 100.0)},
        "scored_by": "distance",
    },
    {
        "id": "highland_rock",
        "label": "Highland-type rock",
        "unit": "%",
        "digits": 0,
        "plain": "Whether the cell's main rock is plutonic (100) or not (0) on Earth's rock map, the closest class it has to the Moon's pale highland rock.",
        "earth_stat": "100 if the cell's dominant rock class on the half-degree GLiM map is plutonic, otherwise 0",
        "column": {"moon": "rock_plutonic"},
        "target": {"moon": ("highland_rock",)},
        "scored_by": "presence",
        "note": "The GLiM rock map only knows \"plutonic\", not \"anorthosite\": it groups granite with the rare anorthosite bodies, so this trait finds the right family of rock, not the exact rock.",
    },
    {
        "id": "volcanic_rock",
        "label": "Volcanic rock",
        "unit": "%",
        "digits": 0,
        "plain": "Whether the cell's main rock is volcanic (100) or not (0) on Earth's rock map. Mars is a basalt world, and Jezero's floor is volcanic rock.",
        "earth_stat": "100 if the cell's dominant rock class on the half-degree GLiM map is volcanic (basic, intermediate or acid volcanics, or pyroclastics), otherwise 0",
        "column": {"mars": "rock_volcanic"},
        "target": {"mars": ("basalt_rock",)},
        "scored_by": "presence",
        "note": "GLiM gives one main rock class per 0.5° cell, so a small lava field inside a cell of other rock does not count, and the flag says volcanic, not basalt.",
    },
    {
        "id": "minerals",
        "label": "Mars minerals seen from orbit",
        "unit": "groups",
        "digits": 0,
        "plain": "How many of four mineral groups (clays, carbonates, sulfates, iron oxides) NASA's EMIT instrument sees in the cell. The score counts only the groups reported at the Mars site.",
        "column": {"mars": "minerals_seen"},
        "earth_stat": "number of the four mineral groups with any abundance in the NASA EMIT L3 cell",
        "target": {"mars": ("minerals",)},
        "scored_by": "presence",
        "note": "Scored by presence, not amount: the Mars side is published text naming the minerals found there, not a mapped amount. EMIT covers dry, dusty land between about 55°S and 55°N only.",
    },
    {
        "id": "bare",
        "label": "Bare ground",
        "unit": "%",
        "digits": 0,
        "plain": "Share of the cell that is barren rock, sand or soil with no plants. The Moon and Mars are entirely bare.",
        "column": {"moon": "bare_share", "mars": "bare_share"},
        "earth_stat": "share of the cell's land classed barren or sparsely vegetated (MODIS land cover)",
        "target": {"moon": ("bare",), "mars": ("bare",)},
        "scored_by": "distance",
    },
    {
        "id": "frozen",
        "label": "Frozen months a year",
        "unit": "months",
        "digits": 0,
        "plain": "Months when the ground's average temperature stays below 0 °C, so ground ice can last.",
        "column": {"moon": "frozen_months", "mars": "frozen_months"},
        "earth_stat": "months whose average ground-surface temperature is below 0 °C (NASA POWER)",
        "target": {"moon": ("frozen_months", 0.0), "mars": ("frozen_months", 0.0)},
        "scored_by": "distance",
    },
    {
        "id": "dust",
        "label": "Dust in the air",
        "unit": "optical depth",
        "digits": 2,
        "plain": "How hazy the air is with lifted dust. Compared by how much dust the air carries, not by wind speed, because Mars air is about 1% as thick as Earth's.",
        "column": {"mars": "aod"},
        "earth_stat": "yearly average aerosol optical depth at 550 nm (NASA POWER, CERES)",
        "target": {"mars": ("dust_tau", 0.0)},
        "scored_by": "distance",
        "note": "Earth's value counts all particles in the air, not only dust.",
    },
    {
        "id": "flat5",
        "label": "Ground under 5°",
        "unit": "%",
        "digits": 0,
        "plain": "Share of the ground flat enough for landing pads, roads, solar farms or a railgun.",
        "column": {"moon": "flat5_240"},
        "target": {"moon": ("ideal", 100.0)},
        "scored_by": "ideal",
        "note": "Scored against ideal flat ground (all of it under 5°), not against the Moon's terrain, because a steep base region still needs flat strips nearby.",
    },
    {
        "id": "low_relief",
        "label": "Level ground",
        "unit": "m",
        "digits": 0,
        "plain": "Height range in a 10 km patch; the less the better for long straight strips.",
        "column": {"moon": "relief_240"},
        "target": {"moon": ("ideal", 0.0)},
        "scored_by": "ideal",
        "note": "Scored against ideal level ground (no height range), not against the Moon's terrain.",
    },
]

STRENGTH = {
    "moon": {
        "name": "Ground strength",
        "reason": "Not scored: nothing measures how much load the ground can carry, on Earth, the Moon or Mars. Thermal inertia, the usual stand-in, is not mapped at the Moon's pole.",
    },
    "mars": {
        "name": "Ground strength",
        "reason": "Not scored: nothing measures it directly. NASA's stand-in is thermal inertia above 100-140, which means load-bearing ground, not thick dust (Golombek et al. 2020). Mars thermal inertia is not in this version.",
    },
}

SHELTER = {
    "id": "shelter",
    "name": "Shelter",
    "question": "Where can crews practise using caves and lava tubes?",
    "what_to_test": "Moving crew and gear into a lava tube, and radio and navigation underground.",
    "traits": [],
    "labels": [
        {
            "name": "Caves and lava tubes",
            "reason": "Not scored: no global cave map exists for Earth, the Moon or Mars. Known caves are shown on the map as labels.",
        }
    ],
}

CHALLENGES = {
    "moon": [
        {
            "id": "surface",
            "name": "Surface",
            "question": "Where can rovers drive, landers touch down and builders work?",
            "what_to_test": "Rover driving, lander touchdown and building on gentle, bare ground.",
            "traits": ["slope", "safe10", "relief", "highland_rock", "bare"],
            "labels": [
                STRENGTH["moon"],
                {"name": "Rocks and boulders", "reason": "Not scored: Earth has no global map of boulders at this scale."},
            ],
        },
        {
            "id": "resources",
            "name": "Resources",
            "question": "Where can teams practise getting water and oxygen from the ground?",
            "what_to_test": "Digging and heating ice-cemented ground, and handling rock for oxygen extraction.",
            "traits": ["frozen", "highland_rock"],
            "labels": [
                {
                    "name": "Ice in shadowed craters",
                    "reason": "Not scored: the Moon's ice comes from published values (LCROSS, LEND, Mini-RF), and Earth has no matching map of buried ice.",
                }
            ],
        },
        {
            "id": "dryness",
            "name": "Dryness",
            "question": "Where is it as dry as possible?",
            "what_to_test": "Keeping water in a closed loop and dust-dry handling of gear.",
            "traits": ["dry"],
            "labels": [],
        },
        {
            "id": "heat",
            "name": "Heat swing",
            "question": "Where can gear be tested in deep cold and big temperature changes?",
            "what_to_test": "Batteries, seals and heaters through deep cold and a large yearly swing.",
            "traits": ["cold", "season_swing"],
            "labels": [
                {
                    "name": "Thermal inertia",
                    "reason": "Not scored: Moon-wide average; not mapped at the pole. The Diviner map stops at 70° latitude and the base regions lie at 84-89°S.",
                    "target_key": "thermal_inertia_moon_wide",
                }
            ],
        },
        SHELTER,
        {
            "id": "light",
            "name": "Polar light and power",
            "question": "Where does the sun sit low enough to practise with long shadows and polar solar power?",
            "only": "Moon only",
            "what_to_test": "Navigating in long shadows and siting tilted solar panels for a low sun.",
            "traits": ["sun_height"],
            "labels": [
                {
                    "name": "Time in sunlight",
                    "earth_text": "50% averaged over a year, everywhere on Earth",
                    "target_key": "lit_share",
                    "reason": "Shown, not scored: every place on Earth is lit half the time over a year, so it can't tell places apart. Some Moon ridges are lit far longer, and that gap is the point.",
                },
                {
                    "name": "Permanent darkness",
                    "target_key": "psr_share",
                    "reason": "Not scored: Earth has no permanently dark ground outside caves.",
                },
            ],
        },
        {
            "id": "industrial",
            "name": "Industrial sites",
            "question": "Where are the long flat strips for landing pads, solar farms, roads or a railgun?",
            "only": "Moon only",
            "what_to_test": "Laying out landing pads, solar farms, roads or a railgun strip.",
            "traits": ["flat5", "low_relief"],
            "labels": [],
        },
        {
            "id": "dust",
            "name": "Dust",
            "question": "Where can designs be tested against fine, sharp dust?",
            "what_to_test": "Seals, joints and visors against fine, sharp grains.",
            "traits": [],
            "labels": [
                {
                    "name": "Fine, sharp grains",
                    "reason": "Not scored: Moon dust is known only from Apollo samples, and Earth has no map of grain shape.",
                }
            ],
        },
    ],
    "mars": [
        {
            "id": "surface",
            "name": "Surface",
            "question": "Where can rovers drive, landers touch down and builders work?",
            "what_to_test": "Rover driving and lander touchdown on gentle, bare, mineral-rich ground.",
            "traits": ["slope", "safe10", "relief", "volcanic_rock", "minerals", "bare"],
            "labels": [
                STRENGTH["mars"],
                {"name": "Rocks and boulders", "reason": "Not scored: Earth has no global map of boulders at this scale."},
            ],
        },
        {
            "id": "resources",
            "name": "Resources",
            "question": "Where can teams practise finding water and useful minerals?",
            "what_to_test": "Drilling frozen ground and finding water-bearing minerals.",
            "traits": ["frozen", "minerals"],
            "labels": [
                {
                    "name": "Buried ice",
                    "target_key": "weh_pct",
                    "reason": "Shown, not scored: Mars Odyssey measures water in the top metre, and Earth has no matching global map.",
                },
                {
                    "name": "Perchlorates",
                    "reason": "Not scored: perchlorate salts are known from a few landing sites, not mapped across Mars or Earth.",
                },
            ],
        },
        {
            "id": "dryness",
            "name": "Dryness",
            "question": "Where is it as dry as possible?",
            "what_to_test": "Water recycling and instruments that must work in bone-dry air.",
            "traits": ["dry"],
            "labels": [],
        },
        {
            "id": "heat",
            "name": "Heat swing",
            "question": "Where can gear be tested in cold and big day-to-night changes?",
            "what_to_test": "Batteries, seals and heaters through cold nights and large daily swings.",
            "traits": ["cold", "day_swing_ground", "day_swing_air"],
            "labels": [
                {
                    "name": "Thermal inertia",
                    "target_key": "thermal_inertia",
                    "reason": "Not in this version: the Mars map exists (TES), but Earth's side needs a conversion we have not checked yet.",
                }
            ],
        },
        SHELTER,
        {
            "id": "atmosphere",
            "name": "Atmosphere and dust",
            "question": "Where can teams practise with wind, dust storms and dust cover?",
            "only": "Mars only",
            "what_to_test": "Solar panels, filters and seals under dusty, hazy air on bare ground.",
            "traits": ["dust", "bare"],
            "labels": [
                {
                    "name": "Dust cover",
                    "earth_text": "no Earth equivalent of this index",
                    "target_key": "dci",
                    "reason": "Shown, not scored: the TES dust cover index exists only for Mars.",
                },
                {
                    "name": "Wind speed",
                    "reason": "Not scored: Mars air is about 1% as thick as Earth's, so the same wind speed lifts very different amounts of dust.",
                },
                {
                    "name": "UV",
                    "reason": "Not in this version: Earth's strongest UV still falls far short of Mars's unshielded surface.",
                },
            ],
        },
        {
            "id": "life",
            "name": "Signs of life",
            "question": "Where can teams practise searching for past life?",
            "only": "Mars only",
            "what_to_test": "Sampling and life-detection instruments in dry, cold, bare, mineral-rich ground.",
            "traits": ["minerals", "dry", "cold", "bare"],
            "labels": [],
        },
    ],
}

FILTERS = [
    {
        "id": "rover",
        "name": "Rover mobility",
        "plain": "Driving, steering and navigating a rover.",
        "challenges": {"moon": ["surface"], "mars": ["surface", "atmosphere"]},
        "note": "Dust is part of this filter, but Moon dust can't be scored, so on the Moon it is Surface alone. On Mars, Atmosphere and dust carries it.",
    },
    {
        "id": "life_support",
        "name": "Life support",
        "plain": "Keeping a crew alive: water, heat and power.",
        "challenges": {"moon": ["resources", "heat", "light"], "mars": ["resources", "heat", "atmosphere"]},
    },
    {
        "id": "habitat",
        "name": "Habitat structure",
        "plain": "Building a habitat that stands up to the ground and the temperature.",
        "challenges": {"moon": ["surface", "heat"], "mars": ["surface", "heat"]},
        "note": "Ground strength and Shelter belong here too, but neither can be scored, so they are shown as labels.",
    },
    {
        "id": "balanced",
        "name": "Balanced",
        "plain": "Every challenge counts the same.",
        "challenges": {"moon": ["surface", "resources", "dryness", "heat", "light", "industrial"], "mars": ["surface", "resources", "dryness", "heat", "atmosphere", "life"]},
        "since": "1.3",
    },
]

TERRAIN_TYPES = [
    (0, "none", "No type"),
    (1, "arid_basin", "Arid basin"),
    (2, "volcanic_high", "High-altitude volcanic field"),
    (3, "salt_flat", "Salt flat"),
    (4, "frozen_ground", "Frozen ground"),
    (5, "cave", "Cave or lava tube"),
]

CANT_COPY = [
    {
        "name": "Gravity",
        "earth": "9.81 m/s²",
        "moon": "1.62 m/s² (one sixth)",
        "mars": "3.73 m/s² (about a third)",
        "source": "NASA planetary fact sheets",
        "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    },
    {
        "name": "Air",
        "earth": "1,013 mbar at sea level",
        "moon": "none: 3×10⁻¹⁵ bar at night",
        "mars": "6.36 mbar, about 0.6% of Earth's",
        "source": "NASA planetary fact sheets",
        "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    },
    {
        "name": "Radiation on the surface",
        "earth": "about 6.6 µSv a day",
        "moon": "1,369 µSv a day (Chang'e 4, far side; never measured at the pole)",
        "mars": "about 670 µSv a day (Curiosity RAD at Gale)",
        "source": "UNSCEAR via Wikipedia; Zhang et al. 2020; NASA Curiosity RAD",
        "url": "https://science.nasa.gov/photojournal/radiation-measurements-on-mars/",
    },
]

NOT_IN_VERSION = [
    ("Thermal inertia scoring", "Mars thermal inertia (NASA TES) is shown as a label, not scored: turning Earth's day-night temperatures into the same units needs a checked conversion. The Moon has only a Moon-wide average; its map stops at 70° latitude."),
    ("UV", "Not scored or shown: Earth's strongest UV, on high dry ground, still falls far short of Mars's unshielded surface."),
    ("How hard it is to get there", "Not asked for by the challenge; left out to keep the first version focused."),
    ("Zoom to one valley or crater", "The map works on half-degree cells (about 50 km). Picking the best valley or crater inside a cell is the next step."),
    ("More targets as defaults", "The Moon's south pole and Jezero crater are the default targets and the only ones checked against the test places. Gale, Arcadia Planitia, Deuteronilus Mensae and the Arsia Mons caves are scored too, but not validated; a challenge a target has too few values for shows no data."),
    ("The nine Artemis regions as separate targets", "Their values are shown under the Moon's south pole, whose target is their median; they are not scored as nine separate maps."),
    ("Reverse mode", "Clicking any place on Earth to see its closest Moon or Mars target is an idea for later."),
    ("Mars ice maps (SWIM)", "They show how far datasets agree that ice is there, and Earth has nothing to compare, so they can only be a label."),
    ("Martian valley networks", "Ancient river landscapes are a good analog idea, but there is no global Earth layer to score them yet."),
    ("Lunar pits", "The LROC lunar pit atlas was not checked; Moon caves are not listed."),
]


def trait(tid):
    return next(t for t in TRAITS if t["id"] == tid)
