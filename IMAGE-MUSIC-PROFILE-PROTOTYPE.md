# Image → Music Profile prototype

Implemented in `studio/`.

## What works

- Upload JPG / PNG / WebP / AVIF from the Theme page.
- Analysis runs locally in the browser; the source image is not uploaded.
- Extracts a deterministic visual fingerprint, five-color palette, brightness, saturation, contrast, complexity, and visual warmth.
- Converts visual features into an editable seven-axis Music Profile:
  - Energy
  - Warmth
  - Tension
  - Mystery
  - Brightness
  - Elegance
  - Aggression
- Derives a suggested BPM, scale/mode, texture and rhythm character.
- Applies the profile to theme generation: scale, rhythmic density, contour, articulation and dynamics respond to the profile.
- The named character remains the motif identity anchor, so alternate images of the same OC remain related instead of rerolling an unrelated melody.
- Applying a new profile resets the selected theme and creates three deterministic new candidates.
- The image thumbnail, palette, visual metrics and Music Profile survive project JSON export/import.
- Older project JSON remains valid because the new profile/image fields are optional.

## Deliberate limitation of this prototype

This version reads visual style, not semantic identity. It does not yet understand that an image contains a knight, city, flower, firearm, rain, a specific character, etc. The next layer should add CLIP/SigLIP/VLM semantic features and merge them into the same `MusicProfile` contract rather than replacing the current pipeline.

## Verification performed here

- `lib/music.ts` and `lib/image-profile.ts` compile with TypeScript.
- The modified studio TSX transpiles successfully with TypeScript `--noCheck` (dependency installation is unavailable in the current isolated environment).
- A direct deterministic-generation check confirmed:
  - same identity + same profile => identical theme output;
  - changing Music Profile => changed output;
  - similar profiles for the same OC keep the same rhythmic skeleton;
  - generated notes remain inside the four-bar/theme bounds.
- `npm test` was also corrected to enable Node 22 TypeScript stripping; full dependency-backed test execution still requires `npm install`/`npm ci` in a network-enabled environment.
