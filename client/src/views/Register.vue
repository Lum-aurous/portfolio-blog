<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const form = ref({
  username: '',
  password: ''
})

const handleRegister = async () => {
  if (!form.value.username || !form.value.password) {
    alert('请填写完整信息')
    return
  }

  try {
    const res = await axios.post('/api/register', form.value)
    if (res.data.success) {
      alert('🎉 注册成功！即将跳转登录页...')
      router.push('/login') // 注册完去登录
    }
  } catch (error) {
    // 如果后端返回 409 (用户名占用)
    if (error.response && error.response.status === 409) {
      alert('❌ 用户名已被占用，换一个吧')
    } else {
      alert('注册失败，请检查网络')
    }
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-box">
      <h2>📝 新用户注册</h2>
      <input type="text" v-model="form.username" placeholder="设置账号 (Username)">
      <input type="password" v-model="form.password" placeholder="设置密码 (Password)">

      <button @click="handleRegister" class="btn-register">立即注册</button>

      <div class="link-area">
        <router-link to="/login">已有账号？去登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 复用之前的样式逻辑 */
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80vh;
}

.auth-box {
  background: var(--card-bg);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 300px;
  border: 1px solid var(--border-color);
}

h2 {
  color: var(--text-color);
  margin-bottom: 20px;
}

input {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  box-sizing: border-box;
  background: var(--bg-color);
  color: var(--text-color);
}

.btn-register {
  width: 100%;
  padding: 12px;
  background: #35495e;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
}

.btn-register:hover {
  background: #2c3e50;
}

.link-area {
  margin-top: 15px;
  font-size: 0.9rem;
}

.link-area a {
  color: #42b883;
  text-decoration: none;
}
</style>