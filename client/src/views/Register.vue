<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { message } from '@/utils/message.js'

const router = useRouter()

const form = reactive({
  account: '',
  password: '',
  confirmPassword: ''
})

const isLoading = ref(false)

const handleRegister = async () => {
  // 1. 非空检查
  if (!form.account || !form.password) {
    message.warning('请填写完整信息')
    return
  }

  // 2. 格式校验 (优化版正则)
  // 手机号：1开头，第二位3-9，后面9位数字
  const isPhone = /^1[3-9]\d{9}$/.test(form.account)
  // 邮箱：简单的通用验证 (只要包含 @ 和 . 且无空格即可)
  const isEmail = /^\S+@\S+\.\S+$/.test(form.account)

  if (!isPhone && !isEmail) {
    message.warning('格式不正确，请输入有效的手机号或邮箱')
    return
  }

  if (form.password.length < 6) {
    message.warning('密码长度至少需要 6 位')
    return
  }

  if (form.password !== form.confirmPassword) {
    message.warning('两次输入的密码不一致')
    return
  }

  isLoading.value = true

  try {
    const res = await axios.post('/api/register', {
      account: form.account,
      password: form.password
    })

    const responseData = res.data

    if (responseData.success) {
      message.success('🎉 注册成功！即将跳转登录...')
      setTimeout(() => {
        router.push('/login')
      }, 1000)
    } else {
      message.error(responseData.message || '注册失败')
    }

  } catch (error) {
    console.error('注册错误:', error)
    if (error.response) {
      const status = error.response.status
      const errorMsg = error.response.data?.message || '未知错误'

      if (status === 409) {
        message.warning('❌ 该账号已被注册，请直接登录')
      } else if (status === 400) {
        message.warning(`❌ ${errorMsg}`)
      } else {
        message.error(`❌ 注册失败: ${errorMsg}`)
      }
    } else {
      message.error('❌ 网络连接失败，请检查服务器')
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-box animate__animated animate__fadeInUp">
      <div class="header">
        <h2>🚀 创建账号</h2>
        <p class="subtitle">使用 手机号 或 邮箱 注册</p>
      </div>

      <div class="input-group">
        <input type="text" v-model="form.account" placeholder="请输入手机号 / 邮箱" @keyup.enter="handleRegister">
      </div>

      <div class="input-group">
        <input type="password" v-model="form.password" placeholder="设置密码 (至少6位)" @keyup.enter="handleRegister">
      </div>

      <div class="input-group">
        <input type="password" v-model="form.confirmPassword" placeholder="确认密码" @keyup.enter="handleRegister">
      </div>

      <button @click="handleRegister" class="btn-register" :disabled="isLoading">
        {{ isLoading ? '提交中...' : '立即注册' }}
      </button>

      <div class="link-area">
        <router-link to="/login">已有账号？<span class="highlight">去登录</span></router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式保持不变，直接复用你原来的即可 */
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.auth-box {
  background: rgba(255, 255, 255, 0.95);
  padding: 40px 30px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 360px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.header {
  margin-bottom: 30px;
}

h2 {
  color: #333;
  margin: 0 0 8px 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.subtitle {
  color: #888;
  font-size: 0.9rem;
  margin: 0;
}

.input-group {
  margin-bottom: 20px;
}

input {
  width: 100%;
  padding: 12px 15px;
  border-radius: 50px;
  border: 1px solid #e0e0e0;
  box-sizing: border-box;
  background: #fcfcfc;
  color: #333;
  font-size: 0.95rem;
  transition: all 0.3s;
  outline: none;
}

input:focus {
  border-color: #42b883;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.btn-register {
  width: 100%;
  padding: 12px;
  background: linear-gradient(90deg, #42b883, #35495e);
  color: white;
  border: none;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 10px;
}

.btn-register:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(66, 184, 131, 0.4);
}

.btn-register:active {
  transform: scale(0.98);
}

.btn-register:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.link-area {
  margin-top: 25px;
  font-size: 0.9rem;
  color: #666;
}

.link-area a {
  color: #666;
  text-decoration: none;
  transition: color 0.3s;
}

.highlight {
  color: #42b883;
  font-weight: 600;
  margin-left: 5px;
}

.link-area a:hover .highlight {
  text-decoration: underline;
}
</style>