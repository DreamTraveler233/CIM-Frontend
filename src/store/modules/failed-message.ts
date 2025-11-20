import { defineStore } from 'pinia'

export const useFailedMessageStore = defineStore('failed-message', {
  state: () => ({
    ids: {} as Record<string, string[]>
  }),
  getters: {
    has: (state) => (sessionKey: string, msg_id: string) => {
      if (!sessionKey) return false
      const arr = state.ids[sessionKey]
      return !!arr && arr.includes(msg_id)
    }
  },
  actions: {
    addFailed(sessionKey: string, msg_id: string) {
      if (!sessionKey || !msg_id) return
      this.ids[sessionKey] = this.ids[sessionKey] || []
      if (!this.ids[sessionKey].includes(msg_id)) {
        this.ids[sessionKey].push(msg_id)
      }
    },
    removeFailed(sessionKey: string, msg_id: string) {
      if (!sessionKey || !msg_id) return
      this.ids[sessionKey] = (this.ids[sessionKey] || []).filter((id) => id !== msg_id)
      if ((this.ids[sessionKey] || []).length === 0) {
        delete this.ids[sessionKey]
      }
    }
  },
  persist: ({ key: 'cim_failed_messages', paths: ['ids'] } as any)
})
