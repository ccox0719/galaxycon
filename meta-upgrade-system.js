export const META_BRANCHES = ["stability", "manipulation", "adaptation"];

export const PARADOX_CORE_ID = "paradox_core";

const UPGRADE_DEFS = [
  {
    id: "structural_memory",
    branch: "stability",
    tier: 1,
    name: "Structural Memory",
    description: "+5% base hull.",
    cost: 45,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, baseHullMultiplier: mods.baseHullMultiplier + 0.05 }),
  },
  {
    id: "efficient_cooling_matrix",
    branch: "stability",
    tier: 1,
    name: "Efficient Cooling Matrix",
    description: "+5% heat dissipation.",
    cost: 45,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, coolingMultiplier: mods.coolingMultiplier + 0.05 }),
  },
  {
    id: "entropic_resistance",
    branch: "stability",
    tier: 2,
    name: "Entropic Resistance",
    description: "Reduces entropy scaling effect by 5%.",
    cost: 90,
    prerequisites: ["structural_memory"],
    applyEffect: (mods) => ({ ...mods, entropyScaleReduction: mods.entropyScaleReduction + 0.05 }),
  },
  {
    id: "shield_echo",
    branch: "stability",
    tier: 2,
    name: "Shield Echo",
    description: "+10% max shield regenerated between sectors.",
    cost: 90,
    prerequisites: ["efficient_cooling_matrix"],
    applyEffect: (mods) => ({ ...mods, shieldEchoBetweenSectors: mods.shieldEchoBetweenSectors + 0.1 }),
  },
  {
    id: "reactor_reinforcement",
    branch: "stability",
    tier: 3,
    name: "Reactor Reinforcement",
    description: "+1 permanent reactor output.",
    cost: 140,
    prerequisites: ["entropic_resistance"],
    applyEffect: (mods) => ({ ...mods, reactorOutputBonus: mods.reactorOutputBonus + 1 }),
  },
  {
    id: "fail_safe_systems",
    branch: "stability",
    tier: 3,
    name: "Fail-Safe Systems",
    description: "Once per run survive lethal damage at 1 HP.",
    cost: 150,
    prerequisites: ["shield_echo"],
    applyEffect: (mods) => ({ ...mods, hasFailSafeSystems: true }),
  },
  {
    id: "temporal_hull_integrity",
    branch: "stability",
    tier: 4,
    name: "Temporal Hull Integrity",
    description: "Every 5 entropy grants +2% max hull.",
    cost: 220,
    prerequisites: ["reactor_reinforcement", "fail_safe_systems"],
    applyEffect: (mods) => ({ ...mods, temporalHullPerFiveEntropy: mods.temporalHullPerFiveEntropy + 0.02 }),
  },
  {
    id: "fragment_efficiency",
    branch: "manipulation",
    tier: 1,
    name: "Fragment Efficiency",
    description: "-10% rewind cost.",
    cost: 45,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, rewindCostMultiplier: mods.rewindCostMultiplier * 0.9 }),
  },
  {
    id: "stable_recall",
    branch: "manipulation",
    tier: 1,
    name: "Stable Recall",
    description: "Retain 1 random perk when rewinding.",
    cost: 50,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, retainedPerksOnRewind: Math.max(mods.retainedPerksOnRewind, 1) }),
  },
  {
    id: "controlled_collapse",
    branch: "manipulation",
    tier: 2,
    name: "Controlled Collapse",
    description: "-10% mutation severity.",
    cost: 90,
    prerequisites: ["fragment_efficiency"],
    applyEffect: (mods) => ({ ...mods, mutationSeverityMultiplier: mods.mutationSeverityMultiplier * 0.9 }),
  },
  {
    id: "checkpoint_optimization",
    branch: "manipulation",
    tier: 2,
    name: "Checkpoint Optimization",
    description: "Unlocks one additional rewind sector.",
    cost: 100,
    prerequisites: ["stable_recall"],
    applyEffect: (mods) => ({ ...mods, extraRewindSectors: mods.extraRewindSectors + 1 }),
  },
  {
    id: "temporal_leverage",
    branch: "manipulation",
    tier: 3,
    name: "Temporal Leverage",
    description: "+10% damage for 1 sector after rewind.",
    cost: 150,
    prerequisites: ["controlled_collapse"],
    applyEffect: (mods) => ({ ...mods, postRewindDamageBonus: mods.postRewindDamageBonus + 0.1 }),
  },
  {
    id: "echo_banking",
    branch: "manipulation",
    tier: 3,
    name: "Echo Banking",
    description: "Carry 20% scrap forward on rewind.",
    cost: 160,
    prerequisites: ["checkpoint_optimization"],
    applyEffect: (mods) => ({ ...mods, rewindScrapCarryPct: mods.rewindScrapCarryPct + 0.2 }),
  },
  {
    id: "rewind_mastery",
    branch: "manipulation",
    tier: 4,
    name: "Rewind Mastery",
    description: "First rewind per run costs 0.",
    cost: 240,
    prerequisites: ["temporal_leverage", "echo_banking"],
    applyEffect: (mods) => ({ ...mods, firstRewindFree: true }),
  },
  {
    id: "pattern_recognition",
    branch: "adaptation",
    tier: 1,
    name: "Pattern Recognition",
    description: "Reveal next biome.",
    cost: 45,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, revealNextBiome: true }),
  },
  {
    id: "faction_insight",
    branch: "adaptation",
    tier: 1,
    name: "Faction Insight",
    description: "Reduce hostile escalation chance.",
    cost: 50,
    prerequisites: [],
    applyEffect: (mods) => ({ ...mods, hostileEscalationReduction: mods.hostileEscalationReduction + 0.05 }),
  },
  {
    id: "adaptive_targeting",
    branch: "adaptation",
    tier: 2,
    name: "Adaptive Targeting",
    description: "+5% damage vs enemy types that killed you in prior runs.",
    cost: 95,
    prerequisites: ["pattern_recognition"],
    applyEffect: (mods) => ({ ...mods, adaptiveTargetingBonus: mods.adaptiveTargetingBonus + 0.05 }),
  },
  {
    id: "entropy_forecasting",
    branch: "adaptation",
    tier: 2,
    name: "Entropy Forecasting",
    description: "Display entropy growth preview.",
    cost: 95,
    prerequisites: ["faction_insight"],
    applyEffect: (mods) => ({ ...mods, entropyForecasting: true }),
  },
  {
    id: "mutation_steering",
    branch: "adaptation",
    tier: 3,
    name: "Mutation Steering",
    description: "Choose 1 of 3 mutation outcomes on rewind.",
    cost: 155,
    prerequisites: ["adaptive_targeting"],
    applyEffect: (mods) => ({ ...mods, mutationSteeringChoices: Math.max(mods.mutationSteeringChoices, 3) }),
  },
  {
    id: "salvage_memory",
    branch: "adaptation",
    tier: 3,
    name: "Salvage Memory",
    description: "Elites grant bonus Chrono Fragments.",
    cost: 150,
    prerequisites: ["entropy_forecasting"],
    applyEffect: (mods) => ({ ...mods, eliteChronoBonus: mods.eliteChronoBonus + 8 }),
  },
  {
    id: "timeline_shaping",
    branch: "adaptation",
    tier: 4,
    name: "Timeline Shaping",
    description: "Boss defeat reduces entropy growth for next 2 sectors.",
    cost: 235,
    prerequisites: ["mutation_steering", "salvage_memory"],
    applyEffect: (mods) => ({ ...mods, timelineEntropyReduction: mods.timelineEntropyReduction + 0.5 }),
  },
  {
    id: PARADOX_CORE_ID,
    branch: "adaptation",
    tier: 5,
    name: "Paradox Core",
    description: "Rewind without restoring entropy. Entropy continues stacking.",
    cost: 320,
    prerequisites: ["timeline_shaping"],
    applyEffect: (mods) => ({ ...mods, paradoxCoreUnlocked: true }),
  },
];

const UPGRADE_MAP = Object.fromEntries(UPGRADE_DEFS.map((u) => [u.id, u]));

export function createDefaultMetaState() {
  return {
    unlockedUpgrades: [],
    lifetimeBossKills: 0,
    lifetimeSectorsCleared: 0,
  };
}

export function normalizeMetaState(metaState) {
  const base = createDefaultMetaState();
  const merged = { ...base, ...(metaState || {}) };
  merged.unlockedUpgrades = Array.from(new Set(merged.unlockedUpgrades || []));
  return merged;
}

export function getMetaUpgradeCatalog() {
  return UPGRADE_DEFS.slice();
}

export function getMetaUpgrade(id) {
  return UPGRADE_MAP[id] || null;
}

export function isUpgradeUnlocked(metaState, upgradeId) {
  const st = normalizeMetaState(metaState);
  return st.unlockedUpgrades.includes(upgradeId);
}

function meetsPrerequisites(metaState, upgrade) {
  if (!upgrade) return false;
  return (upgrade.prerequisites || []).every((id) => isUpgradeUnlocked(metaState, id));
}

function meetsSpecialUnlock(metaState, upgradeId) {
  if (upgradeId !== PARADOX_CORE_ID) return true;
  return (normalizeMetaState(metaState).lifetimeBossKills || 0) >= 3;
}

export function canUnlockMetaUpgrade(metaState, chronoFragments, upgradeId) {
  const upgrade = getMetaUpgrade(upgradeId);
  if (!upgrade) return { ok: false, reason: "unknown_upgrade", upgrade: null };
  if (isUpgradeUnlocked(metaState, upgradeId)) return { ok: false, reason: "already_unlocked", upgrade };
  if (!meetsPrerequisites(metaState, upgrade)) return { ok: false, reason: "missing_prerequisite", upgrade };
  if (!meetsSpecialUnlock(metaState, upgradeId)) return { ok: false, reason: "special_locked", upgrade };
  if ((chronoFragments || 0) < upgrade.cost) return { ok: false, reason: "insufficient_fragments", upgrade };
  return { ok: true, reason: null, upgrade };
}

export function unlockMetaUpgrade(metaProgress, upgradeId) {
  const chrono = metaProgress?.chronoFragments || 0;
  const st = normalizeMetaState(metaProgress?.metaState);
  const gate = canUnlockMetaUpgrade(st, chrono, upgradeId);
  if (!gate.ok) return { ok: false, reason: gate.reason, metaProgress };

  return {
    ok: true,
    metaProgress: {
      ...(metaProgress || {}),
      chronoFragments: Math.max(0, chrono - gate.upgrade.cost),
      metaState: {
        ...st,
        unlockedUpgrades: [...st.unlockedUpgrades, upgradeId],
      },
    },
  };
}

export function getMetaModifiers(metaState, runtime = {}) {
  const st = normalizeMetaState(metaState);
  let mods = {
    baseHullMultiplier: 1,
    coolingMultiplier: 1,
    entropyScaleReduction: 0,
    shieldEchoBetweenSectors: 0,
    reactorOutputBonus: 0,
    hasFailSafeSystems: false,
    temporalHullPerFiveEntropy: 0,
    rewindCostMultiplier: 1,
    retainedPerksOnRewind: 0,
    mutationSeverityMultiplier: 1,
    extraRewindSectors: 0,
    postRewindDamageBonus: 0,
    rewindScrapCarryPct: 0,
    firstRewindFree: false,
    revealNextBiome: false,
    hostileEscalationReduction: 0,
    adaptiveTargetingBonus: 0,
    entropyForecasting: false,
    mutationSteeringChoices: 0,
    eliteChronoBonus: 0,
    timelineEntropyReduction: 0,
    paradoxCoreUnlocked: false,
    adaptiveTargetingActive: false,
    adaptiveTargetingDamageBonus: 0,
    temporalHullEntropyBonus: 0,
  };

  for (const id of st.unlockedUpgrades) {
    const upgrade = getMetaUpgrade(id);
    if (upgrade?.applyEffect) mods = upgrade.applyEffect(mods);
  }

  if (mods.temporalHullPerFiveEntropy > 0) {
    const entropyLevel = Math.max(0, runtime.entropyLevel || 0);
    const stacks = Math.floor(entropyLevel / 5);
    mods.temporalHullEntropyBonus = stacks * mods.temporalHullPerFiveEntropy;
  }

  const enemyId = runtime.enemyId || "";
  const deathTracking = runtime.deathTracking || {};
  if (enemyId && deathTracking[enemyId] > 0 && mods.adaptiveTargetingBonus > 0) {
    mods.adaptiveTargetingActive = true;
    mods.adaptiveTargetingDamageBonus = mods.adaptiveTargetingBonus;
  }

  return mods;
}

export function calculateEntropyMultiplier(entropyLevel, rewindCount, metaState) {
  const mods = getMetaModifiers(metaState);
  const entropyTerm = Math.max(0, entropyLevel || 0) * 0.08 * (1 - mods.entropyScaleReduction);
  const rewindTerm = Math.max(0, rewindCount || 0) * 0.05;
  return 1 + entropyTerm + rewindTerm;
}

export function calculateRewindCost(sectorNumber, rewindCount, metaState, runState = {}) {
  const mods = getMetaModifiers(metaState);
  if (mods.firstRewindFree && (runState.rewindsUsedThisRun || 0) === 0) return 0;
  const baseCost = Math.max(1, sectorNumber || 1) * 25;
  const scaled = baseCost * (1 + Math.max(0, rewindCount || 0) * 0.4);
  return Math.max(1, Math.round(scaled * mods.rewindCostMultiplier));
}

export function getRewindAnchorSectors(maxReachedSector, extraAnchors = 0) {
  const maxSector = Math.max(1, maxReachedSector || 1);
  const anchors = new Set([1, 3, 5].filter((n) => n <= maxSector));
  if (extraAnchors > 0) {
    for (let i = 0; i < extraAnchors; i++) {
      const candidates = [];
      for (let s = 2; s <= maxSector; s++) {
        if (!anchors.has(s)) candidates.push(s);
      }
      if (!candidates.length) break;
      anchors.add(candidates[candidates.length - 1]);
    }
  }
  return [...anchors].sort((a, b) => a - b);
}

export function getMetaTreeLayout(metaState, chronoFragments) {
  const st = normalizeMetaState(metaState);
  const tiers = [1, 2, 3, 4, 5];
  const branches = META_BRANCHES.map((branch) => {
    const rows = tiers.map((tier) => {
      const upgrades = UPGRADE_DEFS.filter((u) => u.branch === branch && u.tier === tier).map((upgrade) => {
        const unlocked = st.unlockedUpgrades.includes(upgrade.id);
        const prereqMet = meetsPrerequisites(st, upgrade);
        const specialMet = meetsSpecialUnlock(st, upgrade.id);
        const affordable = (chronoFragments || 0) >= upgrade.cost;
        return {
          ...upgrade,
          unlocked,
          prereqMet,
          specialMet,
          affordable,
          disabled: unlocked || !prereqMet || !specialMet || !affordable,
        };
      });
      return { tier, upgrades };
    });
    return { branch, rows };
  });

  return { branches, tiers };
}
