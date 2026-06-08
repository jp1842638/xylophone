/* =========================================================
   Xylophone — Web Audio
   - Keyboard: A S D F G H J K
   - Mouse:    click bars
   - Touch:    tap, multi-touch chords, drag-glissando
   - Volume:   vertical slider (0 = fully muted)
   ========================================================= */

(() => {
  "use strict";

  // ---------- Audio setup ----------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  /** @type {AudioContext | null} */
  let audioCtx = null;
  /** @type {GainNode | null} */
  let masterGain = null;

  // 0..1, controlled by the slider
  let volume = 0.7;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new AudioCtx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      // Ignore promise; browsers resolve when allowed
      audioCtx.resume().catch(() => {});
    }
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain && audioCtx) {
      // Smooth ramp to avoid clicks
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(volume, now, 0.01);
    }
  }

  // ---------- Tone synthesis (xylophone-ish) ----------
  function playTone(freq) {
    if (!audioCtx || !masterGain) return;
    if (volume <= 0) return; // truly muted: skip work entirely

    const now = audioCtx.currentTime;

    // Two oscillators layered: fundamental (sine) + soft overtone (triangle 2x)
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = freq;

    const osc2 = audioCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = freq * 2; // octave overtone for "shine"

    const oscGain1 = audioCtx.createGain();
    const oscGain2 = audioCtx.createGain();
    oscGain1.gain.value = 0;
    oscGain2.gain.value = 0;

    // Envelope (percussive)
    const peak = 0.45;          // base velocity
    const peak2 = 0.12;         // overtone is quieter
    const attack = 0.004;
    const decay = 1.1;

    oscGain1.gain.setValueAtTime(0, now);
    oscGain1.gain.linearRampToValueAtTime(peak, now + attack);
    oscGain1.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    oscGain2.gain.setValueAtTime(0, now);
    oscGain2.gain.linearRampToValueAtTime(peak2, now + attack);
    oscGain2.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.7);

    osc1.connect(oscGain1).connect(masterGain);
    osc2.connect(oscGain2).connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + decay + 0.05);
    osc2.stop(now + decay + 0.05);
  }

  // ---------- DOM wiring ----------
  const xylophone = document.getElementById("xylophone");
  const bars = Array.from(document.querySelectorAll(".bar"));
  /** @type {Record<string, HTMLElement>} */
  const keyToBar = {};
  bars.forEach((bar) => {
    const k = bar.dataset.key.toUpperCase();
    keyToBar[k] = bar;
  });

  function flashBar(bar) {
    if (!bar) return;
    bar.classList.add("active");
    // Re-trigger animation if already active
    // Use a short timeout aligned with CSS transition
    clearTimeout(bar._flashTimer);
    bar._flashTimer = setTimeout(() => {
      bar.classList.remove("active");
    }, 160);
  }

  function strike(bar) {
    if (!bar) return;
    ensureAudio();
    const freq = parseFloat(bar.dataset.freq);
    if (!isNaN(freq)) playTone(freq);
    flashBar(bar);
  }

  // ---------- Keyboard ----------
  const VALID_KEYS = new Set(["A", "S", "D", "F", "G", "H", "J", "K"]);
  const heldKeys = new Set();

  window.addEventListener("keydown", (e) => {
    // Ignore when typing in form fields (defensive — we have none, but good practice)
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

    const k = (e.key || "").toUpperCase();
    if (!VALID_KEYS.has(k)) return;
    if (e.repeat || heldKeys.has(k)) return;

    heldKeys.add(k);
    strike(keyToBar[k]);
  });

  window.addEventListener("keyup", (e) => {
    const k = (e.key || "").toUpperCase();
    heldKeys.delete(k);
  });

  // Resume audio on any first interaction (for autoplay policies)
  const resumeOnce = () => {
    ensureAudio();
    window.removeEventListener("pointerdown", resumeOnce);
    window.removeEventListener("keydown", resumeOnce);
    window.removeEventListener("touchstart", resumeOnce);
  };
  window.addEventListener("pointerdown", resumeOnce, { once: false });
  window.addEventListener("keydown", resumeOnce, { once: false });
  window.addEventListener("touchstart", resumeOnce, { once: false, passive: true });

  // ---------- Mouse ----------
  // Click + drag glissando for desktop
  let mouseDown = false;
  let lastMouseBar = null;

  bars.forEach((bar) => {
    bar.addEventListener("mousedown", (e) => {
      e.preventDefault();
      mouseDown = true;
      lastMouseBar = bar;
      strike(bar);
    });

    bar.addEventListener("mouseenter", () => {
      if (mouseDown && lastMouseBar !== bar) {
        lastMouseBar = bar;
        strike(bar);
      }
    });
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
    lastMouseBar = null;
  });

  // ---------- Touch (multi-touch + glissando) ----------
  // Map of touch identifier -> last bar struck for that finger
  const touchLastBar = new Map();

  function barFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest(".bar");
  }

  xylophone.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      ensureAudio();
      for (const t of e.changedTouches) {
        const bar = barFromPoint(t.clientX, t.clientY);
        if (bar) {
          strike(bar);
          touchLastBar.set(t.identifier, bar);
        }
      }
    },
    { passive: false }
  );

  xylophone.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const bar = barFromPoint(t.clientX, t.clientY);
        const prev = touchLastBar.get(t.identifier);
        if (bar && bar !== prev) {
          strike(bar);
          touchLastBar.set(t.identifier, bar);
        }
      }
    },
    { passive: false }
  );

  function clearTouch(e) {
    for (const t of e.changedTouches) {
      touchLastBar.delete(t.identifier);
    }
  }
  xylophone.addEventListener("touchend", clearTouch);
  xylophone.addEventListener("touchcancel", clearTouch);

  // ---------- Volume slider ----------
  const slider = document.getElementById("volume");
  const volValue = document.getElementById("volValue");
  const volIcon = document.getElementById("volIcon");

  function updateVolumeUI(pct) {
    const v = pct / 100;
    setVolume(v);
    volValue.textContent = `${pct}%`;
    if (pct === 0) {
      volIcon.classList.add("muted");
      volIcon.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
        '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.96 8.96 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.17v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73 12 10.73 4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>' +
        "</svg>";
    } else {
      volIcon.classList.remove("muted");
      volIcon.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
        '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>' +
        "</svg>";
    }
  }

  slider.addEventListener("input", () => {
    const pct = parseInt(slider.value, 10) || 0;
    ensureAudio();
    updateVolumeUI(pct);
  });

  // Initial sync
  updateVolumeUI(parseInt(slider.value, 10) || 0);

  // Prevent page from scrolling when interacting with bars on mobile
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.target && e.target.closest && e.target.closest(".xylophone")) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
})();