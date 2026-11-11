"use client";
import { create } from "zustand";

export type ConnectionStatus = "live" | "reconnecting" | "offline";

export function connectionLabel(status: ConnectionStatus): string {
  return status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline";
}

export function connectionColor(status: ConnectionStatus): string {
  return status === "live"
    ? "var(--status-running)"
    : status === "reconnecting"
      ? "var(--status-idle)"
      : "var(--status-offline)";
}

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (s: ConnectionStatus) => void;
}

import { USE_FIXTURES } from "@/lib/constants";

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: USE_FIXTURES ? "live" : "reconnecting",
  setStatus: (status) => set({ status }),
}));
