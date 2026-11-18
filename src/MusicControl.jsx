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

  // Audio may only start inside a user gesture, so start() is always called from an event handler.
  const play = () =>
    music
      .start()
      .then(() => setPlaying(music.running))
      .catch(() => {});

  // Music on by default: start it on the visitor's first click, tap or key press anywhere on the page.
  const onRef = useRef(pref.on);
  onRef.current = pref.on;
  useEffect(() => {
    if (!music || playing) return;
    const events = ["click", "touchend", "keydown"];
    const onGesture = (e) => {
      if (e.target.closest?.(".music-control")) return; // the music button handles itself
      if (onRef.current) play();
    };
    events.forEach((ev) => window.addEventListener(ev, onGesture, true));
    return () => events.forEach((ev) => window.removeEventListener(ev, onGesture, true));
  }, [music, playing]);

  const toggle = () => {
    const on = !pref.on;
    if (on) play();
    else {
      music.stop();
      setPlaying(false);
    }
    setPref((p) => ({ ...p, on }));
  };

  if (!music) return null;
  return (
    <div className="music-control" role="group" aria-label="Background music">
      <button
        type="button"
        className={pref.on ? "active" : ""}
        aria-pressed={pref.on}
        onClick={toggle}
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
