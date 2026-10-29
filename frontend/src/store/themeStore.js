import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const THEME_IDS = ['light', 'dark', 'corporate']
const SUPPORTED_THEME_IDS = new Set(THEME_IDS)
const normalizeTheme = (theme) => (SUPPORTED_THEME_IDS.has(theme) ? theme : 'corporate')

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme: normalizeTheme(theme) }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'nexacrm-theme',
      partialize: (state) => ({ theme: normalizeTheme(state.theme) }),
      migrate: (persistedState) => ({
        ...persistedState,
        theme: normalizeTheme(persistedState?.theme),
      }),
    }
  )
)
