// Music on/off and volume. On by default; browsers only allow sound after the visitor's first click
// or key press, so playback starts then. The visitor's choice is remembered in this browser.
import { useEffect, useRef, useState } from "react";
import { createMusic } from "./music.js";

const KEY = "jts-music";

function loadPref() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && typeof p.on === "boolean" && typeof p.volume === "number") return p;
  } catch {
    /* storage unavailable */
  }
  return { on: true, volume: 0.5 };
}

function savePref(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export default function MusicControl() {
  const musicRef = useRef(null);
  const [pref, setPref] = useState(loadPref);
  const [playing, setPlaying] = useState(false);

  if (!musicRef.current && typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
    musicRef.current = createMusic();
  }
  const music = musicRef.current;

  useEffect(() => savePref(pref), [pref]);
  useEffect(() => music?.setVolume(pref.volume), [music, pref.volume]);

  // When music is on but not yet playing, start on the first user gesture anywhere on the page.
  useEffect(() => {
    if (!music) return;
    if (!pref.on) {
      music.stop();
      setPlaying(false);
      return;
    }
    const begin = () => music.start().then(() => setPlaying(music.running)).catch(() => {});
    begin(); // works immediately if the browser already allows sound
    const events = ["pointerdown", "keydown"];
    const onGesture = () => {
      begin();
      events.forEach((e) => window.removeEventListener(e, onGesture, true));
    };
    events.forEach((e) => window.addEventListener(e, onGesture, true));
    return () => events.forEach((e) => window.removeEventListener(e, onGesture, true));
  }, [music, pref.on]);

  if (!music) return null;
  return (
    <div className="music-control" role="group" aria-label="Background music">
      <button
        type="button"
        className={pref.on ? "active" : ""}
        aria-pressed={pref.on}
        onClick={() => setPref((p) => ({ ...p, on: !p.on }))}
      >
        ♪ Music {pref.on ? "on" : "off"}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={pref.volume}
        onChange={(e) => setPref((p) => ({ ...p, volume: Number(e.target.value) }))}
        aria-label="Music volume"
      />
      {pref.on && !playing && <span className="music-hint">starts on your first click</span>}
    </div>
  );
}
