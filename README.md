# Ronin Bay — STREET SAMURAI

A whole city, playable straight from the browser tab. Ronin Bay draws on Japanese street racing and a crew war over turf, with the player rolling alongside the Ronin Kai. Take the map district by district while the garage grows: a dozen linked story jobs carry the run from the harbour up into the mountain passes, ground already won still has to be held, and every extra minute spent roaming draws a heavier RBPD response.

## Keys you will use

- **WASD / arrow keys** — move around on foot, steer once you are driving
- **F** — climb into a car, or get out again
- **Space** — pull the handbrake and slide
- **Shift** — NOS while driving; a sprint while walking
- **E** — the interact key, garage included
- **P / Esc** — pause the game and bring up the city map
- **M** — toggle the sound off or back on

## Highlights of the build

- Seventeen cars, each one formed by extruding its side silhouette, alongside hero machines won off rivals through pinkslip races
- Seven named characters steer the plot from the first scene through to the ending
- Heat rises across five wanted stars, bringing roadblocks, spike strips and a helicopter that sweeps its searchlight over the streets
- Holding territory earns a steady passive income as time passes
- One mountain loop is reserved purely for touge runs
- The day and night cycle keeps rolling without pause
- Vice flavour runs throughout: a neon shoreline timed for sunset, pastel Coral Strip facades, open paved plazas and screenshots staged at dusk

## Technical notes

Underneath sits a vendored three.js. Textures never leave the machine either, since each one is painted procedurally onto a canvas at runtime, while WebAudio synthesis handles the engine notes, the skid noise, the sirens and the music. With no build step and no external fetching involved, opening `game/index.html` in a desktop browser is the whole setup.
