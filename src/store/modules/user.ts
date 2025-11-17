import { fetchContactApplyUnreadNum, fetchGroupApplyUnreadNum, fetchUserSetting } from '@/apis/api'
import { fetchApi } from '@/apis/request'
import { storage } from '@/utils'
import * as auth from '@/utils/auth.ts'
import { defineStore } from 'pinia'
import { useSettingsStore } from '@/store/modules/settings.ts'

interface IUserStoreState {
  uid: number
  nickname: string
  mobile: string
  email: string
  gender: number
  motto: string
  avatar: string
  online: boolean
  isQiye: boolean
  isContactApply: boolean
  isGroupApply: boolean
}

export const useUserStore = defineStore('user', {
  persist: true,
  state: (): IUserStoreState => {
    return {
      uid: 0, // 用户ID
      mobile: '',
      email: '',
      nickname: '', // 用户昵称
      gender: 0, // 性别
      motto: '', // 个性签名
      avatar: '',
      online: false, // 在线状态
      isQiye: false,
      isContactApply: false,
      isGroupApply: false
    }
  },
  getters: {},
  actions: {
    // 设置用户登录状态
    updateSocketStatus(status: boolean) {
      this.online = status
    },

    logoutLogin() {
      this.$reset()// 重置用户状态
      storage.remove('user_info')// 删除用户信息缓存
      auth.deleteToken()// 删除登录 token
      location.reload()// 刷新页面
    },

    loadSetting() {
      this.loadUserSetting()
      this.loadFriendApplyNum()
      this.loadGroupApplyUnread()
    },
    async loadUserSetting() {
      const [err, data] = await fetchApi(fetchUserSetting, {})
      if (err || !data || !data.user_info) return

      this.nickname = data.user_info.nickname || ''
      this.uid = data.user_info.uid || 0
      this.avatar = data.user_info.avatar || ''
      this.gender = data.user_info.gender || 0
      this.mobile = data.user_info.mobile || ''
      this.email = data.user_info.email || ''
      this.motto = data.user_info.motto || ''
      this.isQiye = data.user_info.is_qiye || false

      storage.set('user_info', data)

      // 将服务端设置写入 settings store（不触发二次保存）
      try {
        const settingsStore = useSettingsStore()
        const toBool = (v: any) => v === 'Y' || v === 'y' || v === 'true' || v === true || v === 1 || v === '1'

        if (data.setting) {
          const { theme_mode, notify_cue_tone, keyboard_event_notify } = data.setting

          if (typeof theme_mode === 'string') {
            settingsStore.themeMode = theme_mode
            settingsStore.currentThemeMode = theme_mode
            storage.set('themeMode', theme_mode, null)
          }

          if (typeof notify_cue_tone !== 'undefined') {
            const val = toBool(notify_cue_tone)
            settingsStore.isPromptTone = val
            storage.set('isPromptTone', val, null)
          }

          if (typeof keyboard_event_notify !== 'undefined') {
            const val = toBool(keyboard_event_notify)
            settingsStore.isKeyboard = val
            storage.set('isKeyboard', val, null)
          }
        }
      } catch (e) {
        // 忽略设置同步中的非致命错误
      }
    },
    async loadFriendApplyNum() {
      const [err, data] = await fetchApi(fetchContactApplyUnreadNum, {})

      if (!err) {
        this.isContactApply = data.num > 0
      }
    },
    async loadGroupApplyUnread() {
      const [err, data] = await fetchApi(fetchGroupApplyUnreadNum, {})

      if (!err) {
        this.isGroupApply = data.num > 0
      }
    }
  }
})
