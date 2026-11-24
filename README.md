# STREET SAMURAI — Ronin Bay

Ronin Bay is an open city you play straight from the browser, built around Japanese street racing culture and a turf war between crews. Riding with the Ronin Kai, you work the city district by district: your garage grows, twelve story jobs link together into a climb that starts down at the harbour and ends up on the mountain roads, the ground you take has to be defended, and the RBPD keeps turning up the heat the longer you stay out.

## Keys and controls

- **WASD / arrow keys** — on foot this walks you around; behind the wheel it steers
- **F** — climb into a vehicle, or get back out of one
- **Space** — the handbrake, there for making the car slide
- **Shift** — NOS boost while you are driving, and a run while you are on foot
- **E** — interact, the garage included
- **P / Esc** — pause the game and bring up the city map
- **M** — turn the audio off or back on

## Inside the game

- Seventeen vehicles, each shaped from an extruded side profile, plus hero cars won from rivals in pinkslip races
- Seven named characters carry the story from its opening scene through to the finale
- Wanted heat runs from one star up to five, bringing roadblocks, spike strips and a helicopter that sweeps its searchlight over you
- Territory under your control pays out passive income as time goes by
- One mountain loop exists purely for touge driving and serves no other purpose
- The day and night cycle is complete and never stops turning
- Vice styling runs through everything: a neon shoreline graded around sunset, pastel frontage along Coral Strip, paved plaza spaces, and screenshots composed at dusk

## Under the hood

Underneath it all sits a vendored copy of three.js. Textures come from procedural canvas work, while WebAudio synthesis produces the engine note, the skid sounds, the sirens and the music. There is no build step and nothing is fetched from outside: open `game/index.html` in a desktop browser and play.
