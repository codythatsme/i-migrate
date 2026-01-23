import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "i-migrate:theme-store";

type Theme = "dark" | "light";

type ThemeStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);
