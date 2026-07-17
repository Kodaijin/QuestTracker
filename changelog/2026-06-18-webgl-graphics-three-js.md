# 2026-06-18: WebGL graphics (three.js)


- **WebGL backgrounds**: shader-based ambient backdrops (living aurora, nebula, deep starfield) selectable in Settings and the Shop, added as a new `background` cosmetic category. The classic CSS aurora stays the free default; some WebGL backgrounds are free, others are gem-priced
- **GPU celebration effects**: level-up, quest-complete, and companion-evolution showers play as bloom-lit GPU particle bursts where WebGL is available
- **3D Quest Gem**: a spinning, glossy gem replaces the 💎 glyph in the Shop
- Built on three.js via react-three-fiber + drei + postprocessing, all lazy-loaded so they stay out of the initial bundle. A single capability gate (`src/lib/useWebGL.ts`) requires WebGL2 and honors `prefers-reduced-motion`, and otherwise everything falls back to the existing CSS/DOM visuals. New `User.backgroundId` column and a `free` flag on cosmetics
