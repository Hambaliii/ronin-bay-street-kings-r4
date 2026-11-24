# STREET SAMURAI — Ronin Bay

Ronin Bay is a complete city that runs inside a single browser tab. Its story mixes Japanese street racing with a turf war between crews: you drive with the Ronin Kai, fighting for the map one district at a time as your garage fills up. Twelve connected story jobs form the spine of the campaign, running from the harbour all the way to the mountain passes. Territory you have already taken still needs defending, and the longer you spend roaming freely, the harder the RBPD comes after you.

## How it is played

- **WASD / arrow keys** — steering when you are in a car; movement when you are on foot
- **F** — enter a car, or climb back out
- **Space** — handbrake, for sliding the car
- **Shift** — sprinting on foot; NOS once you are driving
- **E** — interact, including inside the garage
- **P / Esc** — pause; this also opens the city map
- **M** — sound on or off

## What is in the game

- A roster of seventeen cars, every one of them built by extruding its side silhouette — plus hero machines taken from rivals in pinkslip races
- A cast of seven named characters who carry the plot from the opening scene to the ending
- A wanted system of five heat stars, escalating to roadblocks, spike strips and a helicopter sweeping the streets with its searchlight
- Passive income that keeps arriving while you hold territory
- A mountain loop set aside for nothing but touge runs
- A day and night cycle that never stops rolling
- A Vice streak throughout the presentation: a neon shoreline timed for sunset, pastel facades along the Coral Strip, open paved plazas, and screenshots staged at dusk

## Under the hood

The engine sits on a vendored copy of three.js. Nothing is fetched from outside and there is no build step: every texture is painted procedurally onto a canvas at runtime, and WebAudio synthesis produces the engine notes, skid noise, sirens and music. To play, simply open `game/index.html` in a desktop browser — that is the entire setup.
