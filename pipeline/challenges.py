TRAITS = {
    "slope": {
        "label": "Typical slope",
        "unit": "°",
        "digits": 1,
        "plain": "How steep the ground usually is across a 10 km patch. Rovers and builders want it gentle.",
        "earth": ("terrain", "slope_median_deg"),
        "target": "slope_median_deg",
    },
    "relief": {
        "label": "Height range",
        "unit": "m",
        "digits": 0,
        "plain": "Difference between the high and low ground in a 10 km patch.",
        "earth": ("terrain", "relief_m"),
        "target": "relief_m",
    },
    "safe10": {
        "label": "Ground under 10°",
        "unit": "%",
        "scale": 100,
        "digits": 0,
        "plain": "Share of the patch flatter than NASA's 10° landing limit.",
        "earth": ("terrain", "share_under_10"),
        "target": "share_under_10",
    },
    "flat5": {
        "label": "Ground under 5°",
        "unit": "%",
        "scale": 100,
        "digits": 0,
        "plain": "Share of the patch flat enough for pads, roads and solar farms.",
        "earth": ("terrain", "share_under_5"),
        "target": "share_under_5",
    },
    "strength": {
        "label": "Ground strength (estimate)",
        "unit": "kPa",
        "digits": 0,
        "plain": "How much load the ground can carry. Nothing measures it directly, so it is estimated from stand-in data.",
        "sample": {"earth": (50, 600), "moon": (20, 200), "mars": (40, 400)},
    },
    "rocks": {
        "label": "Rock cover",
        "unit": "%",
        "digits": 0,
        "plain": "Share of the ground covered by boulders big enough to tip a lander.",
        "sample": {"earth": (0, 40), "moon": (1, 15), "mars": (2, 25)},
    },
    "frozen": {
        "label": "Frozen months a year",
        "unit": "months",
        "digits": 0,
        "plain": "Months when the ground's average temperature stays below 0 °C, so ground ice can last.",
        "earth": ("frozen_months_surface",),
        "target": "frozen_months",
    },
    "ground_ice": {
        "label": "Water in the ground",
        "unit": "% by weight",
        "digits": 1,
        "plain": "How much water the top metre of ground holds, as ice or bound in minerals.",
        "sample": {"earth": (0, 30), "moon": (2, 9), "mars": (5, 40)},
        "target_real": "weh_pct",
    },
    "feldspar": {
        "label": "Feldspar-rich rock",
        "unit": "% of area",
        "digits": 0,
        "plain": "Share of the ground made of pale, feldspar-rich rock like the Moon's highlands, the rock a base would bake oxygen from.",
        "sample": {"earth": (0, 60), "moon": (70, 95)},
    },
    "hydrated": {
        "label": "Clays and sulfates",
        "unit": "% of area",
        "digits": 0,
        "plain": "Share of the ground with water-made minerals (clays, sulfates), which hold water and preserve signs of past life.",
        "sample": {"earth": (0, 50), "mars": (0, 40)},
    },
    "cold": {
        "label": "Coldest ground temperature",
        "unit": "°C",
        "digits": 0,
        "plain": "The coldest the ground surface gets in a year. Both sides are ground temperatures, not air.",
        "earth": ("ts_min_c",),
        "target": "t_min_c",
    },
    "season_swing": {
        "label": "Yearly temperature swing",
        "unit": "°C",
        "digits": 0,
        "plain": "Gap between the hottest and coldest ground temperatures of the year.",
        "earth": ("ts_seasonal_swing_c",),
        "target": "season_swing_c",
    },
    "day_swing": {
        "label": "Day-to-night swing",
        "unit": "°C",
        "digits": 0,
        "plain": "How much the temperature drops from day to night.",
        "earth": ("ts_daily_range_c", "daily_range_c"),
        "target": "daily_swing_c",
    },
    "dry": {
        "label": "Rain and snow",
        "unit": "mm/day",
        "digits": 2,
        "plain": "Average rain and snow. Mars gets none.",
        "earth": ("precip_mm_day",),
        "target": "precip_mm_day",
    },
    "sun_height": {
        "label": "Noon sun height",
        "unit": "°",
        "digits": 1,
        "plain": "How high the sun gets at noon, averaged over a year. Near the Moon's south pole it skims the horizon, so shadows are long.",
        "earth": ("noon_sun_deg",),
        "target": "noon_sun_deg",
    },
    "dust_haze": {
        "label": "Dust in the air",
        "unit": "optical depth",
        "digits": 2,
        "plain": "How hazy the air is with lifted dust, as optical depth. Compared by how much dust the wind lifts, not by wind speed, because Mars air is about 1% as thick as Earth's. Earth's value counts all airborne particles, not only dust.",
        "earth": ("aod_550",),
        "target": "dust_tau",
        "sample": {"mars": (0.3, 0.9)},
    },
    "bare": {
        "label": "Bare ground",
        "unit": "%",
        "scale": 100,
        "digits": 0,
        "plain": "Share of the 10 km patch that is barren rock, sand or soil with no plants, from NASA's MODIS land-cover map. The Moon and Mars are entirely bare.",
        "earth": ("bare_share",),
        "target": "bare_share",
    },
}

TERRAIN_SCALE = {"moon": ("terrain_240", 240), "mars": ("terrain_200", 200)}

SURFACE = {
    "id": "surface",
    "name": "Surface",
    "question": "Where can rovers drive, landers touch down and builders work?",
    "parts": [
        {"name": "Ruggedness", "why": "rover drives and stable construction", "traits": ["slope", "relief"]},
        {"name": "Ground strength", "why": "load from buildings and landers", "traits": ["strength"]},
        {"name": "Landing safety", "why": "slope and rocks under a lander", "traits": ["safe10", "rocks"]},
        {"name": "Bare ground", "why": "driving and building on open rock and soil, not plants", "traits": ["bare"]},
    ],
}

SHELTER = {
    "id": "shelter",
    "name": "Shelter",
    "question": "Where can crews practise using caves and lava tubes?",
    "parts": [],
    "labels": [
        {
            "name": "Caves and lava tubes",
            "reason": "Not scored: Earth has no global map of caves or lava tubes, so there is nothing to rank on our side.",
        }
    ],
}

CHALLENGES = {
    "moon": [
        SURFACE,
        {
            "id": "resources",
            "name": "Resources",
            "question": "Where can teams practise getting water and oxygen from the ground?",
            "parts": [
                {"name": "Water", "why": "mining ice-cemented ground", "traits": ["frozen", "ground_ice"]},
                {"name": "Oxygen from local rock", "why": "baking oxygen out of feldspar-rich rock", "traits": ["feldspar"]},
            ],
        },
        {
            "id": "heat",
            "name": "Heat swing",
            "question": "Where can gear be tested in deep cold and big temperature changes?",
            "parts": [
                {"name": "Cold and temperature change", "why": "keeping a base and its machines working", "traits": ["cold", "season_swing"]},
            ],
        },
        SHELTER,
        {
            "id": "light",
            "name": "Polar light and power",
            "question": "Where does the sun sit low enough to practise with long shadows and polar solar power?",
            "only": "Moon only",
            "parts": [
                {"name": "Low sun and long shadows", "why": "navigating and siting solar panels", "traits": ["sun_height"]},
            ],
            "unscored": [
                {
                    "name": "Share of time in sunlight",
                    "earth_text": "50% averaged over a year, everywhere on Earth",
                    "target_key": "lit_share",
                    "reason": "Not scored: every place on Earth gets sunlight half the time over a year, so it can't tell places apart. Some Moon ridges get far more, and that gap is the point.",
                }
            ],
        },
        {
            "id": "industrial",
            "name": "Industrial sites",
            "question": "Where are the long flat strips for landing pads, solar farms, roads or a railgun?",
            "only": "Moon only",
            "built_from": "Built from the Surface scores.",
            "parts": [
                {"name": "Long flat ground", "why": "pads, solar farms, roads, a railgun", "traits": ["flat5", "safe10", "slope"]},
            ],
            "ideal": {"flat5": 1, "safe10": 1, "slope": 0},
            "ideal_note": "Scored against ideal flat ground (all of it under 5°), not against the region's own terrain, because a steep region still needs flat strips nearby.",
        },
        {
            "id": "dust",
            "name": "Dust",
            "question": "Where can designs be tested against fine, sharp dust?",
            "parts": [],
            "labels": [
                {
                    "name": "Fine, sharp grains",
                    "reason": "Not scored: Moon dust is known only from Apollo samples, and Earth has no map of grain shape.",
                }
            ],
        },
    ],
    "mars": [
        SURFACE,
        {
            "id": "resources",
            "name": "Resources",
            "question": "Where can teams practise finding water and useful minerals?",
            "parts": [
                {"name": "Water", "why": "drilling buried ground ice", "traits": ["frozen", "ground_ice"]},
                {"name": "Hydrated minerals", "why": "clays and sulfates that hold water", "traits": ["hydrated"]},
            ],
            "labels": [
                {
                    "name": "Perchlorates",
                    "reason": "Not scored: perchlorate salts are known from a few landing sites, not mapped across Mars or Earth.",
                }
            ],
        },
        {
            "id": "heat",
            "name": "Heat swing",
            "question": "Where can gear be tested in cold and big day-to-night changes?",
            "parts": [
                {"name": "Cold and daily change", "why": "keeping a base and its machines working", "traits": ["cold", "day_swing"]},
            ],
        },
        SHELTER,
        {
            "id": "atmosphere",
            "name": "Atmosphere and dust",
            "question": "Where can teams practise with wind, dust storms and dust cover?",
            "only": "Mars only",
            "parts": [
                {"name": "Dust lifting", "why": "surface work, habitats and design", "traits": ["dust_haze", "bare"]},
            ],
            "unscored": [
                {
                    "name": "Dust cover",
                    "earth_text": "no Earth equivalent of this index",
                    "target_key": "dci",
                    "reason": "Shown, not scored: the TES dust cover index exists only for Mars.",
                }
            ],
        },
        {
            "id": "life",
            "name": "Signs of life",
            "question": "Where can teams practise searching for past life?",
            "only": "Mars only",
            "built_from": "Built on the hydrated-minerals data, plus dryness and cold.",
            "parts": [
                {"name": "Places that preserve life's traces", "why": "water-made minerals in dry, cold, bare ground", "traits": ["hydrated", "dry", "cold", "bare"]},
            ],
        },
    ],
}

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
