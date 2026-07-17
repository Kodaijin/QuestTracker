# 2026-06-21: Drag-and-drop board reordering


- Quests can now be rearranged on the dashboard by **dragging a card's grip handle (⠿)**, in addition to the ↑/↓ buttons. Built on `@dnd-kit` with a pointer sensor (touch-friendly for the Android WebView) and a keyboard sensor for accessible reordering. The handle is owner-only and hidden while a filter is narrowing the board; dragging reuses the existing `reorderProjects` action, so persistence is unchanged
- The per-quest **"Must be done in order"** objectives toggle moved out of the Objectives card to sit just above it on the quest page
