<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { onBeforeUnmount } from 'vue'

// 如果用户离开登录页面但没有登录，清除切换标志
onBeforeUnmount(() => {
    if (sessionStorage.getItem('isSwitchingAccount') === 'true') {
        console.log('用户取消了账号切换')
        sessionStorage.removeItem('isSwitchingAccount')
        sessionStorage.removeItem('previousUsername')
    }
})

const router = useRouter()

// 状态控制
const isLoginMode = ref(true)

// 背景图状态
const bgUrl = ref('')

// 表单数据
const form = ref({
    account: '',           // 登录/注册账号：可以是用户名、邮箱、手机号
    phone: '',             // 手机号部分（纯数字）
    password: '',
    confirmPassword: ''
})

// 验证码相关
const captchaCode = ref('')        // 用户输入的验证码
const captchaText = ref('')        // 显示的验证码
const captchaError = ref(false)    // 验证码错误标记

// 手机号相关状态
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

const selectedPhoneCountry = ref(phoneCountries[0]) // 默认中国

// 是否显示手机号输入框
const showPhoneInput = ref(false)

// 观察用户输入，判断是否为手机号
const checkInputType = () => {
    const input = form.value.account

    // 如果是11位数字，可能是中国手机号
    if (/^\d{11}$/.test(input)) {
        showPhoneInput.value = true
        form.value.phone = input
    } else {
        showPhoneInput.value = false
        form.value.phone = ''
    }
}

// 生成验证码
const generateCaptcha = () => {
    // 生成4位随机验证码（数字+大写字母）
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    captchaText.value = code
    captchaError.value = false

    // 清空用户输入
    captchaCode.value = ''
}

// 初始化：读取主页保存的壁纸
onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'

    // 生成初始验证码
    generateCaptcha()
})

// 切换登录/注册模式
const toggleMode = () => {
    isLoginMode.value = !isLoginMode.value
    resetForm()
    generateCaptcha()
}

// 重置表单
const resetForm = () => {
    form.value = {
        account: '',
        phone: '',
        password: '',
        confirmPassword: ''
    }
    captchaCode.value = ''
    captchaError.value = false
    showPhoneInput.value = false
}

// 切换手机国家
const selectPhoneCountry = (country) => {
    selectedPhoneCountry.value = country
    showPhoneDropdown.value = false
}

// 表单验证
const validateForm = () => {
    if (!isLoginMode.value && showPhoneInput.value && !form.value.phone) {
        alert('❌ 请输入手机号')
        return false
    }

    // 基本验证
    if (!form.value.account && !form.value.phone) {
        alert('❌ 请输入用户名/邮箱/手机号')
        return false
    }

    if (!form.value.password) {
        alert('❌ 密码不能为空')
        return false
    }

    if (!isLoginMode.value && form.value.password !== form.value.confirmPassword) {
        alert('❌ 两次输入的密码不一致')
        return false
    }

    // 登录时验证码验证
    if (isLoginMode.value) {
        if (!captchaCode.value) {
            alert('❌ 请输入验证码')
            return false
        }

        if (captchaCode.value.toUpperCase() !== captchaText.value) {
            captchaError.value = true
            generateCaptcha()
            alert('❌ 验证码错误，请重新输入')
            return false
        }
    }

    // 如果输入了手机号，验证格式
    if (form.value.phone) {
        const country = selectedPhoneCountry.value
        let isValid = false

        if (country.code === '+86') {
            // 中国手机号
            const phoneRegex = /^1[3-9]\d{9}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+1') {
            // 美国手机号
            const phoneRegex = /^\d{10}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+81' || country.code === '+82') {
            // 日本或韩国
            const phoneRegex = /^\d{10,11}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+33') {
            // 法国
            const phoneRegex = /^\d{9}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+44') {
            // 英国
            const phoneRegex = /^\d{10}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+49') {
            // 德国
            const phoneRegex = /^\d{10,11}$/
            isValid = phoneRegex.test(form.value.phone)
        } else if (country.code === '+61') {
            // 澳大利亚
            const phoneRegex = /^\d{9}$/
            isValid = phoneRegex.test(form.value.phone)
        }

        if (!isValid) {
            alert(`❌ ${country.placeholder}`)
            return false
        }
    }

    return true
}

// 邮箱验证函数
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

const handleSubmit = async () => {
    if (!validateForm()) {
        return
    }

    const userStore = useUserStore()

    try {
        if (isLoginMode.value) {
            // 登录逻辑
            const loginData = {
                account: form.value.account || form.value.phone,
                password: form.value.password,
                captcha: captchaCode.value
            }

            const res = await axios.post('/api/login', loginData)

            if (res.data.success) {
                // 检查是否是切换账号操作
                const isSwitchingAccount = sessionStorage.getItem('isSwitchingAccount')
                const previousUsername = sessionStorage.getItem('previousUsername')

                if (isSwitchingAccount) {
                    // 如果是切换账号，显示切换成功提示
                    alert(`账号切换成功！\n从 ${previousUsername || '原账号'} 切换到 ${res.data.user.username}`)

                    // 清除切换标志
                    sessionStorage.removeItem('isSwitchingAccount')
                    sessionStorage.removeItem('previousUsername')
                } else {
                    // 正常登录
                    const welcomeName = res.data.user.nickname || res.data.user.username || res.data.user.email || res.data.user.phone
                    alert(`欢迎回来, ${welcomeName}!`)
                }

                // 使用新用户数据登录
                userStore.login({
                    id: res.data.user.id,
                    username: res.data.user.username,
                    role: res.data.user.role,
                    avatar: res.data.user.avatar || null,
                    nickname: res.data.user.nickname || null,
                    email: res.data.user.email || null,
                    phone: res.data.user.phone || null
                })

                // 跳转到首页
                router.push('/')
            } else {
                alert(`❌ ${res.data.message || '登录失败'}`)
                // 登录失败时刷新验证码
                generateCaptcha()
            }
        } else {
            // 注册逻辑
            // 处理手机号格式（添加国家代码）
            let phoneToSend = null
            if (form.value.phone) {
                phoneToSend = `${selectedPhoneCountry.value.code} ${form.value.phone}`
            }

            // 确定要使用的账号标识
            let accountIdentifier = form.value.account
            if (!accountIdentifier && phoneToSend) {
                accountIdentifier = phoneToSend
            }

            const registerData = {
                username: accountIdentifier,
                email: validateEmail(form.value.account) ? form.value.account : null,
                phone: phoneToSend,
                password: form.value.password
            }

            // 如果有手机号，优先使用手机号作为用户名
            if (phoneToSend) {
                registerData.username = phoneToSend
            }

            const res = await axios.post('/api/register', registerData)

            if (res.data.success) {
                // 注册成功后，自动填充登录表单
                alert('🎉 注册成功！请登录')

                // 自动切换到登录模式
                toggleMode()

                // 如果有手机号，填充到登录表单
                if (phoneToSend) {
                    form.value.account = phoneToSend
                } else if (validateEmail(form.value.account)) {
                    form.value.account = form.value.account
                }
            } else {
                alert(`❌ ${res.data.message || '注册失败'}`)
            }
        }
    } catch (error) {
        console.error('请求错误详情:', error)

        if (error.response) {
            const message = error.response.data?.message || `请求失败 (${error.response.status})`
            alert(`❌ ${message}`)

            // 如果是409冲突（用户名/邮箱/手机号已存在）
            if (error.response.status === 409) {
                // 可以在这里提供更具体的提示
            }
        } else if (error.request) {
            alert('❌ 网络连接异常，请检查网络设置')
        } else {
            alert('❌ 请求发送失败')
        }

        // 错误时刷新验证码
        if (isLoginMode.value) {
            generateCaptcha()
        }
    }
}

// 检查是否是切换账号操作
const isSwitchingAccount = ref(false)

onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'

    // 检查是否是切换账号
    if (sessionStorage.getItem('isSwitchingAccount') === 'true') {
        isSwitchingAccount.value = true
    }
})
</script>

<template>
    <div class="login-page" :style="{ backgroundImage: `url(${bgUrl})` }">
        <div class="bg-overlay"></div>
        <div class="glass-container">
            <!-- 添加切换账号提示 -->
            <div v-if="isSwitchingAccount" class="switch-account-notice">
                <svg viewBox="0 0 24 24" class="notice-icon">
                    <path fill="currentColor"
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>正在切换账号...</span>
            </div>

            <div class="title-area">
                <h2 class="main-title">{{ isLoginMode ? '欢迎登录' : '创建账号' }}</h2>
                <p class="sub-title">
                    {{ isLoginMode ? '进入你的数字空间' : '开启你的探索之旅' }}
                </p>
            </div>

            <div class="form-area">
                <!-- 账号输入区域 -->
                <div class="account-input-wrapper">
                    <div class="input-group">
                        <!-- 账号输入框（用户名/邮箱/手机号） -->
                        <div class="main-input-wrapper">
                            <!-- 左侧手机国家选择（只在显示手机号输入时显示） -->
                            <div v-if="showPhoneInput" class="phone-country-prefix"
                                @click="showPhoneDropdown = !showPhoneDropdown">
                                <span class="flag">{{ selectedPhoneCountry.flag }}</span>
                                <span class="code">{{ selectedPhoneCountry.code }}</span>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" width="12" height="12">
                                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                </svg>

                                <!-- 国家选择下拉 -->
                                <div v-if="showPhoneDropdown" class="phone-country-dropdown">
                                    <div v-for="country in phoneCountries" :key="country.code" class="country-option"
                                        @click="selectPhoneCountry(country)">
                                        <span class="flag">{{ country.flag }}</span>
                                        <span class="country-name">{{ country.country }}</span>
                                        <span class="country-code">{{ country.code }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 主输入框 -->
                            <input type="text" v-model="form.account" required placeholder=" " id="account-input"
                                :placeholder="isLoginMode ? '用户名/邮箱/手机号' : '用户名/邮箱'" @input="checkInputType">
                        </div>

                        <label for="account-input">
                            {{ isLoginMode ? '账号' : '用户名/邮箱' }}
                            <span v-if="!isLoginMode" class="hint-text">（可以使用不同国家的号码进行注册）</span>
                        </label>
                        <div class="glow-bar"></div>
                        <svg class="icon" viewBox="0 0 24 24">
                            <path fill="currentColor"
                                d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM6 8a6 6 0 1 1 12 0A6 6 0 0 1 6 8zm2 10a3 3 0 0 0-3 3a1 1 0 1 1-2 0 5 5 0 0 1 5-5h8a5 5 0 0 1 5 5a1 1 0 1 1-2 0a3 3 0 0 0-3-3H8z" />
                        </svg>
                    </div>

                    <!-- 手机号输入框（当用户输入11位数字时自动显示） -->
                    <transition name="slide-fade">
                        <div v-if="showPhoneInput && !isLoginMode" class="phone-input-wrapper">
                            <div class="input-group">
                                <div class="phone-input-inner">
                                    <div class="phone-country-display">
                                        <span class="flag">{{ selectedPhoneCountry.flag }}</span>
                                        <span class="code">{{ selectedPhoneCountry.code }}</span>
                                    </div>
                                    <input type="tel" v-model="form.phone" placeholder=" " id="phone-input"
                                        :placeholder="selectedPhoneCountry.placeholder">
                                </div>
                                <label for="phone-input">手机号</label>
                                <div class="glow-bar"></div>
                            </div>
                        </div>
                    </transition>
                </div>

                <!-- 密码输入 -->
                <div class="input-group">
                    <input type="password" v-model="form.password" required placeholder=" " id="pass"
                        @keyup.enter="handleSubmit" :placeholder="isLoginMode ? '请输入密码' : '请设置密码'">
                    <label for="pass">密码</label>
                    <div class="glow-bar"></div>
                    <svg class="icon" viewBox="0 0 24 24">
                        <path fill="currentColor"
                            d="M12 17a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm-2-9V7a4 4 0 1 1 8 0v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2zm2-4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z" />
                    </svg>
                </div>

                <!-- 确认密码（仅注册模式） -->
                <transition name="slide-fade">
                    <div class="input-group" v-if="!isLoginMode">
                        <input type="password" v-model="form.confirmPassword" required placeholder=" " id="repass"
                            :placeholder="请再次输入密码">
                        <label for="repass">确认密码</label>
                        <div class="glow-bar"></div>
                        <svg class="icon" viewBox="0 0 24 24">
                            <path fill="currentColor"
                                d="M12 17a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm-2-9V7a4 4 0 1 1 8 0v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2zm2-4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z" />
                        </svg>
                    </div>
                </transition>

                <!-- 验证码输入（仅登录模式） -->
                <transition name="slide-fade">
                    <div v-if="isLoginMode" class="captcha-section">
                        <div class="input-group captcha-group">
                            <input type="text" v-model="captchaCode" required placeholder=" " id="captcha"
                                :placeholder="请输入验证码" @keyup.enter="handleSubmit" :class="{ 'error': captchaError }">
                            <label for="captcha">验证码</label>
                            <div class="glow-bar"></div>

                            <!-- 验证码显示区域 -->
                            <div class="captcha-display" @click="generateCaptcha">
                                <div class="captcha-text" :class="{ 'error': captchaError }">
                                    {{ captchaText }}
                                </div>
                                <div class="captcha-refresh">
                                    <svg viewBox="0 0 24 24" width="16" height="16">
                                        <path fill="currentColor"
                                            d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <p class="captcha-hint">点击验证码可刷新</p>
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
    width: 420px;
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

/* 账号输入区域 */
.account-input-wrapper {
    position: relative;
}

.input-group {
    position: relative;
    margin-bottom: 25px;
    width: 100%;
}

/* 主输入框容器 */
.main-input-wrapper {
    display: flex;
    width: 100%;
    position: relative;
}

/* 手机国家前缀 */
.phone-country-prefix {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    height: 100%;
    background: rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px 0 0 0;
    cursor: pointer;
    color: white;
    z-index: 2;
    min-width: 80px;
}

.phone-country-prefix .flag {
    font-size: 14px;
}

.phone-country-prefix .code {
    font-size: 13px;
    font-weight: 500;
}

.phone-country-prefix .dropdown-icon {
    margin-left: auto;
    opacity: 0.6;
}

/* 主输入框 */
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
    transition: all 0.3s;
    z-index: 1;
}

/* 当有国家前缀时调整输入框padding */
.phone-country-prefix+input {
    padding-left: 90px;
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
    top: -18px;
    left: 0;
    font-size: 0.8rem;
    color: #42b883;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

/* 提示文本 */
.hint-text {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 5px;
    font-weight: normal;
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

/* 国家选择下拉 */
.phone-country-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 5px;
}

.country-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
}

.country-option:hover {
    background: rgba(255, 255, 255, 0.1);
}

.country-option .flag {
    font-size: 16px;
    width: 24px;
    text-align: center;
}

.country-option .country-name {
    flex: 1;
    font-size: 13px;
}

.country-option .country-code {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
}

/* 手机号输入框 */
.phone-input-wrapper {
    margin-top: 10px;
}

.phone-input-inner {
    display: flex;
    align-items: center;
    width: 100%;
}

.phone-country-display {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    background: rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px 0 0 0;
    color: white;
    height: 100%;
    min-width: 80px;
}

.phone-country-display .flag {
    font-size: 14px;
}

.phone-country-display .code {
    font-size: 13px;
    font-weight: 500;
}

/* 验证码区域 */
.captcha-section {
    margin-top: 10px;
}

.captcha-group {
    position: relative;
}

/* 验证码显示区域 */
.captcha-display {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
}

.captcha-text {
    font-family: 'Courier New', monospace;
    font-size: 1.2rem;
    font-weight: bold;
    letter-spacing: 3px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #42b883;
    text-shadow: 0 0 5px rgba(66, 184, 131, 0.5);
    min-width: 80px;
    text-align: center;
    transition: all 0.3s;
}

.captcha-text.error {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.5);
    text-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
    animation: shake 0.5s ease;
}

.captcha-refresh {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.3s;
}

.captcha-display:hover .captcha-refresh {
    background: rgba(255, 255, 255, 0.2);
    color: #42b883;
    transform: rotate(90deg);
}

.captcha-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
    margin-left: 10px;
}

/* 错误状态 */
.input-group input.error {
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
}

/* 提交按钮 */
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
    margin-top: 20px;
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

/* 切换账号提示 */
.switch-account-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(66, 184, 131, 0.1);
    border: 1px solid rgba(66, 184, 131, 0.3);
    border-radius: 12px;
    padding: 10px 15px;
    margin-bottom: 15px;
    animation: pulse 2s infinite;
}

.notice-icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
    color: #42b883;
}

.switch-account-notice span {
    color: #42b883;
    font-size: 0.9rem;
    font-weight: 500;
}

/* 动画 */
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

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.7;
    }
}

@keyframes shake {

    0%,
    100% {
        transform: translateX(0);
    }

    25% {
        transform: translateX(-5px);
    }

    75% {
        transform: translateX(5px);
    }
}

/* 响应式调整 */
@media (max-width: 480px) {
    .glass-container {
        width: 90%;
        padding: 30px 20px;
    }

    .phone-country-prefix {
        min-width: 70px;
    }

    .phone-country-prefix+input {
        padding-left: 80px;
    }

    .captcha-text {
        min-width: 70px;
        font-size: 1rem;
        letter-spacing: 2px;
    }
}
</style>