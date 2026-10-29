import { create } from 'zustand'
import { integrationsAPI } from '../services/api'

export const useIntegrationsStore = create((set, get) => ({
  configs: {},
  connected: {},
  loading: false,
  loaded: false,
  saving: false,
  testing: false,
  syncing: false,

  setConfig: (id, values) => set(s => ({ configs: { ...s.configs, [id]: values } })),
  setConnected: (id, val) => set(s => ({ connected: { ...s.connected, [id]: val } })),
  getApiKey: (id, field = 'apiKey') => get().configs?.[id]?.[field] ?? '',

  fetchIntegrations: async () => {
    set({ loading: true })
    try {
      const rows = await integrationsAPI.getAll()
      const configs = {}
      const connected = {}
      rows.forEach((row) => {
        configs[row.id] = row.values || {}
        connected[row.id] = !!row.connected
      })
      set({ configs, connected, loaded: true })
    } catch {
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  saveIntegration: async (id, values) => {
    set({ saving: true })
    try {
      const row = await integrationsAPI.save(id, values)
      set((s) => ({
        configs: { ...s.configs, [id]: row.values || {} },
        connected: { ...s.connected, [id]: !!row.connected },
      }))
      return row
    } finally {
      set({ saving: false })
    }
  },

  testIntegration: async (id, values) => {
    set({ testing: true })
    try {
      return await integrationsAPI.test(id, values)
    } finally {
      set({ testing: false })
    }
  },

  syncIntegration: async (id, values) => {
    set({ syncing: true })
    try {
      return await integrationsAPI.sync(id, values)
    } finally {
      set({ syncing: false })
    }
  },

  disconnect: (id) => set(s => ({
    connected: { ...s.connected, [id]: false },
    configs: { ...s.configs, [id]: {} },
  })),

  disconnectIntegration: async (id) => {
    await integrationsAPI.disconnect(id)
    set((s) => ({
      connected: { ...s.connected, [id]: false },
      configs: { ...s.configs, [id]: {} },
    }))
  },
}))
