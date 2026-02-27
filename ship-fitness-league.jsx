import { useState, useCallback, useRef, useEffect } from "react";
import {
 createMutationState,
 previewNextMutation,
 previewMutationChoices,
 applyRewindMutation,
 getEntropyMultiplier,
 getSectorMutationModifiers,
 applyMutationsToUniverse,
} from "./mutation-manager.js";
import { createSectorCheckpoint, restoreSectorCheckpoint } from "./checkpoint-system.js";
import { getRewindOptions, canAffordRewind } from "./rewind-handler.js";
import {
 PARADOX_CORE_ID,
 createDefaultMetaState,
 normalizeMetaState,
 getMetaTreeLayout,
 getMetaModifiers,
 unlockMetaUpgrade,
} from "./meta-upgrade-system.js";

// ============================================================
// THEME
// ============================================================
const C = {
 bg: "#05090f", panel: "#0a0f1c", panelHi: "#0d1424", border: "#1a2d4a",
 accent: "#22ddff", accent2: "#ff7d45", accent3: "#55ee77",
 text: "#c8daf5", textDim: "#6a8cb0", textBright: "#eef4ff",
 danger: "#ff3355", warn: "#ffbb22", success: "#22ee77",
 laser: "#5599ff", kinetic: "#ffcc44", explosive: "#ff7744",
 intel: "#dd99ff",
};
const dmgC = t => ({ laser: C.laser, kinetic: C.kinetic, explosive: C.explosive }[t] || C.text);

// ============================================================
// DATA
// ============================================================
const CHASSIS = [
 { id: "interceptor", name: "Interceptor", icon: "", description: "Fast & fragile. High evasion, low capacity.", bpCap: 55, baseHull: 60, baseMass: 30, baseEvasion: 25, slots: { reactor:1, engine:1, defense:1, weapons:2, utility:2 }, maxWeaponSize: 2, color: "#00f5c8" },
 { id: "frigate", name: "Frigate", icon: "", description: "Balanced generalist. Good all-rounder.", bpCap: 65, baseHull: 100, baseMass: 55, baseEvasion: 12, slots: { reactor:1, engine:1, defense:1, weapons:3, utility:3 }, maxWeaponSize: 3, color: "#7b9fff" },
 { id: "destroyer", name: "Destroyer", icon: "", description: "Slow & tanky. Maximum firepower.", bpCap: 80, baseHull: 180, baseMass: 90, baseEvasion: 4, slots: { reactor:1, engine:1, defense:1, weapons:4, utility:2 }, maxWeaponSize: 4, color: "#ff7b7b" },
];

const MODULES = [
 { id:"reactor_sm", name:"Compact Core", type:"reactor", bpCost:7, mass:5, powerGen:8, heatGen:0, stats:{}, tags:[], desc:"Small reactor, enough for light builds." },
 { id:"reactor_md", name:"Medium Core", type:"reactor", bpCost:10, mass:10, powerGen:14, heatGen:0, stats:{}, tags:[], desc:"Standard reactor. Good balance." },
 { id:"reactor_lg", name:"Heavy Fusion Plant", type:"reactor", bpCost:16, mass:20, powerGen:22, heatGen:0, stats:{}, tags:[], desc:"High output, runs hot." },
 { id:"reactor_eff", name:"Eco Reactor", type:"reactor", bpCost:12, mass:12, powerGen:16, heatGen:0, stats:{}, tags:[], desc:"Low-draw, near-zero heat." },
 { id:"engine_fast", name:"Sprint Drive", type:"engine", bpCost:8, mass:6, powerDraw:2, heatGen:0, stats:{speed:18,evasionBonus:8}, tags:[], desc:"Quick but power hungry." },
 { id:"engine_std", name:"Vector Drive", type:"engine", bpCost:8, mass:8, powerDraw:3, heatGen:0, stats:{speed:12,evasionBonus:4}, tags:[], desc:"Standard engine. Reliable." },
 { id:"engine_tank", name:"Heavy Drive", type:"engine", bpCost:6, mass:15, powerDraw:2, heatGen:0, stats:{speed:6, evasionBonus:0}, tags:[], desc:"Slow but fuel-efficient." },
 { id:"engine_ecm", name:"ECM Suite", type:"engine", bpCost:10, mass:7, powerDraw:3, heatGen:0, stats:{speed:10,evasionBonus:6,missileCounter:30}, tags:["ecm"], desc:"Reduces missile hit chance." },
 { id:"def_shield", name:"Shield Array", type:"defense", bpCost:12, mass:10, powerDraw:4, heatGen:0, stats:{shieldHP:80,shieldRegen:6}, tags:["shield"], desc:"Regenerating shields. Weak to lasers." },
 { id:"def_armor", name:"Composite Armor", type:"defense", bpCost:10, mass:20, powerDraw:0, heatGen:0, stats:{armor:18}, tags:["armor"], desc:"Flat damage reduction. No regen." },
 { id:"def_combo", name:"Layered Defense", type:"defense", bpCost:16, mass:18, powerDraw:2, heatGen:0, stats:{shieldHP:40,shieldRegen:3,armor:10}, tags:["shield","armor"], desc:"Moderate shields + armor." },
 { id:"def_reactive",name:"Reactive Plating", type:"defense", bpCost:14, mass:22, powerDraw:0, heatGen:0, stats:{armor:12,explosiveResist:25}, tags:["armor"], desc:"High explosive resistance." },
 { id:"wpn_laser_sm",name:"Pulse Laser", type:"weapon", bpCost:7, mass:5, powerDraw:3, heatGen:3, size:1, stats:{damage:12,accuracy:80,range:2,cooldown:1,dmgType:"laser"}, tags:["laser"], desc:"Fast firing. Strong vs shields." },
 { id:"wpn_laser_md",name:"Beam Array", type:"weapon", bpCost:11, mass:9, powerDraw:5, heatGen:5, size:2, stats:{damage:22,accuracy:75,range:3,cooldown:2,dmgType:"laser"}, tags:["laser"], desc:"High sustained laser DPS." },
 { id:"wpn_laser_lg",name:"Lance Cannon", type:"weapon", bpCost:16, mass:15, powerDraw:8, heatGen:9, size:3, stats:{damage:40,accuracy:65,range:4,cooldown:3,dmgType:"laser"}, tags:["laser"], desc:"Brutal single shots. Runs hot." },
 { id:"wpn_kinetic_sm",name:"Autocannon", type:"weapon", bpCost:6, mass:8, powerDraw:1, heatGen:2, size:1, stats:{damage:10,accuracy:72,range:1,cooldown:1,dmgType:"kinetic",penetration:5}, tags:["kinetic"], desc:"Rapid rounds. Armor shredder." },
 { id:"wpn_kinetic_md",name:"Rail Driver", type:"weapon", bpCost:10, mass:14, powerDraw:2, heatGen:4, size:2, stats:{damage:24,accuracy:68,range:2,cooldown:2,dmgType:"kinetic",penetration:12}, tags:["kinetic"], desc:"High penetration. Eats armor." },
 { id:"wpn_kinetic_lg",name:"Mass Driver", type:"weapon", bpCost:15, mass:22, powerDraw:3, heatGen:6, size:3, stats:{damage:45,accuracy:60,range:2,cooldown:3,dmgType:"kinetic",penetration:20}, tags:["kinetic"], desc:"Devastating kinetic payload." },
 { id:"wpn_missile_sm",name:"Missile Rack", type:"weapon", bpCost:9, mass:10, powerDraw:1, heatGen:1, size:2, stats:{damage:28,accuracy:90,range:4,cooldown:3,dmgType:"explosive",interceptable:true}, tags:["missile"], desc:"High accuracy, can be intercepted." },
 { id:"wpn_missile_lg",name:"Torpedo Bay", type:"weapon", bpCost:14, mass:18, powerDraw:2, heatGen:2, size:3, stats:{damage:55,accuracy:85,range:5,cooldown:5,dmgType:"explosive",interceptable:true}, tags:["missile"], desc:"Massive burst. Slow reload." },
 { id:"wpn_pd", name:"Point Defense", type:"weapon", bpCost:8, mass:6, powerDraw:2, heatGen:2, size:1, stats:{damage:6, accuracy:85,range:1,cooldown:1,dmgType:"kinetic",pdValue:35}, tags:["pointDefense"], desc:"Intercepts missiles. Low direct dmg." },
 { id:"util_heatsink",name:"Heat Sink", type:"utility", bpCost:6, mass:8, powerDraw:0, heatGen:-8, stats:{coolingBonus:8}, tags:[], desc:"Passive cooling boost." },
 { id:"util_targeting",name:"Targeting Computer", type:"utility", bpCost:8, mass:4, powerDraw:2, heatGen:0, stats:{accuracyBonus:12}, tags:[], desc:"Improves weapon accuracy." },
 { id:"util_repair", name:"Repair Drones", type:"utility", bpCost:9, mass:6, powerDraw:2, heatGen:0, stats:{repairPerSector:8}, tags:[], desc:"Repairs hull between events." },
 { id:"util_cargo", name:"Cargo Expander", type:"utility", bpCost:4, mass:10, powerDraw:0, heatGen:0, stats:{scrapBonus:20}, tags:[], desc:"+20% scrap income." },
 { id:"util_cap", name:"Capacitor Bank", type:"utility", bpCost:7, mass:5, powerDraw:1, heatGen:0, stats:{shieldRegenBonus:4}, tags:[], desc:"Extra shield regen per tick." },
 { id:"util_coat", name:"Ablative Coating", type:"utility", bpCost:5, mass:7, powerDraw:0, heatGen:0, stats:{armorBonus:6}, tags:[], desc:"Extra flat armor." },
];

const DOCTRINES = [
 { id:"brawler", name:"Brawler", icon:"", desc:"Closes distance fast, max DPS at short range.", preferredRange:1, disengageThreshold:0.15, fireStyle:"burst" },
 { id:"skirmisher", name:"Skirmisher", icon:"", desc:"Mid-range kiting, retreats when shields fall.", preferredRange:2, disengageThreshold:0.35, fireStyle:"steady" },
 { id:"sniper", name:"Sniper", icon:"", desc:"Max range, conserves fire, high accuracy priority.", preferredRange:4, disengageThreshold:0.5, fireStyle:"deliberate" },
 { id:"missile_boat",name:"Missile Boat",icon:"", desc:"Kites enemy, relies on missiles, avoids close range.", preferredRange:4, disengageThreshold:0.4, fireStyle:"burst" },
 { id:"tank", name:"Tank", icon:"", desc:"Holds position, grinds slowly, maximum survivability.", preferredRange:2, disengageThreshold:0.05, fireStyle:"steady" },
];

const BIOMES = [
 { id:"open_space", name:"Open Space", icon:"", effects:{}, desc:"No modifiers.", color:"#0d1525", threatMod:0 },
 { id:"nebula", name:"Nebula", icon:"", effects:{accuracyMod:-12,evasionMod:10}, desc:"-12% accuracy, +10% evasion.", color:"#1a0d2e", threatMod:1 },
 { id:"asteroid_belt", name:"Asteroid Belt", icon:"", effects:{collisionRisk:8,evasionMod:-5}, desc:"Collision risk. -5% evasion.", color:"#1e1608", threatMod:1 },
 { id:"dead_zone", name:"Dead Zone", icon:"", effects:{shieldRegenMod:-50,fuelCost:2}, desc:"Shield regen halved. Extra fuel.", color:"#0e0e0e", threatMod:2 },
 { id:"ion_storm", name:"Ion Storm", icon:"", effects:{heatSpike:15,missileMod:-25}, desc:"Heat spikes. Missiles unreliable.",color:"#071e1e", threatMod:2 },
];

// 1.5 difficulty: all hull/shield/armor/damage values boosted
const ENEMY_TEMPLATES = [
 {
 id:"drone_scout", name:"Scout Drone", danger:1,
 hull:60, maxHull:60, shield:30, maxShield:30, armor:0, evasion:26, missileCounter:0,
 weapons:[{name:"Pulse Laser",damage:18,accuracy:80,cooldown:1,currentCooldown:0,dmgType:"laser",heatGen:2}],
 lootScrap:[12,30], desc:"Fast recon unit. Light armament.",
 intel:{ profile:"fast-mover", sigils:["laser"], clues:["Energy spike at short wavelengths laser loadout","High relative velocity signature fast hull","Minimal mass return no armor plating"], counter:"shields absorb laser bonus; high evasion also effective" },
 },
 {
 id:"pirate_raider", name:"Pirate Raider", danger:2,
 hull:120, maxHull:120, shield:45, maxShield:45, armor:8, evasion:10, missileCounter:0,
 weapons:[{name:"Autocannon",damage:15,accuracy:72,cooldown:1,currentCooldown:0,dmgType:"kinetic",penetration:5,heatGen:1},{name:"Autocannon",damage:15,accuracy:72,cooldown:1,currentCooldown:1,dmgType:"kinetic",penetration:5,heatGen:1}],
 lootScrap:[25,60], desc:"Stripped-down warship. Kinetic focus.",
 intel:{ profile:"kinetic-brawler", sigils:["kinetic"], clues:["Ballistic fire control systems detected","Dense projectile wake in approach vector","Moderate mass signature light armor"], counter:"armor plating reduces kinetic impact; shields weak here" },
 },
 {
 id:"defense_turret", name:"Defense Turret", danger:2,
 hull:180, maxHull:180, shield:0, maxShield:0, armor:23, evasion:0, missileCounter:0,
 weapons:[{name:"Beam Array",damage:33,accuracy:75,cooldown:2,currentCooldown:0,dmgType:"laser",heatGen:3}],
 lootScrap:[20,50], desc:"Stationary platform. Hardened hull.",
 intel:{ profile:"armored-laser", sigils:["laser","armor"], clues:["Zero motion stationary contact","Reinforced ablative plating on scan","High-gain beam emitter detected"], counter:"kinetic weapons bypass armor; missiles hit hard if no PD detected" },
 },
 {
 id:"bounty_hunter", name:"Bounty Hunter", danger:3,
 hull:135, maxHull:135, shield:90, maxShield:90, armor:12, evasion:14, missileCounter:0,
 weapons:[{name:"Beam Array",damage:33,accuracy:75,cooldown:2,currentCooldown:0,dmgType:"laser",heatGen:3},{name:"Autocannon",damage:15,accuracy:72,cooldown:1,currentCooldown:0,dmgType:"kinetic",penetration:5,heatGen:1}],
 lootScrap:[50,100], desc:"Professional hunter. Mixed weapons.",
 intel:{ profile:"mixed-hunter", sigils:["laser","kinetic"], clues:["Dual fire control systems mixed loadout","Reinforced shield emitter high capacity shields","Licensed pursuit transponder detected"], counter:"strip shields with laser fire first, then switch to kinetic; needs sustained damage" },
 },
 {
 id:"missile_corvette", name:"Missile Corvette", danger:3,
 hull:105, maxHull:105, shield:75, maxShield:75, armor:0, evasion:18, missileCounter:0,
 weapons:[{name:"Missile Rack",damage:42,accuracy:90,cooldown:3,currentCooldown:0,dmgType:"explosive",interceptable:true,heatGen:1},{name:"Missile Rack",damage:42,accuracy:90,cooldown:3,currentCooldown:2,dmgType:"explosive",interceptable:true,heatGen:1}],
 lootScrap:[45,85], desc:"Standoff missile platform. Dangerous at range.",
 intel:{ profile:"missile-kiter", sigils:["explosive"], clues:["Ordnance bay signatures multiple warheads","Standoff approach vector avoiding close range","Lock-on telemetry bursts detected"], counter:"point defense or ECM suite critical; close distance fast to disrupt fire solution" },
 },
 {
 id:"heavy_gunship", name:"Heavy Gunship", danger:4,
 hull:300, maxHull:300, shield:60, maxShield:60, armor:30, evasion:3, missileCounter:0,
 weapons:[{name:"Mass Driver",damage:68,accuracy:60,cooldown:3,currentCooldown:0,dmgType:"kinetic",penetration:20,heatGen:4},{name:"Beam Array",damage:33,accuracy:75,cooldown:2,currentCooldown:1,dmgType:"laser",heatGen:3}],
 lootScrap:[75,140], desc:"Capital-class weapons platform.",
 intel:{ profile:"heavy-armor-mixed", sigils:["kinetic","laser","armor"], clues:["Capital-class mass signature very heavy hull","Railgun discharge residue in approach path","Thermal bloom suggests dual weapon systems"], counter:"high sustained DPS needed this fight is long; repair drones help attrition; exploit low evasion" },
 },
 {
 id:"elite_interceptor", name:"Elite Interceptor", danger:4,
 hull:83, maxHull:83, shield:68, maxShield:68, armor:0, evasion:32, missileCounter:0,
 weapons:[{name:"Pulse Laser",damage:18,accuracy:80,cooldown:1,currentCooldown:0,dmgType:"laser",heatGen:2},{name:"Pulse Laser",damage:18,accuracy:80,cooldown:1,currentCooldown:0,dmgType:"laser",heatGen:2},{name:"Pulse Laser",damage:18,accuracy:80,cooldown:1,currentCooldown:0,dmgType:"laser",heatGen:2}],
 lootScrap:[65,110], desc:"Three lasers. Nearly impossible to hit.",
 intel:{ profile:"triple-laser-evader", sigils:["laser"], clues:["Extreme angular velocity evasion specialist","Triple-emitter laser array signature","Minimal return mass no armor, no shields to speak of"], counter:"targeting computer essential; missiles have tracking advantage; armor not needed focus on accurate fire" },
 },
 {
 id:"fortress_cruiser", name:"Fortress Cruiser", danger:5,
 hull:450, maxHull:450, shield:150, maxShield:150, armor:45, evasion:0, missileCounter:0,
 weapons:[{name:"Lance Cannon",damage:60,accuracy:65,cooldown:3,currentCooldown:0,dmgType:"laser",heatGen:6},{name:"Rail Driver",damage:36,accuracy:68,cooldown:2,currentCooldown:1,dmgType:"kinetic",penetration:12,heatGen:3}],
 lootScrap:[100,180], desc:"Endgame armored command ship.",
 intel:{ profile:"fortress", sigils:["laser","kinetic","armor","shield"], clues:["Fortress-class IFF signature","Stratified composite hull maximum armor rating","Multi-spectrum weapon array prepare for both damage types"], counter:"maximum firepower required this is a war of attrition; bring repair drones and full power output" },
 },
];

// Universe "personality" themes a run gets one dominant flavor
const UNIVERSE_THEMES = [
 { id:"laser_corridor", name:"Laser Corridor", icon:"", color:C.laser, desc:"High-energy beam weapons dominate these sectors. Thick shield banks advised.", primarySigil:"laser", suggestIds:["def_shield","util_cap","engine_ecm"], suggestTags:["shield"] },
 { id:"kinetic_gauntlet", name:"Kinetic Gauntlet", icon:"", color:C.kinetic, desc:"Ballistic fire everywhere. Armor plating will save you.", primarySigil:"kinetic", suggestIds:["def_armor","util_coat","def_combo"], suggestTags:["armor"] },
 { id:"missile_swarm", name:"Missile Swarm", icon:"", color:C.explosive,desc:"Ordnance-heavy zone. Point defense is not optional.", primarySigil:"explosive", suggestIds:["wpn_pd","engine_ecm","def_reactive"], suggestTags:["pointDefense","ecm"] },
 { id:"heavy_armor", name:"Armored Opposition",icon:"", color:"#888", desc:"Enemy hulls are reinforced. Kinetic and explosive weapons cut through.", primarySigil:"armor", suggestIds:["wpn_kinetic_md","wpn_kinetic_lg","wpn_missile_sm"], suggestTags:["kinetic","missile"] },
 { id:"mixed_theater", name:"Mixed Theater", icon:"", color:C.accent, desc:"Diverse threat profile. Balanced loadout recommended.", primarySigil:"mixed", suggestIds:["def_combo","util_targeting","util_repair"], suggestTags:[] },
];

const BUILD_PRESETS = [
 { name:"Glass Cannon", icon:"", chassis:"interceptor", moduleIds:["reactor_lg","engine_fast","def_shield","wpn_laser_sm","wpn_laser_md","util_targeting","util_heatsink"], doctrine:"brawler" },
 { name:"Brick Wall", icon:"", chassis:"destroyer", moduleIds:["reactor_md","engine_tank","def_reactive","wpn_kinetic_lg","wpn_kinetic_md","wpn_pd","wpn_laser_sm","util_repair","util_coat"], doctrine:"tank" },
 { name:"Balanced Strike",icon:"", chassis:"frigate", moduleIds:["reactor_md","engine_std","def_combo","wpn_laser_md","wpn_kinetic_sm","wpn_missile_sm","util_targeting","util_heatsink","util_repair"], doctrine:"skirmisher" },
 { name:"Torpedo Ghost", icon:"", chassis:"frigate", moduleIds:["reactor_eff","engine_ecm","def_shield","wpn_missile_lg","wpn_missile_sm","wpn_pd","util_heatsink","util_cargo","util_cap"], doctrine:"missile_boat" },
];

const CHRONO_REWARD = {
 sectorClear: 8,
 elite: 20,
 boss: 45,
 firstTimeReach: 12,
};

const META_KEY = "ship_fitness_league_meta_v3";

function createDefaultMetaProgress() {
 return {
 chronoFragments: 0,
 firstTimeReached: {},
 lifetimeRewinds: 0,
 enemyDeathTypes: {},
 metaState: createDefaultMetaState(),
 };
}

function normalizeMetaProgress(progress) {
 const base = createDefaultMetaProgress();
 const merged = { ...base, ...(progress || {}) };
 merged.firstTimeReached = { ...(merged.firstTimeReached || {}) };
 merged.enemyDeathTypes = { ...(merged.enemyDeathTypes || {}) };
 merged.metaState = normalizeMetaState(merged.metaState);
 return merged;
}

function computeSectorSeed(universeSeed, sectorIdx, entropyLevel, rewindCount, mutationCount) {
 return (universeSeed + sectorIdx * 1337 + 42 + entropyLevel * 101 + rewindCount * 409 + mutationCount * 983) >>> 0;
}

function isEliteSector(sector) {
 return !!(sector?.enemy && (sector.danger >= 4 || /elite|hunter|gunship/i.test(sector.enemy.id || sector.enemy.name || "")));
}

function isBossSector(sector) {
 return !!(sector?.enemy && (sector.danger >= 5 || /boss|fortress|cruiser/i.test(sector.enemy.id || sector.enemy.name || "")));
}

function getChronoRewardForSector(result, sector, sectorNum, firstTimeReachedMap, ironman, metaModifiers = {}) {
 let gain = result?.survived ? CHRONO_REWARD.sectorClear : 0;
 if (result?.killed && isEliteSector(sector)) gain += CHRONO_REWARD.elite;
 if (result?.killed && isEliteSector(sector)) gain += metaModifiers.eliteChronoBonus || 0;
 if (result?.killed && isBossSector(sector)) gain += CHRONO_REWARD.boss;
 const key = `${sectorNum}`;
 if (!(firstTimeReachedMap || {})[key] && result?.survived) gain += CHRONO_REWARD.firstTimeReach;
 if (ironman) gain *= 2;
 return gain;
}

// ============================================================
// RNG
// ============================================================
class RNG {
 constructor(seed) { this.seed = (seed >>> 0) || 1; }
 next() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 0x100000000; }
 int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
 pick(arr) { return arr[this.int(0, arr.length - 1)]; }
 pickWeighted(arr, weights) {
 const total = weights.reduce((a, b) => a + b, 0);
 let r = this.next() * total;
 for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
 return arr[arr.length - 1];
 }
}

// ============================================================
// PRE-GENERATE UNIVERSE (for briefing before running)
// ============================================================
function generateUniverse(seed, sectorCount, difficulty, options = {}) {
 const rng = new RNG(seed);
 const ironman = !!options.ironman;
 const metaModifiers = options.metaModifiers || {};
 // Determine dominant theme from seed
 const themeRoll = rng.next();
 const theme = themeRoll < 0.2 ? UNIVERSE_THEMES[0] : themeRoll < 0.4 ? UNIVERSE_THEMES[1] : themeRoll < 0.6 ? UNIVERSE_THEMES[2] : themeRoll < 0.75 ? UNIVERSE_THEMES[3] : UNIVERSE_THEMES[4];

 const sectors = [];
 for (let i = 0; i < sectorCount; i++) {
 const danger = Math.min(5, Math.floor(i / 3) + difficulty);

 // Biome: theme influences which biomes appear more
 const biome = rng.pick(BIOMES);

 const er = rng.next();
 const combatChance = Math.max(0.25, 0.45 - (metaModifiers.hostileEscalationReduction || 0));
 const eventType = er < combatChance ? "combat" : er < 0.60 ? "hazard" : er < 0.75 ? "trade" : er < 0.90 ? "salvage" : "anomaly";

 // Enemy selection biased by theme
 let validEnemies = ENEMY_TEMPLATES.filter(e => e.danger <= danger + 1 && e.danger >= Math.max(1, danger - 1));
 if (!validEnemies.length) validEnemies = ENEMY_TEMPLATES;

 // Theme bias: if theme has primary sigil, weight enemies carrying it
 let enemy;
 if (theme.primarySigil !== "mixed" && rng.next() < 0.55) {
 const themeEnemies = validEnemies.filter(e => e.intel.sigils.includes(theme.primarySigil) || e.intel.sigils.includes(theme.primarySigil));
 enemy = themeEnemies.length ? rng.pick(themeEnemies) : rng.pick(validEnemies);
 } else {
 enemy = rng.pick(validEnemies);
 }

 // Intel revealed to player 2-3 clues, not full stats
 const clueCount = rng.int(2, 3);
 const shuffledClues = [...enemy.intel.clues].sort(() => rng.next() - 0.5).slice(0, clueCount);

 sectors.push({
 sectorNum: i + 1,
 danger,
 biome,
 eventType,
 enemy: eventType === "combat" ? enemy : null,
 intel: eventType === "combat" ? { clues: shuffledClues, sigils: enemy.intel.sigils, counter: enemy.intel.counter, profile: enemy.intel.profile } : null,
 });
 }

 // Build threat summary across universe
 const allSigils = sectors.filter(s => s.intel).flatMap(s => s.intel.sigils);
 const sigilCount = {};
 allSigils.forEach(s => { sigilCount[s] = (sigilCount[s] || 0) + 1; });
 const dominantSigil = Object.entries(sigilCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";
 const hasMissiles = allSigils.includes("explosive");
 const hasHeavyArmor = allSigils.includes("armor");

 return { seed, sectorCount, difficulty, ironman, theme, sectors, sigilCount, dominantSigil, hasMissiles, hasHeavyArmor };
}

// ============================================================
// SHIP STATS
// ============================================================
function deriveShipStats(chassis, modules, runtimeMods = {}) {
 const hullMult = Math.max(1, (runtimeMods.baseHullMultiplier || 1) * (1 + (runtimeMods.temporalHullEntropyBonus || 0)));
 const coolingMult = Math.max(0.5, runtimeMods.coolingMultiplier || 1);
 const s = {
 maxHull: Math.round(chassis.baseHull * hullMult), hull: Math.round(chassis.baseHull * hullMult), maxShield:0, shield:0,
 shieldRegen:0, armor:0, evasion:chassis.baseEvasion,
 powerGen:0, powerDraw:0, heatCapacity:100, cooling:6, heat:0, heatGenTotal:0, heatDelta:0,
 weapons:[], accuracyBonus:0, missileCounter:0, repairPerSector:0,
 scrapBonus:0, explosiveResist:0,
 };
 for (const mod of modules) {
 if (!mod) continue;
 if (mod.powerGen) s.powerGen += mod.powerGen;
 if (mod.powerDraw) s.powerDraw += mod.powerDraw;
 if (mod.heatGen > 0) s.heatGenTotal += mod.heatGen;
 if (mod.heatGen < 0) s.cooling += Math.abs(mod.heatGen);
 const st = mod.stats || {};
 if (st.shieldHP) s.maxShield += st.shieldHP;
 if (st.shieldRegen) s.shieldRegen += st.shieldRegen;
 if (st.shieldRegenBonus) s.shieldRegen += st.shieldRegenBonus;
 if (st.armor) s.armor += st.armor;
 if (st.armorBonus) s.armor += st.armorBonus;
 if (st.evasionBonus) s.evasion += st.evasionBonus;
 if (st.accuracyBonus) s.accuracyBonus += st.accuracyBonus;
 if (st.missileCounter) s.missileCounter += st.missileCounter;
 if (st.pdValue) s.missileCounter += st.pdValue;
 if (st.coolingBonus) s.cooling += st.coolingBonus;
 if (st.repairPerSector) s.repairPerSector += st.repairPerSector;
 if (st.scrapBonus) s.scrapBonus += st.scrapBonus;
 if (st.explosiveResist) s.explosiveResist += st.explosiveResist;
 if (st.damage) s.weapons.push({ ...st, id:mod.id, name:mod.name, currentCooldown:0, powerDraw:mod.powerDraw||0, heatGen:mod.heatGen||0 });
 }
 s.powerGen += runtimeMods.reactorOutputBonus || 0;
 s.cooling = Math.round(s.cooling * coolingMult);
 s.shield = s.maxShield;
 s.powerNet = s.powerGen - s.powerDraw;
 s.heatDelta = s.heatGenTotal - s.cooling;
 return s;
}

// ============================================================
// COMBAT ENGINE
// ============================================================
function resolveDmg(dmg, type, target, biome, rng) {
 let eff = dmg;
 if (type === "explosive") {
 const ic = (target.missileCounter || 0) / 100;
 if (rng.next() < ic) return { hit:true, intercepted:true, sd:0, hd:0 };
 if (biome?.missileMod) eff = Math.round(eff * (1 + biome.missileMod / 100));
 if (target.explosiveResist) eff = Math.round(eff * (1 - target.explosiveResist / 100));
 }
 if (target.shield > 0) {
 let sd = eff;
 if (type === "laser") sd = Math.round(eff * 1.35);
 if (type === "kinetic") sd = Math.round(eff * 0.6);
 const actual = Math.min(target.shield, sd);
 target.shield = Math.max(0, target.shield - actual);
 const bleed = Math.max(0, sd - actual);
 if (bleed > 0) {
 const hd = Math.max(1, Math.round(bleed - Math.max(0, target.armor - 3)));
 target.hull = Math.max(0, target.hull - hd);
 return { hit:true, intercepted:false, sd:actual, hd };
 }
 return { hit:true, intercepted:false, sd:actual, hd:0 };
 } else {
 let pen = 0;
 if (type === "kinetic") { eff = Math.round(eff * 1.2); pen = 10; }
 const armor = Math.max(0, (target.armor || 0) - pen);
 const hd = Math.max(1, Math.round(eff - armor));
 target.hull = Math.max(0, target.hull - hd);
 return { hit:true, intercepted:false, sd:0, hd };
 }
}

function simulateCombatRecorded(playerStats, enemy, doctrine, biomeEffects, rng) {
 const p = JSON.parse(JSON.stringify(playerStats));
 const e = JSON.parse(JSON.stringify(enemy));
 const frames = [];
 let tick = 0;
 const MAX = 60;
 const snap = (events) => ({
 tick, events:events||[],
 pHull:Math.max(0,p.hull), pMaxHull:p.maxHull, pShield:Math.max(0,p.shield), pMaxShield:p.maxShield,
 pHeat:Math.min(Math.round(p.heat),p.heatCapacity), pHeatCap:p.heatCapacity,
 eHull:Math.max(0,e.hull), eMaxHull:e.maxHull, eShield:Math.max(0,e.shield), eMaxShield:e.maxShield,
 });
 let playerDmgDealt = 0, enemyDmgDealt = 0;

 while (p.hull > 0 && e.hull > 0 && tick < MAX) {
 tick++;
 const events = [];
 const heatPenalty = p.heat > p.heatCapacity * 0.7 ? (p.heat - p.heatCapacity * 0.7) / p.heatCapacity : 0;

 for (const wpn of p.weapons) {
 if (wpn.currentCooldown > 0) { wpn.currentCooldown--; continue; }
 if (p.powerNet < -2 && wpn.powerDraw > 0) { events.push({ actor:"p", type:"no_power", wpn:wpn.name }); continue; }
 const acc = Math.min(95, Math.max(5, wpn.accuracy + (p.accuracyBonus||0) + (biomeEffects?.accuracyMod||0) - heatPenalty * 30));
 const hit = rng.next() * 100 < acc - (e.evasion||0);
 if (hit) {
 const r = resolveDmg(wpn.damage, wpn.dmgType, e, biomeEffects, rng);
 if (r.intercepted) events.push({ actor:"p", type:"intercepted", wpn:wpn.name, dmgType:wpn.dmgType });
 else { playerDmgDealt += r.sd + r.hd; events.push({ actor:"p", type:"hit", wpn:wpn.name, dmgType:wpn.dmgType, sd:r.sd, hd:r.hd }); }
 } else events.push({ actor:"p", type:"miss", wpn:wpn.name, dmgType:wpn.dmgType });
 wpn.currentCooldown = wpn.cooldown + Math.round(heatPenalty * 2);
 p.heat = Math.max(0, p.heat + (wpn.heatGen||0));
 }

 for (const wpn of e.weapons) {
 if (wpn.currentCooldown > 0) { wpn.currentCooldown--; continue; }
 const acc = Math.min(90, Math.max(5, (wpn.accuracy||70) - (p.evasion||0) + (biomeEffects?.evasionMod||0)));
 if (rng.next() * 100 < acc) {
 const r = resolveDmg(wpn.damage, wpn.dmgType, p, biomeEffects, rng);
 if (r.intercepted) events.push({ actor:"e", type:"intercepted", wpn:wpn.name, dmgType:wpn.dmgType });
 else { enemyDmgDealt += r.sd + r.hd; events.push({ actor:"e", type:"hit", wpn:wpn.name, dmgType:wpn.dmgType, sd:r.sd, hd:r.hd }); }
 } else events.push({ actor:"e", type:"miss", wpn:wpn.name, dmgType:wpn.dmgType });
 wpn.currentCooldown = wpn.cooldown;
 }

 if (p.maxShield > 0) p.shield = Math.min(p.maxShield, p.shield + (p.shieldRegen||2));
 if (e.maxShield > 0) e.shield = Math.min(e.maxShield, e.shield + 2);
 p.heat = Math.max(0, p.heat - (p.cooling||6));
 if (biomeEffects?.heatSpike && rng.next() < 0.15) { p.heat += biomeEffects.heatSpike; events.push({ actor:"env", type:"heat_spike", amount:biomeEffects.heatSpike }); }
 if (biomeEffects?.collisionRisk && rng.next() * 100 < biomeEffects.collisionRisk) {
 const cd = rng.int(5, 25); p.hull = Math.max(0, p.hull - cd);
 events.push({ actor:"env", type:"collision", hd:cd });
 }
 frames.push(snap(events));
 if (p.hull / p.maxHull < doctrine.disengageThreshold) {
 frames.push({ ...snap([{ actor:"p", type:"disengage" }]), tick: tick + 0.5 }); break;
 }
 }
 return { won:e.hull<=0, survived:p.hull>0, frames, playerHullRemaining:Math.max(0,p.hull), playerShieldRemaining:Math.max(0,p.shield), playerDmgDealt, enemyDmgDealt };
}

// ============================================================
// SINGLE SECTOR SIMULATION (for puzzle loop)
// ============================================================
function simulateSingleSector(playerConfig, sector, shipState, universeSeed, sectorIdx, runCtx = {}) {
 const { chassis, modules, doctrine } = playerConfig;
 const { biome, eventType, enemy } = sector;
 const entropyLevel = runCtx.entropyLevel || 0;
 const rewindCount = runCtx.rewindCount || 0;
 const mutationState = runCtx.mutationState || createMutationState();
 const metaModifiers = runCtx.metaModifiers || {};
 const entropyMult = getEntropyMultiplier(entropyLevel, rewindCount, {
 entropyScaleReduction: metaModifiers.entropyScaleReduction || 0,
 });
 const mutationMods = getSectorMutationModifiers(mutationState, sectorIdx);
 const sectorSeed = runCtx.rngState?.sectorSeed ?? computeSectorSeed(universeSeed, sectorIdx, entropyLevel, rewindCount, mutationState.mutationCount || 0);
 const rng = new RNG(sectorSeed);

 // Use provided ship state (carries hull/shield from previous wins)
 const ship = deriveShipStats(chassis, modules.filter(Boolean), metaModifiers);
 const playerDamageBonus = (runCtx.postRewindDamageBonus || 0) + (metaModifiers.adaptiveTargetingDamageBonus || 0);
 if (playerDamageBonus > 0) {
 ship.weapons = ship.weapons.map(w => ({ ...w, damage: Math.max(1, Math.round((w.damage || 1) * (1 + playerDamageBonus))) }));
 }
 ship.weapons = ship.weapons.map(w => ({ ...w, heatGen: Math.round((w.heatGen || 0) * (1 + entropyLevel * 0.04 + mutationMods.heatBoost)) }));
 // Override hull/shield with carried-over values (capped at max)
 ship.hull = Math.min(ship.maxHull, shipState.hull);
 ship.shield = Math.min(ship.maxShield, shipState.shield);

 const sr = {
 sector: sectorIdx + 1,
 biome,
 event: eventType,
 scrap: 0,
 killed: false,
 survived: true,
 enemy: null,
 combatFrames: null,
 hazardDmg: 0,
 entropyMult,
 sectorSeed,
 };

 if (eventType === "combat" && enemy) {
 sr.enemyId = enemy.id;
 const scaledEnemy = {
 ...enemy,
 hull: Math.max(1, Math.round(enemy.hull * entropyMult * mutationMods.aggressionMult)),
 maxHull: Math.max(1, Math.round(enemy.maxHull * entropyMult * mutationMods.aggressionMult)),
 shield: Math.max(0, Math.round(enemy.shield * entropyMult * mutationMods.aggressionMult)),
 maxShield: Math.max(0, Math.round(enemy.maxShield * entropyMult * mutationMods.aggressionMult)),
 armor: Math.max(0, Math.round(enemy.armor * (1 + entropyLevel * 0.05))),
 weapons: (enemy.weapons || []).map(w => ({
 ...w,
 damage: Math.max(1, Math.round((w.damage || 1) * entropyMult * mutationMods.enemyDamageMult)),
 accuracy: Math.min(95, Math.round((w.accuracy || 70) + entropyLevel * 1.5 + (mutationState.factionHostility || 0) * 10)),
 })),
 };
 const biomeEffects = { ...(biome.effects || {}) };
 biomeEffects.collisionRisk = (biomeEffects.collisionRisk || 0) + Math.round((entropyLevel * 1.5) + (mutationMods.hazardBoost * 20));
 biomeEffects.heatSpike = (biomeEffects.heatSpike || 0) + Math.round(entropyLevel * 0.8 + mutationMods.heatBoost * 8);
 const cr = simulateCombatRecorded(ship, scaledEnemy, doctrine, biomeEffects, rng);
 sr.enemy = scaledEnemy; sr.combatFrames = cr.frames;
 if (!cr.survived) {
 sr.survived = false;
 const hits = cr.frames.flatMap(f => f.events.filter(ev => ev.actor === "e" && ev.type === "hit"));
 const killerHit = hits[hits.length - 1];
 sr.killerDmgType = killerHit?.dmgType || null;
 sr.damageBreakdown = hits.reduce((acc, h) => { acc[h.dmgType] = (acc[h.dmgType]||0)+h.hd+h.sd; return acc; }, {});
 } else {
 if (cr.won) {
 sr.scrap = rng.int(...enemy.lootScrap); sr.killed = true;
 }
 sr.enemyId = enemy.id;
 sr.nextHull = cr.playerHullRemaining;
 sr.nextShield = cr.playerShieldRemaining;
 }
 return sr;
 }

 // Non-combat sectors resolve instantly
 if (eventType === "hazard") {
 const hazardHigh = Math.max(12, Math.round(50 * entropyMult * (1 + mutationMods.hazardBoost)));
 const hd = rng.int(8, hazardHigh);
 sr.hazardDmg = hd;
 const newHull = Math.max(0, shipState.hull - hd);
 sr.survived = newHull > 0;
 sr.nextHull = newHull; sr.nextShield = shipState.shield;
 if (!sr.survived) sr.killerDmgType = "hazard";
 } else if (eventType === "trade") {
 sr.scrap = rng.int(25, 70);
 sr.nextHull = shipState.hull; sr.nextShield = shipState.shield;
 } else if (eventType === "salvage") {
 sr.scrap = rng.int(12, 45);
 const repPenalty = 1 + entropyLevel * 0.07 + rewindCount * 0.06;
 const rep = Math.max(0, Math.round(rng.int(0, 18) / repPenalty));
 sr.repairGain = rep;
 sr.nextHull = Math.min(ship.maxHull, shipState.hull + rep);
 sr.nextShield = shipState.shield;
 } else {
 const at = rng.int(0, 2);
 if (at === 0) { sr.scrap = rng.int(35, 90); sr.anomaly = "Lucky cache!"; }
 else if (at === 1) { const d = rng.int(12, 35); sr.anomaly = "Energy surge! "+d+" hull"; sr.nextHull = Math.max(1, shipState.hull - d); }
 else { sr.anomaly = "Shield recharge! +40 shield"; sr.nextHull = shipState.hull; sr.nextShield = Math.min(ship.maxShield, shipState.shield + 40); }
 if (!sr.nextHull) sr.nextHull = shipState.hull;
 if (!sr.nextShield) sr.nextShield = shipState.shield;
 }
 return sr;
}

// ============================================================
// FULL SIMULATION RUN (used for end-of-run summary only)
// ============================================================
function runFullSim(playerConfig, universe) {
 const { chassis, modules, doctrine } = playerConfig;
 const { sectors, sectorCount, difficulty } = universe;
 let ship = deriveShipStats(chassis, modules.filter(Boolean));
 const res = {
 sectors:[], totalScrap:0, totalKills:0, totalDmgDealt:0, totalDmgTaken:0,
 sectorsCompleted:0, causeOfDeath:null, hpOverTime:[], fuelUsed:0,
 weaknesses:{ laser:0, kinetic:0, explosive:0, hazard:0 },
 };
 let fuel = 100;

 // Use a deterministic RNG seeded from the universe seed + run variation
 const rng = new RNG(universe.seed + 77777);

 for (let i = 0; i < sectors.length; i++) {
 const { biome, eventType, enemy } = sectors[i];
 res.hpOverTime.push(Math.round(ship.hull / ship.maxHull * 100));
 const fc = biome.effects?.fuelCost || 1;
 fuel -= fc; res.fuelUsed += fc;
 if (fuel <= 0) { res.causeOfDeath = "Ran out of fuel"; break; }

 const sr = { sector:i+1, biome, event:eventType, scrap:0, killed:false, survived:true, enemy:null, combatFrames:null };

 if (eventType === "combat" && enemy) {
 const cr = simulateCombatRecorded(ship, enemy, doctrine, biome.effects, rng);
 sr.enemy = enemy; sr.combatFrames = cr.frames;
 res.totalDmgDealt += cr.playerDmgDealt; res.totalDmgTaken += cr.enemyDmgDealt;
 if (!cr.survived) {
 sr.survived = false;
 const hits = cr.frames.flatMap(f => f.events.filter(ev => ev.actor==="e" && ev.type==="hit"));
 if (hits.length) { const last = hits[hits.length-1]; res.weaknesses[last.dmgType] = (res.weaknesses[last.dmgType]||0)+1; }
 res.causeOfDeath = `Destroyed by ${enemy.name} in sector ${i+1}`;
 res.sectors.push(sr); break;
 }
 if (cr.won) {
 const sc = rng.int(...enemy.lootScrap);
 sr.scrap = sc + (ship.scrapBonus ? Math.round(sc * ship.scrapBonus / 100) : 0);
 res.totalKills++; sr.killed = true;
 }
 ship.hull = cr.playerHullRemaining; ship.shield = cr.playerShieldRemaining;
 } else if (eventType === "hazard") {
 const hd = rng.int(8, 30 * difficulty);
 ship.hull = Math.max(0, ship.hull - hd); sr.hazardDmg = hd;
 res.totalDmgTaken += hd; res.weaknesses.hazard += hd;
 if (ship.hull <= 0) { sr.survived = false; res.causeOfDeath = `Hazard in sector ${i+1} (${biome.name})`; res.sectors.push(sr); break; }
 } else if (eventType === "trade") {
 const inc = rng.int(25, 70); sr.scrap = inc + (ship.scrapBonus ? Math.round(inc * ship.scrapBonus/100) : 0);
 } else if (eventType === "salvage") {
 const inc = rng.int(12, 45); sr.scrap = inc + (ship.scrapBonus ? Math.round(inc * ship.scrapBonus/100) : 0);
 const rep = rng.int(0, 18); ship.hull = Math.min(ship.maxHull, ship.hull + rep); sr.repairGain = rep;
 } else {
 const at = rng.int(0, 2);
 if (at === 0) { sr.scrap = rng.int(35, 90); sr.anomaly = "Lucky cache!"; }
 else if (at === 1) { const d = rng.int(12, 35); ship.hull = Math.max(1, ship.hull - d); sr.anomaly = "Energy surge!"; }
 else { ship.shield = Math.min(ship.maxShield, ship.shield + 40); sr.anomaly = "Shield recharge!"; }
 }

 if (ship.repairPerSector) ship.hull = Math.min(ship.maxHull, ship.hull + ship.repairPerSector);
 if (ship.maxShield > 0) ship.shield = Math.min(ship.maxShield, ship.shield + ship.shieldRegen * 4);
 res.totalScrap += sr.scrap || 0; res.sectorsCompleted++;
 res.sectors.push(sr);
 }

 res.hpOverTime.push(Math.round(Math.max(0, ship.hull) / ship.maxHull * 100));
 const sc = sectors.length;
 const sur = (res.sectorsCompleted / sc) * 100;
 const pro = Math.min(100, res.totalScrap / 5);
 const com = Math.min(100, res.totalKills * 15 + res.totalDmgDealt / 50);
 const eff = Math.max(0, 100 - res.totalDmgTaken / 20);
 res.finalScore = Math.round(sur * 0.4 + pro * 0.25 + com * 0.25 + eff * 0.1);
 res.breakdown = { sur:Math.round(sur), pro:Math.round(pro), com:Math.round(com), eff:Math.round(eff) };
 res.survived = !res.causeOfDeath;
 return res;
}

function getBP(mods) { return (mods||[]).filter(Boolean).reduce((s,m) => s + (m.bpCost||0), 0); }

// ============================================================
// SHARED UI PRIMITIVES
// ============================================================
function Bar({ pct, color, h=7 }) {
 return (
 <div style={{ background:`${C.border}cc`, borderRadius:3, height:h }}>
 <div style={{ width:`${Math.max(0,Math.min(100,pct))}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.3s" }} />
 </div>
 );
}
const lbl = { fontSize:11, color:C.textDim, letterSpacing:"0.11em", textTransform:"uppercase", marginBottom:8, fontWeight:"bold" };
const crd = { background:"linear-gradient(180deg, rgba(12,20,34,0.9) 0%, rgba(8,14,26,0.9) 100%)", border:`1px solid ${C.border}cc`, padding:"18px 20px", marginBottom:14, borderRadius:6, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.02)" };
const btn = (v="d") => ({ padding:"8px 18px", background:v==="p"?`${C.accent}18`:v==="danger"?`${C.danger}18`:v==="intel"?`${C.intel}18`:"transparent", border:`1px solid ${v==="p"?C.accent:v==="danger"?C.danger:v==="intel"?C.intel:C.border}`, color:v==="p"?C.accent:v==="danger"?C.danger:v==="intel"?C.intel:C.text, cursor:"pointer", fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"inherit", borderRadius:2 });
const tabSt = a => ({ padding:"8px 16px", background:a?`${C.accent}18`:"transparent", border:`1px solid ${a?C.accent:C.border}`, color:a?C.accent:C.text, cursor:"pointer", fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"inherit", borderRadius:2 });
const sigilColor = s => ({ laser:C.laser, kinetic:C.kinetic, explosive:C.explosive, armor:"#bbbbbb", shield:C.accent, mixed:C.intel }[s] || C.text);
const sigilIcon = s => ({ laser:"", kinetic:"", explosive:"", armor:"", shield:"", mixed:"" }[s] || "");
const MOBILE_BREAKPOINT = 820;

function useIsMobile() {
 const getMobile = () => (typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false);
 const [isMobile, setIsMobile] = useState(getMobile);
 useEffect(() => {
 const onResize = () => setIsMobile(getMobile());
 window.addEventListener("resize", onResize);
 return () => window.removeEventListener("resize", onResize);
 }, []);
 return isMobile;
}

function useViewportWidth() {
 const getWidth = () => (typeof window !== "undefined" ? window.innerWidth : 1280);
 const [width, setWidth] = useState(getWidth);
 useEffect(() => {
 const onResize = () => setWidth(getWidth());
 window.addEventListener("resize", onResize);
 return () => window.removeEventListener("resize", onResize);
 }, []);
 return width;
}

// ============================================================
// UNIVERSE BRIEFING
// ============================================================
function UniverseBriefing({ universe, build, onLaunch, onRebuild }) {
 const isMobile = useIsMobile();
 const ch = CHASSIS.find(c => c.id === build.chassis);
 const bp = getBP(build.modules);
 const stats = deriveShipStats(ch, build.modules.filter(Boolean));
 const { theme, sectors, hasMissiles, hasHeavyArmor, sigilCount } = universe;

 // Calculate readiness score
 const shipWeapTypes = stats.weapons.map(w => w.dmgType);
 const hasPD = stats.missileCounter > 0;
 const hasArmor = stats.armor > 0;
 const hasShield = stats.maxShield > 0;
 let readiness = 50;
 if (sigilCount.laser > 0 && hasShield) readiness += 15;
 if (sigilCount.kinetic > 0 && hasArmor) readiness += 15;
 if (sigilCount.explosive > 0 && hasPD) readiness += 20;
 if (sigilCount.armor > 0 && (shipWeapTypes.includes("kinetic") || shipWeapTypes.includes("explosive"))) readiness += 10;
 readiness = Math.min(99, readiness);

 const readinessColor = readiness >= 80 ? C.success : readiness >= 55 ? C.warn : C.danger;

 const combatSectors = sectors.filter(s => s.eventType === "combat");
 const sigils = Object.entries(sigilCount).sort((a,b) => b[1]-a[1]);

 return (
 <div style={{ padding:isMobile ? "14px 12px" : "20px 24px", maxWidth:960, margin:"0 auto" }}>
 {/* Universe header */}
 <div style={{ ...crd, borderLeft:`4px solid ${theme.color}`, marginBottom:20 }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
 <div style={{ flex:1, minWidth:200 }}>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.14em", marginBottom:6 }}>UNIVERSE #{universe.seed} {universe.sectorCount} SECTORS DIFFICULTY {["","EASY","NORMAL","HARD","BRUTAL"][universe.difficulty]}</div>
 <div style={{ fontSize:22, color:theme.color, marginBottom:6, letterSpacing:"0.08em" }}>{theme.icon} {theme.name}</div>
 <div style={{ fontSize:13, color:C.text, lineHeight:1.5 }}>{theme.desc}</div>
 </div>
 <div style={{ textAlign:"right", flexShrink:0 }}>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.1em", marginBottom:4 }}>READINESS</div>
 <div style={{ fontSize:44, color:readinessColor, lineHeight:1, fontWeight:"bold" }}>{readiness}%</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>vs this universe</div>
 </div>
 </div>

 {/* Threat signature */}
 <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
 <div style={{ ...lbl, marginBottom:10 }}>Threat Signature</div>
 <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
 {sigils.map(([s, count]) => (
 <div key={s} style={{ display:"flex", alignItems:"center", gap:8, background:C.panelHi, padding:"6px 12px", border:`1px solid ${sigilColor(s)}30`, borderRadius:2 }}>
 <span style={{ fontSize:16 }}>{sigilIcon(s)}</span>
 <div>
 <div style={{ fontSize:12, color:sigilColor(s), fontWeight:"bold" }}>{s.toUpperCase()}</div>
 <div style={{ fontSize:11, color:C.textDim }}>{count} encounter{count>1?"s":""}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "minmax(280px,1fr) minmax(280px,1fr)", gap:16 }}>
 {/* Sector path */}
 <div style={crd}>
 <div style={lbl}>Sector Path Intel Intercepts</div>
 <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4, maxHeight:420, overflowY:"auto" }}>
 {sectors.map((s, i) => (
 <div key={i} style={{ padding:"8px 12px", background:C.panelHi, borderLeft:`3px solid ${s.eventType==="combat"?sigilColor(s.intel?.sigils?.[0]||"mixed"):s.eventType==="hazard"?C.warn:C.border}`, borderRadius:2 }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
 <div style={{ display:"flex", gap:8, alignItems:"center" }}>
 <span style={{ fontSize:11, color:C.textDim, minWidth:22, fontWeight:"bold" }}>S{s.sectorNum}</span>
 <span style={{ fontSize:14 }}>{s.biome.icon}</span>
 <span style={{ fontSize:11, color:C.text }}>{s.biome.name}</span>
 <span style={{ fontSize:11, color:s.eventType==="combat"?C.accent2:s.eventType==="hazard"?C.warn:C.accent3, fontWeight:"bold" }}>{s.eventType.toUpperCase()}</span>
 </div>
 <div style={{ display:"flex", gap:4, alignItems:"center" }}>
 {s.intel?.sigils.map(sig => <span key={sig} style={{ fontSize:12 }}>{sigilIcon(sig)}</span>)}
 <span style={{ fontSize:11, color:C.danger }}>{''.repeat(Math.max(0,s.danger-2))}</span>
 </div>
 </div>
 {s.intel?.clues && (
 <div style={{ marginTop:6, paddingLeft:30 }}>
 {s.intel.clues.map((clue, ci) => (
 <div key={ci} style={{ fontSize:11, color:C.intel, lineHeight:1.6 }}> {clue}</div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Right column: Build check + recommendations */}
 <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
 {/* Build readiness */}
 <div style={crd}>
 <div style={lbl}>Your Build vs This Universe</div>
 <div style={{ display:"flex", gap:12, marginTop:4, alignItems:"center" }}>
 <span style={{ fontSize:24, color:ch.color }}>{ch.icon}</span>
 <div>
 <div style={{ fontSize:14, color:C.textBright, fontWeight:"bold" }}>{ch.name}</div>
 <div style={{ fontSize:11, color:C.textDim }}>{bp}/{ch.bpCap} BP {DOCTRINES.find(d=>d.id===build.doctrine)?.name}</div>
 </div>
 <div style={{ marginLeft:"auto", fontSize:28, color:readinessColor, fontWeight:"bold" }}>{readiness}%</div>
 </div>
 <div style={{ marginTop:10 }}>
 <Bar pct={readiness} color={readinessColor} h={8} />
 </div>

 {/* Checklist */}
 <div style={{ marginTop:14 }}>
 {[
 sigilCount.laser > 0 && { check:hasShield, label:"Shield defense vs laser threats", fix:"Shield Array or Layered Defense" },
 sigilCount.kinetic > 0 && { check:hasArmor, label:"Armor vs kinetic threats", fix:"Composite Armor or Ablative Coating" },
 sigilCount.explosive > 0 && { check:hasPD, label:"Point defense vs missiles", fix:"Point Defense or ECM Suite" },
 sigilCount.armor > 0 && { check:shipWeapTypes.includes("kinetic")||shipWeapTypes.includes("explosive"), label:"Armor-piercing weapons for armored targets", fix:"Kinetic or explosive weapons" },
 ].filter(Boolean).map((item, i) => (
 <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, alignItems:"flex-start" }}>
 <span style={{ color:item.check ? C.success : C.danger, fontSize:14, lineHeight:1.2 }}>{item.check ? "" : ""}</span>
 <span style={{ color:item.check ? C.text : C.textDim, flex:1 }}>{item.label}</span>
 {!item.check && <span style={{ color:C.warn, fontSize:11, textAlign:"right" }}> {item.fix}</span>}
 </div>
 ))}
 </div>
 </div>

 {/* Theme recommendations */}
 <div style={{ ...crd, borderLeft:`3px solid ${theme.color}` }}>
 <div style={lbl}>Recommended for This Universe</div>
 <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:6 }}>
 {theme.suggestIds.map(id => {
 const mod = MODULES.find(m => m.id === id);
 if (!mod) return null;
 const equipped = build.modules.some(m => m?.id === id);
 return (
 <div key={id} style={{ display:"flex", gap:10, padding:"8px 10px", background:equipped?`${C.success}0c`:`${theme.color}0a`, border:`1px solid ${equipped?C.success:theme.color}33`, alignItems:"center", borderRadius:2 }}>
 <span style={{ fontSize:18 }}>{equipped ? "" : ""}</span>
 <div style={{ flex:1 }}>
 <div style={{ fontSize:12, color:equipped?C.success:C.textBright, fontWeight:"bold" }}>{mod.name}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:1 }}>{mod.desc}</div>
 </div>
 <div style={{ fontSize:12, color:C.accent, fontWeight:"bold" }}>{mod.bpCost} BP</div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Tactical advice */}
 {combatSectors.length > 0 && (
 <div style={crd}>
 <div style={lbl}>Field Intelligence</div>
 <div style={{ marginTop:6 }}>
 {[...new Set(combatSectors.map(s => s.intel?.counter).filter(Boolean))].slice(0,3).map((counter, i) => (
 <div key={i} style={{ fontSize:12, color:C.intel, lineHeight:1.7, padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
 {counter}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Launch bar */}
 <div style={{ display:"flex", gap:12, marginTop:8, justifyContent:"flex-end" }}>
 <button style={{ ...btn(), padding:"10px 22px", fontSize:12 }} onClick={onRebuild}> Adjust Loadout</button>
 <button style={{ ...btn("p"), padding:"12px 32px", fontSize:13 }} onClick={onLaunch}>
 LAUNCH INTO THIS UNIVERSE
 </button>
 </div>
 </div>
 );
}

// ============================================================
// COMBAT PLAYBACK
// ============================================================
function CombatPlayback({ frames, playerName, enemyName, biome, onClose }) {
 const [fi, setFi] = useState(0);
 const [playing, setPlaying] = useState(true);
 const [speed, setSpeed] = useState(1);
 const logRef = useRef(null);
 const iRef = useRef(null);
 const frame = frames[Math.min(fi, frames.length-1)];

 useEffect(() => {
 clearInterval(iRef.current);
 if (playing) iRef.current = setInterval(() => setFi(f => f >= frames.length-1 ? (setPlaying(false), f) : f+1), 550/speed);
 return () => clearInterval(iRef.current);
 }, [playing, speed, frames.length]);

 useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [fi]);

 const allEvents = frames.slice(0, fi+1).flatMap(fr => fr.events.map(ev => ({ ...ev, tick:Math.floor(fr.tick) })));
 const pHull = frame ? frame.pHull/frame.pMaxHull*100 : 0;
 const pShield = frame?.pMaxShield ? frame.pShield/frame.pMaxShield*100 : 0;
 const eHull = frame ? frame.eHull/frame.eMaxHull*100 : 0;
 const eShield = frame?.eMaxShield ? frame.eShield/frame.eMaxShield*100 : 0;
 const heat = frame?.pHeatCap ? Math.min(100, frame.pHeat/frame.pHeatCap*100) : 0;
 const isDead = frame?.pHull <= 0, isWon = frame?.eHull <= 0;

 const MiniBar = ({ pct, color, h=9 }) => <div style={{ background:`${C.border}cc`, borderRadius:2, height:h }}><div style={{ width:`${Math.max(0,pct)}%`, height:"100%", background:color, borderRadius:2, transition:"width 0.2s" }} /></div>;

 const fmtEvent = (ev, isLatest) => {
 let icon, color, text;
 if (ev.type==="hit"&&ev.actor==="p") { icon=""; color=dmgC(ev.dmgType); text=`${ev.wpn}: ${ev.sd>0?ev.sd+" shield":""}${ev.sd>0&&ev.hd>0?" + ":""}${ev.hd>0?ev.hd+" hull":""}`; }
 else if (ev.type==="hit"&&ev.actor==="e") { icon=""; color=C.danger; text=`Enemy ${ev.wpn}: ${ev.sd>0?ev.sd+" shld":""}${ev.sd>0&&ev.hd>0?" + ":""}${ev.hd>0?ev.hd+" hull":""}`; }
 else if (ev.type==="miss") { icon=""; color=C.textDim; text=`${ev.actor==="p"?ev.wpn:"Enemy "+ev.wpn} missed`; }
 else if (ev.type==="intercepted") { icon=""; color=C.accent3; text=`${ev.actor==="p"?ev.wpn:"Enemy "+ev.wpn} intercepted`; }
 else if (ev.type==="disengage") { icon=""; color=C.warn; text="Doctrine: disengaging!"; }
 else if (ev.type==="collision") { icon=""; color=C.warn; text=`Asteroid: ${ev.hd} hull damage`; }
 else if (ev.type==="heat_spike") { icon=""; color=C.warn; text=`Ion storm: +${ev.amount} heat`; }
 else if (ev.type==="no_power") { icon=""; color=C.warn; text=`${ev.wpn} offline low power`; }
 else return null;
 return (
 <div key={Math.random()} style={{ display:"flex", gap:10, padding:"3px 0", opacity:isLatest?1:0.45, fontSize:12 }}>
 <span style={{ color:C.textDim, minWidth:30, fontSize:11 }}>T{ev.tick}</span>
 <span>{icon}</span>
 <span style={{ color:isLatest?color:C.textDim }}>{text}</span>
 </div>
 );
 };

 return (
 <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
 <div style={{ background:C.bg, border:`1px solid ${C.accent}55`, width:"min(860px,96vw)", maxHeight:"92vh", display:"flex", flexDirection:"column", fontFamily:"'Courier New',monospace", borderRadius:4 }}>
 <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.panel, borderRadius:"4px 4px 0 0" }}>
 <div>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.12em" }}>COMBAT REPLAY {biome?.icon} {biome?.name?.toUpperCase()}</div>
 <div style={{ fontSize:15, color:C.textBright, marginTop:3, fontWeight:"bold" }}>{playerName} <span style={{ color:C.textDim }}>vs</span> {enemyName}</div>
 </div>
 <button onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, color:C.text, cursor:"pointer", padding:"6px 14px", fontSize:12, fontFamily:"inherit", borderRadius:2 }}> CLOSE</button>
 </div>

 <div style={{ padding:"18px 22px", display:"grid", gridTemplateColumns:"1fr 90px 1fr", gap:16 }}>
 <div>
 <div style={{ fontSize:11, color:C.accent, letterSpacing:"0.1em", marginBottom:10, fontWeight:"bold" }}>YOUR SHIP</div>
 <div style={{ fontSize:36, marginBottom:12, filter:isDead?"grayscale(1) opacity(0.25)":"none", transition:"filter 0.5s" }}>{isDead?"":""}</div>
 <div style={{ fontSize:11, color:C.textDim, marginBottom:3 }}>HULL {frame?.pHull??0} / {frame?.pMaxHull}</div>
 <MiniBar pct={pHull} color={pHull>50?C.success:pHull>25?C.warn:C.danger} />
 {frame?.pMaxShield>0 && <>
 <div style={{ fontSize:11, color:C.textDim, marginTop:8, marginBottom:3 }}>SHIELDS {frame?.pShield??0} / {frame?.pMaxShield}</div>
 <MiniBar pct={pShield} color={C.accent} />
 </>}
 <div style={{ fontSize:11, color:C.textDim, marginTop:8, marginBottom:3 }}>HEAT {frame?.pHeat??0} / {frame?.pHeatCap}</div>
 <MiniBar pct={heat} color={heat>70?C.danger:heat>40?C.warn:C.accent3} h={6} />
 </div>
 <div style={{ textAlign:"center", paddingTop:12 }}>
 <div style={{ fontSize:11, color:C.textDim }}>TICK</div>
 <div style={{ fontSize:28, color:C.accent, fontWeight:"bold" }}>{Math.floor(frame?.tick??0)}</div>
 <div style={{ fontSize:11, color:C.textDim }}>{fi+1}/{frames.length}</div>
 {isWon && <div style={{ fontSize:12, color:C.success, marginTop:10, fontWeight:"bold" }}> WIN</div>}
 {isDead && <div style={{ fontSize:12, color:C.danger, marginTop:10, fontWeight:"bold" }}> LOST</div>}
 </div>
 <div style={{ textAlign:"right" }}>
 <div style={{ fontSize:11, color:C.danger, letterSpacing:"0.1em", marginBottom:10, fontWeight:"bold" }}>ENEMY</div>
 <div style={{ fontSize:36, marginBottom:12, filter:isWon?"grayscale(1) opacity(0.25)":"none", transition:"filter 0.5s" }}>{isWon?"":""}</div>
 <div style={{ fontSize:11, color:C.textDim, marginBottom:3 }}>HULL {frame?.eHull??0} / {frame?.eMaxHull}</div>
 <MiniBar pct={eHull} color={eHull>50?C.accent2:eHull>25?C.warn:C.danger} />
 {frame?.eMaxShield>0 && <>
 <div style={{ fontSize:11, color:C.textDim, marginTop:8, marginBottom:3, textAlign:"right" }}>SHIELDS {frame?.eShield??0} / {frame?.eMaxShield}</div>
 <MiniBar pct={eShield} color={C.accent} />
 </>}
 </div>
 </div>

 <div style={{ padding:"0 22px 6px" }}>
 <svg viewBox={`0 0 ${frames.length} 20`} style={{ width:"100%", height:24, display:"block" }}>
 <polyline points={frames.map((f,i) => `${i},${20-f.pHull/f.pMaxHull*20}`).join(" ")} fill="none" stroke={C.success} strokeWidth="1" />
 <polyline points={frames.map((f,i) => `${i},${20-f.eHull/f.eMaxHull*20}`).join(" ")} fill="none" stroke={C.danger} strokeWidth="1" strokeDasharray="2 1" />
 <line x1={fi} y1={0} x2={fi} y2={20} stroke={C.accent} strokeWidth="0.8" />
 </svg>
 <input type="range" min={0} max={frames.length-1} value={fi} onChange={e => { setPlaying(false); setFi(+e.target.value); }} style={{ width:"100%", accentColor:C.accent, cursor:"pointer", margin:"4px 0" }} />
 </div>

 <div style={{ padding:"8px 20px 12px", display:"flex", gap:6, alignItems:"center", borderBottom:`1px solid ${C.border}` }}>
 {[["",()=>{setPlaying(false);setFi(0);}],["",()=>{setPlaying(false);setFi(f=>Math.max(0,f-1));}]].map(([l,fn]) => <button key={l} onClick={fn} style={{ background:"none", border:`1px solid ${C.border}`, color:C.text, cursor:"pointer", padding:"6px 12px", fontSize:14, fontFamily:"inherit", borderRadius:2 }}>{l}</button>)}
 <button onClick={() => setPlaying(p => !p)} style={{ background:`${C.accent}18`, border:`1px solid ${C.accent}`, color:C.accent, cursor:"pointer", padding:"6px 24px", fontSize:16, fontFamily:"inherit", minWidth:56, borderRadius:2 }}>{playing?"":""}</button>
 {[["",()=>{setPlaying(false);setFi(f=>Math.min(frames.length-1,f+1));}],["",()=>{setPlaying(false);setFi(frames.length-1);}]].map(([l,fn]) => <button key={l} onClick={fn} style={{ background:"none", border:`1px solid ${C.border}`, color:C.text, cursor:"pointer", padding:"6px 12px", fontSize:14, fontFamily:"inherit", borderRadius:2 }}>{l}</button>)}
 <div style={{ marginLeft:"auto", display:"flex", gap:5, alignItems:"center" }}>
 <span style={{ fontSize:11, color:C.textDim }}>SPEED</span>
 {[0.5,1,2,4].map(s => <button key={s} onClick={() => setSpeed(s)} style={{ background:speed===s?`${C.accent}20`:"none", border:`1px solid ${speed===s?C.accent:C.border}`, color:speed===s?C.accent:C.textDim, cursor:"pointer", padding:"5px 10px", fontSize:11, fontFamily:"inherit", borderRadius:2 }}>{s}</button>)}
 </div>
 </div>

 <div ref={logRef} style={{ flex:1, overflowY:"auto", padding:"10px 22px", maxHeight:160 }}>
 {allEvents.length === 0 && <div style={{ color:C.textDim, fontSize:12 }}>Awaiting engagement...</div>}
 {allEvents.map((ev, i) => fmtEvent(ev, i === allEvents.length-1))}
 </div>
 </div>
 </div>
 );
}

// ============================================================
// SECTOR MAP
// ============================================================
function SectorMap({ sectors, total, universe, onReplay, selected }) {
 const icon = s => {
 if (!s) return { i:"", c:C.textDim+"30" };
 if (!s.survived) return { i:"", c:C.danger };
 return { combat:{ i:s.killed?"":"", c:s.killed?C.accent2:C.warn }, hazard:{ i:"", c:C.warn }, trade:{ i:"", c:C.accent3 }, salvage:{ i:"", c:C.accent }, anomaly:{ i:"", c:"#dd99ff" } }[s.event] || { i:"?", c:C.textDim };
 };
 return (
 <div>
 <div style={{ display:"flex", alignItems:"center", overflowX:"auto", paddingBottom:10, gap:2 }}>
 {Array.from({ length:total }, (_,i) => {
 const s = sectors[i];
 const us = universe?.sectors?.[i];
 const { i:ico, c } = icon(s);
 const clickable = s?.combatFrames;
 const sel = selected === i;
 return (
 <div key={i} style={{ display:"flex", alignItems:"center" }}>
 <div onClick={() => clickable && onReplay(i)} title={us?.intel?.clues?.[0] || ""} style={{ width:44, height:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", border:`1px solid ${sel?C.accent:s?C.border:C.border+"40"}`, background:sel?`${C.accent}15`:s?.biome?.color||C.panel, cursor:clickable?"pointer":"default", borderRadius:3, opacity:!s?0.2:1, position:"relative", transition:"all 0.15s", flexShrink:0 }}>
 <div style={{ fontSize:15 }}>{ico}</div>
 <div style={{ fontSize:11, color:c, fontWeight:"bold" }}>{i+1}</div>
 {us?.intel?.sigils && <div style={{ display:"flex", gap:1, marginTop:1 }}>{us.intel.sigils.slice(0,2).map(sig => <span key={sig} style={{ fontSize:9 }}>{sigilIcon(sig)}</span>)}</div>}
 {clickable && <div style={{ position:"absolute", top:-2, right:-2, fontSize:8, color:C.accent, background:C.bg, padding:"0 3px", border:`1px solid ${C.accent}`, borderRadius:1 }}></div>}
 </div>
 {i < total-1 && <div style={{ width:4, height:1, background:s&&sectors[i+1]?C.border:C.border+"30", flexShrink:0 }} />}
 </div>
 );
 })}
 </div>
 <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:6 }}>
 {[[" Kill",C.accent2],[" Disengage",C.warn],[" Hazard",C.warn],[" Trade",C.accent3],[" Salvage",C.accent],[" = replay",C.accent]].map(([l,c]) => <span key={l} style={{ fontSize:11, color:c }}> {l}</span>)}
 </div>
 </div>
 );
}

// ============================================================
// HANGAR
// ============================================================
function StatsPanel({ stats, chassis, universe }) {
 const pw = stats.powerGen - stats.powerDraw;
 const statRows = [
 { label:"Hull", value:stats.maxHull, color:C.success, pct:Math.min(100, stats.maxHull / 2.6) },
 { label:"Shields", value:stats.maxShield || "-", color:C.accent, pct:Math.min(100, (stats.maxShield || 0) / 1.8) },
 { label:"Heat Delta", value:`${stats.heatDelta > 0 ? "+" : ""}${stats.heatDelta}/t`, color:stats.heatDelta > 6 ? C.danger : stats.heatDelta > 2 ? C.warn : C.success, pct:Math.min(100, Math.abs(stats.heatDelta) * 9) },
 { label:"Evasion", value:`${stats.evasion}%`, color:stats.evasion >= 20 ? C.success : stats.evasion >= 10 ? C.warn : C.danger, pct:Math.min(100, stats.evasion * 3.2) },
 { label:"Net Power", value:pw, color:pw < 0 ? C.danger : pw < 3 ? C.warn : C.success, pct:Math.min(100, Math.abs(pw) * 10) },
 { label:"Cooling", value:`${stats.cooling}/t`, color:stats.cooling >= 10 ? C.success : stats.cooling >= 6 ? C.warn : C.danger, pct:Math.min(100, stats.cooling * 8) },
 ];

 return (
 <div style={{ ...crd, marginBottom:0 }}>
 <div style={{ ...lbl, marginBottom:6 }}>Telemetry Readout</div>
 <div style={{ fontSize:14, color:chassis.color, marginBottom:12, fontWeight:"bold" }}>{chassis.icon} {chassis.name}</div>

 <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
 {statRows.map((row) => (
 <div key={row.label} style={{ paddingBottom:8, borderBottom:`1px solid ${C.border}99` }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, marginBottom:5 }}>
 <span style={{ color:C.textDim, letterSpacing:"0.05em" }}>{row.label}</span>
 <span style={{ color:row.color, fontWeight:"bold" }}>{row.value}</span>
 </div>
 <Bar pct={row.pct} color={row.color} h={5} />
 </div>
 ))}
 </div>

 <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
 {[
 ["Armor",stats.armor || "-", C.warn],
 ["Shield Regen",stats.shieldRegen ? `+${stats.shieldRegen}/t` : "-", C.accent],
 ["Missile Counter",stats.missileCounter ? `${stats.missileCounter}%` : "-", C.accent3],
 ["Repair/Sector",stats.repairPerSector || "-", C.success],
 ].map(([k,v,c]) => (
 <div key={k} style={{ background:`${C.panelHi}bb`, border:`1px solid ${C.border}99`, borderRadius:4, padding:"8px 10px" }}>
 <div style={{ fontSize:11, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{k}</div>
 <div style={{ color:c, fontSize:13, fontWeight:"bold" }}>{v}</div>
 </div>
 ))}
 </div>

 {stats.weapons.length > 0 && <>
 <div style={{ ...lbl, marginTop:14, marginBottom:8 }}>Weapon Bus</div>
 {stats.weapons.map((w,i) => (
 <div key={i} style={{ padding:"6px 0", borderBottom:`1px solid ${C.border}99` }}>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
 <span style={{ color:C.textBright, fontWeight:"bold" }}>{w.name}</span>
 <span style={{ color:dmgC(w.dmgType), fontSize:11, fontWeight:"bold" }}>{w.dmgType}</span>
 </div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{w.damage} dmg {w.accuracy}% acc cd{w.cooldown}</div>
 </div>
 ))}
 </>}

 <div style={{ marginTop:12, padding:"10px 12px", background:`${C.panelHi}aa`, border:`1px solid ${C.border}99`, borderRadius:4 }}>
 <div style={{ fontSize:11, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Build Summary</div>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.textDim }}>
 <span>Weapons</span><span style={{ color:C.textBright, fontWeight:"bold" }}>{stats.weapons.length}</span>
 </div>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.textDim, marginTop:4 }}>
 <span>Total BP Load</span><span style={{ color:C.accent, fontWeight:"bold" }}>{getBP(stats.mods)} BP</span>
 </div>
 </div>

 <div style={{ marginTop:10, padding:"10px 12px", border:`1px dashed ${C.intel}55`, borderRadius:4, background:`${C.intel}08` }}>
 <div style={{ fontSize:11, color:C.intel, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>Entropy Preview</div>
 <div style={{ fontSize:12, color:C.textDim }}>Future hook: projected stress and mutation pressure per sector.</div>
 </div>

 {universe && (
 <div style={{ marginTop:12, padding:"10px 12px", background:`${C.intel}0c`, border:`1px solid ${C.intel}30`, borderRadius:4 }}>
 <div style={{ fontSize:11, color:C.intel, letterSpacing:"0.1em", marginBottom:8, fontWeight:"bold" }}>UNIVERSE INTEL</div>
 <div style={{ fontSize:12, color:universe.theme.color, marginBottom:6 }}>{universe.theme.icon} {universe.theme.name}</div>
 {Object.entries(universe.sigilCount).sort((a,b)=>b[1]-a[1]).map(([sig, count]) => (
 <div key={sig} style={{ fontSize:12, color:sigilColor(sig), display:"flex", justifyContent:"space-between", padding:"2px 0" }}>
 <span>{sigilIcon(sig)} {sig}</span><span style={{ color:C.textDim }}>{count}x</span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function ModulePicker({ slotDef, selected, onSelect, bpLeft, universe }) {
 const [q, setQ] = useState("");
 if (!slotDef?.types) return null;
 const mods = MODULES.filter(m =>
 slotDef.types.includes(m.type) &&
 (!slotDef.maxSize || !m.size || m.size <= slotDef.maxSize) &&
 (!q || m.name.toLowerCase().includes(q.toLowerCase()))
 );

 const isRecommended = (mod) => {
 if (!universe) return false;
 return universe.theme.suggestIds.includes(mod.id) ||
 (universe.theme.suggestTags.length && mod.tags.some(t => universe.theme.suggestTags.includes(t)));
 };

 return (
 <div style={{ marginTop:12, border:`1px solid ${C.accent}40`, background:C.panelHi, padding:14, borderRadius:3 }}>
 <div style={{ ...lbl, marginBottom:8 }}> {slotDef.label} </div>
 <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter modules..." style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:"6px 10px", fontSize:12, fontFamily:"inherit", marginBottom:8, boxSizing:"border-box", borderRadius:2 }} />
 <div style={{ maxHeight:280, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
 {selected && <button style={{ ...btn("danger"), padding:"5px 10px", textAlign:"left", marginBottom:4, fontSize:11 }} onClick={() => onSelect(null)}> Remove {selected.name}</button>}
 {mods.map(m => {
 const over = m.bpCost > bpLeft;
 const rec = isRecommended(m);
 return (
 <button key={m.id} onClick={() => !over && onSelect(m)} style={{ padding:"9px 11px", background:rec?`${C.intel}0e`:selected?.id===m.id?`${C.accent}12`:"transparent", border:`1px solid ${rec?C.intel:selected?.id===m.id?C.accent:over?C.danger+"40":C.border}`, color:over?C.textDim:C.text, cursor:over?"not-allowed":"pointer", textAlign:"left", opacity:over?0.45:1, fontSize:12, fontFamily:"inherit", position:"relative", borderRadius:2 }}>
 {rec && <div style={{ position:"absolute", top:4, right:8, fontSize:11, color:C.intel, fontWeight:"bold" }}> REC</div>}
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
 <span style={{ color:C.textBright, fontWeight:"bold" }}>{m.name}</span>
 <span style={{ color:over?C.danger:C.accent, fontWeight:"bold", fontSize:11 }}>{m.bpCost} BP</span>
 </div>
 <div style={{ color:C.textDim, fontSize:11, marginTop:3 }}>{m.desc}</div>
 {m.stats?.damage && <div style={{ color:dmgC(m.stats.dmgType), fontSize:11, marginTop:2, fontWeight:"bold" }}> {m.stats.damage} dmg {m.stats.dmgType} cd{m.stats.cooldown}</div>}
 </button>
 );
 })}
 </div>
 </div>
 );
}

function Hangar({ build, onBuildChange, savedBuilds, onSave, universe }) {
 const viewportWidth = useViewportWidth();
 const isCompact = viewportWidth < 860;
 const isMedium = viewportWidth >= 860 && viewportWidth < 1320;
 const hangarColumns = isCompact
 ? "1fr"
 : isMedium
 ? "minmax(250px,0.9fr) minmax(500px,1.6fr)"
 : "minmax(250px,0.9fr) minmax(560px,1.55fr) minmax(300px,1fr)";
 const { chassis, modules, doctrine } = build;
 const ch = CHASSIS.find(c => c.id === chassis);
 const bp = getBP(modules);
 const [pickSlot, setPickSlot] = useState(null);
 const [showPresets, setShowPresets] = useState(false);
 const stats = deriveShipStats(ch, modules.filter(Boolean));

 const slotDefs = [
 { label:"Reactor", types:["reactor"] },
 { label:"Engine", types:["engine"] },
 { label:"Defense", types:["defense"] },
 ...Array.from({ length:ch.slots.weapons }, (_,i) => ({ label:`Weapon ${i+1}`, types:["weapon"], maxSize:ch.maxWeaponSize })),
 ...Array.from({ length:ch.slots.utility }, (_,i) => ({ label:`Utility ${i+1}`, types:["utility"] })),
 ];

 const setMod = (i, m) => { const ms=[...modules]; ms[i]=m; onBuildChange({ ...build, modules:ms }); setPickSlot(null); };
 const applyPreset = p => { onBuildChange({ chassis:p.chassis, modules:p.moduleIds.map(id => MODULES.find(m => m.id===id)).filter(Boolean), doctrine:p.doctrine }); setShowPresets(false); setPickSlot(null); };

 const isRecommended = (mod) => {
 if (!universe || !mod) return false;
 return universe.theme.suggestIds.includes(mod.id) || (universe.theme.suggestTags.length && mod.tags?.some(t => universe.theme.suggestTags.includes(t)));
 };

 const renderSlotCard = (idx, tone = "default") => {
 const sd = slotDefs[idx];
 if (!sd) return null;
 const mod = modules[idx];
 const rec = isRecommended(mod);
 const selected = pickSlot === idx;
 const borderColor = selected ? C.accent : rec ? C.intel : tone === "primary" ? `${C.accent}77` : `${C.border}cc`;

 return (
 <button
 key={idx}
 onClick={() => setPickSlot(selected ? null : idx)}
 style={{
 padding:"12px 13px",
 background:selected ? `${C.accent}10` : rec ? `${C.intel}0a` : `${C.panelHi}aa`,
 border:`1px solid ${borderColor}`,
 cursor:"pointer",
 textAlign:"left",
 color:C.text,
 fontFamily:"inherit",
 position:"relative",
 borderRadius:5,
 minHeight:88,
 transition:"border-color 0.18s, background 0.18s, transform 0.18s",
 boxShadow:selected ? `0 0 0 1px ${C.accent}33 inset` : "none",
 }}
 >
 {rec && <div style={{ position:"absolute", top:6, right:8, fontSize:11, color:C.intel, fontWeight:"bold" }}>REC</div>}
 <div style={{ fontSize:11, color:C.textDim, marginBottom:5, fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.08em" }}>{sd.label}</div>
 {mod ? <>
 <div style={{ fontSize:13, color:C.textBright, fontWeight:"bold", lineHeight:1.25 }}>{mod.name}</div>
 <div style={{ fontSize:11, color:C.accent, marginTop:4, fontWeight:"bold" }}>{mod.bpCost} BP</div>
 {mod.stats?.damage && <div style={{ fontSize:11, color:dmgC(mod.stats.dmgType), marginTop:2 }}>{mod.stats.dmgType}</div>}
 </> : <div style={{ fontSize:12, color:C.textDim, marginTop:6 }}>[ empty slot ]</div>}
 </button>
 );
 };

 const weaponStart = 3;
 const utilityStart = weaponStart + ch.slots.weapons;

 return (
 <div style={{ padding:isCompact ? "14px 12px" : "clamp(18px, 2vw, 28px)", maxWidth:isMedium ? 1240 : 1520, margin:"0 auto" }}>
 {universe && (
 <div style={{ ...crd, borderLeft:`3px solid ${universe.theme.color}`, marginBottom:14 }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
 <div>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.12em", marginBottom:4 }}>ACTIVE UNIVERSE INTEL</div>
 <div style={{ fontSize:14, color:universe.theme.color, fontWeight:"bold" }}>{universe.theme.icon} {universe.theme.name} - Seed #{universe.seed}</div>
 <div style={{ fontSize:12, color:C.intel, marginTop:3 }}>{universe.theme.desc}</div>
 </div>
 <div style={{ display:"flex", gap:10 }}>
 {Object.entries(universe.sigilCount).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([s]) => <span key={s} style={{ fontSize:18 }}>{sigilIcon(s)}</span>)}
 </div>
 </div>
 </div>
 )}

 <div style={{ display:"grid", gridTemplateColumns:hangarColumns, gap:isCompact ? 12 : 16, alignItems:"start" }}>
 <div>
 <div style={crd}>
 <div style={lbl}>Chassis</div>
 <div style={{ display:"grid", gridTemplateColumns:isCompact ? "1fr" : "1fr", gap:8 }}>
 {CHASSIS.map(c => (
 <button key={c.id} onClick={() => onBuildChange({ ...build, chassis:c.id, modules:[] })} style={{ padding:12, background:chassis===c.id?`${c.color}12`:`${C.panelHi}aa`, border:`1px solid ${chassis===c.id?c.color:C.border}`, color:chassis===c.id?c.color:C.text, cursor:"pointer", textAlign:"left", fontFamily:"inherit", borderRadius:5 }}>
 <div style={{ fontSize:20 }}>{c.icon}</div>
 <div style={{ fontSize:13, fontWeight:"bold", marginTop:3 }}>{c.name}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{c.description}</div>
 <div style={{ fontSize:11, marginTop:6 }}><span style={{ color:C.accent, fontWeight:"bold" }}>{c.bpCap} BP</span><span style={{ color:C.textDim }}> {c.baseHull} HP</span></div>
 </button>
 ))}
 </div>
 </div>

 <div style={crd}>
 <div style={lbl}>Doctrine</div>
 <div style={{ display:"grid", gap:6, marginTop:8 }}>
 {DOCTRINES.map(d => <button key={d.id} onClick={() => onBuildChange({ ...build, doctrine:d.id })} style={{ padding:"9px 11px", background:doctrine===d.id?`${C.accent2}14`:`${C.panelHi}99`, border:`1px solid ${doctrine===d.id?C.accent2:C.border}`, color:doctrine===d.id?C.accent2:C.text, cursor:"pointer", fontSize:12, fontFamily:"inherit", borderRadius:4, textAlign:"left" }} title={d.desc}>{d.icon} {d.name}</button>)}
 </div>
 {doctrine && <div style={{ fontSize:12, color:C.textDim, marginTop:8, lineHeight:1.45 }}>{DOCTRINES.find(d => d.id===doctrine)?.desc}</div>}
 </div>

 <div style={{ ...crd, marginBottom:0 }}>
 <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
 <button style={{ ...btn("p"), padding:"10px 14px" }} onClick={() => setShowPresets(!showPresets)}>Presets</button>
 <button style={{ ...btn(), padding:"10px 14px" }} onClick={() => onSave(build)}>Save Build</button>
 </div>
 {savedBuilds.length > 0 && <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>{savedBuilds.length} saved build{savedBuilds.length!==1?"s":""}</div>}
 {showPresets && (
 <div style={{ display:"grid", gap:6, marginBottom:8 }}>
 {BUILD_PRESETS.map(p => (
 <button key={p.name} onClick={() => applyPreset(p)} style={{ padding:"9px 10px", background:`${C.panelHi}88`, border:`1px solid ${C.border}`, color:C.text, cursor:"pointer", textAlign:"left", fontFamily:"inherit", borderRadius:4 }}>
 <div style={{ fontSize:12, color:C.textBright, fontWeight:"bold" }}>{p.icon} {p.name}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{CHASSIS.find(c=>c.id===p.chassis)?.name} {DOCTRINES.find(d=>d.id===p.doctrine)?.name}</div>
 </button>
 ))}
 </div>
 )}
 {savedBuilds.length > 0 && (
 <div style={{ display:"grid", gap:4 }}>
 {savedBuilds.map((b,i) => (
 <button key={i} onClick={() => onBuildChange(b)} style={{ display:"flex", gap:8, width:"100%", padding:"8px 0", background:"transparent", border:"none", borderBottom:`1px solid ${C.border}99`, color:C.text, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center", fontSize:12 }}>
 <span style={{ color:CHASSIS.find(c=>c.id===b.chassis)?.color, fontSize:15 }}>{CHASSIS.find(c=>c.id===b.chassis)?.icon}</span>
 <span style={{ color:C.textBright, fontWeight:"bold" }}>{CHASSIS.find(c=>c.id===b.chassis)?.name}</span>
 <span style={{ color:C.accent2, marginLeft:"auto" }}>{getBP(b.modules)} BP</span>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div>
 <div style={{ ...crd, marginBottom:0, border:`1px solid ${C.border}bb`, background:`radial-gradient(circle at 50% 8%, ${C.accent}12 0%, rgba(12,20,34,0.95) 36%, rgba(8,14,26,0.95) 100%)` }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:10 }}>
 <div>
 <div style={{ ...lbl, marginBottom:4, fontSize:11 }}>Loadout Command Deck</div>
 <div style={{ fontSize:12, color:C.textDim }}>Primary build surface</div>
 </div>
 <div style={{ fontSize:16, fontWeight:"bold" }}><span style={{ color:bp>ch.bpCap?C.danger:C.accent }}>{bp}</span><span style={{ color:C.textDim, fontSize:13 }}> / {ch.bpCap} BP</span></div>
 </div>
 <Bar pct={bp/ch.bpCap*100} color={bp>ch.bpCap?C.danger:C.accent} h={7} />
 {bp > ch.bpCap && <div style={{ marginTop:8, fontSize:11, color:C.danger, letterSpacing:"0.06em" }}>WARNING: BP CAP EXCEEDED</div>}

 <div style={{ marginTop:16 }}>
 <div style={{ ...lbl, marginBottom:8 }}>Core Systems</div>
 <div style={{ display:"grid", gridTemplateColumns:isCompact ? "1fr" : "repeat(3,minmax(0,1fr))", gap:8 }}>
 {renderSlotCard(0, "primary")}
 {renderSlotCard(2, "primary")}
 {renderSlotCard(1, "primary")}
 </div>
 </div>

 <div style={{ marginTop:14 }}>
 <div style={{ ...lbl, marginBottom:8 }}>Weapons</div>
 <div style={{ display:"grid", gridTemplateColumns:isCompact ? "1fr" : `repeat(${Math.max(2, ch.slots.weapons)}, minmax(${isMedium ? 120 : 0}px,1fr))`, gap:8 }}>
 {Array.from({ length:ch.slots.weapons }, (_,i) => renderSlotCard(weaponStart + i))}
 </div>
 </div>

 <div style={{ marginTop:14 }}>
 <div style={{ ...lbl, marginBottom:8 }}>Utilities</div>
 <div style={{ display:"grid", gridTemplateColumns:isCompact ? "1fr" : "repeat(2,minmax(0,1fr))", gap:8 }}>
 {Array.from({ length:ch.slots.utility }, (_,i) => renderSlotCard(utilityStart + i))}
 </div>
 </div>

 {pickSlot !== null && slotDefs[pickSlot] && <ModulePicker slotDef={slotDefs[pickSlot]} selected={modules[pickSlot]} onSelect={m => setMod(pickSlot, m)} bpLeft={ch.bpCap - bp + (modules[pickSlot]?.bpCost||0)} universe={universe} />}
 </div>
 </div>

 <div style={isMedium ? { gridColumn:"1 / -1" } : undefined}>
 <StatsPanel stats={stats} chassis={ch} universe={universe} />
 </div>
 </div>
 </div>
 );
}

// ============================================================
// RUN CONFIG
// ============================================================
function RunConfig({ build, onBriefing, metaProgress }) {
 const isMobile = useIsMobile();
 const [sectors, setSectors] = useState(10);
 const [difficulty, setDifficulty] = useState(2);
 const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999999) + 1);
 const [ironman, setIronman] = useState(false);

 const ch = CHASSIS.find(c => c.id === build.chassis);
 const bp = getBP(build.modules);
 const doc = DOCTRINES.find(d => d.id === build.doctrine);
 const valid = bp <= ch.bpCap && build.doctrine && build.modules.some(Boolean);

 const handleScout = () => {
 const metaModifiers = getMetaModifiers(metaProgress?.metaState);
 const universe = generateUniverse(seed, sectors, difficulty, { ironman, metaModifiers });
 onBriefing(universe);
 };

 return (
 <div style={{ padding:isMobile ? "14px 12px" : "24px 20px", maxWidth:560, margin:"0 auto" }}>
 <div style={crd}>
 <div style={lbl}>Build Check</div>
 <div style={{ display:"flex", gap:14, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
 <span style={{ color:ch.color, fontSize:15, fontWeight:"bold" }}>{ch.icon} {ch.name}</span>
 <span style={{ fontSize:13 }}><span style={{ color:bp>ch.bpCap?C.danger:C.success, fontWeight:"bold" }}>{bp}</span><span style={{ color:C.textDim }}>/{ch.bpCap} BP</span></span>
 <span style={{ color:C.accent2, fontSize:13, fontWeight:"bold" }}>{doc?.icon} {doc?.name}</span>
 </div>
 {!valid && <div style={{ color:C.warn, fontSize:12, marginTop:8 }}>{bp>ch.bpCap?" Over BP ":""}{!build.doctrine?" No doctrine ":""}{!build.modules.some(Boolean)?" No modules":""}</div>}
 </div>

 <div style={crd}>
 <div style={lbl}>Universe Config</div>
 {[["Sectors",sectors,setSectors,4,20,C.accent],["Difficulty",difficulty,setDifficulty,1,4,C.accent2]].map(([name,val,set,mn,mx,ac]) => (
 <div key={name} style={{ marginTop:14 }}>
 <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
 <span style={{ fontSize:12, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:"bold" }}>{name}</span>
 <span style={{ color:ac, fontSize:13, fontWeight:"bold" }}>{name==="Difficulty"?["","Easy","Normal","Hard","Brutal"][val]:val}</span>
 </div>
 <input type="range" min={mn} max={mx} value={val} onChange={e => set(+e.target.value)} style={{ width:"100%", accentColor:ac }} />
 </div>
 ))}
 <div style={{ marginTop:18 }}>
 <div style={{ fontSize:12, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:"bold", marginBottom:8 }}>Universe Seed</div>
 <div style={{ display:"flex", gap:8 }}>
 <input type="number" value={seed} onChange={e => setSeed(Math.max(1,+e.target.value))} style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:"7px 10px", fontSize:13, fontFamily:"inherit", borderRadius:2 }} />
 <button style={{ ...btn(), fontSize:16 }} onClick={() => setSeed(Math.floor(Math.random()*999999)+1)}></button>
 </div>
 </div>
 <div style={{ marginTop:14, padding:"10px 12px", background:`${C.intel}0c`, border:`1px solid ${C.intel}30`, fontSize:12, color:C.intel, lineHeight:1.6, borderRadius:2 }}>
 Each universe is pre-scouted you'll see SIGINT clues on enemy ships before launching so you can adapt your loadout.
 </div>
 </div>
 <label style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.warn }}>
 <input type="checkbox" checked={ironman} onChange={e => setIronman(e.target.checked)} />
 Ironman Mode: no rewinds, 2x Chrono rewards, higher entropy growth
 </label>

 <button style={{ ...btn("p"), width:"100%", padding:"13px 0", fontSize:14, opacity:valid?1:0.4 }} onClick={handleScout} disabled={!valid}>
 SCOUT UNIVERSE &amp; REVIEW BRIEFING
 </button>
 </div>
 );
}

function MetaUpgradeTree({ metaProgress, onMetaProgress }) {
 const isMobile = useIsMobile();
 const meta = normalizeMetaProgress(metaProgress);
 const mods = getMetaModifiers(meta.metaState);
 const layout = getMetaTreeLayout(meta.metaState, meta.chronoFragments);
 const label = { stability: "Stability", manipulation: "Manipulation", adaptation: "Adaptation" };

 const onUnlock = (upgradeId) => {
 onMetaProgress(prev => {
 const res = unlockMetaUpgrade(normalizeMetaProgress(prev), upgradeId);
 return res.ok ? normalizeMetaProgress(res.metaProgress) : normalizeMetaProgress(prev);
 });
 };

 return (
 <div style={{ padding:isMobile ? "14px 12px" : "20px 22px", maxWidth:1180, margin:"0 auto" }}>
 <div style={{ ...crd, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
 <div>
 <div style={lbl}>Meta Upgrade Tree</div>
 <div style={{ fontSize:13, color:C.textDim }}>Permanent progression across all runs.</div>
 </div>
 <div style={{ display:"flex", gap:14, flexWrap:"wrap", fontSize:12 }}>
 <span style={{ color:C.accent3 }}>Chrono: <b>{meta.chronoFragments}</b></span>
 <span style={{ color:C.warn }}>Lifetime Boss Kills: <b>{meta.metaState.lifetimeBossKills || 0}</b></span>
 <span style={{ color:C.intel }}>Lifetime Sectors: <b>{meta.metaState.lifetimeSectorsCleared || 0}</b></span>
 </div>
 </div>

 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap:12 }}>
 {layout.branches.map((col) => (
 <div key={col.branch} style={{ ...crd, marginBottom:0 }}>
 <div style={{ ...lbl, color: col.branch === "stability" ? C.success : col.branch === "manipulation" ? C.intel : C.accent2 }}>
 {label[col.branch]}
 </div>
 {col.rows.filter(r => r.upgrades.length > 0).map((row) => (
 <div key={row.tier} style={{ marginBottom:10 }}>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Tier {row.tier}</div>
 <div style={{ display:"grid", gap:8 }}>
 {row.upgrades.map((u) => {
 const specialLocked = u.id === PARADOX_CORE_ID && !u.specialMet;
 const disabled = u.disabled;
 return (
 <button
 key={u.id}
 onClick={() => onUnlock(u.id)}
 disabled={disabled}
 title={u.description}
 style={{
 padding:"10px 12px",
 textAlign:"left",
 background:u.unlocked ? `${C.success}18` : C.panelHi,
 border:`1px solid ${u.unlocked ? C.success : disabled ? `${C.border}90` : C.border}`,
 color:u.unlocked ? C.success : C.text,
 opacity:disabled && !u.unlocked ? 0.65 : 1,
 cursor:disabled ? "not-allowed" : "pointer",
 borderRadius:2,
 fontFamily:"inherit",
 }}
 >
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
 <span style={{ fontSize:13, fontWeight:"bold" }}>{u.name}</span>
 <span style={{ fontSize:11, color:u.unlocked ? C.success : C.accent3 }}>{u.unlocked ? "Unlocked" : `${u.cost} CF`}</span>
 </div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{u.description}</div>
 {specialLocked && <div style={{ fontSize:11, color:C.warn, marginTop:4 }}>Requires 3 lifetime boss kills.</div>}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 ))}
 </div>

 <div style={{ ...crd, marginTop:12, marginBottom:0 }}>
 <div style={lbl}>Active Meta Effects</div>
 <div style={{ fontSize:12, color:C.textDim, lineHeight:1.7 }}>
 Entropy reduction: {(mods.entropyScaleReduction * 100).toFixed(0)}% | Rewind cost mult: {mods.rewindCostMultiplier.toFixed(2)}x | Mutation severity: {mods.mutationSeverityMultiplier.toFixed(2)}x
 </div>
 </div>
 </div>
 );
}

// ============================================================
// RESULTS
// ============================================================
function HullChart({ data }) {
 if (!data || data.length < 2) return null;
 const W=640, H=80;
 const pts = data.map((v,i) => [i/(data.length-1)*W, H-v/100*H]);
 const poly = pts.map(p=>p.join(",")).join(" ");
 const area = `M 0,${H} L ${pts.map(p=>p.join(",")).join(" L ")} L ${W},${H} Z`;
 return (
 <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:80 }}>
 <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.success} stopOpacity="0.2" /><stop offset="100%" stopColor={C.success} stopOpacity="0" /></linearGradient></defs>
 <line x1={0} y1={H/2} x2={W} y2={H/2} stroke={C.border} strokeWidth="0.5" strokeDasharray="4 3" />
 <path d={area} fill="url(#hg)" />
 <polyline points={poly} fill="none" stroke={C.success} strokeWidth="1.5" />
 {pts.map((p,i) => data[i]<30?<circle key={i} cx={p[0]} cy={p[1]} r={3} fill={C.danger} />:null)}
 </svg>
 );
}

function WeaknessAdvisor({ run }) {
 const w = run.weaknesses;
 const total = Object.values(w).reduce((a,b) => a+b, 0) || 1;
 const tips = [];
 if (w.laser>0) tips.push({ i:"", t:"Shields absorb 35% more laser damage add Shield Array or Layered Defense." });
 if (w.kinetic>0) tips.push({ i:"", t:"Composite Armor or Ablative Coating reduces kinetic penetration." });
 if (w.explosive>0) tips.push({ i:"", t:"Point Defense or ECM Suite intercepts incoming ordnance." });
 if (w.hazard>80) tips.push({ i:"", t:"Repair Drones help recover hull between sectors." });
 if (run.breakdown.eff<40) tips.push({ i:"", t:"Heavy damage received consider more defensive modules." });
 if (run.totalKills===0) tips.push({ i:"", t:"No kills weapon type mismatch or insufficient accuracy." });
 return (
 <div>
 {run.causeOfDeath && (
 <div style={{ background:`${C.danger}10`, border:`1px solid ${C.danger}40`, padding:"10px 12px", marginBottom:12, borderRadius:2 }}>
 <div style={{ fontSize:11, color:C.danger, letterSpacing:"0.1em", fontWeight:"bold", marginBottom:4 }}>CAUSE OF DEATH</div>
 <div style={{ fontSize:13, color:C.textBright }}>{run.causeOfDeath}</div>
 </div>
 )}
 {Object.entries({ laser:"Laser", kinetic:"Kinetic", explosive:"Explosive" }).some(([k]) => w[k]>0) && (
 <div style={{ marginBottom:12 }}>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.1em", fontWeight:"bold", marginBottom:8, textTransform:"uppercase" }}>Damage by Type</div>
 {Object.entries({ laser:"Laser", kinetic:"Kinetic", explosive:"Explosive" }).map(([k,label]) => {
 if (!w[k]) return null;
 const pct = Math.round(w[k]/total*100);
 return <div key={k} style={{ marginBottom:7 }}>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
 <span style={{ color:dmgC(k), fontWeight:"bold" }}>{label}</span>
 <span style={{ color:C.textDim }}>{pct}%</span>
 </div>
 <Bar pct={pct} color={dmgC(k)} h={5} />
 </div>;
 })}
 </div>
 )}
 {tips.length > 0 && (
 <div>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.1em", fontWeight:"bold", marginBottom:8, textTransform:"uppercase" }}>Advisor</div>
 {tips.map((t,i) => (
 <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.text, lineHeight:1.5 }}>
 <span style={{ fontSize:14 }}>{t.i}</span><span>{t.t}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function SingleResult({ run, config, universe }) {
 const [playback, setPlayback] = useState(null);
 const [selSector, setSelSector] = useState(null);
 const openReplay = i => { const s = run.sectors[i]; if (s?.combatFrames) { setPlayback({ frames:s.combatFrames, enemy:s.enemy, biome:s.biome }); setSelSector(i); } };

 return (
 <div style={{ padding:"20px 22px", maxWidth:1000, margin:"0 auto" }}>
 {playback && <CombatPlayback frames={playback.frames} playerName="Your Ship" enemyName={playback.enemy?.name} biome={playback.biome} onClose={() => setPlayback(null)} />}

 <div style={{ textAlign:"center", marginBottom:20 }}>
 <div style={{ fontSize:48 }}>{run.survived?"":""}</div>
 <div style={{ fontSize:20, color:run.survived?C.success:C.danger, marginTop:8, letterSpacing:"0.1em", fontWeight:"bold" }}>{run.survived?"MISSION COMPLETE":"SHIP DESTROYED"}</div>
 {universe && <div style={{ fontSize:13, color:universe.theme.color, marginTop:4 }}>{universe.theme.icon} {universe.theme.name}</div>}
 </div>

 <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
 {[["Score",run.finalScore,C.accent],["Sectors",`${run.sectorsCompleted}/${config.sectorCount}`,C.textBright],["Kills",run.totalKills,C.accent2],["Scrap",`${run.totalScrap}`,C.accent3]].map(([l,v,c]) => (
 <div key={l} style={{ ...crd, textAlign:"center", marginBottom:0 }}>
 <div style={{ fontSize:26, color:c, fontWeight:"bold" }}>{v}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:5, textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
 </div>
 ))}
 </div>

 <div style={crd}>
 <div style={lbl}>Sector Map tap to replay combat</div>
 <SectorMap sectors={run.sectors} total={config.sectorCount} universe={universe} onReplay={openReplay} selected={selSector} />
 </div>

 <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
 <div style={crd}>
 <div style={lbl}>Score Breakdown</div>
 {[["Survival 0.40",run.breakdown.sur,C.success],["Profit 0.25",run.breakdown.pro,C.accent3],["Combat 0.25",run.breakdown.com,C.accent2],["Efficiency 0.10",run.breakdown.eff,C.accent]].map(([k,v,c]) => (
 <div key={k} style={{ marginTop:10 }}>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
 <span style={{ color:C.textDim }}>{k}</span><span style={{ color:c, fontWeight:"bold" }}>{v}</span>
 </div>
 <Bar pct={v} color={c} h={5} />
 </div>
 ))}
 </div>
 <div style={crd}><div style={lbl}>After-Action Report</div><WeaknessAdvisor run={run} /></div>
 </div>

 <div style={crd}><div style={lbl}>Hull Integrity Over Run</div><HullChart data={run.hpOverTime} /></div>

 <div style={crd}>
 <div style={lbl}>Sector Log</div>
 {run.sectors.map((s,i) => {
 const uSector = universe?.sectors?.[i];
 return (
 <div key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
 <div onClick={() => s.combatFrames && openReplay(i)} style={{ display:"flex", gap:10, padding:"7px 4px", fontSize:12, cursor:s.combatFrames?"pointer":"default", background:selSector===i?`${C.accent}08`:"transparent", alignItems:"center" }}>
 <span style={{ color:C.textDim, minWidth:24, fontWeight:"bold" }}>S{s.sector}</span>
 <span style={{ minWidth:18, fontSize:14 }}>{s.biome?.icon}</span>
 <span style={{ color:C.textDim, minWidth:90 }}>{s.biome?.name}</span>
 <span style={{ color:s.event==="combat"?C.accent2:s.event==="hazard"?C.danger:C.accent3, minWidth:60, fontWeight:"bold" }}>{s.event.toUpperCase()}</span>
 {s.enemy && <span style={{ color:C.text }}>vs {s.enemy.name}</span>}
 {s.killed && <span style={{ color:C.success, fontWeight:"bold" }}> Kill</span>}
 {s.hazardDmg>0 && <span style={{ color:C.danger }}>-{s.hazardDmg} HP</span>}
 {s.anomaly && <span style={{ color:C.intel }}>{s.anomaly}</span>}
 {s.repairGain>0 && <span style={{ color:C.success }}>+{s.repairGain} HP</span>}
 {s.scrap>0 && <span style={{ color:C.accent3, marginLeft:"auto" }}>+{s.scrap}</span>}
 {!s.survived && <span style={{ color:C.danger, fontWeight:"bold" }}> DESTROYED</span>}
 {s.combatFrames && <span style={{ color:C.accent, fontSize:11, marginLeft:4 }}> REPLAY</span>}
 </div>
 {uSector?.intel?.clues && (
 <div style={{ paddingLeft:28, paddingBottom:6 }}>
 {uSector.intel.clues.map((c,ci) => <div key={ci} style={{ fontSize:11, color:C.intel }}> {c}</div>)}
 {!s.survived && <div style={{ fontSize:11, color:C.warn, marginTop:3 }}> Counter: {uSector.intel.counter}</div>}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}

// ============================================================
// INTEL REFERENCE
// ============================================================
function Intel() {
 const [t, setT] = useState("enemies");
 return (
 <div style={{ padding:18 }}>
 <div style={{ display:"flex", gap:5, marginBottom:14, flexWrap:"wrap" }}>
 {["enemies","modules","biomes","doctrines","damage"].map(x => <button key={x} style={tabSt(t===x)} onClick={() => setT(x)}>{x}</button>)}
 </div>
 {t==="enemies" && (
 <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:10 }}>
 {ENEMY_TEMPLATES.map(e => (
 <div key={e.id} style={{ ...crd, borderLeft:`3px solid ${sigilColor(e.intel.sigils[0]||"mixed")}`, marginBottom:0 }}>
 <div style={{ display:"flex", justifyContent:"space-between" }}>
 <span style={{ color:C.textBright, fontSize:14, fontWeight:"bold" }}>{e.name}</span>
 <span style={{ color:C.danger, fontSize:12, fontWeight:"bold" }}> Danger {e.danger}</span>
 </div>
 <div style={{ color:C.textDim, fontSize:12, marginTop:3 }}>{e.desc}</div>
 <div style={{ fontSize:12, marginTop:8 }}>
 <span style={{ color:C.success, fontWeight:"bold" }}>Hull {e.hull}</span>
 {e.shield>0&&<span style={{ color:C.accent }}> Shield {e.shield}</span>}
 {e.armor>0&&<span style={{ color:C.warn }}> Armor {e.armor}</span>}
 <span style={{ color:C.textDim }}> Eva {e.evasion}%</span>
 </div>
 <div style={{ fontSize:12, marginTop:5 }}>{e.weapons.map((w, i) => <span key={`${w.name}-${i}`} style={{ color:dmgC(w.dmgType), marginRight:8, fontWeight:"bold" }}>{w.name} ({w.damage})</span>)}</div>
 <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
 <div style={{ fontSize:11, color:C.intel, letterSpacing:"0.1em", marginBottom:5, fontWeight:"bold" }}>INTEL CLUES</div>
 {e.intel.clues.map((c,i) => <div key={i} style={{ fontSize:11, color:C.intel, lineHeight:1.6 }}> {c}</div>)}
 <div style={{ fontSize:11, color:C.warn, marginTop:5 }}> Counter: {e.intel.counter}</div>
 </div>
 </div>
 ))}
 </div>
 )}
 {t==="modules" && (
 <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:8 }}>
 {MODULES.map(m => (
 <div key={m.id} style={{ ...crd, marginBottom:0 }}>
 <div style={{ display:"flex", justifyContent:"space-between" }}>
 <span style={{ color:C.textBright, fontSize:13, fontWeight:"bold" }}>{m.name}</span>
 <span style={{ color:C.accent, fontSize:12, fontWeight:"bold" }}>{m.bpCost} BP</span>
 </div>
 <div style={{ color:C.accent2, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", marginTop:2, fontWeight:"bold" }}>{m.type}</div>
 <div style={{ color:C.textDim, fontSize:12, marginTop:5 }}>{m.desc}</div>
 {m.stats?.damage&&<div style={{ color:dmgC(m.stats.dmgType), fontSize:12, marginTop:5, fontWeight:"bold" }}> {m.stats.damage} {m.stats.dmgType} cd{m.stats.cooldown}</div>}
 </div>
 ))}
 </div>
 )}
 {t==="biomes" && (
 <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
 {BIOMES.map(b => (
 <div key={b.id} style={{ ...crd, borderLeft:`3px solid ${b.color||C.border}`, marginBottom:0 }}>
 <div style={{ fontSize:24 }}>{b.icon}</div>
 <div style={{ color:C.textBright, fontSize:14, marginTop:5, fontWeight:"bold" }}>{b.name}</div>
 <div style={{ color:C.textDim, fontSize:12, marginTop:4 }}>{b.desc}</div>
 </div>
 ))}
 </div>
 )}
 {t==="doctrines" && (
 <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:8 }}>
 {DOCTRINES.map(d => (
 <div key={d.id} style={{ ...crd, borderLeft:`3px solid ${C.accent2}`, marginBottom:0 }}>
 <div style={{ fontSize:24 }}>{d.icon}</div>
 <div style={{ color:C.accent2, fontSize:14, marginTop:5, fontWeight:"bold" }}>{d.name}</div>
 <div style={{ color:C.textDim, fontSize:12, marginTop:4 }}>{d.desc}</div>
 <div style={{ fontSize:12, marginTop:8 }}>
 <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
 <span style={{ color:C.textDim }}>Preferred range</span><span style={{ color:C.text, fontWeight:"bold" }}>{d.preferredRange}</span>
 </div>
 <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
 <span style={{ color:C.textDim }}>Disengage at</span><span style={{ color:C.warn, fontWeight:"bold" }}>{Math.round(d.disengageThreshold*100)}% HP</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 {t==="damage" && (
 <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
 {[["laser",C.laser,"Laser","Shields (+35% dmg)","Armor (no bonus)","Fast, hot, reliable. Strip shields first."],["kinetic",C.kinetic,"Kinetic","Armor (10pt penetration)","Shields (40% dmg)","Armor piercing. Best after shields drop."],["explosive",C.explosive,"Explosive","Bare hull, huge burst","Point Defense / ECM","Highest peak damage. Countered by PD."]].map(([tp,c,name,str,weak,note]) => (
 <div key={tp} style={{ ...crd, borderTop:`3px solid ${c}`, marginBottom:0 }}>
 <div style={{ color:c, fontSize:15, fontWeight:"bold" }}>{name}</div>
 <div style={{ fontSize:12, marginTop:10 }}>
 <div style={{ color:C.success, marginBottom:5 }}> Strong vs: {str}</div>
 <div style={{ color:C.danger, marginBottom:8 }}> Weak vs: {weak}</div>
 <div style={{ color:C.textDim }}>{note}</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

// ============================================================
// BATTLE PUZZLE LOOP TIME REWIND SYSTEM
// ============================================================

// Analyzes a failed sector and produces targeted advice
function analyzeDefeat(sector, enemy, damageBreakdown) {
 const tips = [];
 const db = damageBreakdown || {};
 const dominant = Object.entries(db).sort((a,b)=>b[1]-a[1])[0]?.[0];

 if (dominant === "laser") {
 tips.push({ icon:"", title:"Laser fire overwhelmed you", body:"Shields absorb 35% bonus laser damage. Swap in Shield Array or Layered Defense." });
 tips.push({ icon:"", title:"Try Skirmisher doctrine", body:"Kiting retreats before you die buys time for shield regen." });
 }
 if (dominant === "kinetic") {
 tips.push({ icon:"", title:"Kinetic rounds tore through you", body:"Composite Armor reduces kinetic hits by flat reduction. Ablative Coating stacks on top." });
 tips.push({ icon:"", title:"Tank doctrine holds position", body:"Less disengaging means more of your fire lands. Pair with armor." });
 }
 if (dominant === "explosive") {
 tips.push({ icon:"", title:"Missiles tracked you down", body:"Point Defense intercepts 35% of ordnance. ECM Suite adds 30% on top." });
 tips.push({ icon:"", title:"Missile Boat out-ranges them", body:"Staying at max range disrupts missile corvette fire solutions." });
 }
 if (enemy?.armor > 20) {
 tips.push({ icon:"", title:"Heavy armor soaked your shots", body:"Kinetic weapons bypass armor (10pt penetration). Mass Driver or Rail Driver are your tools." });
 tips.push({ icon:"", title:"Missiles skip armor", body:"Explosive damage goes straight to hull once shields drop. Torpedo Bay for raw burst." });
 }
 if (enemy?.evasion > 20) {
 tips.push({ icon:"", title:"Enemy kept dodging", body:"Targeting Computer adds 12% accuracy. Missiles auto-track they ignore evasion." });
 }
 if (enemy?.maxShield > 80) {
 tips.push({ icon:"", title:"Shields ate everything", body:"Lasers deal 35% bonus shield damage. Pulse Laser or Beam Array strips them fast." });
 }
 if (enemy?.hull > 250) {
 tips.push({ icon:"", title:"This is a war of attrition", body:"Repair Drones keep your hull up through the long fight. High DPS weapons needed." });
 tips.push({ icon:"", title:"Reactor headroom matters", body:"Heavy Fusion Plant powers more weapons simultaneously fewer offline-due-to-power events." });
 }
 // Always add the enemy's own counter advice
 if (enemy?.intel?.counter) {
 tips.push({ icon:"", title:"SIGINT says", body: enemy.intel.counter });
 }
 return tips.slice(0, 4);
}

// Cinematic time-rewind death screen
function TimeRewindScreen({ sector, enemy, damageBreakdown, attempts, onEdit }) {
 const [phase, setPhase] = useState("dying"); // dying rewinding analysis
 const tips = analyzeDefeat(sector, enemy, damageBreakdown);

 useEffect(() => {
 const t1 = setTimeout(() => setPhase("rewinding"), 1200);
 const t2 = setTimeout(() => setPhase("analysis"), 2800);
 return () => { clearTimeout(t1); clearTimeout(t2); };
 }, []);

 const dominant = Object.entries(damageBreakdown||{}).sort((a,b)=>b[1]-a[1])[0]?.[0];
 const killColor = dominant ? dmgC(dominant) : C.danger;

 return (
 <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:C.bg, padding:24 }}>
 {phase === "dying" && (
 <div style={{ textAlign:"center" }}>
 <div style={{ fontSize:80, lineHeight:1, animation:"pulse 0.6s infinite" }}></div>
 <div style={{ fontSize:28, color:C.danger, marginTop:16, fontWeight:"bold", letterSpacing:"0.15em" }}>SHIP DESTROYED</div>
 <div style={{ fontSize:14, color:C.textDim, marginTop:8 }}>Sector {sector?.sectorNum} {enemy?.name}</div>
 </div>
 )}

 {phase === "rewinding" && (
 <div style={{ textAlign:"center" }}>
 <div style={{ fontSize:60, lineHeight:1 }}></div>
 <div style={{ fontSize:26, color:C.intel, marginTop:16, fontWeight:"bold", letterSpacing:"0.12em" }}>TIMELINE REVERTING...</div>
 <div style={{ fontSize:13, color:C.textDim, marginTop:8 }}>Causality loop detected. Rewinding to pre-engagement.</div>
 <div style={{ marginTop:24, width:300, margin:"24px auto 0" }}>
 <div style={{ height:3, background:C.border, borderRadius:2 }}>
 <div style={{ height:"100%", background:C.intel, borderRadius:2, width:"100%", transition:"width 1.4s linear", animation:"rewindBar 1.4s linear forwards" }} />
 </div>
 </div>
 </div>
 )}

 {phase === "analysis" && (
 <div style={{ maxWidth:600, width:"100%" }}>
 <div style={{ textAlign:"center", marginBottom:28 }}>
 <div style={{ fontSize:14, color:C.textDim, letterSpacing:"0.15em", marginBottom:8 }}>
 ATTEMPT {attempts} SECTOR {sector?.sectorNum}
 </div>
 <div style={{ fontSize:24, color:killColor, fontWeight:"bold" }}>
 {sector?.biome?.icon} Destroyed by {enemy?.name}
 </div>
 {dominant && (
 <div style={{ marginTop:8, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
 {Object.entries(damageBreakdown||{}).sort((a,b)=>b[1]-a[1]).map(([type, dmg]) => (
 <span key={type} style={{ fontSize:12, color:dmgC(type), background:`${dmgC(type)}18`, border:`1px solid ${dmgC(type)}40`, padding:"3px 10px", borderRadius:2 }}>
 {sigilIcon(type)} {type.toUpperCase()} {dmg} dmg
 </span>
 ))}
 </div>
 )}
 </div>

 <div style={{ ...crd, borderLeft:`4px solid ${C.intel}`, marginBottom:16 }}>
 <div style={{ ...lbl, color:C.intel, marginBottom:12 }}>COMBAT ANALYSIS WHAT WENT WRONG</div>
 <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
 {tips.map((tip, i) => (
 <div key={i} style={{ display:"flex", gap:14, padding:"10px 12px", background:C.panelHi, borderRadius:2, border:`1px solid ${C.border}` }}>
 <div style={{ fontSize:22, flexShrink:0 }}>{tip.icon}</div>
 <div>
 <div style={{ fontSize:13, color:C.textBright, fontWeight:"bold", marginBottom:3 }}>{tip.title}</div>
 <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>{tip.body}</div>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div style={{ display:"flex", justifyContent:"center" }}>
 <button style={{ ...btn("intel"), padding:"14px 40px", fontSize:14, fontWeight:"bold" }} onClick={onEdit}>
 ADAPT LOADOUT &amp; RETRY
 </button>
 </div>
 </div>
 )}
 </div>
 );
}

// Mid-run loadout editor swap modules/doctrine but not chassis
function RewindDecisionScreen({
 sector,
 lastResult,
 entropyLevel,
 chronoFragments,
 rewindOptions,
 nextMutationPreview,
 mutationChoices,
 selectedMutationType,
 onSelectMutationType,
 paradoxCoreUnlocked,
 paradoxMode,
 onToggleParadoxMode,
 onRewind,
 onEdit,
 ironman,
}) {
 const isMobile = useIsMobile();
 const cause = lastResult?.killerDmgType === "hazard"
 ? `Hazard spike in ${sector?.biome?.name}`
 : `Destroyed by ${sector?.enemy?.name || "enemy fire"}`;
 return (
 <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:isMobile ? 12 : 24 }}>
 <div style={{ width:"100%", maxWidth:760 }}>
 <div style={{ ...crd, borderLeft:`4px solid ${C.danger}` }}>
 <div style={{ ...lbl, color:C.danger, marginBottom:12 }}>RUN FAILURE</div>
 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "repeat(4,minmax(0,1fr))", gap:8 }}>
 {[["Cause", cause, C.textBright], ["Sector", `S${sector?.sectorNum || "?"}`, C.warn], ["Entropy", entropyLevel, C.intel], ["Chrono", chronoFragments, C.accent3]].map(([k,v,c]) => (
 <div key={k} style={{ background:C.panelHi, border:`1px solid ${C.border}`, padding:"10px 12px", borderRadius:2 }}>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{k}</div>
 <div style={{ fontSize:14, color:c, fontWeight:"bold" }}>{v}</div>
 </div>
 ))}
 </div>
 </div>

 <div style={{ ...crd, marginTop:12 }}>
 <div style={lbl}>Branching Rewind</div>
 {ironman ? (
 <div style={{ marginTop:10, color:C.warn, fontSize:13, lineHeight:1.6 }}>
 Ironman mode enabled: rewinds are disabled. You can still adjust loadout and retry this sector.
 </div>
 ) : (
 <div style={{ marginTop:10, display:"grid", gap:10 }}>
 {mutationChoices?.length > 0 && (
 <div style={{ border:`1px solid ${C.intel}55`, background:`${C.intel}08`, padding:"10px 12px", borderRadius:2 }}>
 <div style={{ fontSize:11, color:C.intel, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Mutation Steering</div>
 <div style={{ display:"grid", gap:6 }}>
 {mutationChoices.map(choice => (
 <button
 key={choice.type}
 onClick={() => onSelectMutationType(choice.type)}
 style={{
 ...btn("intel"),
 textAlign:"left",
 opacity: selectedMutationType && selectedMutationType !== choice.type ? 0.55 : 1,
 }}
 >
 {choice.label}
 </button>
 ))}
 </div>
 </div>
 )}
 {paradoxCoreUnlocked && (
 <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.warn }}>
 <input type="checkbox" checked={paradoxMode} onChange={e => onToggleParadoxMode(e.target.checked)} />
 Paradox Core: rewind without entropy reset
 </label>
 )}
 {rewindOptions.map(opt => {
 const afford = canAffordRewind(chronoFragments, opt.cost);
 return (
 <div key={opt.sectorNumber} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, border:`1px solid ${afford ? C.border : C.danger}55`, background:afford ? C.panelHi : `${C.danger}0f`, padding:"10px 12px", borderRadius:2 }}>
 <div>
 <div style={{ fontSize:13, color:C.textBright, fontWeight:"bold" }}>{opt.label}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>
 Cost: <span style={{ color:afford ? C.accent3 : C.danger, fontWeight:"bold" }}>{opt.cost}</span> Chrono Fragments
 </div>
 <div style={{ fontSize:11, color:C.intel, marginTop:3 }}>Mutation: {nextMutationPreview?.label} ({nextMutationPreview?.detail})</div>
 </div>
 <button disabled={!afford} onClick={() => onRewind(opt, { selectedMutationType, useParadoxCore: paradoxMode })} style={{ ...btn("intel"), opacity:afford ? 1 : 0.35, minWidth:140 }}>
 Rewind
 </button>
 </div>
 );
 })}
 </div>
 )}
 <div style={{ display:"flex", justifyContent:"center", marginTop:14 }}>
 <button style={{ ...btn(), padding:"11px 24px" }} onClick={onEdit}>Adjust Loadout</button>
 </div>
 </div>
 </div>
 </div>
 );
}

function MidRunEditor({ build, onBuildChange, enemy, universe, onRetry, attempts }) {
 const isMobile = useIsMobile();
 const { chassis, modules, doctrine } = build;
 const ch = CHASSIS.find(c => c.id === chassis);
 const bp = getBP(modules);
 const [pickSlot, setPickSlot] = useState(null);
 const stats = deriveShipStats(ch, modules.filter(Boolean));

 const slotDefs = [
 { label:"Reactor", types:["reactor"] },
 { label:"Engine", types:["engine"] },
 { label:"Defense", types:["defense"] },
 ...Array.from({ length:ch.slots.weapons }, (_,i) => ({ label:`Weapon ${i+1}`, types:["weapon"], maxSize:ch.maxWeaponSize })),
 ...Array.from({ length:ch.slots.utility }, (_,i) => ({ label:`Utility ${i+1}`, types:["utility"] })),
 ];
 const setMod = (i, m) => { const ms=[...modules]; ms[i]=m; onBuildChange({ ...build, modules:ms }); setPickSlot(null); };

 return (
 <div style={{ padding:isMobile ? "14px 12px" : "20px 22px", maxWidth:960, margin:"0 auto" }}>
 <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20, flexWrap:"wrap" }}>
 <div style={{ flex:1 }}>
 <div style={{ fontSize:12, color:C.textDim, letterSpacing:"0.12em", marginBottom:4 }}>TIMELINE RESTORED ATTEMPT {attempts + 1}</div>
 <div style={{ fontSize:20, color:C.intel, fontWeight:"bold" }}>Adapt your loadout. Then fight again.</div>
 <div style={{ fontSize:13, color:C.textDim, marginTop:4 }}>
 {enemy && <>Next: <span style={{ color:C.accent2, fontWeight:"bold" }}>{enemy.name}</span> {enemy.hull} hull {enemy.armor ? `${enemy.armor} armor` : "no armor"} {enemy.evasion}% evasion</>}
 </div>
 </div>
 <button style={{ ...btn("p"), padding:"12px 28px", fontSize:13, fontWeight:"bold" }} onClick={onRetry}>
 FIGHT AGAIN
 </button>
 </div>

 {enemy && (
 <div style={{ ...crd, borderLeft:`3px solid ${sigilColor(enemy.intel?.sigils?.[0]||"mixed")}`, marginBottom:16 }}>
 <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
 <div style={{ flex:1 }}>
 <div style={{ fontSize:11, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontWeight:"bold" }}>Enemy Intel</div>
 <div style={{ fontSize:16, color:C.textBright, fontWeight:"bold", marginBottom:4 }}>{enemy.name}</div>
 <div style={{ fontSize:12, color:C.textDim, marginBottom:8 }}>{enemy.desc}</div>
 <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12 }}>
 <span style={{ color:C.success }}>Hull {enemy.hull}</span>
 {enemy.maxShield>0 && <span style={{ color:C.accent }}>Shield {enemy.maxShield}</span>}
 {enemy.armor>0 && <span style={{ color:C.warn }}>Armor {enemy.armor}</span>}
 <span style={{ color:C.textDim }}>Evasion {enemy.evasion}%</span>
 </div>
 <div style={{ marginTop:8 }}>
 {enemy.weapons.map((w, i) => (
 <span key={`${w.name}-${i}`} style={{ fontSize:11, color:dmgC(w.dmgType), marginRight:12, fontWeight:"bold" }}>
 {sigilIcon(w.dmgType)} {w.name} {w.damage}dmg
 </span>
 ))}
 </div>
 </div>
 <div style={{ minWidth:isMobile ? 0 : 200 }}>
 <div style={{ fontSize:11, color:C.intel, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontWeight:"bold" }}>SIGINT Clues</div>
 {enemy.intel?.clues?.map((c,i) => (
 <div key={i} style={{ fontSize:11, color:C.intel, lineHeight:1.6 }}> {c}</div>
 ))}
 <div style={{ fontSize:11, color:C.warn, marginTop:6 }}> {enemy.intel?.counter}</div>
 </div>
 </div>
 </div>
 )}

 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 280px", gap:16 }}>
 <div>
 <div style={crd}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
 <div style={lbl}>Loadout {ch.icon} {ch.name} (chassis locked)</div>
 <div style={{ fontSize:13, fontWeight:"bold" }}>
 <span style={{ color:bp>ch.bpCap?C.danger:C.accent }}>{bp}</span>
 <span style={{ color:C.textDim }}> / {ch.bpCap} BP</span>
 </div>
 </div>
 <Bar pct={bp/ch.bpCap*100} color={bp>ch.bpCap?C.danger:C.accent} h={6} />
 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:8, marginTop:12 }}>
 {slotDefs.map((sd, idx) => {
 const mod = modules[idx];
 return (
 <button key={idx} onClick={() => setPickSlot(pickSlot===idx?null:idx)} style={{ padding:11, background:pickSlot===idx?`${C.accent}0a`:mod?`${C.accent}05`:"transparent", border:`1px solid ${pickSlot===idx?C.accent:mod?C.border:C.border+"60"}`, cursor:"pointer", textAlign:"left", color:C.text, fontFamily:"inherit", borderRadius:2 }}>
 <div style={{ fontSize:11, color:C.textDim, marginBottom:3, fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.06em" }}>{sd.label}</div>
 {mod ? <>
 <div style={{ fontSize:13, color:C.textBright, fontWeight:"bold" }}>{mod.name}</div>
 <div style={{ fontSize:11, color:C.accent, marginTop:2 }}>{mod.bpCost} BP</div>
 {mod.stats?.damage && <div style={{ fontSize:11, color:dmgC(mod.stats.dmgType), marginTop:1 }}>{mod.stats.dmgType} {mod.stats.damage} dmg</div>}
 </> : <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>[ empty ]</div>}
 </button>
 );
 })}
 </div>
 {pickSlot !== null && slotDefs[pickSlot] && (
 <ModulePicker slotDef={slotDefs[pickSlot]} selected={modules[pickSlot]} onSelect={m => setMod(pickSlot, m)} bpLeft={ch.bpCap - bp + (modules[pickSlot]?.bpCost||0)} universe={universe} />
 )}
 </div>

 <div style={crd}>
 <div style={lbl}>Doctrine</div>
 <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
 {DOCTRINES.map(d => (
 <button key={d.id} onClick={() => onBuildChange({ ...build, doctrine:d.id })} style={{ padding:"8px 14px", background:doctrine===d.id?`${C.accent2}15`:"transparent", border:`1px solid ${doctrine===d.id?C.accent2:C.border}`, color:doctrine===d.id?C.accent2:C.text, cursor:"pointer", fontSize:12, fontFamily:"inherit", borderRadius:2 }} title={d.desc}>
 {d.icon} {d.name}
 </button>
 ))}
 </div>
 {doctrine && <div style={{ fontSize:12, color:C.textDim, marginTop:8 }}>{DOCTRINES.find(d=>d.id===doctrine)?.desc}</div>}
 </div>
 </div>

 {/* Live stats panel */}
 <div style={crd}>
 <div style={lbl}>Your Ship Stats</div>
 <div style={{ fontSize:13, color:ch.color, margin:"6px 0 12px", fontWeight:"bold" }}>{ch.icon} {ch.name}</div>
 {[
 ["Hull",stats.maxHull,C.success], ["Shield",stats.maxShield||"",C.accent],
 ["Armor",stats.armor||"",C.warn], ["Evasion",stats.evasion+"%",""],
 ["Net Power",stats.powerGen-stats.powerDraw,(stats.powerGen-stats.powerDraw)<0?C.danger:C.success],
 ["Missile Counter",stats.missileCounter?stats.missileCounter+"%":"",""],
 ].map(([k,v,c]) => (
 <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
 <span style={{ color:C.textDim }}>{k}</span><span style={{ color:c||C.textBright, fontWeight:"bold" }}>{v}</span>
 </div>
 ))}
 {stats.weapons.length > 0 && <>
 <div style={{ ...lbl, marginTop:14, marginBottom:8 }}>Weapons</div>
 {stats.weapons.map((w,i) => (
 <div key={i} style={{ padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
 <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
 <span style={{ color:C.textBright, fontWeight:"bold" }}>{w.name}</span>
 <span style={{ color:dmgC(w.dmgType), fontWeight:"bold" }}>{w.damage} dmg</span>
 </div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{w.dmgType} {w.accuracy}% acc cd{w.cooldown}</div>
 </div>
 ))}
 </>}
 </div>
 </div>
 </div>
 );
}

// Sector intro card shown before each battle
function BattleRun({ universe, initialBuild, onBuildChange, metaProgress, onMetaProgress }) {
 const isMobile = useIsMobile();
 const ch0 = CHASSIS.find(c => c.id === initialBuild.chassis);
 const normalizedMeta = normalizeMetaProgress(metaProgress);
 const initMetaMods = getMetaModifiers(normalizedMeta.metaState, { entropyLevel: 0, deathTracking: normalizedMeta.enemyDeathTypes });
 const initStats = deriveShipStats(ch0, initialBuild.modules.filter(Boolean), initMetaMods);
 const baseUniverseRef = useRef(universe);

 const [build, setBuild] = useState(initialBuild);
 const [sectorIdx, setSectorIdx] = useState(0);
 const [shipState, setShipState] = useState({ hull: initStats.maxHull, shield: initStats.maxShield });
 const [phase, setPhase] = useState("briefing");
 const [lastResult, setLastResult] = useState(null);
 const [attemptCount, setAttemptCount] = useState(0);
 const [completedSectors, setCompletedSectors] = useState([]);
 const [totalScrap, setTotalScrap] = useState(0);
 const [showPlayback, setShowPlayback] = useState(null);
 const [entropyLevel, setEntropyLevel] = useState(0);
 const [rewindCount, setRewindCount] = useState(0);
 const [mutationState, setMutationState] = useState(() => createMutationState());
 const [tempPerks, setTempPerks] = useState([]);
 const [checkpoints, setCheckpoints] = useState({});
 const [chronoEarnedRun, setChronoEarnedRun] = useState(0);
 const [failSafeUsed, setFailSafeUsed] = useState(false);
 const [postRewindBuffSectors, setPostRewindBuffSectors] = useState(0);
 const [timelineEntropyReliefSectors, setTimelineEntropyReliefSectors] = useState(0);
 const [paradoxMode, setParadoxMode] = useState(false);
 const [selectedMutationType, setSelectedMutationType] = useState(null);
 const [runUniverse, setRunUniverse] = useState(() => applyMutationsToUniverse(universe, createMutationState()));

 const sector = runUniverse.sectors[sectorIdx];
 const activeMeta = normalizeMetaProgress(metaProgress);
 const runMetaMods = getMetaModifiers(activeMeta.metaState, {
 entropyLevel,
 enemyId: sector?.enemy?.id,
 deathTracking: activeMeta.enemyDeathTypes,
 });
 const handleBuildChange = (b) => { setBuild(b); onBuildChange(b); };

 useEffect(() => {
 const cp = createSectorCheckpoint({
 sectorNumber: 1,
 shipState: { hull: initStats.maxHull, shield: initStats.maxShield },
 resources: { totalScrap: 0, chronoEarnedRun: 0 },
 perks: [],
 entropyLevel: 0,
 rngState: { sectorSeed: computeSectorSeed(runUniverse.seed, 0, 0, 0, 0) },
 buildState: initialBuild,
 });
 setCheckpoints({ 1: cp });
 }, []);

 const onEngage = () => {
 const cp = checkpoints[sectorIdx + 1];
 let result = simulateSingleSector(build, sector, shipState, runUniverse.seed, sectorIdx, {
 entropyLevel,
 rewindCount,
 mutationState,
 metaModifiers: runMetaMods,
 postRewindDamageBonus: postRewindBuffSectors > 0 ? runMetaMods.postRewindDamageBonus : 0,
 rngState: cp?.rngState,
 });

 if (!result.survived && runMetaMods.hasFailSafeSystems && !failSafeUsed) {
 result = { ...result, survived: true, nextHull: 1, nextShield: 0, failSafeTriggered: true };
 setFailSafeUsed(true);
 }
 if (!result.survived && sector?.enemy?.id) {
 const enemyId = sector.enemy.id;
 onMetaProgress(prev => {
 const nx = normalizeMetaProgress(prev);
 return {
 ...nx,
 enemyDeathTypes: {
 ...nx.enemyDeathTypes,
 [enemyId]: (nx.enemyDeathTypes[enemyId] || 0) + 1,
 },
 };
 });
 }
 setLastResult(result);
 setAttemptCount(a => a + 1);
 setPhase(result.survived ? "won" : "rewind");
 };

 const onAdvance = () => {
 if (!lastResult) return;
 const nextScrap = totalScrap + (lastResult.scrap || 0);
 const bossDefeated = lastResult.killed && isBossSector(sector);
 const reliefPool = bossDefeated ? Math.max(timelineEntropyReliefSectors, 2) : timelineEntropyReliefSectors;
 const baseEntropyGrowth = 1 + (mutationState.entropyRateBoost || 0) + (runUniverse.ironman ? 0.5 : 0);
 const entropyGrowth = reliefPool > 0
 ? Math.max(0.25, baseEntropyGrowth - (runMetaMods.timelineEntropyReduction || 0))
 : baseEntropyGrowth;
 const nextEntropy = entropyLevel + entropyGrowth;
 const sectorNum = sectorIdx + 1;
 const chronoGain = getChronoRewardForSector(lastResult, sector, sectorNum, activeMeta.firstTimeReached, runUniverse.ironman, runMetaMods);
 setChronoEarnedRun(v => v + chronoGain);
 onMetaProgress(prev => {
 const nx = normalizeMetaProgress(prev);
 return {
 ...nx,
 chronoFragments: (nx.chronoFragments || 0) + chronoGain,
 firstTimeReached: { ...(nx.firstTimeReached || {}), [String(sectorNum)]: true },
 metaState: {
 ...nx.metaState,
 lifetimeSectorsCleared: (nx.metaState.lifetimeSectorsCleared || 0) + 1,
 lifetimeBossKills: (nx.metaState.lifetimeBossKills || 0) + (bossDefeated ? 1 : 0),
 },
 };
 });

 const ch = CHASSIS.find(c => c.id === build.chassis);
 const shipForTransition = deriveShipStats(ch, build.modules.filter(Boolean), getMetaModifiers(activeMeta.metaState, { entropyLevel: nextEntropy, deathTracking: activeMeta.enemyDeathTypes }));
 const shieldEchoAmount = Math.round((shipForTransition.maxShield || 0) * (runMetaMods.shieldEchoBetweenSectors || 0));
 const nextShieldAfterEcho = Math.min(shipForTransition.maxShield || 0, (lastResult.nextShield || 0) + shieldEchoAmount);
 setShipState({ hull: lastResult.nextHull, shield: nextShieldAfterEcho });
 setTotalScrap(nextScrap);
 setEntropyLevel(nextEntropy);
 setCompletedSectors(prev => [...prev, { ...lastResult, attemptsOnSector: attemptCount, entropyAfter: nextEntropy, chronoGain }]);
 setAttemptCount(0);
 if (postRewindBuffSectors > 0) setPostRewindBuffSectors(v => v - 1);
 if (bossDefeated) setTimelineEntropyReliefSectors(1);
 else if (timelineEntropyReliefSectors > 0) setTimelineEntropyReliefSectors(v => v - 1);

 if (sectorIdx + 1 >= runUniverse.sectors.length) {
 setPhase("complete");
 return;
 }

 const nextSectorNum = sectorIdx + 2;
 const nextShip = { hull: lastResult.nextHull, shield: lastResult.nextShield };
 const nextSeed = computeSectorSeed(runUniverse.seed, nextSectorNum - 1, nextEntropy, rewindCount, mutationState.mutationCount || 0);
 setCheckpoints(prev => ({
 ...prev,
 [nextSectorNum]: createSectorCheckpoint({
 sectorNumber: nextSectorNum,
 shipState: { hull: nextShip.hull, shield: nextShieldAfterEcho },
 resources: { totalScrap: nextScrap, chronoEarnedRun: chronoEarnedRun + chronoGain },
 perks: tempPerks,
 entropyLevel: nextEntropy,
 rngState: { sectorSeed: nextSeed },
 buildState: build,
 }),
 }));
 setSectorIdx(i => i + 1);
 setPhase("briefing");
 };

 const rewindOptions = getRewindOptions({
 maxReachedSector: sectorIdx + 1,
 sectors: runUniverse.sectors,
 rewindCount,
 ironman: runUniverse.ironman,
 metaState: activeMeta.metaState,
 });
 const mutationChoices = runMetaMods.mutationSteeringChoices >= 3
 ? previewMutationChoices(mutationState, runUniverse.seed, rewindCount, runUniverse.sectors.length, 3)
 : [];
 const nextMutationPreview = selectedMutationType
 ? previewNextMutation(mutationState, runUniverse.seed, rewindCount, runUniverse.sectors.length, { forcedType: selectedMutationType })
 : previewNextMutation(mutationState, runUniverse.seed, rewindCount, runUniverse.sectors.length);

 const onRewind = (opt, opts = {}) => {
 if (!canAffordRewind(activeMeta.chronoFragments || 0, opt.cost)) return;
 const checkpoint = restoreSectorCheckpoint(checkpoints[opt.sectorNumber]);
 if (!checkpoint) return;

 onMetaProgress(prev => {
 const nx = normalizeMetaProgress(prev);
 return {
 ...nx,
 chronoFragments: Math.max(0, (nx.chronoFragments || 0) - opt.cost),
 lifetimeRewinds: (nx.lifetimeRewinds || 0) + 1,
 };
 });

 const { mutationState: newMutationState, mutationApplied } = applyRewindMutation(
 mutationState,
 runUniverse.seed,
 rewindCount,
 runUniverse.sectors.length,
 {
 severityMultiplier: runMetaMods.mutationSeverityMultiplier,
 forcedType: opts.selectedMutationType || null,
 }
 );
 const nextRewindCount = rewindCount + 1;
 const useParadoxCore = !!opts.useParadoxCore && runMetaMods.paradoxCoreUnlocked;
 const entropyAfterRewind = useParadoxCore
 ? entropyLevel + (runUniverse.ironman ? 1.5 : 1) + (newMutationState.entropyRateBoost || 0)
 : checkpoint.entropyLevel + (runUniverse.ironman ? 3 : 2) + (newMutationState.entropyRateBoost || 0);
 const mutatedUniverse = applyMutationsToUniverse(baseUniverseRef.current, newMutationState);
 const targetSeed = computeSectorSeed(mutatedUniverse.seed, opt.sectorNumber - 1, entropyAfterRewind, nextRewindCount, newMutationState.mutationCount || 0);
 const carryScrap = Math.round(totalScrap * (runMetaMods.rewindScrapCarryPct || 0));
 const rewindScrap = (checkpoint.resources?.totalScrap || 0) + carryScrap;
 const recalledPerks = (runMetaMods.retainedPerksOnRewind > 0 && tempPerks.length > 0)
 ? [tempPerks[Math.floor(Math.random() * tempPerks.length)]]
 : [];

 setMutationState(newMutationState);
 setRunUniverse(mutatedUniverse);
 setRewindCount(nextRewindCount);
 setEntropyLevel(entropyAfterRewind);
 setBuild(checkpoint.buildState || build);
 onBuildChange(checkpoint.buildState || build);
 setShipState(checkpoint.shipState || shipState);
 setTotalScrap(rewindScrap);
 setChronoEarnedRun(checkpoint.resources?.chronoEarnedRun || 0);
 setTempPerks([...(checkpoint.perks || []), ...recalledPerks].slice(0, 3));
 setPostRewindBuffSectors(runMetaMods.postRewindDamageBonus > 0 ? 1 : 0);
 setSelectedMutationType(null);
 setCompletedSectors(prev => prev.filter(s => s.sector < opt.sectorNumber));
 setCheckpoints(prev => {
 const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => +k <= opt.sectorNumber));
 kept[opt.sectorNumber] = createSectorCheckpoint({
 sectorNumber: opt.sectorNumber,
 shipState: checkpoint.shipState || shipState,
 resources: { ...(checkpoint.resources || { totalScrap: 0, chronoEarnedRun: 0 }), totalScrap: rewindScrap },
 perks: [...(checkpoint.perks || []), ...recalledPerks].slice(0, 3),
 entropyLevel: entropyAfterRewind,
 rngState: { sectorSeed: targetSeed },
 buildState: checkpoint.buildState || build,
 });
 return kept;
 });
 setSectorIdx(opt.sectorNumber - 1);
 setAttemptCount(0);
 setLastResult(prev => ({ ...(prev || {}), mutationApplied }));
 setPhase("briefing");
 };

 if (phase === "complete") {
 return <RunSummary completedSectors={completedSectors} totalScrap={totalScrap} universe={runUniverse}
 chronoEarnedRun={chronoEarnedRun} entropyLevel={entropyLevel} rewindCount={rewindCount}
 onReplay={(fr, en, bi) => setShowPlayback({ frames:fr, enemy:en, biome:bi })}
 showPlayback={showPlayback} onClosePlayback={() => setShowPlayback(null)} />;
 }

 if (phase === "rewind") {
 return <RewindDecisionScreen
 sector={sector}
 lastResult={lastResult}
 entropyLevel={entropyLevel}
 chronoFragments={metaProgress?.chronoFragments || 0}
 rewindOptions={rewindOptions}
 nextMutationPreview={nextMutationPreview}
 mutationChoices={mutationChoices}
 selectedMutationType={selectedMutationType}
 onSelectMutationType={setSelectedMutationType}
 paradoxCoreUnlocked={runMetaMods.paradoxCoreUnlocked}
 paradoxMode={paradoxMode}
 onToggleParadoxMode={setParadoxMode}
 onRewind={onRewind}
 onEdit={() => setPhase("editing")}
 ironman={runUniverse.ironman}
 />;
 }

 if (phase === "editing") {
 return <MidRunEditor build={build} onBuildChange={handleBuildChange}
 enemy={sector.enemy} universe={runUniverse}
 onRetry={() => setPhase("briefing")} attempts={attemptCount} />;
 }

 if (phase === "won" && lastResult) {
 const isCombat = sector.eventType === "combat";
 const ch = CHASSIS.find(c => c.id === build.chassis);
 const ship = deriveShipStats(ch, build.modules.filter(Boolean), runMetaMods);
 const hullAfter = lastResult.nextHull;
 const hullPct = Math.round(hullAfter / ship.maxHull * 100);
 const isLastSector = sectorIdx + 1 >= runUniverse.sectors.length;
 const chronoGain = getChronoRewardForSector(lastResult, sector, sectorIdx + 1, activeMeta.firstTimeReached, runUniverse.ironman, runMetaMods);

 return (
 <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:isMobile ? 12 : 24 }}>
 {showPlayback && <CombatPlayback frames={showPlayback.frames} playerName="Your Ship" enemyName={showPlayback.enemy?.name} biome={showPlayback.biome} onClose={() => setShowPlayback(null)} />}
 <div style={{ maxWidth:520, width:"100%" }}>
 <div style={{ display:"flex", gap:4, marginBottom:24, justifyContent:"center" }}>
 {runUniverse.sectors.map((_,i) => (
 <div key={i} style={{ width:20, height:7, borderRadius:2, background: i < sectorIdx ? C.success : i === sectorIdx ? C.accent : C.border }} />
 ))}
 </div>

 <div style={{ textAlign:"center", marginBottom:20 }}>
 <div style={{ fontSize:56 }}>{isCombat ? "COMBAT" : "CLEAR"}</div>
 <div style={{ fontSize:22, color:C.success, fontWeight:"bold", letterSpacing:"0.1em", marginTop:10 }}>
 {isCombat ? "ENEMY DESTROYED" : "SECTOR CLEARED"}
 </div>
 </div>

 <div style={{ ...crd, marginBottom:16 }}>
 {lastResult.scrap > 0 && (
 <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
 <span style={{ color:C.textDim }}>Scrap earned</span>
 <span style={{ color:C.accent3, fontWeight:"bold" }}>+SCRAP {lastResult.scrap}</span>
 </div>
 )}
 <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
 <span style={{ color:C.textDim }}>Chrono Fragments</span>
 <span style={{ color:C.intel, fontWeight:"bold" }}>+{chronoGain}</span>
 </div>
 <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
 <span style={{ color:C.textDim }}>Entropy</span>
 <span style={{ color:C.warn, fontWeight:"bold" }}>{entropyLevel.toFixed(2)}</span>
 </div>
 <div style={{ padding:"10px 0 4px" }}>
 <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>HULL AFTER - {hullAfter} / {ship.maxHull}</div>
 <Bar pct={hullPct} color={hullPct>50?C.success:hullPct>25?C.warn:C.danger} h={8} />
 </div>
 </div>

 <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
 {isCombat && lastResult.combatFrames && (
 <button style={{ ...btn(), padding:"10px 20px" }}
 onClick={() => setShowPlayback({ frames:lastResult.combatFrames, enemy:lastResult.enemy, biome:sector.biome })}>
 Watch Replay
 </button>
 )}
 <button style={{ ...btn("p"), padding:"13px 36px", fontSize:14, fontWeight:"bold" }} onClick={onAdvance}>
 {isLastSector ? "COMPLETE RUN" : `SECTOR ${sectorIdx + 2}`}
 </button>
 </div>
 </div>
 </div>
 );
 }

 const isCombat = sector.eventType === "combat";
 const ch = CHASSIS.find(c => c.id === build.chassis);
 const ship = deriveShipStats(ch, build.modules.filter(Boolean), runMetaMods);
 const hullPct = Math.round(shipState.hull / ship.maxHull * 100);

 return (
 <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:isMobile ? 12 : 24 }}>
 <div style={{ maxWidth:600, width:"100%" }}>
 <div style={{ display:"flex", gap:4, marginBottom:24, justifyContent:"center" }}>
 {runUniverse.sectors.map((_,i) => (
 <div key={i} style={{ width:20, height:7, borderRadius:2, background: i < sectorIdx ? C.success : i === sectorIdx ? C.accent : C.border }} />
 ))}
 </div>

 <div style={{ textAlign:"center", marginBottom:20 }}>
 <div style={{ fontSize:13, color:C.textDim, letterSpacing:"0.14em", marginBottom:8 }}>
 SECTOR {sectorIdx+1} OF {runUniverse.sectors.length}
 </div>
 <div style={{ fontSize:44 }}>{sector.biome.icon}</div>
 <div style={{ fontSize:22, color:C.textBright, fontWeight:"bold", marginTop:8 }}>{sector.biome.name}</div>
 <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>{sector.biome.desc}</div>
 <div style={{ marginTop:8, fontSize:12, color:C.intel }}>
 Entropy {entropyLevel.toFixed(2)} | Rewinds {rewindCount} | Chrono {activeMeta.chronoFragments || 0}
 </div>
 {runMetaMods.revealNextBiome && runUniverse.sectors[sectorIdx + 1] && (
 <div style={{ marginTop:6, fontSize:11, color:C.accent }}>
 Next biome: {runUniverse.sectors[sectorIdx + 1].biome?.icon} {runUniverse.sectors[sectorIdx + 1].biome?.name}
 </div>
 )}
 {runMetaMods.entropyForecasting && (
 <div style={{ marginTop:4, fontSize:11, color:C.warn }}>
 Next entropy forecast: {(entropyLevel + 1 + (mutationState.entropyRateBoost || 0) + (runUniverse.ironman ? 0.5 : 0)).toFixed(2)}
 </div>
 )}
 </div>

 {isCombat && sector.enemy && (
 <div style={{ ...crd, borderLeft:`4px solid ${sigilColor(sector.intel?.sigils?.[0]||"mixed")}`, marginBottom:16 }}>
 <div style={{ fontSize:11, color:C.accent2, fontWeight:"bold", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Combat Encounter</div>
 <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
 <div style={{ flex:1 }}>
 <div style={{ fontSize:20, color:C.textBright, fontWeight:"bold", marginBottom:4 }}>{sector.enemy.name}</div>
 <div style={{ fontSize:12, color:C.textDim, marginBottom:10 }}>{sector.enemy.desc}</div>
 <div style={{ display:"flex", gap:14, flexWrap:"wrap", fontSize:12, marginBottom:10 }}>
 <span style={{ color:C.success }}>Hull {sector.enemy.hull}</span>
 {sector.enemy.maxShield>0 && <span style={{ color:C.accent }}>Shield {sector.enemy.maxShield}</span>}
 {sector.enemy.armor>0 && <span style={{ color:C.warn }}>Armor {sector.enemy.armor}</span>}
 <span style={{ color:C.textDim }}>Eva {sector.enemy.evasion}%</span>
 </div>
 </div>
 </div>
 </div>
 )}

 <div style={{ ...crd, marginBottom:20 }}>
 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
 <div style={{ fontSize:11, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:"bold" }}>Your Ship</div>
 <div style={{ fontSize:11, color:ch.color, fontWeight:"bold" }}>{ch.icon} {ch.name}</div>
 </div>
 <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>HULL {shipState.hull} / {ship.maxHull}</div>
 <Bar pct={hullPct} color={hullPct>50?C.success:hullPct>25?C.warn:C.danger} h={8} />
 {ship.maxShield > 0 && <>
 <div style={{ fontSize:11, color:C.textDim, margin:"8px 0 4px" }}>SHIELDS {shipState.shield} / {ship.maxShield}</div>
 <Bar pct={Math.round(shipState.shield/ship.maxShield*100)} color={C.accent} h={6} />
 </>}
 </div>

 <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
 <button style={{ ...btn(), padding:"10px 20px" }} onClick={() => setPhase("editing")}>Adjust Loadout</button>
 <button style={{ ...btn("p"), padding:"13px 40px", fontSize:14, fontWeight:"bold" }} onClick={onEngage}>
 {isCombat ? "ENGAGE" : "PROCEED"}
 </button>
 </div>
 </div>
 </div>
 );
}

// End-of-run summary
function RunSummary({ completedSectors, totalScrap, universe, build, onReplay, showPlayback, onClosePlayback, chronoEarnedRun=0, entropyLevel=0, rewindCount=0 }) {
 const isMobile = useIsMobile();
 const totalAttempts = completedSectors.reduce((s, sec) => s + (sec.attempts||0), 0);
 const kills = completedSectors.filter(s => s.killed).length;
 const hardestSector = completedSectors.reduce((best, s) => (s.attempts||0) > (best?.attempts||0) ? s : best, null);

 return (
 <div style={{ padding:isMobile ? "14px 12px" : "24px 22px", maxWidth:900, margin:"0 auto" }}>
 {showPlayback && <CombatPlayback frames={showPlayback.frames} playerName="Your Ship" enemyName={showPlayback.enemy?.name} biome={showPlayback.biome} onClose={onClosePlayback} />}

 <div style={{ textAlign:"center", marginBottom:28 }}>
 <div style={{ fontSize:64 }}></div>
 <div style={{ fontSize:26, color:C.success, fontWeight:"bold", letterSpacing:"0.12em", marginTop:12 }}>UNIVERSE CONQUERED</div>
 <div style={{ fontSize:14, color:universe.theme.color, marginTop:6 }}>{universe.theme.icon} {universe.theme.name} Seed #{universe.seed}</div>
 </div>

 <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,1fr)", gap:10, marginBottom:20 }}>
 {[
 ["Sectors", completedSectors.length, C.accent],
 ["Kills", kills, C.accent2],
 ["Retries", totalAttempts, totalAttempts > 3 ? C.warn : C.success],
 ["Scrap", `${totalScrap}`, C.accent3],
 ["Chrono", `+${chronoEarnedRun}`, C.intel],
 ].map(([l,v,c]) => (
 <div key={l} style={{ ...crd, textAlign:"center", marginBottom:0 }}>
 <div style={{ fontSize:28, color:c, fontWeight:"bold" }}>{v}</div>
 <div style={{ fontSize:11, color:C.textDim, marginTop:5, textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
 </div>
 ))}
 </div>

 <div style={{ ...crd, marginBottom:20 }}>
 <div style={{ fontSize:11, color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Entropy Report</div>
 <div style={{ fontSize:13, color:C.warn }}>
 Final entropy <b>{entropyLevel.toFixed(2)}</b> rewinds used <b>{rewindCount}</b>
 </div>
 </div>

 {hardestSector && hardestSector.attempts > 0 && (
 <div style={{ ...crd, borderLeft:`4px solid ${C.warn}`, marginBottom:20 }}>
 <div style={{ fontSize:11, color:C.warn, fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Toughest Fight</div>
 <div style={{ fontSize:15, color:C.textBright, fontWeight:"bold" }}>Sector {hardestSector.sector} {hardestSector.enemy?.name}</div>
 <div style={{ fontSize:12, color:C.textDim, marginTop:3 }}>Took {hardestSector.attempts + 1} attempt{hardestSector.attempts !== 1 ? "s" : ""} to crack it</div>
 </div>
 )}

 <div style={crd}>
 <div style={lbl}>Sector-by-Sector Log</div>
 {completedSectors.map((s, i) => (
 <div key={i} style={{ display:"flex", gap:10, padding:"8px 4px", borderBottom:`1px solid ${C.border}`, alignItems:isMobile ? "flex-start" : "center", flexWrap:isMobile ? "wrap" : "nowrap", fontSize:12 }}>
 <span style={{ color:C.textDim, fontWeight:"bold", minWidth:24 }}>S{s.sector}</span>
 <span style={{ fontSize:14 }}>{s.biome?.icon}</span>
 <span style={{ color:C.textDim, minWidth:88 }}>{s.biome?.name}</span>
 <span style={{ color:s.event==="combat"?C.accent2:s.event==="hazard"?C.danger:C.accent3, fontWeight:"bold", minWidth:64 }}>{s.event?.toUpperCase()}</span>
 {s.enemy && <span style={{ color:C.text }}>vs {s.enemy.name}</span>}
 {s.killed && <span style={{ color:C.success, fontWeight:"bold" }}> Kill</span>}
 {s.hazardDmg>0 && <span style={{ color:C.danger }}>{s.hazardDmg} HP</span>}
 {s.repairGain>0 && <span style={{ color:C.success }}>+{s.repairGain} HP</span>}
 {s.anomaly && <span style={{ color:C.intel }}>{s.anomaly}</span>}
 {(s.attempts||0) > 0 && <span style={{ color:C.warn, fontSize:11 }}> {s.attempts} rewind{s.attempts!==1?"s":""}</span>}
 {s.scrap>0 && <span style={{ color:C.accent3, marginLeft:"auto" }}>+{s.scrap}</span>}
 {s.combatFrames && (
 <button onClick={() => onReplay(s.combatFrames, s.enemy, s.biome)} style={{ ...btn(), padding:"4px 10px", fontSize:11, marginLeft:4 }}></button>
 )}
 </div>
 ))}
 </div>
 </div>
 );
}

// ============================================================
// APP ROOT
// ============================================================
const DEFAULT_BUILD = { chassis:"frigate", modules:[], doctrine:"skirmisher" };

export default function App() {
 const isMobile = useIsMobile();
 const [currentTab, setCurrentTab] = useState("hangar");
 const [build, setBuild] = useState(DEFAULT_BUILD);
 const [saved, setSaved] = useState([]);
 const [universe, setUniverse] = useState(null);
 const [showBriefing, setShowBriefing] = useState(false);
 const [inRun, setInRun] = useState(false);
 const [metaProgress, setMetaProgress] = useState(() => {
 try {
 const raw = localStorage.getItem(META_KEY);
 return raw ? normalizeMetaProgress({ ...createDefaultMetaProgress(), ...JSON.parse(raw) }) : createDefaultMetaProgress();
 } catch {
 return createDefaultMetaProgress();
 }
 });

 useEffect(() => {
 localStorage.setItem(META_KEY, JSON.stringify(normalizeMetaProgress(metaProgress)));
 }, [metaProgress]);

 const onBriefing = useCallback((u) => { setUniverse(u); setShowBriefing(true); setCurrentTab("run"); }, []);

 const onLaunch = useCallback(() => {
 if (!universe) return;
 setShowBriefing(false);
 setInRun(true);
 setCurrentTab("run");
 }, [universe]);

 const onSave = useCallback(b => {
 setSaved(prev => {
 if (prev.some(s => s.chassis===b.chassis && s.doctrine===b.doctrine && getBP(s.modules)===getBP(b.modules))) return prev;
 return [...prev.slice(-4), { ...b, modules:[...b.modules] }];
 });
 }, []);

 const stars = useRef(Array.from({ length:120 }, () => ({ x:Math.random()*100, y:Math.random()*100, r:Math.random()*0.12+0.03, o:Math.random()*0.5+0.07 }))).current;

 const navItems = [
 { id:"hangar", lbl:" Hangar" },
 { id:"run", lbl: inRun ? " Battle" : " Simulate" },
 { id:"meta", lbl:"Meta" },
 { id:"intel", lbl:" Intel" },
 ];

 return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"Consolas, 'Lucida Console', 'Courier New', monospace", fontSize:14, lineHeight:1.45 }}>
 <svg style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
 {stars.map((s,i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />)}
 <defs><radialGradient id="n1"><stop offset="0%" stopColor="#08103a" stopOpacity="0.6" /><stop offset="100%" stopColor="transparent" /></radialGradient></defs>
 <ellipse cx="15" cy="85" rx="45" ry="35" fill="url(#n1)" />
 <ellipse cx="88" cy="15" rx="35" ry="30" fill="url(#n1)" />
 </svg>

 <div style={{ position:"relative", zIndex:1 }}>
 <header style={{ borderBottom:`1px solid ${C.border}`, padding:isMobile ? "10px 12px" : "14px 24px", display:"flex", alignItems:isMobile ? "stretch" : "center", justifyContent:"space-between", flexDirection:isMobile ? "column" : "row", gap:isMobile ? 10 : 0, background:C.panel, position:"sticky", top:0, zIndex:10 }}>
 <div>
 <div style={{ fontSize:16, color:C.accent, letterSpacing:"0.2em", fontWeight:"bold" }}> SHIP FITNESS LEAGUE</div>
 <div style={{ fontSize:11, color:C.textDim, letterSpacing:"0.12em", marginTop:3 }}>SCOUT BUILD FIGHT REWIND ADAPT</div>
 </div>
 <nav style={{ display:"flex", gap:6, flexWrap:"wrap", width:isMobile ? "100%" : "auto", justifyContent:isMobile ? "center" : "flex-end" }}>
 {navItems.map(({ id, lbl }) => (
 <button key={id} style={{ ...tabSt(currentTab===id), ...(id==="run" && !inRun ? { padding:"10px 20px", fontSize:12, borderColor:C.accent, color:C.accent, background:currentTab===id ? `${C.accent}2b` : `${C.accent}10`, boxShadow:`0 0 0 1px ${C.accent}35 inset, 0 0 18px ${C.accent}22` } : {}) }} onClick={() => setCurrentTab(id)}>{lbl}</button>
 ))}
 </nav>
 </header>

 {currentTab==="hangar" && <Hangar build={build} onBuildChange={setBuild} savedBuilds={saved} onSave={onSave} universe={universe} />}

 {currentTab==="run" && !showBriefing && !inRun && <RunConfig build={build} onBriefing={onBriefing} metaProgress={metaProgress} />}
 {currentTab==="run" && showBriefing && universe && (
 <UniverseBriefing universe={universe} build={build} onLaunch={onLaunch} onRebuild={() => { setShowBriefing(false); setCurrentTab("hangar"); }} />
 )}
 {currentTab==="run" && inRun && universe && (
 <BattleRun
 universe={universe}
 initialBuild={build}
 onBuildChange={setBuild}
 metaProgress={metaProgress}
 onMetaProgress={setMetaProgress}
 />
 )}
 {currentTab==="meta" && <MetaUpgradeTree metaProgress={metaProgress} onMetaProgress={setMetaProgress} />}

 {currentTab==="intel" && <Intel />}
 </div>
 </div>
 );
}








