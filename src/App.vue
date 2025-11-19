<script lang="ts" setup>
import AppProvider from '@/layout/AppProvider.vue'
import { useUserStore } from '@/store'
import { isLogin } from '@/utils/auth.ts'
import { JsUpdateDetector } from './plugins/update-detector'
const { loadSetting } = useUserStore()

onMounted(() => {
  isLogin() && loadSetting()

  // 跨标签页监听 localStorage 变化（例如登录/登出），当 token 变更时刷新页面以避免多账号数据混乱
  window.addEventListener('storage', (e: StorageEvent) => {
    try {
      // Storage plugin 使用前缀 IM_，Token key 为 IM_AUTH_TOKEN
      const authKey = 'IM_AUTH_TOKEN'

      if (e.key && e.key.toUpperCase() === authKey) {
        // NOTE: token storage moved to sessionStorage to enable per-tab login sessions.
        // sessionStorage changes are not broadcasted via 'storage' events, so ignore
        // token change in localStorage to avoid forcing cross-tab reload.
        return
      }
    } catch (err) {
      console.error('storage event handler error', err)
    }
  })

  new JsUpdateDetector({
    checkInterval: 5 * 60 * 1000
  })
})
</script>

<template>
  <AppProvider>
    <router-view />
  </AppProvider>
</template>
