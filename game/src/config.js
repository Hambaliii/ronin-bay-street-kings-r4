// config.js — all design data for STREET SAMURAI r4
export const CFG = { world: 1320, half: 660, roadEvery: 165, roadW: 30, waterLevel: 0, dayLength: 240, startHour: 10.5 };
export const DISTRICTS = [
  { id: 'port', name: 'Portside', cx: -330, cz: 330, color: 0x3f6d8e, accent: '#57b7ff' },
  { id: 'coral', name: 'Coral Strip', cx: 330, cz: 330, color: 0xd96f4e, accent: '#ffb35c' },
  { id: 'neon', name: 'Neon Mile', cx: 330, cz: -330, color: 0x7a4fd0, accent: '#e879ff' },
  { id: 'hoshino', name: 'Hoshino Heights', cx: -330, cz: -330, color: 0x3f7d5a, accent: '#7dffb0' },
];
// ---- Vice round palette (consumed by world.js) ----
// Pastel art-deco beachfront: bright treated grounds (no bare dirt),
// high-saturation Coral pastels, mid-tone downtown, neon trim that is
// already ON by dusk (onset 17.0-17.2, full by 17.8, not night-only).
export const VICE = {
  ground: {
    base: '#d6ccb4',          // base land: bright warm, never olive/dirt
    paving: '#ded7c6',        // sidewalk / plaza slabs (light warm grey) — V3: zone repeat 66 (~5 m slabs)
    pavingAlt: '#d2cbbb',
    pavingGrout: '#97907c',   // slab grout lines
    grass: '#43a047',         // saturated park / yard green
    grassLight: '#83cf62',
    grassDark: '#2f7d33',
    sand: '#f7e3ac',          // bright warm beach sand
    sandSpeckle: '#dbba7a',
    hill: '#58a34c',
  },
  coralPastels: ['#ff8fab', '#ffb35c', '#ffd93d', '#5eeab7', '#4cc9f0', '#c39bff', '#ff7a6b', '#7dd7ff'],
  downtown: ['#7f9bb3', '#a26769', '#8d99ae', '#b08968', '#6d8ea0', '#9c7bb5', '#5f8d7d', '#c08552'],
  neonTrim: [0xff5da2, 0x39d5ff, 0xffb35c, 0x7dffb0, 0xe879ff],
  neon: { cyan: 0x39d5ff, magenta: 0xff4fd8 },
  dusk: { neonOnset: 17.0, onset: 17.2, full: 17.8 },
};
export const CLUB_RANKS = ['Rookie', 'Runner', 'Drifter', 'Street Ace', 'Night Captain', 'Bay Legend', 'Street King'];
export const CARS = {
  'hachi': { name: 'Hachi-Roku GT', price: 0, len: 4.2, wid: 1.7, topSpeed: 168, accel: 0.55, grip: 0.8, drift: 0.9, color: 0xf2f2f2, body: 'hatch', hood: 0.55, cabin: 0.45, roof: 'hatch', popups: true, tail: 'lip', twoTone: true, glow: null, wheels: 0xc0c0c0 },
  'sora15': { name: 'Sora S15', price: 4500, len: 4.45, wid: 1.75, topSpeed: 205, accel: 0.68, grip: 0.85, drift: 0.95, color: 0x3f8cff, body: 'coupe', hood: 0.6, cabin: 0.5, roof: 'coupe', popups: false, tail: 'ducktail', glow: 0x3f8cff, wheels: 0xd8d8d8 },
  'kei': { name: 'Pico Kei', price: 1200, len: 3.3, wid: 1.45, topSpeed: 128, accel: 0.4, grip: 0.7, drift: 0.5, color: 0xffd23f, body: 'kei', hood: 0.3, cabin: 0.35, roof: 'flat', wheels: 0xaaaaaa },
  'sedan': { name: 'Familia Sedan', price: 2000, len: 4.7, wid: 1.8, topSpeed: 172, accel: 0.5, grip: 0.75, drift: 0.45, color: 0xb9c0c7, body: 'sedan', hood: 0.5, cabin: 0.5, roof: 'flat', wheels: 0xbbbbbb },
  'wagon': { name: 'Tourer Wagon', price: 2600, len: 4.8, wid: 1.8, topSpeed: 178, accel: 0.52, grip: 0.78, drift: 0.5, color: 0x5a7d4f, body: 'wagon', hood: 0.5, cabin: 0.55, roof: 'wagon', wheels: 0xbbbbbb },
  'van': { name: 'Cargo Van', price: 2200, len: 4.9, wid: 1.9, topSpeed: 150, accel: 0.42, grip: 0.7, drift: 0.3, color: 0xd8d8d8, body: 'van', hood: 0.25, cabin: 0.3, roof: 'flat', wheels: 0x999999 },
  'suv': { name: 'Ridge SUV', price: 3200, len: 4.8, wid: 1.95, topSpeed: 182, accel: 0.55, grip: 0.8, drift: 0.4, color: 0x44484e, body: 'suv', hood: 0.45, cabin: 0.5, roof: 'flat', wheels: 0xcccccc },
  'truck': { name: 'Hauler Truck', price: 3800, len: 6.4, wid: 2.2, topSpeed: 140, accel: 0.45, grip: 0.72, drift: 0.25, color: 0x707880, body: 'truck', hood: 0.3, cabin: 0.25, roof: 'flat', wheels: 0x888888 },
  'taxi': { name: 'Bay Taxi', price: 2400, len: 4.8, wid: 1.82, topSpeed: 175, accel: 0.52, grip: 0.75, drift: 0.45, color: 0xf2b21b, body: 'sedan', hood: 0.5, cabin: 0.5, roof: 'flat', livery: 'taxi', wheels: 0xaaaaaa },
  'police': { name: 'RBPD Interceptor', price: 0, len: 4.75, wid: 1.85, topSpeed: 215, accel: 0.72, grip: 0.88, drift: 0.5, color: 0xf4f6f8, body: 'sedan', hood: 0.52, cabin: 0.5, roof: 'flat', livery: 'police', lightbar: true, wheels: 0x333333 },
  'police-suv': { name: 'RBPD Enforcer SUV', price: 0, len: 4.9, wid: 2.0, topSpeed: 200, accel: 0.65, grip: 0.85, drift: 0.4, color: 0x23262b, body: 'suv', hood: 0.45, cabin: 0.5, roof: 'flat', livery: 'police', lightbar: true, wheels: 0x333333 },
  'hatch': { name: 'City Hatch', price: 1800, len: 3.9, wid: 1.7, topSpeed: 160, accel: 0.5, grip: 0.76, drift: 0.55, color: 0xd95555, body: 'hatch', hood: 0.5, cabin: 0.45, roof: 'hatch', wheels: 0xbbbbbb },
  'roadster': { name: 'Mio Roadster', price: 5200, len: 4.0, wid: 1.75, topSpeed: 198, accel: 0.66, grip: 0.87, drift: 0.85, color: 0xd92b4f, body: 'roadster', hood: 0.65, cabin: 0.55, roof: 'coupe', tail: 'lip', wheels: 0xd8d8d8 },
  'hoshi7': { name: 'Hoshi RX-7', price: 9800, len: 4.3, wid: 1.8, topSpeed: 228, accel: 0.78, grip: 0.9, drift: 1.0, color: 0xffcf3f, body: 'coupe', hood: 0.7, cabin: 0.5, roof: 'fastback', popups: true, tail: 'roundWing', roundTail: true, glow: 0xffcf3f, wheels: 0xe8e8e8 },
  'taiyo': { name: 'Taiyo Supra GT', price: 12500, len: 4.5, wid: 1.85, topSpeed: 242, accel: 0.84, grip: 0.92, drift: 0.9, color: 0xff7a1a, body: 'coupe', hood: 0.65, cabin: 0.52, roof: 'fastback', tail: 'roundWing', roundTail: true, glow: 0xff7a1a, wheels: 0xe0e0e0 },
  'kaze': { name: 'Kaze GT-X', price: 15000, len: 4.6, wid: 1.9, topSpeed: 252, accel: 0.88, grip: 0.94, drift: 0.88, color: 0x35586e, body: 'coupe', hood: 0.55, cabin: 0.5, roof: 'coupe', tail: 'quadWing', roundTail: true, glow: 0x57b7ff, wheels: 0xd0d0d0 },
  'gtr35': { name: 'Arakawa GT-R35', price: 18000, len: 4.71, wid: 1.89, topSpeed: 262, accel: 0.93, grip: 0.95, drift: 0.85, color: 0x9aa0a6, body: 'coupe', hood: 0.55, cabin: 0.5, roof: 'coupe', tail: 'wing', roundTail: true, glow: 0xff2a2a, wheels: 0xd0d0d0, desc: 'The R35 rival flagship — silver over black, red stripe, all menace.' },
  'svj': { name: 'SVJ Aventador', price: 45000, len: 4.94, wid: 2.10, topSpeed: 305, accel: 0.99, grip: 0.97, drift: 0.80, color: 0x17181a, body: 'coupe', hood: 0.5, cabin: 0.5, roof: 'coupe', tail: 'wing', roundTail: true, glow: 0xff7a1a, wheels: 0x2a2a2e, desc: 'The dream. Matte black V12 flagship — the Bay Legend\'s final weapon.' },
  'hero-supra': { name: 'TEN-SECOND Taiyo', price: 0, len: 4.5, wid: 1.85, topSpeed: 258, accel: 0.92, grip: 0.93, drift: 0.92, color: 0xff7a1a, body: 'coupe', hood: 0.65, cabin: 0.52, roof: 'fastback', tail: 'roundWing', roundTail: true, glow: 0xffa63f, livery: 'hero-supra', wheels: 0xffd700 },
  'hero-gtr': { name: 'BAYSIDE GHOST Kaze', price: 0, len: 4.6, wid: 1.9, topSpeed: 268, accel: 0.95, grip: 0.96, drift: 0.9, color: 0x2c4a63, body: 'coupe', hood: 0.55, cabin: 0.5, roof: 'coupe', tail: 'quadWing', roundTail: true, glow: 0x7dd7ff, livery: 'hero-gtr', wheels: 0xe8e8e8 },
};
export const CAST = {
  ren: { name: 'Ren Takagi', role: 'driver', h: 1.0, build: 0.55, skin: 0xc98d64, hair: 'black topknot', hairColor: 0x141414, outfit: { top: 'jacket', topColor: 0xff7a1a, trim: 0x14161a, pants: 'jeans', pantsColor: 0x2e3d55, shoes: 0xf2f2f2, shoeStripes: true }, accessory: 'none' },
  ako: { name: "Ako 'Wrench' Sato", role: 'mechanic', h: 0.93, build: 0.42, skin: 0xe8b48c, hair: 'red ponytail', hairColor: 0xa83226, outfit: { top: 'overalls', topColor: 0x3f6d8e, trim: 0x222222, pants: 'overalls', pantsColor: 0x3f6d8e, shoes: 0x333333 }, accessory: 'cap' },
  mika: { name: 'Mika Chen', role: 'lookout', h: 0.95, build: 0.45, skin: 0xf0c8a0, hair: 'violet bob', hairColor: 0x6a3fb5, outfit: { top: 'hoodie', topColor: 0x7a4fd0, trim: 0xffffff, pants: 'skirt+leggings', pantsColor: 0x23232a, shoes: 0xe879ff, shoeStripes: true }, accessory: 'phone' },
  jun: { name: 'Jun Park', role: 'muscle', h: 1.02, build: 0.7, skin: 0xb97a4e, hair: 'buzz', hairColor: 0x1a1a1a, outfit: { top: 'tank', topColor: 0xe8e8e8, trim: 0x888888, pants: 'cargo', pantsColor: 0x4a4a38, shoes: 0x222222 }, accessory: 'chain' },
  ryo: { name: "Ryo 'Ghost' Kaze", role: 'legend', h: 1.0, build: 0.5, skin: 0xd9a878, hair: 'silver undercut', hairColor: 0xc8ccd0, outfit: { top: 'jacket', topColor: 0x2c4a63, trim: 0x9fd8ff, pants: 'jeans', pantsColor: 0x1c2733, shoes: 0x9fd8ff, shoeStripes: true }, accessory: 'glasses' },
  dante: { name: 'Dante Voss', role: 'rival', h: 1.04, build: 0.62, skin: 0x8a5a34, hair: 'slick black', hairColor: 0x0a0a0a, outfit: { top: 'leather', topColor: 0x1a1a1e, trim: 0xc02040, pants: 'jeans', pantsColor: 0x14161c, shoes: 0xc02040 }, accessory: 'gloves' },
  shun: { name: 'Shun Arakawa', role: 'RIVAL ACE', h: 1.02, build: 0.62, skin: 0xb97a4e, hair: 'slick black', hairColor: 0x0a0a0a, outfit: { top: 'leather', topColor: 0x17181c, trim: 0xc02040, pants: 'jeans', pantsColor: 0x14161c, shoes: 0x141414 }, accessory: 'gloves' },
  cop: { name: 'RBPD Officer', role: 'cop', h: 1.0, build: 0.6, skin: 0xc98d64, hair: 'cap', hairColor: 0x24304a, outfit: { top: 'uniform', topColor: 0x24304a, trim: 0xc8a028, pants: 'uniform', pantsColor: 0x1c2733, shoes: 0x141414 }, accessory: 'cap+badge' },
};
export const MISSIONS = [
  { id: 'm1', giver: 'ren', title: 'First Keys', type: 'meet', district: 'port', blurb: 'Collect your Hachi at HQ.', reward: { money: 300, rep: 10 }, need: 0 },
  { id: 'm2', giver: 'ako', title: 'Shakedown Run', type: 'sprint', district: 'port', blurb: 'Test the Hachi on a Portside sprint.', reward: { money: 500, rep: 20 }, need: 0 },
  { id: 'm3', giver: 'mika', title: 'Neon Errand', type: 'delivery', district: 'neon', blurb: 'Run a package to Neon Mile.', reward: { money: 700, rep: 30 }, need: 0 },
  { id: 'm4', giver: 'jun', title: 'Portside Drift School', type: 'drift', district: 'port', blurb: 'Learn to slide around the docks.', reward: { money: 900, rep: 40 }, need: 1 },
  { id: 'm5', giver: 'dante', title: 'Rival at the Lights', type: 'race', district: 'coral', blurb: 'Dante wants a straight fight on Coral.', reward: { money: 1200, rep: 55 }, need: 1 },
  { id: 'm6', giver: 'ryo', title: 'Ghost Line', type: 'timetrial', district: 'hoshino', blurb: 'Chase the Ghost line on the touge.', reward: { money: 1500, rep: 65 }, need: 2 },
  { id: 'm7', giver: 'ako', title: 'Parts Runner', type: 'delivery', district: 'port', blurb: 'Move hot parts across the bay.', reward: { money: 1800, rep: 70 }, need: 2 },
  { id: 'm8', giver: 'jun', title: 'Disable the Pursuit', type: 'disable', district: 'neon', blurb: 'Ram the RBPD pursuit unit off the road.', reward: { money: 2200, rep: 85 }, need: 3 },
  { id: 'm9', giver: 'mika', title: 'Data Jack', type: 'jack', district: 'neon', blurb: 'Jack the data terminal in Neon Mile.', reward: { money: 2600, rep: 95 }, need: 3 },
  { id: 'm10', giver: 'ren', title: 'Hold the Mile', type: 'hold', district: 'neon', blurb: 'Defend Ronin territory on the Mile.', reward: { money: 3000, rep: 105 }, need: 4 },
  { id: 'm11', giver: 'shun', title: 'Kings of Coral', type: 'race', district: 'coral', blurb: 'Settle Coral Strip once and for all.', reward: { money: 3500, rep: 110 }, need: 5 },
  { id: 'm12', giver: 'ryo', title: 'Bayside Ghost', type: 'pinkslip', district: 'hoshino', blurb: "Final run vs Ryo's matte-black SVJ. Win takes the hero-gtr.", reward: { money: 4000, rep: 120 }, need: 6 },
];
export const TOUGE_POINTS = [[-560,-560],[-470,-600],[-380,-545],[-300,-610],[-215,-560],[-170,-640],[-90,-590],[-60,-500],[-140,-450],[-90,-380],[-190,-330],[-290,-390],[-370,-330],[-450,-390],[-540,-350],[-600,-430],[-560,-560]];
