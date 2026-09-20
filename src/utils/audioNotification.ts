/**
 * Audio Notification Service for Namana Physiotherapy Clinic
 * Uses Web Audio API for instant, offline-capable musical chimes and ping notifications.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch (e) {
    console.warn('Web Audio API unavailable:', e);
    return null;
  }
}

/**
 * Plays a cheerful, crystal-clear musical ping chime when a new patient is successfully added.
 * Features a 3-tier harmonic bell arpeggio (C6 1046.5Hz -> E6 1318.5Hz -> G6 1567.98Hz with sparkle decay).
 */
export function playAddPatientPing(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master volume limiter to keep audio pleasant, gentle, and distortion-free
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.28, now);
    masterGain.connect(ctx.destination);

    // Chime notes: C6 (1046.5 Hz), E6 (1318.5 Hz), G6 (1567.98 Hz)
    const tones = [
      { freq: 1046.5, startOffset: 0.0, duration: 0.65, peakGain: 0.55, type: 'sine' as OscillatorType },
      { freq: 1318.5, startOffset: 0.07, duration: 0.75, peakGain: 0.65, type: 'sine' as OscillatorType },
      { freq: 1567.98, startOffset: 0.14, duration: 0.85, peakGain: 0.75, type: 'sine' as OscillatorType },
      // High shimmer octave for a crisp, high-definition bell ping
      { freq: 2093.0, startOffset: 0.18, duration: 0.60, peakGain: 0.30, type: 'triangle' as OscillatorType },
    ];

    tones.forEach(({ freq, startOffset, duration, peakGain, type }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      // Subtle pitch resonance ramp for natural bell acoustic warmth
      osc.frequency.exponentialRampToValueAtTime(freq * 0.992, now + startOffset + duration);

      // Fast, click-free attack (12ms) followed by an exponential decay
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.setValueAtTime(0.0001, now + startOffset);
      noteGain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    });
  } catch (err) {
    console.warn('Unable to play add-patient ping audio:', err);
  }
}

/**
 * Soft ascending two-tone beep when voice microphone starts listening.
 */
export function playVoiceListeningStart(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.15, now);
    master.connect(ctx.destination);

    [
      { freq: 523.25, time: 0, dur: 0.08 }, // C5
      { freq: 659.25, time: 0.09, dur: 0.12 }, // E5
    ].forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);
      g.gain.setValueAtTime(0.001, now + time);
      g.gain.exponentialRampToValueAtTime(0.3, now + time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (e) {}
}

/**
 * Gentle affirmative triple-tone chime when Voice AI successfully recognizes and auto-fills fields.
 */
export function playVoiceFillSuccess(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.2, now);
    master.connect(ctx.destination);

    [
      { freq: 659.25, time: 0.0, dur: 0.25 }, // E5
      { freq: 783.99, time: 0.08, dur: 0.25 }, // G5
      { freq: 1046.5, time: 0.16, dur: 0.45 }, // C6
    ].forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);
      g.gain.setValueAtTime(0.001, now + time);
      g.gain.exponentialRampToValueAtTime(0.4, now + time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (e) {}
}

