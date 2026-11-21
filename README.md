# Mothlight — a quiet heist

[![make.fun](https://make.fun/badge/competition/best-stealth-game-20261121-1759)](https://make.fun/c/best-stealth-game-20261121-1759)
[![make.fun entry](https://make.fun/badge/entry/best-stealth-game-20261121-1759)](https://make.fun/c/best-stealth-game-20261121-1759)

An original top-down stealth game that runs offline in a desktop browser from
static files. You are Pip, a moth with a lantern and light fingers, sneaking
through three moonlit galleries. Steal the moonshard, slip out the skylight
exit — and never be seen.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no build step.

- **WASD / arrows** — move (running is loud)
- **Shift** — sneak: slow, silent, harder to spot
- **Click** — toss a pebble to lure a warden away
- **P** — pause · **R** — restart the gallery · **M** — mute

## The stealth

- Wardens patrol fixed routes with vision cones — learn them, wait for the gap.
- A cone that sees you fills your suspicion: at a third full the warden stops
  and looks, at full it chases. Break line of sight and it searches, then
  gives up and goes back to its patrol.
- Bushes hide you (unless a warden gets close). Lamp light betrays you.
  Darkness is your friend. Running is loud — wardens hear footsteps and
  investigate the sound.
- The moonshard unlocks the skylight exit. Fireflies are bonus points, and a
  gallery cleared without ever being spotted earns a ghost bonus.

## Screenshots

The four screenshots under `screenshots/` are real renders of the game's own
code in a real browser, staged by `game/src/shots.js` through
`?shot=cover|play|alert|title&seed=1`: the cover is a near miss from a bush,
then the heist itself, a chase, and the title over the vault at night.

## Files

- `game/index.html` — the page; `game/src/main.js` — boot and the game loop
- `game/src/world.js` — rules: movement, wardens, detection, noise, pickups
- `game/src/vision.js` — line of sight and vision cones
- `game/src/levels.js` — the three galleries and their patrols
- `game/src/render.js` — everything drawn: floor, cover, cones, dark and light
- `game/src/audio.js` — footsteps, alarms and chimes, synthesized live
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the screenshot scenes
- `main.ts` — hands the game in; `vendor/makefun-game.ts` — the kit's library

## License

MIT — see `LICENSE`.
