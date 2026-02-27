const MUTATION_TYPES = [
  "enemy_aggression",
  "sector_hazard",
  "elite_spawn",
  "faction_hostility",
  "entropy_growth",
];

function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function toInt(n) {
  return Math.max(0, Math.floor(n || 0));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createMutationState() {
  return {
    mutationCount: 0,
    enemyAggression: 0,
    eliteSpawnChance: 0,
    factionHostility: 0,
    entropyRateBoost: 0,
    sectorHazardBoosts: {},
    history: [],
  };
}

export function previewNextMutation(mutationState, universeSeed, rewindCount, sectorCount, opts = {}) {
  const st = mutationState || createMutationState();
  const nextCount = toInt(st.mutationCount) + 1;
  const type = opts.forcedType || pickMutationType(universeSeed, nextCount, rewindCount);
  const sectorNumber = pickMutationSector(universeSeed, nextCount, sectorCount);
  return describeMutation(type, sectorNumber);
}

export function previewMutationChoices(mutationState, universeSeed, rewindCount, sectorCount, count = 3) {
  const st = mutationState || createMutationState();
  const nextCount = toInt(st.mutationCount) + 1;
  const rollRng = lcg((universeSeed >>> 0) + nextCount * 4111 + toInt(rewindCount) * 233);
  const pool = [...MUTATION_TYPES];
  const picks = [];

  while (pool.length && picks.length < Math.max(1, count || 1)) {
    const idx = Math.floor(rollRng() * pool.length);
    const type = pool.splice(clamp(idx, 0, pool.length - 1), 1)[0];
    const sectorNumber = pickMutationSector(universeSeed + picks.length * 97, nextCount, sectorCount);
    picks.push(describeMutation(type, sectorNumber));
  }

  return picks;
}

function pickMutationType(universeSeed, nextCount, rewindCount) {
  const roll = lcg((universeSeed >>> 0) + nextCount * 977 + toInt(rewindCount) * 131)();
  const idx = Math.min(MUTATION_TYPES.length - 1, Math.floor(roll * MUTATION_TYPES.length));
  return MUTATION_TYPES[idx];
}

function pickMutationSector(universeSeed, nextCount, sectorCount) {
  const sectorRng = lcg((universeSeed >>> 0) + nextCount * 1231 + 17);
  const maxSector = Math.max(1, toInt(sectorCount));
  return Math.max(1, Math.min(maxSector, Math.floor(sectorRng() * maxSector) + 1));
}

function describeMutation(type, sectorNumber) {
  if (type === "enemy_aggression") return { type, label: "Enemy aggression increases", detail: "+enemy stat scaling on future encounters" };
  if (type === "sector_hazard") return { type, label: `Sector ${sectorNumber} hazard intensifies`, detail: "+hazard severity in a random sector" };
  if (type === "elite_spawn") return { type, label: "Elite spawn chance increases", detail: "+more dangerous enemy rolls" };
  if (type === "faction_hostility") return { type, label: "Faction hostility rises", detail: "+enemy pressure and combat lethality" };
  return { type: "entropy_growth", label: "Entropy growth accelerates", detail: "+faster entropy escalation each sector" };
}

export function applyRewindMutation(mutationState, universeSeed, rewindCount, sectorCount, opts = {}) {
  const current = mutationState || createMutationState();
  const severity = clamp(opts.severityMultiplier ?? 1, 0.5, 1.5);
  const next = {
    ...current,
    sectorHazardBoosts: { ...(current.sectorHazardBoosts || {}) },
    history: [...(current.history || [])],
  };
  const preview = previewNextMutation(current, universeSeed, rewindCount, sectorCount, { forcedType: opts.forcedType });
  next.mutationCount = toInt(next.mutationCount) + 1;

  if (preview.type === "enemy_aggression") next.enemyAggression += 0.08 * severity;
  else if (preview.type === "sector_hazard") {
    const sectorIdx = Math.max(0, (preview.label.match(/Sector (\d+)/)?.[1] || 1) - 1);
    next.sectorHazardBoosts[sectorIdx] = (next.sectorHazardBoosts[sectorIdx] || 0) + (0.2 * severity);
  } else if (preview.type === "elite_spawn") next.eliteSpawnChance += 0.08 * severity;
  else if (preview.type === "faction_hostility") next.factionHostility += 0.07 * severity;
  else next.entropyRateBoost += 0.05 * severity;

  next.history.push({
    count: next.mutationCount,
    type: preview.type,
    label: preview.label,
    detail: preview.detail,
    atRewind: toInt(rewindCount) + 1,
  });
  return { mutationState: next, mutationApplied: preview };
}

export function getEntropyMultiplier(entropyLevel, rewindCount, opts = {}) {
  const entropyScaleReduction = clamp(opts.entropyScaleReduction || 0, 0, 0.2);
  return 1 + (entropyLevel * 0.08 * (1 - entropyScaleReduction)) + (rewindCount * 0.05);
}

export function getSectorMutationModifiers(mutationState, sectorIdx) {
  const st = mutationState || createMutationState();
  const hazardBoost = st.sectorHazardBoosts?.[sectorIdx] || 0;
  return {
    aggressionMult: 1 + st.enemyAggression + st.factionHostility * 0.35 + st.eliteSpawnChance * 0.2,
    enemyDamageMult: 1 + st.enemyAggression * 0.7 + st.factionHostility * 0.6,
    hazardBoost,
    heatBoost: st.factionHostility * 0.12 + st.entropyRateBoost * 0.08,
    eliteChanceBonus: st.eliteSpawnChance,
  };
}

export function applyMutationsToUniverse(baseUniverse, mutationState) {
  if (!baseUniverse) return baseUniverse;
  const st = mutationState || createMutationState();
  const sectors = (baseUniverse.sectors || []).map((s, idx) => {
    const mods = getSectorMutationModifiers(st, idx);
    const biome = {
      ...s.biome,
      effects: { ...(s.biome?.effects || {}) },
    };
    if (mods.hazardBoost > 0) {
      biome.effects.collisionRisk = (biome.effects.collisionRisk || 0) + Math.round(mods.hazardBoost * 20);
      biome.effects.heatSpike = (biome.effects.heatSpike || 0) + Math.round(mods.hazardBoost * 10);
    }

    let enemy = s.enemy;
    if (enemy) {
      const hpMult = mods.aggressionMult;
      const dmgMult = mods.enemyDamageMult;
      enemy = {
        ...enemy,
        hull: Math.round(enemy.hull * hpMult),
        maxHull: Math.round(enemy.maxHull * hpMult),
        shield: Math.round(enemy.shield * hpMult),
        maxShield: Math.round(enemy.maxShield * hpMult),
        armor: Math.round(enemy.armor * (1 + st.enemyAggression * 0.4)),
        weapons: (enemy.weapons || []).map((w) => ({
          ...w,
          damage: Math.max(1, Math.round(w.damage * dmgMult)),
          accuracy: Math.min(95, Math.round((w.accuracy || 70) + st.factionHostility * 10)),
        })),
      };
    }
    return { ...s, biome, enemy };
  });
  return { ...baseUniverse, sectors };
}
