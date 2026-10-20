/**
 * Procedural Web Audio API synthesizer for tactile game feel.
 * Zero external audio files required — works 100% offline on Android WebView / PWA.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private readonly STORAGE_KEY = 'raheem_ludo_sound_muted';

  constructor() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null) {
        this.muted = JSON.parse(saved);
      }
    } catch {
      this.muted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.muted));
    } catch {
      // ignore storage errors
    }
    return this.muted;
  }

  public playDiceRoll(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Play a quick series of woody clicks simulating a tumbling die
    [0, 0.055, 0.11, 0.17].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 + i * 65, now + offset);
      osc.frequency.exponentialRampToValueAtTime(110, now + offset + 0.04);

      gain.gain.setValueAtTime(0.14, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.045);
    });
  }

  public playDiceSix(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.16, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.16);
    });
  }

  public playTokenHop(stepIndex = 0): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 340 + (stepIndex % 6) * 35;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.065);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playTokenSpawn(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 587.33, 880]; // A4, D5, A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.16, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.14);
    });
  }

  public playCapture(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Punchy synth impact + upward triumphant sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.32);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playSafeSquare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.setValueAtTime(987.77, now + 0.07);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playHomeGoal(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.18, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.28);
    });
  }

  public playVictoryFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0, d: 0.14 },
      { f: 659.25, t: 0.14, d: 0.14 },
      { f: 783.99, t: 0.28, d: 0.14 },
      { f: 1046.5, t: 0.42, d: 0.42 },
    ];
    melody.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.t);
      gain.gain.setValueAtTime(0.2, now + note.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.t);
      osc.stop(now + note.t + note.d);
    });
  }
}

export const soundFX = new SoundService();
