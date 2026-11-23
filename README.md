[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v5/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v5/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PUERTO ALBA — Open-World Crime Game

An original open-world crime game built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
Explore the sun-soaked coastal city of **Puerto Alba** on foot and by car, steal cars, outrun the Alba PD,
and pull off the heist of the decade with **Dante Reyes** and **Mara Solís**.

## The story

Dante Reyes is back in Puerto Alba after three years away. Mara Solís has a plan, a crew to build,
and a vault under the Portside docks with both their names on it. Take the city district by district —
Marina, Old Town, La Colina, Portside and the Neon Strip — and stay ahead of the police.

## What is in the game

- **A full open world**: 5 districts, beach and sea, port cranes, a lighthouse, palm-lined boulevards,
  traffic and pedestrians, day/sunset/night lighting.
- **10 story missions** with two playable leads (switch with C — Dante drives faster, Mara shakes
  the police faster), plus 3 street races, taxi fares and 20 hidden packages.
- **Wanted system 1–5 stars**: police pursuit cars, PIT manoeuvres at 3+, roadblocks and a police
  helicopter with a searchlight at 4–5 stars. Break line of sight to cool off.
- **Combat**: punch (F) and shoot (mouse click) against the Viper gang; police respond to gunfire.
- **Crew & standing**: recruit Rolo the Fixer, Iris the Hacker and Tito the Lookout; raise district
  standing to unlock better payouts.
- **HUD with a live minimap**, mission objectives, cash, health, speed and a wanted-star display.
- **Sound**: fully synthesized WebAudio — engine hum, sirens, gunshots and 3 radio stations
  (ALBA FM, NEON 88, SURF 102). No audio files.
- **Save**: progress saves to the browser after every mission (localStorage), with Continue on the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (Shift = boost) |
| E | Enter or steal a car / get out |
| Space | Brake (in car) |
| F | Punch |
| Mouse click | Shoot |
| Drag mouse | Orbit the camera |
| R | Change radio station |
| C | Switch lead (Dante / Mara) |
| M | Start the next story mission |
| T | Start a taxi fare |
| G | Start a street race |
| P | Pause · H help |

## How to play

Serve `game/` with any static file server and open `game/index.html` in desktop Chrome
(`node serve.ts` then http://localhost:8080 also works). Everything runs offline — every script,
image and sound is a file under `game/` or generated at runtime. No network requests.

## Tech

Three.js (vendored as the minified `game/vendor/three.min.js`), plain ES modules, no build step.
Source is split by system: `game/src/city.js`, `vehicles.js`, `player.js`, `police.js`,
`missions.js`, `peds.js`, `audio.js`, `hud.js`, `save.js`, `crew.js`, `effects.js`, `main.js`.

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story, art, sound and music are original.
Nothing from any commercial game is used.
