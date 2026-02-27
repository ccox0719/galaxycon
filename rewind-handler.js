import { calculateRewindCost, getMetaModifiers, getRewindAnchorSectors, normalizeMetaState } from "./meta-upgrade-system.js";

export function getRewindCost(sectorNumber, rewindCount, opts = {}) {
  return calculateRewindCost(sectorNumber, rewindCount, normalizeMetaState(opts.metaState), {
    rewindsUsedThisRun: opts.rewindsUsedThisRun ?? rewindCount,
  });
}

export function getRewindOptions({ maxReachedSector, sectors, rewindCount, ironman, metaState }) {
  if (ironman) return [];
  const st = normalizeMetaState(metaState);
  const mods = getMetaModifiers(st);
  const maxSector = Math.max(1, maxReachedSector || 1);
  const wanted = getRewindAnchorSectors(maxSector, mods.extraRewindSectors);
  const lastBossSector = findLastBossSector(sectors, maxSector);
  const unique = new Set(wanted);
  if (lastBossSector && lastBossSector <= maxSector) unique.add(lastBossSector);

  return [...unique]
    .sort((a, b) => a - b)
    .map((sectorNumber) => ({
      sectorNumber,
      label: sectorNumber === lastBossSector ? `Rewind to Last Boss (S${sectorNumber})` : `Rewind to Sector ${sectorNumber}`,
      cost: getRewindCost(sectorNumber, rewindCount, { metaState: st, rewindsUsedThisRun: rewindCount }),
    }));
}

function findLastBossSector(sectors, maxSector) {
  if (!sectors?.length) return null;
  for (let i = Math.min(maxSector - 1, sectors.length - 1); i >= 0; i--) {
    const s = sectors[i];
    if (!s || s.eventType !== "combat" || !s.enemy) continue;
    const isBoss = s.danger >= 5 || /fortress|boss|cruiser/i.test(s.enemy.id || s.enemy.name || "");
    if (isBoss) return i + 1;
  }
  return null;
}

export function canAffordRewind(balance, cost) {
  return (balance || 0) >= cost;
}
