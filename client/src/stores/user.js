// src/stores/user.js
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)

  // 计算属性：是否已登录
  const isLoggedIn = computed(() => !!user.value)

  // 登录
  const login = (userData) => {
    user.value = userData
    console.log('✅ 用户已登录:', userData.username)
  }

  // 退出登录
  const logout = () => {
    user.value = null
    console.log('✅ 用户已登出')
  }

  // 初始化（页面加载时调用）
  const init = () => {
    // pinia-plugin-persistedstate 会自动恢复 state
    // 这里只是打印日志确认状态
    if (user.value) {
      console.log('✅ 登录状态已恢复:', user.value.username)
    } else {
      console.log('ℹ️ 未登录状态')
    }
  }

  return { user, isLoggedIn, login, logout, init }
}, {
  persist: true // 自动持久化
})