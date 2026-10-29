import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const AUTH_STORAGE_KEY = 'nexacrm-auth'
let authPersistenceMode = 'session'

const selectStorage = (mode) => (mode === 'local' ? localStorage : sessionStorage)

const authStorage = {
  getItem: (key) => {
    const sessionValue = sessionStorage.getItem(key)
    if (sessionValue) {
      authPersistenceMode = 'session'
      return sessionValue
    }

    const localValue = localStorage.getItem(key)
    if (localValue) {
      authPersistenceMode = 'local'
      return localValue
    }

    return null
  },
  setItem: (key, value) => {
    const primaryStorage = selectStorage(authPersistenceMode)
    const fallbackStorage = selectStorage(authPersistenceMode === 'local' ? 'session' : 'local')
    primaryStorage.setItem(key, value)
    fallbackStorage.removeItem(key)
  },
  removeItem: (key) => {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  },
}

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      authBootstrapped: false,
      setPersistenceMode: (mode) => {
        authPersistenceMode = mode === 'local' ? 'local' : 'session'
      },

      login: (user, token, refreshToken = null) =>
        set({ user, token, refreshToken, isAuthenticated: true, authBootstrapped: true }),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, authBootstrapped: true }),
      setTokens: (token, refreshToken = null) =>
        set((s) => ({ token, refreshToken: refreshToken ?? s.refreshToken })),
      updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
      setSessionFromUser: (user) =>
        set((s) => ({
          user,
          token: user ? s.token : null,
          refreshToken: user ? s.refreshToken : null,
          isAuthenticated: Boolean(user),
          authBootstrapped: true,
        })),
      markAuthBootstrapped: () => set({ authBootstrapped: true }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStorage),
      version: 3,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState
        // Repair older persisted sessions that marked auth=true without storing tokens.
        if (version < 2 && persistedState.isAuthenticated && !persistedState.token) {
          return {
            ...persistedState,
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            authBootstrapped: false,
          }
        }
        if (version < 3) {
          return {
            ...persistedState,
            token: null,
            refreshToken: null,
          }
        }
        return {
          ...persistedState,
          token: null,
          refreshToken: null,
        }
      },
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        authBootstrapped: state.authBootstrapped,
      }),
    }
  )
)
