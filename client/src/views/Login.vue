<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
// ⚡️ 关键修复：导入 useUserStore
import { useUserStore } from '@/stores/user.js'

const router = useRouter()

// 状态控制
const isLoginMode = ref(true)

// 背景图状态
const bgUrl = ref('')

// 表单数据
const form = ref({
    username: '',
    password: '',
    confirmPassword: ''
})

// 初始化：读取主页保存的壁纸
onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'
})

const toggleMode = () => {
    isLoginMode.value = !isLoginMode.value
    form.value.password = ''
    form.value.confirmPassword = ''
}

const handleSubmit = async () => {
    if (!form.value.username || !form.value.password) {
        alert('❌ 请输入完整的账号和密码')
        return
    }

    if (!isLoginMode.value && form.value.password !== form.value.confirmPassword) {
        alert('❌ 两次输入的密码不一致')
        return
    }

    const url = isLoginMode.value ? '/api/login' : '/api/register'
    const payload = {
        username: form.value.username,
        password: form.value.password
    }

    try {
        const res = await axios.post(url, payload)
        if (res.data.success) {
            if (isLoginMode.value) {
                // ⚡️ 现在可以正常使用了
                const userStore = useUserStore()
                userStore.login({
                    id: res.data.user.id,
                    username: res.data.user.username,
                    role: res.data.user.role,
                    avatar: res.data.user.avatar || null,
                    nickname: res.data.user.nickname || null,
                    email: res.data.user.email || null
                })

                alert(`欢迎回来,${res.data.user.username}!`)

                // ⚡️ 所有用户登录后都跳转到首页
                router.push('/')
            } else {
                alert('🎉 注册成功！请登录')
                toggleMode()
            }
        } else {
            alert(`❌ ${res.data.message || '操作失败'}`)
        }
    } catch (error) {
        console.error('登录错误详情:', error)
        alert('❌ 网络错误或服务器异常')
    }
}
</script>

<template>
    <div class="login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
        <div class="bg-overlay"></div>
        <div class="glass-container">
            <div class="title-area">
                <h2 class="main-title">{{ isLoginMode ? '欢迎登录' : '创建账号' }}</h2>
                <p class="sub-title">
                    {{ isLoginMode ? '进入你的数字空间' : '开启你的探索之旅' }}
                </p>
            </div>

            <div class="form-area">
                <div class="input-group">
                    <input type="text" v-model="form.username" required placeholder=" " id="user">
                    <label for="user">用户名 / 账号</label>
                    <div class="glow-bar"></div>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path fill="currentColor"
                            d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 8a6 6 0 1 1 12 0A6 6 0 0 1 6 8zm2 10a3 3 0 0 0-3 3a1 1 0 1 1-2 0 5 5 0 0 1 5-5h8a5 5 0 0 1 5 5a1 1 0 1 1-2 0a3 3 0 0 0-3-3H8z" />
                    </svg>
                </div>

                <div class="input-group">
                    <input type="password" v-model="form.password" required placeholder=" " id="pass"
                        @keyup.enter="handleSubmit">
                    <label for="pass">密码</label>
                    <div class="glow-bar"></div>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path fill="currentColor"
                            d="M12 17a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm-2-9V7a4 4 0 1 1 8 0v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2zm2-4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z" />
                    </svg>
                </div>

                <transition name="slide-fade">
                    <div class="input-group" v-if="!isLoginMode">
                        <input type="password" v-model="form.confirmPassword" required placeholder=" " id="repass">
                        <label for="repass">确认密码</label>
                        <div class="glow-bar"></div>
                        <svg class="icon" viewBox="0 0 24 24">
                            <path fill="currentColor"
                                d="M12 17a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm-2-9V7a4 4 0 1 1 8 0v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2zm2-4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z" />
                        </svg>
                    </div>
                </transition>

                <button class="submit-btn" @click="handleSubmit">
                    <span>{{ isLoginMode ? '登 录' : '注 册' }}</span>
                    <div class="btn-glow"></div>
                </button>

                <div class="switch-mode">
                    {{ isLoginMode ? '还没有账号？' : '已有账号？' }}
                    <span @click="toggleMode">{{ isLoginMode ? '立即注册' : '立即登录' }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.login-page {
    height: 100vh;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    background-color: #0f172a;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transition: background-image 0.5s ease;
}

.bg-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    z-index: 0;
}

.glass-container {
    position: relative;
    z-index: 1;
    width: 400px;
    padding: 50px 40px;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 30px;
    transition: height 0.3s ease;
}

.title-area {
    text-align: center;
}

.main-title {
    font-size: 2rem;
    color: #fff;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 5px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.sub-title {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    font-weight: 300;
}

.input-group {
    position: relative;
    margin-bottom: 25px;
    width: 100%;
}

.input-group input {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 40px 12px 10px;
    background: rgba(0, 0, 0, 0.2);
    border: none;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px 8px 0 0;
    color: #fff;
    font-size: 1rem;
    outline: none;
    transition: background 0.3s;
    z-index: 2;
}

.input-group input:focus {
    background: rgba(0, 0, 0, 0.4);
}

.input-group label {
    position: absolute;
    left: 10px;
    top: 12px;
    color: rgba(255, 255, 255, 0.6);
    pointer-events: none;
    transition: 0.3s ease;
    font-size: 1rem;
}

.input-group input:focus~label,
.input-group input:not(:placeholder-shown)~label {
    top: -12px;
    left: 0;
    font-size: 0.8rem;
    color: #42b883;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.glow-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #42b883, #35495e);
    box-shadow: 0 0 10px #42b883;
    transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1);
    z-index: 3;
}

.input-group input:focus~.glow-bar {
    width: 100%;
}

.icon {
    position: absolute;
    right: 10px;
    top: 10px;
    width: 20px;
    height: 20px;
    color: rgba(255, 255, 255, 0.4);
    transition: color 0.3s;
}

.input-group input:focus~.icon {
    color: #42b883;
}

.submit-btn {
    position: relative;
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #42b883 0%, #2c3e50 100%);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.3s;
    margin-top: 10px;
}

.submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(66, 184, 131, 0.4);
}

.submit-btn:active {
    transform: scale(0.98);
}

.submit-btn span {
    position: relative;
    z-index: 2;
    letter-spacing: 2px;
}

.submit-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: 0.5s;
    z-index: 1;
}

.submit-btn:hover::before {
    left: 100%;
}

.switch-mode {
    text-align: center;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    margin-top: 10px;
}

.switch-mode span {
    color: #42b883;
    cursor: pointer;
    font-weight: 600;
    margin-left: 5px;
    transition: color 0.2s;
    text-decoration: underline;
    text-underline-offset: 4px;
}

.switch-mode span:hover {
    color: #fff;
    text-shadow: 0 0 5px #42b883;
}

.slide-fade-enter-active {
    transition: all 0.4s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(-10px);
    opacity: 0;
    height: 0;
    margin-bottom: 0;
}
</style>