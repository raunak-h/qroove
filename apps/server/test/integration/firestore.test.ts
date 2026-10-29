import { afterAll } from 'vitest';
import type { Repository } from '../../src/db/ports.js';
import { runCommandSuite } from '../commands.suite.js';
import { runRepoContract } from '../repo.contract.js';

// Runs only against the Firestore emulator:
//   firebase emulators:exec --only firestore "pnpm --filter @qroove/server test:integration"
const skip = !process.env.FIRESTORE_EMULATOR_HOST;
const repos: Repository[] = [];
const make = async () => {
  const { createRepository } = await import('../../src/db/index.js');
  const repo = await createRepository({
    NODE_ENV: 'test',
    PORT: 0,
    PUBLIC_BASE_URL: '',
    REPO_DRIVER: 'firestore',
    FIREBASE_PROJECT_ID: 'qroove-test',
  });
  repos.push(repo);
  return repo;
};
afterAll(async () => {
  await Promise.all(repos.map((r) => r.close().catch(() => undefined)));
});

runRepoContract('firestore emulator', make, skip);
runCommandSuite('firestore emulator', make, skip);
