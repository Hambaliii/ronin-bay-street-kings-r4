// Content tables and tuning values for the whole build live here.
export const CFG = { world: 1320, half: 660, roadW: 30, roadEvery: 165, dayLength: 240, waterLevel: 0, startHour: 10.5 };
export const DISTRICTS = [];
DISTRICTS.push({ cz: 330, cx: -330, id: 'port', name: 'Portside', accent: '#57b7ff', color: 0x3f6d8e });
DISTRICTS.push({ cz: 330, cx: 330, id: 'coral', name: 'Coral Strip', accent: '#ffb35c', color: 0xd96f4e });
DISTRICTS.push({ cz: -330, cx: 330, id: 'neon', name: 'Neon Mile', accent: '#e879ff', color: 0x7a4fd0 });
DISTRICTS.push({ cz: -330, cx: -330, id: 'hoshino', name: 'Hoshino Heights', accent: '#7dffb0', color: 0x3f7d5a });
// The world builders draw their palette from here: pastel deco
// takes the beachfront, Coral goes saturated, downtown holds the
// mid tones, and neon trim wakes at early dusk, not full night.
export const VICE = {};
VICE.neon = { cyan: 0x39d5ff, magenta: 0xff4fd8 };
VICE.dusk = { full: 17.8, onset: 17.2, neonOnset: 17.0 };
VICE.neonTrim = [];
VICE.neonTrim.push(0xff5da2);
VICE.neonTrim.push(0x39d5ff);
VICE.neonTrim.push(0xffb35c);
VICE.neonTrim.push(0x7dffb0);
VICE.neonTrim.push(0xe879ff);
VICE.downtown = [];
VICE.downtown.push('#7f9bb3');
VICE.downtown.push('#a26769');
VICE.downtown.push('#8d99ae');
VICE.downtown.push('#b08968');
VICE.downtown.push('#6d8ea0');
VICE.downtown.push('#9c7bb5');
VICE.downtown.push('#5f8d7d');
VICE.downtown.push('#c08552');
VICE.coralPastels = [];
VICE.coralPastels.push('#ff8fab');
VICE.coralPastels.push('#ffb35c');
VICE.coralPastels.push('#ffd93d');
VICE.coralPastels.push('#5eeab7');
VICE.coralPastels.push('#4cc9f0');
VICE.coralPastels.push('#c39bff');
VICE.coralPastels.push('#ff7a6b');
VICE.coralPastels.push('#7dd7ff');
VICE.ground = {};
VICE.ground.grass = '#43a047';
VICE.ground.paving = '#ded7c6';
VICE.ground.base = '#d6ccb4';
VICE.ground.pavingAlt = '#d2cbbb';
VICE.ground.pavingGrout = '#97907c';
VICE.ground.grassLight = '#83cf62';
VICE.ground.grassDark = '#2f7d33';
VICE.ground.sandSpeckle = '#dbba7a';
VICE.ground.sand = '#f7e3ac';
VICE.ground.hill = '#58a34c';
export const CLUB_RANKS = [];
CLUB_RANKS.push('Rookie');
CLUB_RANKS.push('Runner');
CLUB_RANKS.push('Drifter');
CLUB_RANKS.push('Street Ace');
CLUB_RANKS.push('Night Captain');
CLUB_RANKS.push('Bay Legend');
CLUB_RANKS.push('Street King');
export const CARS = {
  'hachi': { price: 0, name: 'Hachi-Roku GT', wid: 1.7, len: 4.2, accel: 0.55, topSpeed: 168, drift: 0.9, grip: 0.8, body: 'hatch', color: 0xf2f2f2, cabin: 0.45, hood: 0.55, popups: true, roof: 'hatch', glow: null, tail: 'lip', twoTone: true, wheels: 0xc0c0c0 },
  'sora15': { price: 4500, name: 'Sora S15', wid: 1.75, len: 4.45, accel: 0.68, topSpeed: 205, drift: 0.95, grip: 0.85, body: 'coupe', color: 0x3f8cff, cabin: 0.5, hood: 0.6, popups: false, roof: 'coupe', glow: 0x3f8cff, tail: 'ducktail', wheels: 0xd8d8d8 },
  'kei': { price: 1200, name: 'Pico Kei', wid: 1.45, len: 3.3, accel: 0.4, topSpeed: 128, drift: 0.5, grip: 0.7, body: 'kei', color: 0xffd23f, cabin: 0.35, hood: 0.3, roof: 'flat', wheels: 0xaaaaaa },
  'sedan': { price: 2000, name: 'Familia Sedan', wid: 1.8, len: 4.7, accel: 0.5, topSpeed: 172, drift: 0.45, grip: 0.75, body: 'sedan', color: 0xb9c0c7, cabin: 0.5, hood: 0.5, roof: 'flat', wheels: 0xbbbbbb },
  'wagon': { price: 2600, name: 'Tourer Wagon', wid: 1.8, len: 4.8, accel: 0.52, topSpeed: 178, drift: 0.5, grip: 0.78, body: 'wagon', color: 0x5a7d4f, cabin: 0.55, hood: 0.5, roof: 'wagon', wheels: 0xbbbbbb },
  'van': { price: 2200, name: 'Cargo Van', wid: 1.9, len: 4.9, accel: 0.42, topSpeed: 150, drift: 0.3, grip: 0.7, body: 'van', color: 0xd8d8d8, cabin: 0.3, hood: 0.25, roof: 'flat', wheels: 0x999999 },
  'suv': { price: 3200, name: 'Ridge SUV', wid: 1.95, len: 4.8, accel: 0.55, topSpeed: 182, drift: 0.4, grip: 0.8, body: 'suv', color: 0x44484e, cabin: 0.5, hood: 0.45, roof: 'flat', wheels: 0xcccccc },
  'truck': { price: 3800, name: 'Hauler Truck', wid: 2.2, len: 6.4, accel: 0.45, topSpeed: 140, drift: 0.25, grip: 0.72, body: 'truck', color: 0x707880, cabin: 0.25, hood: 0.3, roof: 'flat', wheels: 0x888888 },
  'taxi': { price: 2400, name: 'Bay Taxi', wid: 1.82, len: 4.8, accel: 0.52, topSpeed: 175, drift: 0.45, grip: 0.75, body: 'sedan', color: 0xf2b21b, cabin: 0.5, hood: 0.5, roof: 'flat', livery: 'taxi', wheels: 0xaaaaaa },
  'police': { price: 0, name: 'RBPD Interceptor', wid: 1.85, len: 4.75, accel: 0.72, topSpeed: 215, drift: 0.5, grip: 0.88, body: 'sedan', color: 0xf4f6f8, cabin: 0.5, hood: 0.52, roof: 'flat', livery: 'police', lightbar: true, wheels: 0x333333 },
  'police-suv': { price: 0, name: 'RBPD Enforcer SUV', wid: 2.0, len: 4.9, accel: 0.65, topSpeed: 200, drift: 0.4, grip: 0.85, body: 'suv', color: 0x23262b, cabin: 0.5, hood: 0.45, roof: 'flat', livery: 'police', lightbar: true, wheels: 0x333333 },
  'hatch': { price: 1800, name: 'City Hatch', wid: 1.7, len: 3.9, accel: 0.5, topSpeed: 160, drift: 0.55, grip: 0.76, body: 'hatch', color: 0xd95555, cabin: 0.45, hood: 0.5, roof: 'hatch', wheels: 0xbbbbbb },
  'roadster': { price: 5200, name: 'Mio Roadster', wid: 1.75, len: 4.0, accel: 0.66, topSpeed: 198, drift: 0.85, grip: 0.87, body: 'roadster', color: 0xd92b4f, cabin: 0.55, hood: 0.65, roof: 'coupe', tail: 'lip', wheels: 0xd8d8d8 },
  'hoshi7': { price: 9800, name: 'Hoshi RX-7', wid: 1.8, len: 4.3, accel: 0.78, topSpeed: 228, drift: 1.0, grip: 0.9, body: 'coupe', color: 0xffcf3f, cabin: 0.5, hood: 0.7, popups: true, roof: 'fastback', glow: 0xffcf3f, tail: 'roundWing', roundTail: true, wheels: 0xe8e8e8 },
  'taiyo': { price: 12500, name: 'Taiyo Supra GT', wid: 1.85, len: 4.5, accel: 0.84, topSpeed: 242, drift: 0.9, grip: 0.92, body: 'coupe', color: 0xff7a1a, cabin: 0.52, hood: 0.65, roof: 'fastback', tail: 'roundWing', roundTail: true, glow: 0xff7a1a, wheels: 0xe0e0e0 },
  'kaze': { price: 15000, name: 'Kaze GT-X', wid: 1.9, len: 4.6, accel: 0.88, topSpeed: 252, drift: 0.88, grip: 0.94, body: 'coupe', color: 0x35586e, cabin: 0.5, hood: 0.55, roof: 'coupe', tail: 'quadWing', roundTail: true, glow: 0x57b7ff, wheels: 0xd0d0d0 },
  'gtr35': { price: 18000, name: 'Arakawa GT-R35', wid: 1.89, len: 4.71, accel: 0.93, topSpeed: 262, drift: 0.85, grip: 0.95, body: 'coupe', color: 0x9aa0a6, cabin: 0.5, hood: 0.55, roof: 'coupe', tail: 'wing', roundTail: true, glow: 0xff2a2a, wheels: 0xd0d0d0, desc: 'The R35 rival flagship — silver over black, red stripe, all menace.' },
  'svj': { price: 45000, name: 'SVJ Aventador', wid: 2.10, len: 4.94, accel: 0.99, topSpeed: 305, drift: 0.80, grip: 0.97, body: 'coupe', color: 0x17181a, cabin: 0.5, hood: 0.5, roof: 'coupe', tail: 'wing', roundTail: true, glow: 0xff7a1a, wheels: 0x2a2a2e, desc: 'The dream. Matte black V12 flagship — the Bay Legend\'s final weapon.' },
  'hero-supra': { price: 0, name: 'TEN-SECOND Taiyo', wid: 1.85, len: 4.5, accel: 0.92, topSpeed: 258, drift: 0.92, grip: 0.93, body: 'coupe', color: 0xff7a1a, cabin: 0.52, hood: 0.65, roof: 'fastback', tail: 'roundWing', roundTail: true, glow: 0xffa63f, livery: 'hero-supra', wheels: 0xffd700 },
  'hero-gtr': { price: 0, name: 'BAYSIDE GHOST Kaze', wid: 1.9, len: 4.6, accel: 0.95, topSpeed: 268, drift: 0.9, grip: 0.96, body: 'coupe', color: 0x2c4a63, cabin: 0.5, hood: 0.55, roof: 'coupe', tail: 'quadWing', roundTail: true, glow: 0x7dd7ff, livery: 'hero-gtr', wheels: 0xe8e8e8 } };
export const CAST = {};
CAST.ren = { role: 'driver', name: 'Ren Takagi', build: 0.55, h: 1.0, hair: 'black topknot', skin: 0xc98d64, accessory: 'none', hairColor: 0x141414, outfit: { topColor: 0xff7a1a, top: 'jacket', pants: 'jeans', trim: 0x14161a, shoes: 0xf2f2f2, pantsColor: 0x2e3d55, shoeStripes: true } };
CAST.ako = { role: 'mechanic', name: "Ako 'Wrench' Sato", build: 0.42, h: 0.93, hair: 'red ponytail', skin: 0xe8b48c, accessory: 'cap', hairColor: 0xa83226, outfit: { topColor: 0x3f6d8e, top: 'overalls', pants: 'overalls', trim: 0x222222, shoes: 0x333333, pantsColor: 0x3f6d8e } };
CAST.mika = { role: 'lookout', name: 'Mika Chen', build: 0.45, h: 0.95, hair: 'violet bob', skin: 0xf0c8a0, accessory: 'phone', hairColor: 0x6a3fb5, outfit: { topColor: 0x7a4fd0, top: 'hoodie', pants: 'skirt+leggings', trim: 0xffffff, shoes: 0xe879ff, pantsColor: 0x23232a, shoeStripes: true } };
CAST.jun = { role: 'muscle', name: 'Jun Park', build: 0.7, h: 1.02, hair: 'buzz', skin: 0xb97a4e, accessory: 'chain', hairColor: 0x1a1a1a, outfit: { topColor: 0xe8e8e8, top: 'tank', pants: 'cargo', trim: 0x888888, shoes: 0x222222, pantsColor: 0x4a4a38 } };
CAST.ryo = { role: 'legend', name: "Ryo 'Ghost' Kaze", build: 0.5, h: 1.0, hair: 'silver undercut', skin: 0xd9a878, accessory: 'glasses', hairColor: 0xc8ccd0, outfit: { topColor: 0x2c4a63, top: 'jacket', pants: 'jeans', trim: 0x9fd8ff, shoes: 0x9fd8ff, pantsColor: 0x1c2733, shoeStripes: true } };
CAST.dante = { role: 'rival', name: 'Dante Voss', build: 0.62, h: 1.04, hair: 'slick black', skin: 0x8a5a34, accessory: 'gloves', hairColor: 0x0a0a0a, outfit: { topColor: 0x1a1a1e, top: 'leather', pants: 'jeans', trim: 0xc02040, shoes: 0xc02040, pantsColor: 0x14161c } };
CAST.shun = { role: 'RIVAL ACE', name: 'Shun Arakawa', build: 0.62, h: 1.02, hair: 'slick black', skin: 0xb97a4e, accessory: 'gloves', hairColor: 0x0a0a0a, outfit: { topColor: 0x17181c, top: 'leather', pants: 'jeans', trim: 0xc02040, shoes: 0x141414, pantsColor: 0x14161c } };
CAST.cop = { role: 'cop', name: 'RBPD Officer', build: 0.6, h: 1.0, hair: 'cap', skin: 0xc98d64, accessory: 'cap+badge', hairColor: 0x24304a, outfit: { topColor: 0x24304a, top: 'uniform', pants: 'uniform', trim: 0xc8a028, shoes: 0x141414, pantsColor: 0x1c2733 } };
export const MISSIONS = [];
MISSIONS.push({ need: 0, id: 'm1', district: 'port', giver: 'ren', type: 'meet', title: 'First Keys', reward: { rep: 10, money: 300 }, blurb: 'Collect your Hachi at HQ.' });
MISSIONS.push({ need: 0, id: 'm2', district: 'port', giver: 'ako', type: 'sprint', title: 'Shakedown Run', reward: { rep: 20, money: 500 }, blurb: 'Test the Hachi on a Portside sprint.' });
MISSIONS.push({ need: 0, id: 'm3', district: 'neon', giver: 'mika', type: 'delivery', title: 'Neon Errand', reward: { rep: 30, money: 700 }, blurb: 'Run a package to Neon Mile.' });
MISSIONS.push({ need: 1, id: 'm4', district: 'port', giver: 'jun', type: 'drift', title: 'Portside Drift School', reward: { rep: 40, money: 900 }, blurb: 'Learn to slide around the docks.' });
MISSIONS.push({ need: 1, id: 'm5', district: 'coral', giver: 'dante', type: 'race', title: 'Rival at the Lights', reward: { rep: 55, money: 1200 }, blurb: 'Dante wants a straight fight on Coral.' });
MISSIONS.push({ need: 2, id: 'm6', district: 'hoshino', giver: 'ryo', type: 'timetrial', title: 'Ghost Line', reward: { rep: 65, money: 1500 }, blurb: 'Chase the Ghost line on the touge.' });
MISSIONS.push({ need: 2, id: 'm7', district: 'port', giver: 'ako', type: 'delivery', title: 'Parts Runner', reward: { rep: 70, money: 1800 }, blurb: 'Move hot parts across the bay.' });
MISSIONS.push({ need: 3, id: 'm8', district: 'neon', giver: 'jun', type: 'disable', title: 'Disable the Pursuit', reward: { rep: 85, money: 2200 }, blurb: 'Ram the RBPD pursuit unit off the road.' });
MISSIONS.push({ need: 3, id: 'm9', district: 'neon', giver: 'mika', type: 'jack', title: 'Data Jack', reward: { rep: 95, money: 2600 }, blurb: 'Jack the data terminal in Neon Mile.' });
MISSIONS.push({ need: 4, id: 'm10', district: 'neon', giver: 'ren', type: 'hold', title: 'Hold the Mile', reward: { rep: 105, money: 3000 }, blurb: 'Defend Ronin territory on the Mile.' });
MISSIONS.push({ need: 5, id: 'm11', district: 'coral', giver: 'shun', type: 'race', title: 'Kings of Coral', reward: { rep: 110, money: 3500 }, blurb: 'Settle Coral Strip once and for all.' });
MISSIONS.push({ need: 6, id: 'm12', district: 'hoshino', giver: 'ryo', type: 'pinkslip', title: 'Bayside Ghost', reward: { rep: 120, money: 4000 }, blurb: "Final run vs Ryo's matte-black SVJ. Win takes the hero-gtr." });
export const TOUGE_POINTS = [];
TOUGE_POINTS.push([-560, -560]);
TOUGE_POINTS.push([-470, -600]);
TOUGE_POINTS.push([-380, -545]);
TOUGE_POINTS.push([-300, -610]);
TOUGE_POINTS.push([-215, -560]);
TOUGE_POINTS.push([-170, -640]);
TOUGE_POINTS.push([-90, -590]);
TOUGE_POINTS.push([-60, -500]);
TOUGE_POINTS.push([-140, -450]);
TOUGE_POINTS.push([-90, -380]);
TOUGE_POINTS.push([-190, -330]);
TOUGE_POINTS.push([-290, -390]);
TOUGE_POINTS.push([-370, -330]);
TOUGE_POINTS.push([-450, -390]);
TOUGE_POINTS.push([-540, -350]);
TOUGE_POINTS.push([-600, -430]);
TOUGE_POINTS.push([-560, -560]);
