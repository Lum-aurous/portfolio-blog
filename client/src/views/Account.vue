<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user.js'
import { Country, State, City } from 'country-state-city' // 🌍 导入全球地区数据库

const router = useRouter()
const userStore = useUserStore()

// 背景图状态
const bgUrl = ref('')
const activeTab = ref('personal')
const isSaving = ref(false)

// 用户数据
const user = ref({
    username: '',
    nickname: '',
    email: '',
    avatar: '',
    birthday: '',
    gender: '',
    phone: '',
    region: '',
    bio: '',
    social_link: ''
})

// 数据备份
const originalUser = ref({})

// 侧边栏菜单
const menuItems = [
    { id: 'personal', label: '个人信息', iconPath: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'security', label: '安全与登录', iconPath: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-9-2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z' },
    { id: 'data', label: '数据与隐私', iconPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z' },
    { id: 'people', label: '用户与分享', iconPath: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' }
]

// ========== 🎂 生日日历选择器 ==========
const showDatePicker = ref(false)
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedDay = ref(new Date().getDate())
const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const daysInMonth = computed(() => {
    return new Date(selectedYear.value, selectedMonth.value, 0).getDate()
})
const days = computed(() => {
    return Array.from({ length: daysInMonth.value }, (_, i) => i + 1)
})
const confirmBirthday = () => {
    user.value.birthday = `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
    showDatePicker.value = false
}

// ========== 🚻 性别下拉选择器 ==========
const showGenderDropdown = ref(false)
const genders = [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' }
]
const selectGender = (gender) => {
    user.value.gender = gender.value
    showGenderDropdown.value = false
}

// ========== 🌍 地区三级联动选择器 (真实全球数据) ==========
const showRegionPicker = ref(false)
const selectedCountryCode = ref('') // 存储国家代码 (如 'CN', 'US')
const selectedStateCode = ref('') // 存储州/省代码
const selectedCityName = ref('') // 存储城市名称
// 🌍 获取所有国家 (按中文名称排序，中国置顶)
const countries = computed(() => {
    const allCountries = Country.getAllCountries().map(country => ({
        code: country.isoCode,
        name: country.name,
        nativeName: country.native || country.name,
        flag: country.flag || '🌐'
    }))
    // 中国置顶，其他按名称排序
    const china = allCountries.find(c => c.code === 'CN')
    const others = allCountries.filter(c => c.code !== 'CN').sort((a, b) => a.name.localeCompare(b.name))

    return china ? [china, ...others] : others
})
// 🏙️ 获取选中国家的所有州/省
const states = computed(() => {
    if (!selectedCountryCode.value) return []

    const stateList = State.getStatesOfCountry(selectedCountryCode.value)
    return stateList.map(state => ({
        code: state.isoCode,
        name: state.name
    }))
})
// 🏘️ 获取选中州/省的所有城市
const cities = computed(() => {
    if (!selectedCountryCode.value || !selectedStateCode.value) return []

    const cityList = City.getCitiesOfState(selectedCountryCode.value, selectedStateCode.value)
    return cityList.map(city => ({
        name: city.name
    }))
})
// 当选择国家时，重置州和城市
const handleCountryChange = () => {
    selectedStateCode.value = ''
    selectedCityName.value = ''
}
// 当选择州时，重置城市
const handleStateChange = () => {
    selectedCityName.value = ''
}
// 确认地区选择
const confirmRegion = () => {
    if (!selectedCountryCode.value) {
        alert('请选择国家')
        return
    }

    const country = countries.value.find(c => c.code === selectedCountryCode.value)
    const state = states.value.find(s => s.code === selectedStateCode.value)

    // 构建地区字符串
    let regionStr = country.name

    if (selectedStateCode.value && state) {
        regionStr += ` - ${state.name}`
    }

    if (selectedCityName.value) {
        regionStr += ` - ${selectedCityName.value}`
    }

    user.value.region = regionStr
    showRegionPicker.value = false
}
// 打开地区选择器时，解析已有地区数据
const openRegionPicker = () => {
    showRegionPicker.value = true

    // 如果已有地区数据，尝试解析并回填
    if (user.value.region) {
        const parts = user.value.region.split(' - ')

        if (parts.length > 0) {
            // 查找国家
            const country = countries.value.find(c => c.name === parts[0])
            if (country) {
                selectedCountryCode.value = country.code

                // 如果有省/州
                if (parts.length > 1) {
                    setTimeout(() => {
                        const state = states.value.find(s => s.name === parts[1])
                        if (state) {
                            selectedStateCode.value = state.code

                            // 如果有城市
                            if (parts.length > 2) {
                                setTimeout(() => {
                                    selectedCityName.value = parts[2]
                                }, 100)
                            }
                        }
                    }, 100)
                }
            }
        }
    }
}
// ========== 📱 电话国际区号选择器 ==========
const showPhoneDropdown = ref(false)
const phoneInput = ref('')
const phoneError = ref('')
// 全球主要国家区号配置
const phoneCountries = [
    { code: '+86', country: '中国', flag: '🇨🇳', minLength: 11, maxLength: 11, pattern: /^1[3-9]\d{9}$/ },
    { code: '+1', country: '美国', flag: '🇺🇸', minLength: 10, maxLength: 10, pattern: /^\d{10}$/ },
    { code: '+81', country: '日本', flag: '🇯🇵', minLength: 10, maxLength: 11, pattern: /^[0-9]{10,11}$/ },
    { code: '+33', country: '法国', flag: '🇫🇷', minLength: 9, maxLength: 9, pattern: /^[0-9]{9}$/ },
    { code: '+44', country: '英国', flag: '🇬🇧', minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
    { code: '+82', country: '韩国', flag: '🇰🇷', minLength: 10, maxLength: 11, pattern: /^[0-9]{10,11}$/ },
    { code: '+61', country: '澳大利亚', flag: '🇦🇺', minLength: 9, maxLength: 9, pattern: /^[0-9]{9}$/ },
    { code: '+49', country: '德国', flag: '🇩🇪', minLength: 10, maxLength: 11, pattern: /^[0-9]{10,11}$/ }
]
const selectedPhoneCountry = ref(phoneCountries[0]) // 默认中国
const selectPhoneCountry = (country) => {
    selectedPhoneCountry.value = country
    showPhoneDropdown.value = false
    validatePhone()
}
const validatePhone = () => {
    const config = selectedPhoneCountry.value
    const cleanNumber = phoneInput.value.replace(/\s/g, '')

    if (!cleanNumber) {
        phoneError.value = ''
        return
    }

    if (cleanNumber.length < config.minLength) {
        phoneError.value = `号码至少需要 ${config.minLength} 位数字`
        return
    }

    if (cleanNumber.length > config.maxLength) {
        phoneError.value = `号码最多 ${config.maxLength} 位数字`
        return
    }

    if (!config.pattern.test(cleanNumber)) {
        phoneError.value = `请输入有效的${config.country}手机号码`
        return
    }

    phoneError.value = ''
    user.value.phone = `${config.code} ${cleanNumber}`
}
// 监听电话输入并实时校验
const handlePhoneInput = () => {
    validatePhone()
}
// ========== 获取用户信息 ==========
const fetchUserInfo = async () => {
    const currentUsername = userStore.user?.username || localStorage.getItem('username')
    if (!currentUsername) {
        console.warn('未找到用户名')
        return
    }
    try {
        const res = await axios.get('/api/user/profile', {
            params: { username: currentUsername }
        })
        if (res.data.success) {
            const dbUser = res.data.user
            user.value = {
                username: dbUser.username,
                nickname: dbUser.nickname || dbUser.username,
                email: dbUser.email || '',
                avatar: dbUser.avatar || '',
                birthday: dbUser.birthday || '',
                gender: dbUser.gender || '',
                phone: dbUser.phone || '',
                region: dbUser.region || '',
                bio: dbUser.bio || '',
                social_link: dbUser.social_link || ''
            }
            // 解析已存储的电话号码
            if (user.value.phone) {
                const phoneMatch = user.value.phone.match(/^(\+\d+)\s(.+)$/)
                if (phoneMatch) {
                    const code = phoneMatch[1]
                    phoneInput.value = phoneMatch[2]
                    const country = phoneCountries.find(c => c.code === code)
                    if (country) selectedPhoneCountry.value = country
                }
            }
            originalUser.value = { ...user.value }
            userStore.updateUser({
                nickname: user.value.nickname,
                email: user.value.email,
                avatar: user.value.avatar,
                region: user.value.region,
                bio: user.value.bio
            })
        }
    } catch (error) {
        console.error('获取用户信息失败', error)
    }
}
// ========== 取消修改 ==========
const handleCancel = () => {
    const hasChanges = JSON.stringify(user.value) !== JSON.stringify(originalUser.value)
    if (!hasChanges) {
        router.back()
        return
    }
    if (confirm('您有未保存的修改,确定要放弃吗?')) {
        user.value = { ...originalUser.value }
        router.back()
    }
}
// ========== 保存修改 ==========
const handlePublish = async () => {
    if (!user.value.nickname) {
        alert('昵称不能为空')
        return
    }
    if (phoneError.value) {
        alert('请修正电话号码格式')
        return
    }
    isSaving.value = true
    try {
        const res = await axios.post('/api/user/update', user.value)
        if (res.data.success) {
            alert('🎉 保存成功!数据已同步到数据库')
            const updatedData = {
                nickname: user.value.nickname,
                email: user.value.email,
                avatar: user.value.avatar,
                region: user.value.region,
                bio: user.value.bio
            }
            userStore.updateUser(updatedData)
            originalUser.value = { ...user.value }
            await userStore.refreshUserInfo()
        } else {
            alert('保存失败:' + res.data.message)
        }
    } catch (error) {
        console.error(error)
        alert('❌ 保存失败,服务器错误')
    } finally {
        isSaving.value = false
    }
}
// ========== 头像上传 ==========
const fileInput = ref(null)
const triggerUpload = () => fileInput.value.click()
const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
        // 限制图片大小为 1MB
        if (file.size > 1024 * 1024) {
            alert('图片太大啦,请上传 1MB 以内的图片')
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            user.value.avatar = e.target.result
        }
        reader.readAsDataURL(file)
    }
}
onMounted(() => {
    const savedBg = localStorage.getItem('activeWallpaperUrl')
    bgUrl.value = savedBg || 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80'
    fetchUserInfo()
})
const hasUnsavedChanges = computed(() => {
    return JSON.stringify(user.value) !== JSON.stringify(originalUser.value)
})
</script>
<template>
    <div class="account-container" :style="{ backgroundImage: `url(${bgUrl})` }">
        <!-- 统一的毛玻璃背景卡片 -->
        <div class="unified-card">
            <!-- 左侧菜单 -->
            <aside class="sidebar">
                <div class="menu">
                    <div v-for="item in menuItems" :key="item.id" class="menu-item"
                        :class="{ active: activeTab === item.id }" @click="activeTab = item.id">
                        <svg class="menu-icon" viewBox="0 0 24 24">
                            <path :d="item.iconPath" fill="currentColor" />
                        </svg>
                        <span>{{ item.label }}</span>
                    </div>
                </div>
            </aside>
            <!-- 右侧内容区 -->
            <main class="content">
                <!-- 个人信息面板 -->
                <div v-if="activeTab === 'personal'" class="panel">
                    <h2 class="panel-title">个人信息</h2>
                    <!-- 头像 -->
                    <div class="form-group">
                        <label class="label">头像 (最大1MB)</label>
                        <div class="avatar-upload">
                            <img v-if="user.avatar" :src="user.avatar" alt="头像" class="avatar-preview" />
                            <div v-else class="avatar-placeholder">
                                <svg viewBox="0 0 24 24" width="40" height="40">
                                    <path
                                        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                                        fill="currentColor" />
                                </svg>
                            </div>
                            <button @click="triggerUpload" class="upload-btn">更换头像</button>
                            <input ref="fileInput" type="file" accept="image/*" @change="handleFileChange"
                                style="display: none" />
                        </div>
                    </div>
                    <!-- 用户名(不可修改) -->
                    <div class="form-group">
                        <label class="label">用户名</label>
                        <input type="text" v-model="user.username" class="input" disabled />
                    </div>
                    <!-- 昵称 -->
                    <div class="form-group">
                        <label class="label">昵称</label>
                        <input type="text" v-model="user.nickname" class="input" placeholder="请输入昵称" />
                    </div>
                    <!-- 邮箱 -->
                    <div class="form-group">
                        <label class="label">邮箱</label>
                        <input type="email" v-model="user.email" class="input" placeholder="请输入邮箱" />
                    </div>
                    <!-- 生日(日历选择器) -->
                    <div class="form-group">
                        <label class="label">生日</label>
                        <div class="date-picker-wrapper">
                            <input type="text" v-model="user.birthday" class="input" placeholder="请选择出生日期"
                                @click="showDatePicker = true" readonly />

                            <!-- 日历弹窗 -->
                            <div v-if="showDatePicker" class="date-picker-modal" @click.self="showDatePicker = false">
                                <div class="date-picker-content">
                                    <h3>选择出生日期</h3>

                                    <div class="date-selectors">
                                        <!-- 年份选择 -->
                                        <div class="date-column">
                                            <label>年份</label>
                                            <select v-model="selectedYear" class="date-select">
                                                <option v-for="year in years" :key="year" :value="year">{{ year }}
                                                </option>
                                            </select>
                                        </div>
                                        <!-- 月份选择 -->
                                        <div class="date-column">
                                            <label>月份</label>
                                            <select v-model="selectedMonth" class="date-select">
                                                <option v-for="month in months" :key="month" :value="month">{{ month }}月
                                                </option>
                                            </select>
                                        </div>
                                        <!-- 日期选择 -->
                                        <div class="date-column">
                                            <label>日期</label>
                                            <select v-model="selectedDay" class="date-select">
                                                <option v-for="day in days" :key="day" :value="day">{{ day }}日</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="date-picker-actions">
                                        <button @click="showDatePicker = false" class="btn-cancel">取消</button>
                                        <button @click="confirmBirthday" class="btn-confirm">确定</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- 性别(下拉选择) -->
                    <div class="form-group">
                        <label class="label">性别</label>
                        <div class="dropdown-wrapper">
                            <div class="dropdown-input" @click="showGenderDropdown = !showGenderDropdown">
                                <span v-if="user.gender">{{genders.find(g => g.value === user.gender)?.label}}</span>
                                <span v-else class="placeholder">请选择性别</span>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                </svg>
                            </div>
                            <div v-if="showGenderDropdown" class="dropdown-menu">
                                <div v-for="gender in genders" :key="gender.value" class="dropdown-item"
                                    @click="selectGender(gender)">
                                    {{ gender.label }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- 电话(国际区号) -->
                    <div class="form-group">
                        <label class="label">电话</label>
                        <div class="phone-wrapper">
                            <div class="phone-code" @click="showPhoneDropdown = !showPhoneDropdown">
                                <span class="flag">{{ selectedPhoneCountry.flag }}</span>
                                <span>{{ selectedPhoneCountry.code }}</span>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                </svg>
                            </div>

                            <input type="tel" v-model="phoneInput" @input="handlePhoneInput" class="phone-input"
                                :class="{ error: phoneError }"
                                :placeholder="`请输入${selectedPhoneCountry.minLength}位号码`" />
                            <!-- 区号下拉菜单 -->
                            <div v-if="showPhoneDropdown" class="phone-dropdown">
                                <div v-for="country in phoneCountries" :key="country.code" class="phone-dropdown-item"
                                    @click="selectPhoneCountry(country)">
                                    <span class="flag">{{ country.flag }}</span>
                                    <span class="country-name">{{ country.country }}</span>
                                    <span class="country-code">{{ country.code }}</span>
                                </div>
                            </div>
                        </div>
                        <p v-if="phoneError" class="error-text">{{ phoneError }}</p>
                    </div>
                    <!-- 地区(三级联动) -->
                    <div class="form-group">
                        <label class="label">地区</label>
                        <div class="region-wrapper">
                            <input type="text" v-model="user.region" class="input" placeholder="请选择地区"
                                @click="openRegionPicker" readonly />
                            <!-- 地区选择弹窗 -->
                            <div v-if="showRegionPicker" class="region-modal" @click.self="showRegionPicker = false">
                                <div class="region-content">
                                    <h3>🌍 选择地区</h3>

                                    <div class="region-selectors">
                                        <!-- 国家 -->
                                        <div class="region-column">
                                            <label>国家/地区</label>
                                            <select v-model="selectedCountryCode" @change="handleCountryChange"
                                                class="region-select">
                                                <option value="">请选择</option>
                                                <option v-for="country in countries" :key="country.code"
                                                    :value="country.code">
                                                    {{ country.flag }} {{ country.name }}
                                                </option>
                                            </select>
                                        </div>
                                        <!-- 省/州 -->
                                        <div class="region-column">
                                            <label>省/州</label>
                                            <select v-model="selectedStateCode" @change="handleStateChange"
                                                class="region-select"
                                                :disabled="!selectedCountryCode || states.length === 0">
                                                <option value="">请选择</option>
                                                <option v-for="state in states" :key="state.code" :value="state.code">
                                                    {{ state.name }}
                                                </option>
                                            </select>
                                            <p v-if="selectedCountryCode && states.length === 0" class="no-data-hint">
                                                该国家暂无省/州数据</p>
                                        </div>
                                        <!-- 市/县 -->
                                        <div class="region-column">
                                            <label>市/县</label>
                                            <select v-model="selectedCityName" class="region-select"
                                                :disabled="!selectedStateCode || cities.length === 0">
                                                <option value="">请选择</option>
                                                <option v-for="city in cities" :key="city.name" :value="city.name">
                                                    {{ city.name }}
                                                </option>
                                            </select>
                                            <p v-if="selectedStateCode && cities.length === 0" class="no-data-hint">
                                                该地区暂无城市数据</p>
                                        </div>
                                    </div>
                                    <div class="region-actions">
                                        <button @click="showRegionPicker = false" class="btn-cancel">取消</button>
                                        <button @click="confirmRegion" class="btn-confirm"
                                            :disabled="!selectedCountryCode">确定</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- 自我介绍 -->
                    <div class="form-group">
                        <label class="label">自我介绍</label>
                        <textarea v-model="user.bio" class="textarea" placeholder="介绍一下你自己吧" rows="4"></textarea>
                    </div>
                    <!-- 社交媒体链接 -->
                    <div class="form-group">
                        <label class="label">社交媒体链接</label>
                        <input type="url" v-model="user.social_link" class="input" placeholder="https://..." />
                    </div>
                    <!-- 底部按钮 -->
                    <div class="actions">
                        <button @click="handleCancel" class="btn-secondary">取消</button>
                        <button @click="handlePublish" class="btn-primary" :disabled="isSaving || !hasUnsavedChanges">
                            {{ isSaving ? '保存中...' : '保存修改' }}
                        </button>
                    </div>
                </div>
                <!-- 其他标签页(占位) -->
                <div v-else class="panel">
                    <h2 class="panel-title">{{menuItems.find(m => m.id === activeTab)?.label}}</h2>
                    <p style="color: rgba(255,255,255,0.6);">该功能正在开发中...</p>
                </div>
            </main>
        </div>
    </div>
</template>
<style scoped>
.account-container {
    min-height: calc(100vh - 80px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
    padding: 40px 20px;
    margin-top: 80px;
}

/* 🎨 统一的毛玻璃背景卡片 */
.unified-card {
    display: flex;
    width: 100%;
    max-width: 1200px;
    /* 缩小最大宽度，更紧凑 */
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    gap: 0;
}

/* 侧边栏 */
.sidebar {
    width: 260px;
    /* 稍微增加宽度 */
    flex-shrink: 0;
    padding: 20px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin-bottom: 8px;
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.3s;
}

.menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.menu-item.active {
    background: rgba(255, 255, 255, 0.2);
    color: white;
}

.menu-icon {
    width: 20px;
    height: 20px;
    margin-right: 12px;
}

/* 内容区 */
.content {
    flex: 1;
    padding: 40px 50px;
    /* 增加左右内边距 */
    display: flex;
    flex-direction: column;
    align-items: center;
    /* 水平居中内容 */
}

.panel {
    width: 100%;
    /* 占满容器宽度 */
    max-width: 600px;
    /* 限制内容最大宽度 */
}

.panel-title {
    font-size: 28px;
    font-weight: 600;
    color: white;
    margin-bottom: 30px;
}

/* 表单 */
.form-group {
    margin-bottom: 24px;
}

.label {
    display: block;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 8px;
    font-weight: 500;
}

.input,
.textarea {
    width: 100%;
    /* 占满父容器 */
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 15px;
    transition: all 0.3s;
}

.input:focus,
.textarea:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.2);
}

.input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.textarea {
    resize: vertical;
    min-height: 100px;
}

/* 头像上传 */
.avatar-upload {
    display: flex;
    align-items: center;
    gap: 20px;
}

.avatar-preview,
.avatar-placeholder {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(255, 255, 255, 0.3);
}

.avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
}

.upload-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.3s;
}

.upload-btn:hover {
    background: rgba(255, 255, 255, 0.3);
}

/* 日期选择器包装 */
.date-picker-wrapper {
    max-width: 500px;
    /* 限制最大宽度 */
}

.date-picker-wrapper .input {
    max-width: 100%;
    /* 继承父容器宽度 */
}

.date-picker-modal,
.region-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.date-picker-content,
.region-content {
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 30px;
    min-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.date-picker-content h3,
.region-content h3 {
    color: white;
    margin-bottom: 24px;
    font-size: 20px;
}

.date-selectors,
.region-selectors {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.date-column,
.region-column {
    flex: 1;
}

.date-column label,
.region-column label {
    display: block;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    margin-bottom: 8px;
}

.date-select,
.region-select {
    width: 100%;
    padding: 10px;
    background: rgba(50, 50, 50, 0.95);
    /* 深色背景，确保可读 */
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    /* 白色文字 */
    font-size: 14px;
    cursor: pointer;
}

/* 🔥 修复 select 下拉选项的显示问题 */
.date-select option,
.region-select option {
    background: rgba(30, 30, 30, 0.98);
    /* 深色背景 */
    color: white;
    /* 白色文字 */
    padding: 10px;
}

/* hover 效果 */
.date-select option:hover,
.region-select option:hover {
    background: rgba(100, 100, 100, 0.9);
}

.date-select:disabled,
.region-select:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* 无数据提示 */
.no-data-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 6px;
    font-style: italic;
}

.date-picker-actions,
.region-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
}

.btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
}

.btn-confirm {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-confirm:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* 下拉选择器 */
.dropdown-wrapper {
    position: relative;
    width: 100%;
    /* 占满父容器 */
}

.dropdown-input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    cursor: pointer;
    color: white;
    transition: all 0.3s;
}

.dropdown-input:hover {
    background: rgba(255, 255, 255, 0.2);
}

.placeholder {
    color: rgba(255, 255, 255, 0.5);
}

.dropdown-icon {
    transition: transform 0.3s;
}

.dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 100;
    overflow: hidden;
}

.dropdown-item {
    padding: 12px 16px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
}

.dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* 电话输入 */
.phone-wrapper {
    display: flex;
    gap: 8px;
    position: relative;
    width: 100%;
    /* 占满父容器 */
}

.phone-code {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    cursor: pointer;
    color: white;
    white-space: nowrap;
    transition: all 0.3s;
}

.phone-code:hover {
    background: rgba(255, 255, 255, 0.2);
}

.flag {
    font-size: 20px;
}

.phone-input {
    flex: 1;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 15px;
    transition: all 0.3s;
}

.phone-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.2);
}

.phone-input.error {
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
}

.error-text {
    color: #ff6b6b;
    font-size: 13px;
    margin-top: 6px;
}

.phone-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 300px;
    max-height: 300px;
    overflow-y: auto;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 100;
}

.phone-dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
}

.phone-dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.country-name {
    flex: 1;
}

.country-code {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
}

/* 底部按钮 */
.actions {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
    /* 确保按钮区域占满宽度 */
}

.btn-primary,
.btn-secondary {
    padding: 12px 32px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    transition: all 0.3s;
}

.btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 768px) {
    .account-container {
        padding: 20px 10px;
        margin-top: 70px;
    }

    .unified-card {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .content {
        padding: 20px;
    }

    .date-picker-content,
    .region-content {
        min-width: auto;
        width: 90%;
        padding: 20px;
    }

    .date-selectors,
    .region-selectors {
        flex-direction: column;
    }

    .phone-wrapper {
        flex-direction: column;
    }

    .phone-code {
        width: 100%;
        justify-content: center;
    }
}
</style>