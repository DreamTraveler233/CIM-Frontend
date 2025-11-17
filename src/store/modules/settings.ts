import { defineStore } from 'pinia'
import { storage } from '@/utils'
import { fetchUserSettingSave } from '@/apis/api'
import { fetchApi } from '@/apis/request'

// 轻度防抖：避免频繁保存设置到后端
let _saveSettingsTimer: any = null

export const useSettingsStore = defineStore('settings', {
  state: () => {
    return {
      isPromptTone: storage.get('isPromptTone', false), // 新消息提示音
      isKeyboard: storage.get('isKeyboard', false), // 是否推送键盘输入事件
      isLeaveWeb: false, // 是否离开网页
      isNotify: storage.get('isNotify', true), // 是否同意浏览器通知
      isFullScreen: storage.get('isFullScreen', true), // 是否客户端全屏
      themeMode: storage.get('themeMode', 'light') as string,
      currentThemeMode: storage.get('themeMode', 'light') as string
    }
  },
  actions: {
    async saveSettingsToServer() {
      // 将本地设置映射为后端所需字段
      const payload = {
        theme_mode: this.themeMode,
        // 目前未在本地维护，预留为空或后续接入：
        theme_bag_img: '',
        theme_color: '',
        // 布尔转字符串，后端可按 Y/N 或 true/false 解析
        notify_cue_tone: this.isPromptTone ? 'Y' : 'N',
        keyboard_event_notify: this.isKeyboard ? 'Y' : 'N'
      }

      // 防抖 300ms，合并短时间内的多次修改
      if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer)
      _saveSettingsTimer = setTimeout(async () => {
        await fetchApi(fetchUserSettingSave, payload)
      }, 300)
    },
    setPromptTone(value: boolean) {
      this.isPromptTone = value
      storage.set('isPromptTone', value, null)
      // 同步到后端
      this.saveSettingsToServer()
    },
    setKeyboard(value: boolean) {
      this.isKeyboard = value
      storage.set('isKeyboard', value, null)
      // 同步到后端
      this.saveSettingsToServer()
    },
    setFullScreen(value: boolean) {
      this.isFullScreen = value
      storage.set('isFullScreen', value, null)
    },
    setThemeMode(value: string) {
      this.themeMode = value
      storage.set('themeMode', value, null)
      // 同步到后端
      this.saveSettingsToServer()
    },
    setNotify(value: boolean) {
      this.isNotify = value
      storage.set('isNotify', value, null)
    }
  }
})
