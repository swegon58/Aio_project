import { create } from "zustand";

export type MascotState = "idle" | "thinking" | "working" | "done" | "error" | "needs_approval";

interface AppState {
  sessionId: string | null;
  mascotState: MascotState;
  setSessionId: (sessionId: string | null) => void;
  setMascotState: (state: MascotState) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sessionId: null,
  mascotState: "idle",
  setSessionId: (sessionId) => set({ sessionId }),
  setMascotState: (mascotState) => set({ mascotState }),
}));
