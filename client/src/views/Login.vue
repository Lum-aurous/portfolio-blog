<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
// 修改1：改成对象，包含 username 和 password
const form = ref({
    username: '',
    password: ''
})

const handleLogin = async () => {
    try {
        // 修改2：发送 form 对象给后端
        const res = await axios.post('/api/login', form.value)

        // 在 handleLogin 函数里，登录成功后的逻辑：
        if (res.data.success) {
            localStorage.setItem('isLoggedIn', 'true')
            localStorage.setItem('username', res.data.user.username)
            localStorage.setItem('role', res.data.user.role) // 👈 新增：记住身份

            alert('🔓 登录成功！')

            // 👇 智能跳转：如果是管理员去后台，普通用户去首页
            if (res.data.user.role === 'admin') {
                router.push('/admin')
            } else {
                router.push('/')
            }
        }
    } catch (error) {
        alert('❌ 账号或密码错误')
    }
}
</script>

<template>
    <div class="login-container">
        <div class="login-box">
            <h2>🔐 管理员登录</h2>

            <input type="text" v-model="form.username" placeholder="请输入账号">

            <input type="password" v-model="form.password" placeholder="请输入密码" @keyup.enter="handleLogin">

            <button @click="handleLogin">登录</button>

            <div class="link-area">
                <router-link to="/register">还没有账号？去注册</router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 样式保持不变，新增 link-area */
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 80vh;
}

.login-box {
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

button {
    width: 100%;
    padding: 12px;
    background: #42b883;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.3s;
}

button:hover {
    background: #3aa876;
}

.link-area {
    margin-top: 15px;
    font-size: 0.9rem;
}

.link-area a {
    color: #35495e;
    text-decoration: none;
}
</style>