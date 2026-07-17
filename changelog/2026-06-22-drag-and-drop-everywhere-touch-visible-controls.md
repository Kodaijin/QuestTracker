# 2026-06-22: Drag-and-drop everywhere + touch-visible controls


- Objectives and inventory items can now be **dragged by a grip handle (⠿)** to reorder, matching the dashboard quest cards (the ↑/↓ buttons stay too). New `reorderObjectives` / `reorderInventoryItems` server actions persist a full new order; built on `@dnd-kit` with a shared `SortableRow` wrapper and `verticalListSortingStrategy`
- **Touch visibility fix**: the reorder/edit/delete controls (and the new drag handles) were hidden behind `group-hover`, so they never appeared on touch devices like the Android app. They now stay visible on coarse-pointer (touch) devices via a `[@media(pointer:coarse)]` variant, while desktop keeps the hover-reveal
