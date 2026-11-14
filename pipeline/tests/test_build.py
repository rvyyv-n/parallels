import json

import pytest

from pipeline import build
from pipeline.challenges import CHALLENGES, TRAITS

TEAM_PLAN = {
    "moon": ["Surface", "Resources", "Heat swing", "Shelter", "Polar light and power", "Industrial sites", "Dust"],
    "mars": ["Surface", "Resources", "Heat swing", "Shelter", "Atmosphere and dust", "Signs of life"],
}
LABEL_ONLY = {"moon": ["Shelter", "Dust"], "mars": ["Shelter"]}


@pytest.fixture(scope="module")
def app():
    return build.build()


@pytest.mark.parametrize("body", ["moon", "mars"])
def test_every_team_plan_challenge_is_present(body):
    assert [c["name"] for c in CHALLENGES[body]] == TEAM_PLAN[body]


@pytest.mark.parametrize("body", ["moon", "mars"])
def test_label_only_challenges_say_why(body):
    for c in CHALLENGES[body]:
        if c["name"] in LABEL_ONLY[body]:
            assert c["parts"] == []
            assert all(l["reason"].startswith("Not scored") for l in c["labels"])


def test_team_plan_sub_points_are_covered():
    names = {p["name"] for b in CHALLENGES.values() for c in b for p in c["parts"]}
    labels = {l["name"] for b in CHALLENGES.values() for c in b for l in c.get("labels", [])}
    for want in ["Ruggedness", "Ground strength", "Landing safety", "Water", "Oxygen from local rock", "Hydrated minerals"]:
        assert want in names
    assert "Perchlorates" in labels


def test_mars_dust_is_compared_by_lifting_not_speed():
    assert "not by wind speed" in TRAITS["dust_days"]["plain"]


def test_targets_are_the_chosen_fourteen(app):
    names = {t["name"] for t in app["targets"]}
    assert len([t for t in app["targets"] if t["body"] == "moon"]) == 9
    assert {"Jezero", "Arcadia Planitia", "Gale", "Deuteronilus Mensae", "Arsia Mons caves"} <= names


def test_every_real_target_value_names_its_source(app):
    for t in app["targets"]:
        for k, v in t["values"].items():
            if not v["sample"]:
                assert v.get("source"), (t["id"], k)


def test_sample_traits_are_always_flagged(app):
    sample_only = [k for k, t in TRAITS.items() if "sample" in t and "target_real" not in t]
    for s in app["sites"]:
        for body, vals in s["values"].items():
            for k in sample_only:
                if k in vals:
                    assert vals[k]["sample"]


def test_scores_with_sample_inputs_are_flagged(app):
    for tid, per in app["results"].items():
        body = next(t["body"] for t in app["targets"] if t["id"] == tid)
        for row in per["surface"]:
            assert row["sample"]
        for row in per["heat"]:
            if body == "moon":
                assert not row["sample"]


def test_validation_uses_real_traits_only(app):
    for v in app["validation"].values():
        assert all("earth" in TRAITS[t] for t in v["traits"])
        assert v["note"]


def test_rankings_are_sorted_and_bounded(app):
    for per in app["results"].values():
        for rows in per.values():
            scores = [r["score"] for r in rows]
            assert scores == sorted(scores, reverse=True)
            assert all(0 <= s <= 1 for s in scores)


def test_output_is_small_enough_for_phones():
    assert build.OUT.stat().st_size < 900_000
    json.loads(build.OUT.read_text(encoding="utf-8"))
