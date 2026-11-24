# STREET SAMURAI — Ronin Bay

A browser open world built around JDM street racing and turf crime. You ride with the Ronin Kai club through Ronin Bay: take districts one at a time, grow the garage, work through a dozen missions that run from downtown out to the mountain passes, defend the ground you hold, and stay ahead of the RBPD whenever the heat climbs.

## Controls and keys

- **WASD / arrows** — driving, and movement on foot
- **F** — get into a car, or climb back out
- **Space** — handbrake, for drifting
- **Shift** — NOS boost
- **E** — interact, including at the garage
- **P / Esc** — pause and open the city map
- **M** — mute the sound


## What is inside

- Seventeen cars shaped from extruded side profiles, plus hero cars taken from rivals on pinkslips
- A story carried from the opening to the finale by seven named characters
- Wanted heat running from one star to five, with roadblocks, spike strips and a helicopter searchlight on your tail
- Passive income paid by territory under your control
- A mountain loop that exists purely for touge runs
- A complete cycle that turns day into night and back again
- Vice flavour: a neon coastline graded for sunset, the pastel Coral Strip, paved plazas, and screenshots staged at dusk

## Build notes

The whole thing runs on vendored three.js with procedural canvas textures, and WebAudio synthesis supplies the engine, skid, siren and music. There is no build step and nothing gets fetched from outside: open `game/index.html` in a desktop browser and play.
