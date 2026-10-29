import type { Env } from '../env.js';
import type { Repository } from './ports.js';
import { MemoryRepository } from './memory/index.js';

export type { Repository, EventTx } from './ports.js';
export * from './types.js';

export async function createRepository(env: Env): Promise<Repository> {
  if (env.REPO_DRIVER === 'memory') return new MemoryRepository();
  // Loaded lazily so memory-only runs never pull in firebase-admin.
  const [{ initFirestore }, { FirestoreRepository }] = await Promise.all([
    import('./firestore/init.js'),
    import('./firestore/index.js'),
  ]);
  return new FirestoreRepository(initFirestore(env));
}
