# 2026-06-18: Quest Gems and cosmetic Shop


- **Quest Gems** currency, earned from level-ups, achievements, and streak milestones. The balance is derived from progress (farm-proof), not a stored counter
- **Shop** (`/shop`) to buy and equip cosmetics: color themes, XP-bar styles, frames and glows, and level-up particle styles, with live previews and a nav gem-balance chip
- Themes recolor the app accent via a CSS-variable layer applied server-side (no flash). New `CosmeticUnlock` model and equipped-cosmetic columns on `User`
