<script setup>
import { ref, onMounted, onBeforeUnmount, reactive } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { message } from '@/utils/message.js'

const router = useRouter()
const userStore = useUserStore()

// ==================== 状态控制 ====================
const isLoginMode = ref(true)
const bgUrl = ref('')
const illustrationUrl = ref('https://w.wallhaven.cc/full/yq/wallhaven-yqqemd.png')
const isSwitchingAccount = ref(false)

// ==================== 表单数据 ====================
const form = reactive({
    account: '',
    phone: '',
    password: '',
    confirmPassword: ''
})

// ==================== 验证码 & 手机号状态 ====================
const captchaCode = ref('')
const captchaText = ref('')
const captchaError = ref(false)
const showPhoneInput = ref(false)
const showPhoneDropdown = ref(false)

const phoneCountries = [
    { code: '+86', country: '中国', flag: '🇨🇳', placeholder: '请输入11位手机号' },
    { code: '+1', country: '美国', flag: '🇺🇸', placeholder: '请输入10位号码' },
    { code: '+81', country: '日本', flag: '🇯🇵', placeholder: '请输入10-11位号码' },
    { code: '+82', country: '韩国', flag: '🇰🇷', placeholder: '请输入10-11位号码' },
    { code: '+44', country: '英国', flag: '🇬🇧', placeholder: '请输入10位号码' },
    { code: '+33', country: '法国', flag: '🇫🇷', placeholder: '请输入9位号码' },
    { code: '+49', country: '德国', flag: '🇩🇪', placeholder: '请输入10-11位号码' },
    { code: '+61', country: '澳大利亚', flag: '🇦🇺', placeholder: '请输入9位号码' }
]
const selectedPhoneCountry = ref(phoneCountries[0])

// ==================== 核心逻辑 ====================
const generateCaptcha = () => {
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    captchaText.value = code
    captchaError.value = false
    captchaCode.value = ''
}

const checkInputType = () => {
    const input = form.account
    if (/^\d{11}$/.test(input)) {
        showPhoneInput.value = true
        form.phone = input
    } else {
        showPhoneInput.value = false
        form.phone = ''
    }
}

const toggleMode = () => {
    isLoginMode.value = !isLoginMode.value
    form.password = ''
    form.confirmPassword = ''
    form.phone = showPhoneInput.value ? form.account : ''
    captchaCode.value = ''
    captchaError.value = false
    if (isLoginMode.value) generateCaptcha()
}

const selectPhoneCountry = (country) => {
    selectedPhoneCountry.value = country
    showPhoneDropdown.value = false
}

const validateForm = () => {
    if (!isLoginMode.value && showPhoneInput.value && !form.phone) {
        message.warning('请输入手机号')
        return false
    }
    if (!form.account && !form.phone) {
        message.warning('请输入账号')
        return false
    }
    if (!form.password) {
        message.warning('密码不能为空')
        return false
    }
    if (!isLoginMode.value) {
        if (form.password.length < 6) {
            message.warning('密码长度至少需要6位')
            return false
        }
        if (form.password !== form.confirmPassword) {
            message.warning('两次输入的密码不一致')
            return false
        }
    }
    if (isLoginMode.value) {
        if (!captchaCode.value) {
            message.warning('请输入验证码')
            return false
        }
        if (captchaCode.value.toUpperCase() !== captchaText.value) {
            captchaError.value = true
            message.error('验证码错误')
            generateCaptcha()
            return false
        }
    }
    return true
}

const handleSubmit = async () => {
    if (!validateForm()) return

    try {
        if (isLoginMode.value) {
            const loginData = {
                account: form.account || form.phone,
                password: form.password,
                captcha: captchaCode.value
            }
            const res = await axios.post('/api/login', loginData)

            if (res.data.success) {
                const isSwitching = sessionStorage.getItem('isSwitchingAccount')
                if (isSwitching) {
                    message.success(`切换成功！欢迎 ${res.data.user.username}`)
                    sessionStorage.removeItem('isSwitchingAccount')
                    sessionStorage.removeItem('previousUsername')
                } else {
                    const name = res.data.user.nickname || res.data.user.username
                    message.success(`欢迎回来, ${name} 👋`)
                }
                userStore.login(res.data.user)
                router.push('/')
            } else {
                message.error(res.data.message || '登录失败')
                generateCaptcha()
            }
        } else {
            let phoneToSend = null
            if (form.phone) {
                phoneToSend = `${selectedPhoneCountry.value.code} ${form.phone}`
            }
            const registerData = {
                username: form.account,
                password: form.password,
                phone: phoneToSend
            }
            if (phoneToSend && form.account === form.phone) {
                registerData.username = phoneToSend
            }
            const res = await axios.post('/api/register', registerData)

            if (res.data.success) {
                message.success('🎉 注册成功！请登录')
                toggleMode()
            } else {
                message.error(res.data.message || '注册失败')
            }
        }
    } catch (error) {
        console.error(error)
        if (error.response?.status === 409) {
            message.warning('该账号已被注册，请直接登录')
        } else {
            message.error('网络请求失败，请稍后重试')
        }
        if (isLoginMode.value) generateCaptcha()
    }
}

const closeDropdowns = () => {
    showPhoneDropdown.value = false
}

onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'
    generateCaptcha()
    if (sessionStorage.getItem('isSwitchingAccount') === 'true') {
        isSwitchingAccount.value = true
    }
    window.addEventListener('click', closeDropdowns)
})

onBeforeUnmount(() => {
    window.removeEventListener('click', closeDropdowns)
    if (!userStore.isLoggedIn && isSwitchingAccount.value) {
        sessionStorage.removeItem('isSwitchingAccount')
        sessionStorage.removeItem('previousUsername')
    }
})
</script>

<template>
    <div class="login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
        <div class="bg-overlay"></div>

        <div class="scroll-container">
            <div class="login-card-wrapper">
                <div class="illustration-side" :style="{ backgroundImage: `url(${illustrationUrl})` }"></div>

                <div class="glass-container">
                    <div class="logo-section">
                        <router-link to="/" class="logo-link">
                            <span class="logo-text">𝓥𝓮𝓻𝓲𝓽𝓪𝓼</span>
                        </router-link>
                    </div>

                    <transition name="fade">
                        <div v-if="isSwitchingAccount" class="switch-account-notice">
                            <svg viewBox="0 0 24 24" class="notice-icon">
                                <path fill="currentColor"
                                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            <span>正在切换账号...</span>
                        </div>
                    </transition>

                    <div class="title-area-left">
                        <h2 class="main-title">
                            {{ isLoginMode ? '登录' : '注册' }}
                            <div class="title-underline"></div>
                        </h2>

                        <div class="sub-link-area">
                            {{ isLoginMode ? '没有账号？' : '已有账号？' }}
                            <span class="switch-link" @click="toggleMode">
                                {{ isLoginMode ? '立即注册 >' : '立即登录 >' }}
                            </span>
                        </div>
                    </div>

                    <div class="form-area">
                        <div class="input-group">
                            <div class="main-input-wrapper">
                                <div v-if="showPhoneInput" class="phone-country-prefix"
                                    @click.stop="showPhoneDropdown = !showPhoneDropdown">
                                    <span class="flag">{{ selectedPhoneCountry.flag }}</span>
                                    <span class="code">{{ selectedPhoneCountry.code }}</span>
                                    <svg class="dropdown-icon" viewBox="0 0 24 24">
                                        <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                    </svg>
                                    <div v-if="showPhoneDropdown" class="phone-country-dropdown">
                                        <div v-for="country in phoneCountries" :key="country.code"
                                            class="country-option" @click.stop="selectPhoneCountry(country)">
                                            <span class="flag">{{ country.flag }}</span>
                                            <span class="country-name">{{ country.country }}</span>
                                            <span class="country-code">{{ country.code }}</span>
                                        </div>
                                    </div>
                                </div>

                                <input type="text" v-model="form.account" id="account" required placeholder=" "
                                    :class="{ 'has-prefix': showPhoneInput }" @input="checkInputType"
                                    @keyup.enter="handleSubmit">
                                <label for="account" :class="{ 'label-shifted': showPhoneInput }">
                                    {{ isLoginMode ? '账号 / 手机号 / 邮箱' : '设置账号' }}
                                </label>
                                <div class="glow-bar"></div>
                            </div>
                        </div>

                        <div class="input-group">
                            <input type="password" v-model="form.password" id="password" required placeholder=" "
                                @keyup.enter="handleSubmit">
                            <label for="password">密码</label>
                            <div class="glow-bar"></div>
                        </div>

                        <transition name="slide-fade">
                            <div v-if="!isLoginMode" class="input-group">
                                <input type="password" v-model="form.confirmPassword" id="confirm" required
                                    placeholder=" " @keyup.enter="handleSubmit">
                                <label for="confirm">确认密码</label>
                                <div class="glow-bar"></div>
                            </div>
                        </transition>

                        <transition name="slide-fade">
                            <div v-if="isLoginMode" class="captcha-row">
                                <div class="input-group captcha-input">
                                    <input type="text" v-model="captchaCode" id="captcha" required placeholder=" "
                                        @keyup.enter="handleSubmit" :class="{ 'input-error': captchaError }">
                                    <label for="captcha">验证码</label>
                                    <div class="glow-bar"></div>
                                </div>

                                <div class="captcha-box" @click="generateCaptcha" title="点击刷新">
                                    <span class="captcha-code">{{ captchaText }}</span>
                                </div>
                            </div>
                        </transition>

                        <button class="submit-btn" @click="handleSubmit">
                            <svg class="rocket-icon" viewBox="0 0 1024 1024" version="1.1"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M831.301657 142.018329c-74.572756 0-135.027799 165.650191-135.027799 369.979896 0 204.338579 60.455043 369.979896 135.027799 369.979896 74.572756 0 135.018925-165.641317 135.018925-369.979896 0-204.329705-60.44617-369.979896-135.018925-369.979896z"
                                    fill="#89B7FF"></path>
                                <path
                                    d="M831.295445 353.073248c-30.675633 0-55.539133 71.156464-55.539133 158.92409 0 87.776499 24.863501 158.932964 55.539133 158.932964 30.675633 0 55.539133-71.156464 55.539134-158.932964 0-87.767626-24.863501-158.92409-55.539134-158.92409z"
                                    fill="#FFFFFF"></path>
                                <path
                                    d="M529.695501 416.364256c-43.532423-43.532423-88.269865-69.37112-99.934059-57.706925-11.657983 11.657983 14.173615 56.401636 57.706038 99.934946a409.351542 409.351542 0 0 0 18.158697 17.097428c-47.576957-8.550489-111.252187-13.776971-181.220492-13.77697-147.3087 0-266.728042 23.168666-266.728042 51.750156 0 28.590364 119.419341 51.759029 266.728042 51.759029 67.734849 0 129.571494-4.898163 176.615154-12.968596a413.708423 413.708423 0 0 0-13.551584 12.957061c-43.532423 43.532423-69.370232 88.268977-57.706038 99.933171 11.657983 11.657983 56.401636-14.173615 99.934059-57.706038 34.850607-34.850607 58.356464-70.477643 60.364533-89.283216 0.715203-1.544873 1.08079-3.110156 1.080791-4.691411 0-1.497844-0.328319-2.98149-0.970759-4.445615 1.005366-17.569497-23.27426-55.650939-60.47634-92.852132z"
                                    fill="#89B7FF"></path>
                            </svg>
                            <span>{{ isLoginMode ? '登 录' : '注 册' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ==================== 1. 全屏背景 - 固定不滚动 ==================== */
.login-page {
    position: fixed;
    inset: 0;
    background-color: #0f172a;
    background-size: cover;
    background-position: center;
    transition: background-image 0.5s ease;
    overflow: hidden;
}

.bg-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(3px);
    z-index: 0;
    pointer-events: none;
}

/* ==================== 2. 🔥 滚动容器 - 核心优化 ==================== */
.scroll-container {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 40px 20px;
    box-sizing: border-box;

    /* 🔥 隐藏滚动条但保留滚动功能 */
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* IE/Edge */
}

.scroll-container::-webkit-scrollbar {
    display: none;
    /* Chrome/Safari/Opera */
}

/* ==================== 3. 登录卡片大容器 (画布) - 精致版 ==================== */
.login-card-wrapper {
    position: relative;
    z-index: 1;
    display: flex;
    /* 🔥 缩小尺寸 */
    width: 850px;
    /* 变窄 */
    height: 520px;
    /* 变矮，整体趋近于宽一点的长方形，视觉更稳 */

    /* 移除 wrapper 的圆角和阴影 */
    box-shadow: none;
    background: transparent;
    overflow: visible;
    margin: auto;
    max-width: 90%;
    /* 移动端保护 */
}

/* ==================== 4. 左侧插画区域 (底座) ==================== */
.illustration-side {
    /* 🔥 宽度占画布的 65% */
    width: 65%;
    height: 100%;
    /* 高度撑满 600px */

    position: absolute;
    left: 0;
    top: 0;
    z-index: 1;

    background-size: cover;
    background-position: center;
    /* 四个角都给圆角，因为它现在是一个独立的视觉块 */
    border-radius: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    /* 给插画加阴影 */
}

/* 遮罩：只在右侧加一点点渐变，让毛玻璃的文字更清晰，不需要全遮 */
.illustration-side::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, transparent 60%, rgba(0, 0, 0, 0.3) 100%);
    border-radius: inherit;
}

/* ==================== 5. 毛玻璃卡片 (悬浮小卡片) - 最终版 ==================== */
.glass-container {
    position: absolute;
    right: 15px;
    /* 距离右侧也稍微缩进一点 */
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;

    /* 🔥 宽度加大到 400px */
    width: 400px;
    height: auto;
    min-height: 440px;

    /* 🔥 缩小内边距，让内容更紧凑 */
    padding: 30px 35px;
    box-sizing: border-box;

    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);

    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);

    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==================== 6. Logo 区域 (Q弹修复版) ==================== */
.logo-section {
    display: flex;
    justify-content: center;
    margin-bottom: 25px;
}

.logo-link {
    text-decoration: none;
    display: inline-block;
    /* 必须是块级或行内块才能变形 */
    /* 🔥 这里的贝塞尔曲线是 Q 弹的核心：带回弹效果 */
    transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.logo-link:hover {
    /* 悬停时放大 1.1 倍，配合上面的曲线，会“弹”一下 */
    transform: scale(1.05) rotate(0.15deg);
}

.logo-text {
    font-size: 2.5rem;
    font-weight: 700;
    font-family: 'Georgia', serif;
    letter-spacing: 2px;

    /* 渐变流光文字 */
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    /* 默认发光 */
    filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.4));

    /* 🔥 永久呼吸动画：让它时刻都在轻轻律动 */
    animation: logo-breathe 3s ease-in-out infinite alternate;
}

/* 呼吸动画关键帧 */
@keyframes logo-breathe {
    0% {
        filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.4));
        transform: translateY(0);
    }

    100% {
        filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.8));
        transform: translateY(-2px);
        /* 微微上浮 */
    }
}

/* ==================== 7. 标题区域 (下划线Q弹修复版) ==================== */
.title-area-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 25px;
    padding-left: 5px;
}

.main-title {
    font-size: 1.6rem;
    color: white;
    font-weight: 800;
    /* 加粗 */
    margin: 0 0 8px 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    letter-spacing: 1px;
    position: relative;
    display: inline-block;
    /* 关键：让宽度适应文字 */
    cursor: default;
}

/* 🔥 灵动下划线：变细、变精致 */
.title-underline {
    width: 35px;
    height: 2.5px;
    /* 从 4px 改为 3px，更显秀气 */
    background: #42b883;
    border-radius: 1.5px;
    /* 圆角随高度微调 */
    margin-top: 5px;
    /* 阴影范围稍微收敛一点，不至于糊成一团 */
    box-shadow: 0 0 6px rgba(66, 184, 131, 0.5);
    transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 鼠标移入时的伸长效果保持不变 */
.title-area-left:hover .title-underline {
    width: 80px;
    box-shadow: 0 2px 10px rgba(66, 184, 131, 0.8);
}


.sub-link-area {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
}

.switch-link {
    color: #42b883;
    cursor: pointer;
    font-weight: 700;
    margin-left: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-block;
}

.switch-link:hover {
    color: #64e6b0;
    text-shadow: 0 0 10px rgba(66, 184, 131, 0.6);
    transform: translateX(3px);
    /* 向右Q弹移动 */
}

/* ==================== 8. 表单输入框 ==================== */
.form-area {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.input-group {
    position: relative;
    width: 100%;
}

.main-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.input-group input {
    width: 100%;
    padding: 10px 0;
    font-size: 1rem;
    color: white;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    outline: none;
    transition: all 0.3s;
}

.input-group input.has-prefix {
    padding-left: 90px;
}

.input-group input.input-error {
    border-bottom-color: #ff4757;
}

.input-group label {
    position: absolute;
    left: 0;
    top: 10px;
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
    transition: 0.3s ease;
    font-size: 0.95rem;
}

.label-shifted {
    left: 90px !important;
}

.input-group input:focus~label,
.input-group input:not(:placeholder-shown)~label {
    top: -18px;
    left: 0 !important;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.8);
}

.glow-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: #42b883;
    box-shadow: 0 0 10px rgba(66, 184, 131, 0.8);
    transition: width 0.3s ease;
}

.input-group input:focus~.glow-bar {
    width: 100%;
}

/* ==================== 9. 手机号前缀与下拉 ==================== */
.phone-country-prefix {
    position: absolute;
    left: 0;
    bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 5px 8px 0;
    cursor: pointer;
    color: white;
    z-index: 10;
}

.flag {
    font-size: 16px;
}

.code {
    font-size: 14px;
    font-weight: 500;
}

.dropdown-icon {
    width: 10px;
    opacity: 0.7;
}

.phone-country-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 140px;
    max-height: 200px;
    overflow-y: auto;
    background: #2c2c2c;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    z-index: 100;
}

.country-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: background 0.2s;
}

.country-option:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.country-name {
    flex: 1;
}

.country-code {
    font-size: 0.85rem;
    opacity: 0.7;
}

/* ==================== 10. 验证码区域 ==================== */
.captcha-row {
    display: flex;
    align-items: flex-end;
    gap: 15px;
}

.captcha-input {
    flex: 1;
}

.captcha-box {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    height: 36px;
    user-select: none;
}

.captcha-box:hover {
    background: rgba(255, 255, 255, 0.25);
}

.captcha-code {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: bold;
    color: #fff;
    letter-spacing: 2px;
}

/* ==================== 11. 按钮与图标 ==================== */
.submit-btn {
    width: 100%;
    padding: 10px 12px;
    /* 按钮稍微变扁一点，显秀气 */
    border-radius: 50px;
    border: none;
    background: #42b883;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(66, 184, 131, 0.4);
    transition: all 0.3s;
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(66, 184, 131, 0.6);
}

.submit-btn:hover .rocket-icon {
    transform: translate(2px, -2px);
}

.submit-btn:active {
    transform: scale(0.98);
}

.rocket-icon {
    width: 24px;
    height: 24px;
    transition: transform 0.3s ease;
}

/* ==================== 12. 切换账号提示样式 ==================== */
.switch-account-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(66, 184, 131, 0.15);
    border: 1px solid rgba(66, 184, 131, 0.3);
    padding: 8px;
    border-radius: 8px;
    margin-bottom: 20px;
    color: #42b883;
    font-size: 0.85rem;
}

.notice-icon {
    width: 16px;
    height: 16px;
}

/* ==================== 13. 动画效果 ==================== */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(-10px);
    opacity: 0;
}

/* ==================== 14. 移动端适配 (重要更新) ==================== */
@media (max-width: 950px) {
    .login-card-wrapper {
        flex-direction: column;
        width: 90%;
        height: auto;
        width: 450px;
        /* 移动端限制最大宽 */
    }

    .illustration-side {
        position: relative;
        /* 恢复流式布局 */
        width: 100%;
        height: 200px;
        border-radius: 20px 20px 0 0;
    }

    .glass-container {
        position: relative;
        /* 恢复流式布局 */
        right: auto;
        top: auto;
        transform: none;

        width: 100%;
        max-width: none;
        min-height: auto;

        margin-top: -20px;
        /* 向上压一点 */
        border-radius: 20px;
        /* 统一圆角 */
        box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.2);
        padding: 30px;
    }
}

@media (max-width: 600px) {
    .scroll-container {
        padding: 20px 10px;
    }

    .glass-container {
        padding: 25px 30px;
    }

    .logo-text {
        font-size: 2rem;
    }

    .main-title {
        font-size: 1.3rem;
    }

    .form-area {
        gap: 18px;
    }

    .submit-btn {
        font-size: 1rem;
        padding: 10px;
    }
}

/* ==================== 15. 深色主题支持 ==================== */
@media (prefers-color-scheme: dark) {
    .login-page {
        background-color: #0a0e1a;
    }

    .glass-container {
        background: rgba(255, 255, 255, 0.12);
    }
}

/* ==================== 16. 打印样式优化 ==================== */
@media print {
    .login-page {
        background: white;
    }

    .bg-overlay {
        display: none;
    }

    .illustration-side {
        display: none;
    }

    .glass-container {
        box-shadow: none;
        border: 1px solid #ccc;
    }
}
</style>