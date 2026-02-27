function clone(data) {
  return data == null ? data : JSON.parse(JSON.stringify(data));
}

export function createSectorCheckpoint({
  sectorNumber,
  shipState,
  resources,
  perks,
  entropyLevel,
  rngState,
  buildState,
}) {
  return {
    sectorNumber,
    shipState: clone(shipState),
    resources: clone(resources),
    perks: clone(perks),
    entropyLevel,
    rngState: clone(rngState),
    buildState: clone(buildState),
  };
}

export function restoreSectorCheckpoint(checkpoint) {
  if (!checkpoint) return null;
  return {
    sectorNumber: checkpoint.sectorNumber,
    shipState: clone(checkpoint.shipState),
    resources: clone(checkpoint.resources),
    perks: clone(checkpoint.perks),
    entropyLevel: checkpoint.entropyLevel,
    rngState: clone(checkpoint.rngState),
    buildState: clone(checkpoint.buildState),
  };
}
