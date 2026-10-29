import type { LocalTrack } from './library';
import { trackFromFile } from './library';

/** Best-effort device storage (SPEC §5): the browser may evict it, so the organiser can always re-pick. */
const DB = 'qroove-player';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveTracks(tracks: LocalTrack[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  for (const t of tracks) tx.objectStore(STORE).put({ id: t.id, file: t.file });
  await done(tx);
  db.close();
}

export async function loadTracks(): Promise<LocalTrack[]> {
  const db = await open();
  const rows = await new Promise<Array<{ id: string; file: File }>>((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => resolve(r.result as Array<{ id: string; file: File }>);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return rows.map((r) => trackFromFile(r.file));
}

export async function clearTracks(): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
  db.close();
}
