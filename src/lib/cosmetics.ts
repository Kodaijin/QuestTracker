// Quest Gems economy + cosmetic catalog. Pure & data-driven (mirrors the style of
// src/lib/pet.ts and src/lib/achievements.ts). The gem balance is *derived*:
// earned (from farm-proof level / achievements / streak history) minus the summed
// price of owned cosmetics — so there is no mutable counter to exploit.

// ── Gem economy ───────────────────────────────────────────────────────────────

export const GEM_PER_LEVEL = 5;
export const GEM_PER_ACHIEVEMENT = 10;

/** Longest-streak milestones; each grants its gems once the streak has reached it. */
export const STREAK_MILESTONES: { days: number; gems: number }[] = [
  { days: 7, gems: 25 },
  { days: 30, gems: 100 },
  { days: 100, gems: 500 },
];

export function gemsFromLevel(level: number): number {
  return Math.max(0, level - 1) * GEM_PER_LEVEL;
}

export function streakMilestoneGems(longestStreak: number): number {
  return STREAK_MILESTONES.filter((m) => longestStreak >= m.days).reduce((s, m) => s + m.gems, 0);
}

/** Total gems a hero has ever earned (farm-proof: derived from progression history). */
export function earnedGems(args: {
  level: number;
  achievementsUnlocked: number;
  longestStreak: number;
}): number {
  return (
    gemsFromLevel(args.level) +
    args.achievementsUnlocked * GEM_PER_ACHIEVEMENT +
    streakMilestoneGems(args.longestStreak)
  );
}

// ── Cosmetic catalog ────────────────────────────────────────────────────────────

export type CosmeticCategory = 'theme' | 'xpbar' | 'frame' | 'particle' | 'background';

export const COSMETIC_CATEGORIES: { id: CosmeticCategory; label: string; blurb: string }[] = [
  { id: 'xpbar', label: 'XP Bar Styles', blurb: 'Animate your XP bar.' },
  { id: 'frame', label: 'Frames & Glows', blurb: 'Decorate your hero panel.' },
  { id: 'particle', label: 'Celebration FX', blurb: 'Restyle level-up sparkles.' },
  { id: 'background', label: 'Backgrounds', blurb: 'Set the ambient backdrop behind everything.' },
];

/** Which renderer a background cosmetic uses. 'css' = the original CSS aurora. */
export type BackgroundKind =
  | 'css'
  | 'aurora-webgl'
  | 'nebula'
  | 'starfield'
  | 'fireflies'
  | 'ocean'
  | 'ember'
  | 'galaxy'
  | 'sakura'
  | 'synthwave'
  | 'constellations'
  | 'rain';

/** Which WebGL particle behavior a celebration cosmetic plays. */
export type CelebrationKind =
  | 'stars' // default
  | 'confetti'
  | 'fireworks'
  | 'coins'
  | 'embers'
  | 'petals'
  | 'runes'
  | 'frost'
  | 'vortex';

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  price: number;
  /** Free cosmetics can be equipped without a purchase (no CosmeticUnlock row). */
  free?: boolean;
  /** Two hex colors for the shop preview swatch. */
  swatch: [string, string];
  /** `data-theme` value (theme category). */
  themeAttr?: string;
  /** CSS class applied to the target element (xpbar / frame categories). */
  className?: string;
  /** Particle set for the CSS/DOM fallback celebration (particle category). */
  particle?: { chars: string[]; colorClass: string };
  /** WebGL celebration behavior + palette (particle category). */
  fx?: { kind: CelebrationKind; colors: string[] };
  /** Renderer to use (background category). */
  background?: { kind: BackgroundKind };
}

export const COSMETICS: Cosmetic[] = [
  // ── XP-bar styles (class on the bar fill) ──
  { id: 'xpbar-quicksilver', category: 'xpbar', name: 'Quicksilver', description: 'A faster silver shimmer.', price: 50, swatch: ['#e5e7eb', '#9ca3af'], className: 'xpbar-quicksilver' },
  { id: 'xpbar-pulse', category: 'xpbar', name: 'Pulse Glow', description: 'A breathing glow along the bar.', price: 100, swatch: ['#fbbf24', '#f59e0b'], className: 'xpbar-pulse' },
  { id: 'xpbar-starfield', category: 'xpbar', name: 'Starfield', description: 'Twinkling night-sky fill.', price: 150, swatch: ['#6366f1', '#0ea5e9'], className: 'xpbar-starfield' },
  { id: 'xpbar-rainbow', category: 'xpbar', name: 'Rainbow Flow', description: 'A flowing rainbow gradient.', price: 200, swatch: ['#f472b6', '#22d3ee'], className: 'xpbar-rainbow' },

  // ── Frames & glows (class on the hero/progression panel) ──
  { id: 'frame-gilded', category: 'frame', name: 'Gilded', description: 'Warm golden frame + glow.', price: 100, swatch: ['#f59e0b', '#fbbf24'], className: 'frame-gilded' },
  { id: 'frame-frost', category: 'frame', name: 'Frost', description: 'Cool sky-blue frame + glow.', price: 150, swatch: ['#38bdf8', '#0ea5e9'], className: 'frame-frost' },
  { id: 'frame-vines', category: 'frame', name: 'Verdant Vines', description: 'Emerald frame + glow.', price: 150, swatch: ['#34d399', '#10b981'], className: 'frame-vines' },
  { id: 'frame-void', category: 'frame', name: 'Void', description: 'Violet frame + deep glow.', price: 400, swatch: ['#a78bfa', '#7c3aed'], className: 'frame-void' },

  // ── Celebration FX (WebGL particle bursts on level-up / quest-complete) ──
  // `particle` drives the CSS/DOM fallback; `fx` drives the WebGL behavior.
  { id: 'particle-confetti', category: 'particle', name: 'Confetti Burst', description: 'Tumbling colored paper raining down.', price: 150, swatch: ['#f472b6', '#22d3ee'], particle: { chars: ['🎉', '🎊', '✨'], colorClass: 'text-fuchsia-300' }, fx: { kind: 'confetti', colors: ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'] } },
  { id: 'particle-fireworks', category: 'particle', name: 'Fireworks', description: 'Bursts that explode and rain down.', price: 250, swatch: ['#fbbf24', '#f472b6'], particle: { chars: ['🎆', '✦', '✨'], colorClass: 'text-amber-300' }, fx: { kind: 'fireworks', colors: ['#fbbf24', '#f472b6', '#22d3ee', '#a78bfa', '#ffffff'] } },
  { id: 'particle-coins', category: 'particle', name: 'Golden Coins', description: 'A burst of loot — coins erupt and fall.', price: 250, swatch: ['#fcd34d', '#f59e0b'], particle: { chars: ['🪙', '💰', '✨'], colorClass: 'text-amber-300' }, fx: { kind: 'coins', colors: ['#fcd34d', '#f59e0b', '#fde68a'] } },
  { id: 'particle-embers', category: 'particle', name: 'Ember Flurry', description: 'Glowing embers swirling upward.', price: 150, swatch: ['#fb923c', '#ef4444'], particle: { chars: ['🔥', '✦', '✶'], colorClass: 'text-orange-300' }, fx: { kind: 'embers', colors: ['#fb923c', '#ef4444', '#fbbf24'] } },
  { id: 'particle-petals', category: 'particle', name: 'Petal Drift', description: 'Cherry-blossom petals cascading down.', price: 150, swatch: ['#f9a8d4', '#fb7185'], particle: { chars: ['🌸', '🌺', '🌷'], colorClass: 'text-pink-300' }, fx: { kind: 'petals', colors: ['#f9a8d4', '#fb7185', '#fecdd3'] } },
  { id: 'particle-runes', category: 'particle', name: 'Arcane Runes', description: 'Glowing sigils rising and fading.', price: 250, swatch: ['#a78bfa', '#22d3ee'], particle: { chars: ['✶', '❖', '✦'], colorClass: 'text-violet-300' }, fx: { kind: 'runes', colors: ['#a78bfa', '#22d3ee', '#c4b5fd'] } },
  { id: 'particle-frost', category: 'particle', name: 'Frostfall', description: 'Icy crystals sparkling down.', price: 200, swatch: ['#bae6fd', '#7dd3fc'], particle: { chars: ['❄', '✦', '❅'], colorClass: 'text-sky-200' }, fx: { kind: 'frost', colors: ['#bae6fd', '#7dd3fc', '#ffffff'] } },
  { id: 'particle-vortex', category: 'particle', name: 'Sparkle Vortex', description: 'Particles spiraling out in a swirl.', price: 250, swatch: ['#e879f9', '#22d3ee'], particle: { chars: ['✦', '✧', '⋆'], colorClass: 'text-fuchsia-300' }, fx: { kind: 'vortex', colors: ['#e879f9', '#22d3ee', '#fef08a'] } },

  // ── Backgrounds (ambient backdrop behind all content) ──
  // `bg-aurora` is the original CSS look and the default — free, no canvas.
  { id: 'bg-aurora', category: 'background', name: 'Aurora', description: 'The classic drifting aurora glow.', price: 0, free: true, swatch: ['#6366f1', '#d946ef'], background: { kind: 'css' } },
  { id: 'bg-aurora-live', category: 'background', name: 'Living Aurora', description: 'A flowing WebGL aurora with floating motes.', price: 0, free: true, swatch: ['#818cf8', '#22d3ee'], background: { kind: 'aurora-webgl' } },
  { id: 'bg-nebula', category: 'background', name: 'Nebula', description: 'Billowing colored nebula clouds.', price: 300, swatch: ['#a855f7', '#ec4899'], background: { kind: 'nebula' } },
  { id: 'bg-starfield', category: 'background', name: 'Deep Starfield', description: 'A parallax field of drifting stars.', price: 350, swatch: ['#38bdf8', '#1e293b'], background: { kind: 'starfield' } },
  { id: 'bg-fireflies', category: 'background', name: 'Mystic Fireflies', description: 'Glowing fireflies drifting through a dark forest.', price: 300, swatch: ['#fde047', '#a3e635'], background: { kind: 'fireflies' } },
  { id: 'bg-ocean', category: 'background', name: 'Ocean Abyss', description: 'Caustic light and rising bubbles in the deep.', price: 300, swatch: ['#22d3ee', '#0e7490'], background: { kind: 'ocean' } },
  { id: 'bg-ember', category: 'background', name: 'Ember', description: 'Glowing cracks and rising volcanic embers.', price: 350, swatch: ['#fb923c', '#dc2626'], background: { kind: 'ember' } },
  { id: 'bg-galaxy', category: 'background', name: 'Galaxy Spiral', description: 'A slowly rotating spiral galaxy.', price: 400, swatch: ['#c084fc', '#60a5fa'], background: { kind: 'galaxy' } },
  { id: 'bg-sakura', category: 'background', name: 'Sakura Drift', description: 'Cherry-blossom petals drifting down.', price: 300, swatch: ['#f9a8d4', '#fb7185'], background: { kind: 'sakura' } },
  { id: 'bg-synthwave', category: 'background', name: 'Synthwave', description: 'A neon grid receding under a banded sun.', price: 350, swatch: ['#e879f9', '#22d3ee'], background: { kind: 'synthwave' } },
  { id: 'bg-constellations', category: 'background', name: 'Constellations', description: 'Drifting stars linked by faint lines.', price: 300, swatch: ['#93c5fd', '#1e293b'], background: { kind: 'constellations' } },
  { id: 'bg-rain', category: 'background', name: 'Rainstorm', description: 'Streaking rain with distant lightning.', price: 350, swatch: ['#94a3b8', '#334155'], background: { kind: 'rain' } },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: string): Cosmetic | undefined {
  return COSMETIC_BY_ID.get(id);
}

export function cosmeticsByCategory(category: CosmeticCategory): Cosmetic[] {
  return COSMETICS.filter((c) => c.category === category);
}

/** Summed price of every owned cosmetic — the hero's total gem spend. */
export function spentGems(ownedIds: string[]): number {
  return ownedIds.reduce((sum, id) => sum + (getCosmetic(id)?.price ?? 0), 0);
}

export interface EquippedCosmetics {
  theme: string | null;
  xpbar: string | null;
  frame: string | null;
  particle: string | null;
  background: string | null;
}

export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  theme: null,
  xpbar: null,
  frame: null,
  particle: null,
  background: null,
};

/** The default level-up/quest-complete particle (amber stars) when none is equipped. */
export const DEFAULT_PARTICLE = { chars: ['✦', '✧', '✶', '⋆'], colorClass: 'text-amber-300' };

/** Resolve the particle set for an equipped id, falling back to the default stars. */
export function particleFor(id: string | null): { chars: string[]; colorClass: string } {
  if (!id) return DEFAULT_PARTICLE;
  return getCosmetic(id)?.particle ?? DEFAULT_PARTICLE;
}

/** The default WebGL celebration (a golden star shower) when none is equipped. */
export const DEFAULT_CELEBRATION: { kind: CelebrationKind; colors: string[] } = {
  kind: 'stars',
  colors: ['#fcd34d', '#ffffff'],
};

/** Resolve the WebGL celebration behavior for an equipped id, defaulting to stars. */
export function celebrationFor(id: string | null): { kind: CelebrationKind; colors: string[] } {
  if (!id) return DEFAULT_CELEBRATION;
  return getCosmetic(id)?.fx ?? DEFAULT_CELEBRATION;
}

/** The default background when none is equipped: the original CSS aurora. */
export const DEFAULT_BACKGROUND_KIND: BackgroundKind = 'css';

/** Resolve the background renderer for an equipped id, falling back to CSS aurora. */
export function backgroundFor(id: string | null): BackgroundKind {
  if (!id) return DEFAULT_BACKGROUND_KIND;
  return getCosmetic(id)?.background?.kind ?? DEFAULT_BACKGROUND_KIND;
}
