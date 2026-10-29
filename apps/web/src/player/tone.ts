/** Plays a short two-note chime through WebAudio so the room can be checked before the first song. */
export async function playTone(): Promise<void> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('No audio support');
  const ctx = new Ctx();
  await ctx.resume();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime;
  [440, 660].forEach((hz, i) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    o.connect(gain);
    o.start(t0 + i * 0.6);
    o.stop(t0 + i * 0.6 + 0.5);
  });
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05);
  gain.gain.setValueAtTime(0.25, t0 + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.25);
  await new Promise((r) => setTimeout(r, 1400));
  await ctx.close();
}
