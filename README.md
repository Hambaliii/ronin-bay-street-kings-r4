# Ronin Bay — STREET SAMURAI

A whole city, playable in one browser tab, with no setup beyond opening a file. STREET SAMURAI drops you into Ronin Bay, where Japanese street racing collides with a crew turf war: you run with the Ronin Kai and carve the map up district by district while your garage grows. Holding ground you have won matters just as much as taking it, because districts you own come under attack — and the more time you spend in free roam, the more aggressively the RBPD hunts you.

## The campaign

Twelve story missions, linked end to end, carry the plot from the harbour to the mountain passes. Seven named characters drive that story, appearing from the very first scene through to the finale.

## Controls

| Input | What it does |
| --- | --- |
| **WASD / arrow keys** | Drive while in a car; walk while on foot |
| **F** | Get into a car or get back out of one |
| **Space** | Handbrake — use it to slide the car |
| **Shift** | Sprint on foot; NOS while driving |
| **E** | Interact (works in the garage too) |
| **P / Esc** | Pause — this is also how you open the city map |
| **M** | Toggle the sound |

## Inside Ronin Bay

- Seventeen cars to collect, each one formed by extruding its side profile — and on top of those, hero cars you can win away from rivals in pinkslip races
- A five-star wanted system: heat builds through roadblocks and spike strips until a helicopter joins the chase, sweeping a searchlight over the streets
- Territory that pays you passively for as long as you hold it
- A dedicated mountain loop reserved purely for touge driving
- A day/night cycle that runs continuously
- A distinctly Vice-flavoured look: a neon shoreline caught at sunset, pastel frontages on the Coral Strip, broad open paved plazas, and screenshots composed at dusk

## Running it, and how it is built

There is no build step and nothing is loaded from the network: open `game/index.html` in a desktop browser and the game is running — that really is all there is to it. Underneath, the engine is built on a vendored copy of three.js, every texture is generated procedurally on a canvas while the game runs, and all of the audio — engine notes, tyre skid, sirens and the music itself — is synthesised live with WebAudio.
