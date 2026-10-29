import { defineConfig } from 'vitest/config';

// Contended Firestore transactions retry; give the emulator suite room.
export default defineConfig({ test: { testTimeout: 30_000 } });
