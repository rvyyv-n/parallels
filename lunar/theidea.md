# Lunar Landing Site Navigator: the idea

Official challenge page: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

## The short version

**A "weather forecast" for a Moon landing spot: pick where and when, and it tells you whether you'll have sunlight for power and a view of Earth to call home, for how long, and how that changes if plans slip.**

## The problem NASA describes

Moon missions almost never launch on time. A part runs late, the rocket slips, and suddenly the team has to ask: "We were going to land here on the 5th. What if we land on the 20th? Or a few miles over?"

The data to answer that already exists. NASA's mapping tools (Quickmap, Moon Trek) and JPL's planet-position service (Horizons) have it all. But they're built for experts, and checking one site on one date means juggling several clunky websites and reading raw numbers. **NASA wants a tool where you can try "what if" options quickly and get an answer you can see at a glance.**

## Why sunlight and Earth matter

A lander needs two things to survive:

1. **Sunlight, for power.** Most landers run on solar panels. No sun means no power, and the lander freezes and dies.
2. **A view of Earth, to phone home.** The lander talks to mission control by radio, pointed straight at Earth. If a mountain or crater wall is in the way, nobody hears from it.

## What the tool should let you do

- **Pick a landing spot.** Choose from a ready-made list: Apollo sites, upcoming commercial NASA landers (the CLPS program), other countries' missions (China, India, and so on). Or type in your own coordinates. It's not limited to the south pole, though that's the hot spot.
- **Pick a date and time,** then slide forward and back to see how things change over days or weeks.
- **See the Sun and Earth against the local hills.** Is each one up or hidden?
- **Get the key numbers:**
  - **How high the Sun is.** Low sun means weak power from the solar panels.
  - **How long the sunlight lasts.**
  - **When Earth is visible,** which decides when you can radio home.
  - **Time left before sunset or "Earthset".** NASA calls this critical, because that's the countdown the lander lives by.
- **Compare options side by side,** such as two sites, or one site on two dates.

It can be a website, a phone app, an interactive visual, even a game. NASA leaves that open.

## Things that make it interesting

- **Real terrain matters.** At the south pole the Sun just skims the horizon, so a crater wall can block it completely. You need the actual 3D shape of the ground (from NASA's laser mapping, called LOLA) to get the right answer.
- **Earth wobbles.** From the Moon, Earth doesn't rise and set like the Sun. It hangs in roughly the same spot in the sky and slowly wobbles a little. At the south pole Earth sits right at the horizon, so that small wobble makes it bob in and out of view behind the hills.
- **There's no air.** On Earth the atmosphere bends light a bit near the horizon. On the Moon it doesn't, so the horizon is simply wherever the terrain ends.
- **Make the strangeness obvious.** NASA explicitly wants the tool to show how different the Moon is from Earth. A Moon day lasts about a month, the Sun circles low around the sky at the pole, and moving a short distance can mean the difference between permanent shadow and near-constant light.
- **Explain *why*.** Bonus points for helping people understand why a small change in place or date makes a huge difference.

## Who it's for

Mission planners who need fast answers, plus teachers, students and the public who are curious why landing on the Moon is so hard. That means it should be simple on top, with details available underneath.

## How hard it is

NASA rates it Intermediate to Advanced. The hard part isn't the idea, it's getting the terrain and the Sun and Earth positions right, then making the result easy to read.
