# Xylophone

A tiny browser xylophone. No installs, no downloads — just open and play.

🎹 **Live demo:** https://jp1842638.github.io/xylophone/

## How to play

| Key | Note |
|-----|------|
| `A` | C (도)  |
| `S` | D (레)  |
| `D` | E (미)  |
| `F` | F (파)  |
| `G` | G (솔)  |
| `H` | A (라)  |
| `J` | B (시)  |
| `K` | C' (높은 도) |

- **Desktop:** press the keys above, or click & drag across the bars for a glissando.
- **Mobile:** tap the bars. Use multiple fingers for chords, or slide a finger across for a glissando.
- **Volume:** the vertical slider next to the xylophone. Top = loudest, bottom = fully muted.

Bars glow when struck.

## Tech

- Pure HTML / CSS / JavaScript — no build step, no dependencies.
- Sound is synthesized live via the **Web Audio API** (no audio files).
- Designed to work on GitHub Pages out of the box.

## Deploy on GitHub Pages

1. Push these files to the `main` branch.
2. Go to **Settings → Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Your site will be live at `https://<your-username>.github.io/xylophone/`.

## Files

- `index.html` — markup
- `style.css` — visuals (dark theme, glowing bars, vertical slider)
- `script.js` — keyboard / mouse / multi-touch input + Web Audio synthesis