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

  // ---------- April Fools state ----------
  // Mode flag is flipped from the bottom of this file via setAprilFools().
  let aprilFoolsActive = false;

  // Reusable noise buffer for "chew" effect (built lazily once)
  let noiseBuffer = null;
  function getNoiseBuffer() {
    if (!audioCtx) return null;
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(audioCtx.sampleRate * 0.25); // 250ms is plenty
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // ---------- Tone synthesis (xylophone-ish) ----------
  function playTone(freq) {
    if (!audioCtx || !masterGain) return;
    if (volume <= 0) return; // truly muted: skip work entirely

    if (aprilFoolsActive) {
      playChewyTone(freq);
    } else {
      playNormalTone(freq);
    }
  }

  function playNormalTone(freq) {
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

  // April Fools / Xylitol mode: same pitch, but softer + a chewy noise burst on top.
  function playChewyTone(freq) {
    const now = audioCtx.currentTime;

    // --- Main tone: a softer sine, slightly detuned, with a tiny vibrato ---
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = -4; // ~4 cents flat for a soft, candy-like vibe

    // Small vibrato (LFO -> osc.detune)
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.5; // Hz
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 4; // ±4 cents
    lfo.connect(lfoGain).connect(osc.detune);

    // Subtle second-harmonic shimmer (very quiet)
    const shimmer = audioCtx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = freq * 2;

    const toneGain = audioCtx.createGain();
    const shimmerGain = audioCtx.createGain();
    toneGain.gain.value = 0;
    shimmerGain.gain.value = 0;

    const peak = 0.4;
    const shimmerPeak = 0.05;
    const attack = 0.006;
    const decay = 1.0;

    toneGain.gain.setValueAtTime(0, now);
    toneGain.gain.linearRampToValueAtTime(peak, now + attack);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(shimmerPeak, now + attack);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.6);

    osc.connect(toneGain).connect(masterGain);
    shimmer.connect(shimmerGain).connect(masterGain);

    osc.start(now);
    shimmer.start(now);
    lfo.start(now);
    osc.stop(now + decay + 0.05);
    shimmer.stop(now + decay + 0.05);
    lfo.stop(now + decay + 0.05);

    // --- Chewy noise burst on top ---
    const buf = getNoiseBuffer();
    if (buf) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = buf;

      // Bandpass it so it sounds like a soft "ch" / chew, not raw hiss
      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1200;
      bp.Q.value = 0.9;

      const noiseGain = audioCtx.createGain();
      const noisePeak = 0.18;
      const noiseDecay = 0.09; // ~90ms — short and punchy
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(noisePeak, now + 0.001);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDecay);

      noise.connect(bp).connect(noiseGain).connect(masterGain);
      noise.start(now);
      noise.stop(now + noiseDecay + 0.02);
    }
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
    // Remove + force reflow + re-add so the CSS animation restarts
    // even when the same bar is struck repeatedly in quick succession.
    bar.classList.remove("active");
    void bar.offsetWidth;
    bar.classList.add("active");
    clearTimeout(bar._flashTimer);
    bar._flashTimer = setTimeout(() => {
      bar.classList.remove("active");
    }, 240);
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

  // ---------- April Fools mode ----------
  const aprilBtn = document.getElementById("aprilFoolsBtn");
  const siteTitle = document.getElementById("siteTitle");
  const siteSubtitle = document.getElementById("siteSubtitle");

  const ORIGINAL_TITLE = "Xylophone";
  const APRIL_TITLE = "Xylitol";
  const ORIGINAL_SUBTITLE_HTML = siteSubtitle ? siteSubtitle.innerHTML : "";
  const APRIL_SUBTITLE_HTML =
    "Chew with " +
    "<kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> " +
    "<kbd>G</kbd> <kbd>H</kbd> <kbd>J</kbd> <kbd>K</kbd>" +
    ". Don't worry, it's sugar free!";

  const LS_KEY = "xylo-april-fools";

  function isAprilFirst() {
    const d = new Date();
    return d.getMonth() === 3 && d.getDate() === 1; // April = 3 (0-indexed)
  }

  function setAprilFools(on) {
    aprilFoolsActive = !!on;
    document.body.classList.toggle("april-fools", aprilFoolsActive);

    if (siteTitle) siteTitle.textContent = aprilFoolsActive ? APRIL_TITLE : ORIGINAL_TITLE;
    document.title = aprilFoolsActive ? APRIL_TITLE : ORIGINAL_TITLE;
    if (siteSubtitle) {
      siteSubtitle.innerHTML = aprilFoolsActive ? APRIL_SUBTITLE_HTML : ORIGINAL_SUBTITLE_HTML;
    }
    if (aprilBtn) {
      aprilBtn.textContent = aprilFoolsActive
        ? "April Fools Mode 🤡 (ON)"
        : "April Fools Mode 🤡";
      aprilBtn.setAttribute("aria-pressed", aprilFoolsActive ? "true" : "false");
    }

    try {
      localStorage.setItem(LS_KEY, aprilFoolsActive ? "1" : "0");
    } catch (_) {}
  }

  // Show button only on April 1
  const showButton = isAprilFirst();
  if (aprilBtn && showButton) {
    aprilBtn.hidden = false;

    aprilBtn.addEventListener("click", () => {
      setAprilFools(!aprilFoolsActive);
    });

    // Restore previous state for today
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === "1") setAprilFools(true);
    } catch (_) {}
  } else {
    // Not April 1 — make sure stale state from a previous April 1 is cleared.
    try {
      localStorage.removeItem(LS_KEY);
    } catch (_) {}
  }
})();
