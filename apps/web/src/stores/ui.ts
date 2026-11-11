"use client";
import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  helpOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
}));
