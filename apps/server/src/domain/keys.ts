import { fingerprint } from '@qroove/contracts/normalise';

export { fingerprint, looseKey, norm, versionTag } from '@qroove/contracts/normalise';

/** Identity for a manually entered or imported recording (no provider id to anchor on). */
export const manualKey = fingerprint;
