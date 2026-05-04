# Banner image prompt

Generate the bullpen banner with any image model (Midjourney, DALL·E 3, Imagen, Flux, Ideogram, Leonardo, etc.). Drop the result at `assets/banner.png` and uncomment the banner img tag in `README.md`.

## Recommended prompt

> A wide cinematic banner image, 16:9. Stylized as 80s-90s baseball card art crossed with synthwave neon. A dugout bench in the foreground where ten silhouetted teammates sit in a row — each holding a different tool of their trade: a glowing laptop, a sketch tablet, a wrench, a database cube, a magnifying glass, a microphone, a coffee mug, a chart, a soldering iron, a soft heart-shaped aura. Above them, a glowing neon serif sign reads **bullpen** in clean lowercase, with a small subtitle: *64 specialists. always warming up.* Background: a softly blurred baseball field at dusk, grass turning to data-grid lines as it recedes, dawn-gradient sky from deep midnight blue to electric purple to warm amber. ASCII-character constellations subtly float in the sky. Cinematic rim lighting, painterly texture, slight grain, high detail, atmospheric.

## Variants to try

**More minimal (works on dark + light README themes):**

> Wide minimalist banner, 16:9. Black background. Centered text "bullpen" in clean lowercase serif (Söhne, Tiempos, or similar), white. Below it in smaller monospace: "64 specialists. always warming up." A single horizontal row of 10 small, subtle ASCII glyphs across the bottom: `[*] <C> [T] [◇] [#] {^} <§> [♡] (✦) (♡)` — each glowing softly in a different muted neon hue (cyan, purple, amber). No baseball imagery — just typography + glyphs.

**More playful (Saturday morning cartoon feel):**

> 16:9 banner illustration. A cartoon dugout filled with 10 distinct cartoon characters working at tiny desks — a designer at an easel, a coder at a laptop, a DBA hunched over a stack of database cubes, a security analyst with a magnifying glass, a wellness coach pouring tea for one of them. Bright, optimistic colors. Hand-drawn line work. Big chunky lowercase title "bullpen" in the upper-left, friendly serif. Subtitle: "your AI engineering team." Inviting, warm, not corporate.

## Output specs

- **Aspect:** 16:9 (1920 × 1080 minimum, 2400 × 1350 ideal for retina)
- **File:** `assets/banner.png` (PNG with transparent background optional, or solid dark for contrast)
- **Weight:** under 800 KB if possible — README loads should stay fast
- **Alt text:** "bullpen — your AI engineering team"

## After generating

1. Save as `assets/banner.png`
2. Edit `README.md` and replace the banner comment block with:
   ```html
   <img src="assets/banner.png" alt="bullpen — your AI engineering team" width="800" />
   ```
3. Commit:
   ```bash
   git add assets/banner.png README.md
   git commit -m "docs: add banner image"
   git push
   ```
