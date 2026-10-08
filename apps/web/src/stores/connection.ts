"use client";
import { create } from "zustand";

export type ConnectionStatus = "live" | "reconnecting" | "offline";

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (s: ConnectionStatus) => void;
}

import { USE_FIXTURES } from "@/lib/constants";

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: USE_FIXTURES ? "live" : "reconnecting",
  setStatus: (status) => set({ status }),
}));
