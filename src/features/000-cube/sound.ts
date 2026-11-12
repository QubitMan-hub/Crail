/** Synthesised landing thud. No audio files: nothing to license, nothing to load. */
export class Thud {
  private ac: AudioContext | null = null;
  enabled = true;

  /** Call from a user gesture; browsers refuse audio before one. */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (AC) this.ac = new AC();
  }

  play(): void {
    const ac = this.ac;
    if (!ac || !this.enabled || ac.state !== 'running') return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const f = 105 + Math.random() * 25;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.09);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }
}
