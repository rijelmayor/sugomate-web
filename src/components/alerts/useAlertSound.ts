"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREF_KEY = "sugomate_sound_v1";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Shared sound + voice engine for merchant, rider and customer alerts.
 * Browsers only allow audio after a tap, so the user enables it once; the choice is
 * remembered and re-armed by the first tap on a later visit.
 */
export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(false);
  const [enabled, setEnabled] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const enable = useCallback(async () => {
    try {
      const Ctor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!Ctor) { setUnsupported(true); return; }
      const ctx = ctxRef.current ?? new Ctor();
      ctxRef.current = ctx;
      await ctx.resume();
      // Silent blip unlocks audio on iOS Safari.
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
      if ("speechSynthesis" in window) {
        const prime = new SpeechSynthesisUtterance(" ");
        prime.volume = 0;
        window.speechSynthesis.speak(prime);
      }
      enabledRef.current = true;
      setEnabled(true);
      setNeedsTap(false);
      setUnsupported(false);
      try { window.localStorage.setItem(PREF_KEY, "on"); } catch { /* ignore */ }
    } catch {
      setUnsupported(true);
    }
  }, []);

  const disable = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    setNeedsTap(false);
    try { window.localStorage.setItem(PREF_KEY, "off"); } catch { /* ignore */ }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Returning visitors who turned sound on: re-arm it with their first tap anywhere.
  useEffect(() => {
    let pref: string | null = null;
    try { pref = window.localStorage.getItem(PREF_KEY); } catch { /* ignore */ }
    if (pref !== "on") return;
    setNeedsTap(true);
    const unlock = () => { void enable(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [enable]);

  useEffect(() => () => {
    if (ctxRef.current && ctxRef.current.state !== "closed") void ctxRef.current.close();
  }, []);

  const tones = useCallback((notes: { freq: number; start: number; length: number; type?: OscillatorType; volume?: number }[]) => {
    const ctx = ctxRef.current;
    if (!enabledRef.current || !ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + note.start;
      const peak = note.volume ?? 0.2;
      oscillator.type = note.type ?? "sine";
      oscillator.frequency.setValueAtTime(note.freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.length);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + note.length + 0.02);
    }
  }, []);

  /** Friendly two-note chime (new order for a store, status update for a customer). */
  const chime = useCallback(() => tones([
    { freq: 880, start: 0, length: 0.32 },
    { freq: 1174, start: 0.18, length: 0.34 },
  ]), [tones]);

  /** Loud, urgent alarm for riders: four fast alternating beeps. */
  const alarmBeep = useCallback(() => tones([0, 0.22, 0.44, 0.66].map((start, index) => ({
    freq: index % 2 === 0 ? 1046 : 784, start, length: 0.15, type: "square" as OscillatorType, volume: 0.32,
  }))), [tones]);

  const speak = useCallback((text: string) => {
    if (!enabledRef.current || !("speechSynthesis" in window)) return;
    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const voice = voices.find(v => /^en[-_]PH/i.test(v.lang)) ?? voices.find(v => /^en/i.test(v.lang));
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.volume = 1;
      synth.speak(utterance);
    } catch { /* speech is a bonus; the chime still plays */ }
  }, []);

  const vibrate = useCallback((pattern: number[]) => {
    try { if (enabledRef.current && "vibrate" in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
  }, []);

  return { enabled, needsTap, unsupported, enable, disable, chime, alarmBeep, speak, vibrate };
}

export type AlertSound = ReturnType<typeof useAlertSound>;

/** Runs `fn` immediately and then every `ms` while `active` is true. */
export function useRepeat(active: boolean, fn: () => void, ms: number) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!active) return;
    ref.current();
    const timer = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(timer);
  }, [active, ms]);
}

/** Keeps the screen on (where supported) so alerts are not missed by a sleeping phone. */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
      } catch { /* not allowed or unsupported */ }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release(); };
  }, [active]);
}
