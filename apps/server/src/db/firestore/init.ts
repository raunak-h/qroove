import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Env } from '../../env.js';

/** The only place credentials are read. Emulator wins when `FIRESTORE_EMULATOR_HOST` is set. */
export function initFirestore(
  env: Pick<Env, 'FIREBASE_PROJECT_ID' | 'FIREBASE_SERVICE_ACCOUNT_B64'>,
): Firestore {
  const existing = getApps().find((a) => a.name === 'qroove');
  if (existing) return getFirestore(existing);
  const projectId = env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? 'qroove-test';
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const app = initializeApp(
    env.FIREBASE_SERVICE_ACCOUNT_B64 && !emulator
      ? {
          projectId,
          credential: cert(
            JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')),
          ),
        }
      : { projectId },
    'qroove',
  );
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}
