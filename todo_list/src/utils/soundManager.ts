/**
 * Sound Manager & Audio Synthesizer
 * Supports multiple preset sound themes + Custom Voice/Microphone recording
 * stored safely in IndexedDB.
 */

import { idbGet, idbSet } from "./storageHelper";

export type SoundTheme = "chime" | "pop" | "retro" | "marimba" | "tada" | "custom";

export interface SoundThemeOption {
  id: SoundTheme;
  name: string;
  desc: string;
}

export const SOUND_THEMES: SoundThemeOption[] = [
  { id: "chime", name: "Chime (กระดิ่ง)", desc: "เสียงคริสตัลใส" },
  { id: "pop", name: "Pop (บับเบิ้ล)", desc: "เสียงป๊อปละมุน" },
  { id: "retro", name: "8-Bit (เรโทร)", desc: "เสียงเหรียญเกม" },
  { id: "marimba", name: "Marimba (มาริมบา)", desc: "เสียงเครื่องไม้" },
  { id: "tada", name: "Tada! (แฟนฟาร์)", desc: "เสียงฉลองสำเร็จ" },
  { id: "custom", name: "เสียงของฉัน", desc: "เสียงที่คุณอัดเอง" },
];

const CUSTOM_SOUND_KEY = "todo_custom_sound_audio";

/**
 * Play a synthesized sound theme via Web Audio API
 */
export function playSynthesizedTheme(theme: Exclude<SoundTheme, "custom">) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (theme === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else if (theme === "retro") {
      const now = ctx.currentTime;
      [987.77, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.06, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.13);
      });
    } else if (theme === "marimba") {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.14, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.22);
      });
    } else if (theme === "tada") {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.1, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.38);
      });
    } else {
      // Default: Chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    console.error("Audio synthesizer error:", err);
  }
}

/**
 * Play task completion sound (Supports presets or user-recorded custom voice)
 */
export async function playSoundEffect(theme: SoundTheme, customAudioDataUrl?: string | null) {
  if (theme === "custom") {
    let audioUrl = customAudioDataUrl;
    if (!audioUrl) {
      audioUrl = await idbGet<string>(CUSTOM_SOUND_KEY);
    }

    if (audioUrl) {
      try {
        const audio = new Audio(audioUrl);
        audio.volume = 0.9;
        await audio.play();
        return;
      } catch (err) {
        console.warn("Custom audio play failed, falling back to chime:", err);
      }
    }
    // Fallback if custom audio is empty
    playSynthesizedTheme("chime");
    return;
  }

  playSynthesizedTheme(theme);
}

/**
 * Save user custom voice recording to IndexedDB
 */
export async function saveCustomSound(audioDataUrl: string): Promise<void> {
  await idbSet(CUSTOM_SOUND_KEY, audioDataUrl);
}

/**
 * Get user custom voice recording from IndexedDB
 */
export async function getCustomSound(): Promise<string | null> {
  return await idbGet<string>(CUSTOM_SOUND_KEY);
}

/**
 * Delete user custom voice recording from IndexedDB
 */
export async function deleteCustomSound(): Promise<void> {
  await idbSet(CUSTOM_SOUND_KEY, "");
}
