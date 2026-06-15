'use client';

import { create } from 'zustand';
import type { ProjectWithRelations } from '@/app/actions/projects';

type ObjItem = ProjectWithRelations['objectives'][number];
type InvItem = ProjectWithRelations['inventoryItems'][number];

type SavedObjective = { obj: ObjItem; projectId: string; index: number };
type SavedInventoryItem = { item: InvItem; projectId: string; index: number };
type SavedProject = { project: ProjectWithRelations; index: number };

type ProjectStore = {
  projects: ProjectWithRelations[];

  hydrate: (projects: ProjectWithRelations[]) => void;

  // Objective toggle (existing)
  optimisticToggleObjective: (objectiveId: string) => boolean;
  rollbackObjective: (objectiveId: string, previousValue: boolean) => void;

  // Inventory quantity (existing)
  optimisticSetQuantity: (itemId: string, qty: number) => number;
  rollbackQuantity: (itemId: string, previousQty: number) => void;

  // Project rename
  optimisticUpdateProject: (projectId: string, title: string) => string;
  rollbackProject: (projectId: string, prevTitle: string) => void;

  // Objective rename
  optimisticRenameObjective: (objectiveId: string, title: string) => string;
  rollbackRenameObjective: (objectiveId: string, prevTitle: string) => void;

  // Objective delete
  optimisticDeleteObjective: (objectiveId: string) => SavedObjective | null;
  rollbackDeleteObjective: (saved: SavedObjective) => void;

  // Inventory item rename
  optimisticRenameInventoryItem: (itemId: string, name: string) => string;
  rollbackRenameInventoryItem: (itemId: string, prevName: string) => void;

  // Inventory item delete
  optimisticDeleteInventoryItem: (itemId: string) => SavedInventoryItem | null;
  rollbackDeleteInventoryItem: (saved: SavedInventoryItem) => void;

  // Project delete
  optimisticDeleteProject: (projectId: string) => SavedProject | null;
  rollbackDeleteProject: (saved: SavedProject) => void;
};

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  projects: [],

  hydrate(projects) {
    set({ projects });
  },

  // ── Objective toggle ──────────────────────────────────────────────────────────

  optimisticToggleObjective(objectiveId) {
    let previousValue = false;
    for (const project of get().projects) {
      const obj = project.objectives.find((o) => o.id === objectiveId);
      if (obj) {
        previousValue = obj.isCompleted;
        break;
      }
    }
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        objectives: project.objectives.map((obj) =>
          obj.id === objectiveId
            ? { ...obj, isCompleted: !obj.isCompleted }
            : obj,
        ),
      })),
    }));
    return previousValue;
  },

  rollbackObjective(objectiveId, previousValue) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        objectives: project.objectives.map((obj) =>
          obj.id === objectiveId ? { ...obj, isCompleted: previousValue } : obj,
        ),
      })),
    }));
  },

  // ── Inventory quantity ────────────────────────────────────────────────────────

  optimisticSetQuantity(itemId, qty) {
    let previousQty = 0;
    for (const project of get().projects) {
      const item = project.inventoryItems.find((i) => i.id === itemId);
      if (item) {
        previousQty = item.quantity;
        break;
      }
    }
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        inventoryItems: project.inventoryItems.map((item) =>
          item.id === itemId ? { ...item, quantity: qty } : item,
        ),
      })),
    }));
    return previousQty;
  },

  rollbackQuantity(itemId, previousQty) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        inventoryItems: project.inventoryItems.map((item) =>
          item.id === itemId ? { ...item, quantity: previousQty } : item,
        ),
      })),
    }));
  },

  // ── Project rename ────────────────────────────────────────────────────────────

  optimisticUpdateProject(projectId, title) {
    const prevTitle =
      get().projects.find((p) => p.id === projectId)?.title ?? '';
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, title } : p,
      ),
    }));
    return prevTitle;
  },

  rollbackProject(projectId, prevTitle) {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, title: prevTitle } : p,
      ),
    }));
  },

  // ── Objective rename ──────────────────────────────────────────────────────────

  optimisticRenameObjective(objectiveId, title) {
    let prevTitle = '';
    for (const project of get().projects) {
      const obj = project.objectives.find((o) => o.id === objectiveId);
      if (obj) {
        prevTitle = obj.title;
        break;
      }
    }
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        objectives: project.objectives.map((obj) =>
          obj.id === objectiveId ? { ...obj, title } : obj,
        ),
      })),
    }));
    return prevTitle;
  },

  rollbackRenameObjective(objectiveId, prevTitle) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        objectives: project.objectives.map((obj) =>
          obj.id === objectiveId ? { ...obj, title: prevTitle } : obj,
        ),
      })),
    }));
  },

  // ── Objective delete ──────────────────────────────────────────────────────────

  optimisticDeleteObjective(objectiveId) {
    let saved: SavedObjective | null = null;
    for (const project of get().projects) {
      const index = project.objectives.findIndex((o) => o.id === objectiveId);
      if (index !== -1) {
        saved = { obj: project.objectives[index], projectId: project.id, index };
        break;
      }
    }
    if (!saved) return null;
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        objectives: project.objectives.filter((o) => o.id !== objectiveId),
      })),
    }));
    return saved;
  },

  rollbackDeleteObjective(saved) {
    set((state) => ({
      projects: state.projects.map((project) => {
        if (project.id !== saved.projectId) return project;
        const objectives = [...project.objectives];
        objectives.splice(saved.index, 0, saved.obj);
        return { ...project, objectives };
      }),
    }));
  },

  // ── Inventory item rename ─────────────────────────────────────────────────────

  optimisticRenameInventoryItem(itemId, name) {
    let prevName = '';
    for (const project of get().projects) {
      const item = project.inventoryItems.find((i) => i.id === itemId);
      if (item) {
        prevName = item.name;
        break;
      }
    }
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        inventoryItems: project.inventoryItems.map((item) =>
          item.id === itemId ? { ...item, name } : item,
        ),
      })),
    }));
    return prevName;
  },

  rollbackRenameInventoryItem(itemId, prevName) {
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        inventoryItems: project.inventoryItems.map((item) =>
          item.id === itemId ? { ...item, name: prevName } : item,
        ),
      })),
    }));
  },

  // ── Inventory item delete ─────────────────────────────────────────────────────

  optimisticDeleteInventoryItem(itemId) {
    let saved: SavedInventoryItem | null = null;
    for (const project of get().projects) {
      const index = project.inventoryItems.findIndex((i) => i.id === itemId);
      if (index !== -1) {
        saved = { item: project.inventoryItems[index], projectId: project.id, index };
        break;
      }
    }
    if (!saved) return null;
    set((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        inventoryItems: project.inventoryItems.filter((i) => i.id !== itemId),
      })),
    }));
    return saved;
  },

  rollbackDeleteInventoryItem(saved) {
    set((state) => ({
      projects: state.projects.map((project) => {
        if (project.id !== saved.projectId) return project;
        const inventoryItems = [...project.inventoryItems];
        inventoryItems.splice(saved.index, 0, saved.item);
        return { ...project, inventoryItems };
      }),
    }));
  },

  // ── Project delete ────────────────────────────────────────────────────────────

  optimisticDeleteProject(projectId) {
    const index = get().projects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;
    const saved: SavedProject = { project: get().projects[index], index };
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
    }));
    return saved;
  },

  rollbackDeleteProject(saved) {
    set((state) => {
      const projects = [...state.projects];
      projects.splice(saved.index, 0, saved.project);
      return { projects };
    });
  },
}));
