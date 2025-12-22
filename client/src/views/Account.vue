<script setup>
import { ref, onMounted, computed, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.js'
import { Country, State, City } from 'country-state-city'
import { message } from '@/utils/message.js'
import { api } from '@/utils/api'

const router = useRouter()
const route = useRoute() // 
const userStore = useUserStore()

const activeTab = ref('personal')
const isSaving = ref(false)

// 用户数据
const user = ref({
    id: null,
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
    {
        id: 'personal',
        label: '个人信息',
        iconPath: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
    },
    {
        id: 'security',
        label: '安全与登录',
        iconPath: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z'
    },
    {
        id: 'data',
        label: '数据与隐私',
        iconPath: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'
    },
    {
        id: 'people',
        label: '用户与分享',
        iconPath: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'
    }
]

// 核心逻辑：根据 URL 参数自动切换 Tab
const handleTabSwitch = () => {
    // 如果 URL 里的 tab=privacy，自动切换到 ID 为 'data' 的面板
    if (route.query.tab === 'privacy') {
        activeTab.value = 'data'
        console.log('🛡️ 已根据导航指令切换至数据与隐私面板')
    }
}

const avatarSrc = computed(() => {
    if (!user.value.avatar) return ''
    if (user.value.avatar.startsWith('data:image') || user.value.avatar.startsWith('http')) return user.value.avatar
    return user.value.avatar
})

// ========== 🎂 生日日历选择器 ==========
const showDatePicker = ref(false)
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedDay = ref(new Date().getDate())

const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)

const daysInMonth = computed(() => new Date(selectedYear.value, selectedMonth.value, 0).getDate())
const days = computed(() => Array.from({ length: daysInMonth.value }, (_, i) => i + 1))

const confirmBirthday = () => {
    user.value.birthday = `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
    showDatePicker.value = false
}

// ========== 🚻 性别下拉选择器 ==========
const showGenderDropdown = ref(false)
const genders = [
    { value: '男', label: '男' },
    { value: '女', label: '女' },
    { value: '不展示', label: '不展示' }
]
const selectGender = (gender) => {
    user.value.gender = gender.value
    showGenderDropdown.value = false
}

// ========== 🌍 地区三级联动选择器 ==========
const showRegionPicker = ref(false)
const selectedCountryCode = ref('')
const selectedStateCode = ref('')
const selectedCityName = ref('')

const countries = computed(() => {
    const allCountries = Country.getAllCountries().map(country => ({
        code: country.isoCode,
        name: country.name,
        flag: country.flag || '🌐'
    }))
    const china = allCountries.find(c => c.code === 'CN')
    const others = allCountries.filter(c => c.code !== 'CN').sort((a, b) => a.name.localeCompare(b.name))
    return china ? [china, ...others] : others
})

const states = computed(() => {
    if (!selectedCountryCode.value) return []
    return State.getStatesOfCountry(selectedCountryCode.value).map(state => ({
        code: state.isoCode,
        name: state.name
    }))
})

const cities = computed(() => {
    if (!selectedCountryCode.value || !selectedStateCode.value) return []
    return City.getCitiesOfState(selectedCountryCode.value, selectedStateCode.value).map(city => ({
        name: city.name
    }))
})

const handleCountryChange = () => {
    selectedStateCode.value = ''
    selectedCityName.value = ''
}
const handleStateChange = () => { selectedCityName.value = '' }

const confirmRegion = () => {
    if (!selectedCountryCode.value) {
        message.warning('请先选择一个国家')
        return
    }
    const country = countries.value.find(c => c.code === selectedCountryCode.value)
    const state = states.value.find(s => s.code === selectedStateCode.value)
    let regionStr = country.name
    if (selectedStateCode.value && state) regionStr += ` - ${state.name}`
    if (selectedCityName.value) regionStr += ` - ${selectedCityName.value}`
    user.value.region = regionStr
    showRegionPicker.value = false
}

const openRegionPicker = () => {
    showRegionPicker.value = true
    if (user.value.region) {
        const parts = user.value.region.split(' - ')
        if (parts.length > 0) {
            const country = countries.value.find(c => c.name === parts[0])
            if (country) {
                selectedCountryCode.value = country.code
                if (parts.length > 1) {
                    setTimeout(() => {
                        const state = states.value.find(s => s.name === parts[1])
                        if (state) {
                            selectedStateCode.value = state.code
                            if (parts.length > 2) {
                                setTimeout(() => { selectedCityName.value = parts[2] }, 100)
                            }
                        }
                    }, 100)
                }
            }
        }
    }
}

// ========== 📱 电话选择器 ==========
const showPhoneDropdown = ref(false)
const phoneInput = ref('')
const phoneError = ref('')
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
const selectedPhoneCountry = ref(phoneCountries[0])

const selectPhoneCountry = (country) => {
    selectedPhoneCountry.value = country
    showPhoneDropdown.value = false
    validatePhone()
}

const validatePhone = () => {
    const config = selectedPhoneCountry.value
    const cleanNumber = phoneInput.value.replace(/\s/g, '')
    if (!cleanNumber) { phoneError.value = ''; return }
    if (cleanNumber.length < config.minLength || cleanNumber.length > config.maxLength) {
        phoneError.value = `号码需 ${config.minLength}-${config.maxLength} 位`
        return
    }
    if (!config.pattern.test(cleanNumber)) {
        phoneError.value = `格式不正确`
        return
    }
    phoneError.value = ''
    user.value.phone = `${config.code} ${cleanNumber}`
}
const handlePhoneInput = () => validatePhone()

// ========== API 交互 ==========
const fetchUserInfo = async () => {
    console.log('🔍 开始获取用户信息...')

    // 直接从 store 获取当前用户
    const currentUsername = userStore.user?.username

    if (!currentUsername) {
        console.warn('❌ 未找到用户名，尝试刷新用户信息...')
        await userStore.refreshUserInfo()

        if (!userStore.user?.username) {
            message.warning('请先登录')
            router.push('/login')
            return
        }
    }

    // 使用 store 中的用户名
    const username = userStore.user.username
    console.log('✅ 使用的用户名:', username)

    try {
        console.log('📡 请求用户信息 API，用户名:', username)

        // ✅ 使用封装的 api 方法
        const res = await api.get('/user/profile', {
            params: { username }
        })

        console.log('📦 API 响应:', res.data)
        const responseData = res.data

        if (responseData.success && responseData.data) {
            const dbUser = responseData.data
            console.log('🗂️ 数据库用户数据:', dbUser)

            // 更新用户数据
            Object.assign(user.value, {
                id: dbUser.id || '',
                username: dbUser.username || '',
                nickname: dbUser.nickname || dbUser.username || '',
                email: dbUser.email || '',
                avatar: dbUser.avatar || '',
                birthday: dbUser.birthday || '',
                gender: dbUser.gender || '',
                phone: dbUser.phone || '',
                region: dbUser.region || '',
                bio: dbUser.bio || '',
                social_link: dbUser.social_link || ''
            })

            console.log('✅ 用户数据更新完成:', user.value)

            // 处理电话号码回显逻辑
            if (user.value.phone) {
                console.log('📱 处理电话号码:', user.value.phone)
                const phoneMatch = user.value.phone.match(/^(\+\d+)\s(.+)$/)
                if (phoneMatch) {
                    const code = phoneMatch[1]
                    phoneInput.value = phoneMatch[2]
                    const country = phoneCountries.find(c => c.code === code)
                    if (country) {
                        selectedPhoneCountry.value = country
                        console.log('✅ 设置国家区号:', country)
                    }
                } else {
                    // 如果是纯数字手机号
                    phoneInput.value = user.value.phone
                    selectedPhoneCountry.value = phoneCountries.find(c => c.code === '+86')
                }
            }

            // 备份原始数据
            originalUser.value = JSON.parse(JSON.stringify(user.value))
            console.log('📝 原始数据备份完成')

            // 更新 store
            userStore.updateUser(user.value)
            console.log('🔄 Store 更新完成')
        } else {
            console.error('API 返回数据格式错误:', responseData)
            message.error('获取用户信息失败：' + (responseData.message || '未知错误'))
        }
    } catch (error) {
        console.error('❌ 获取用户信息失败:', error)
        // api 已经处理了错误，这里只需要处理特殊情况
        if (error.response && error.response.status === 404) {
            message.error('用户信息不存在')
        }
    }
}

const validateForm = () => {
    const errors = []

    // 1. 昵称验证
    if (!user.value.nickname || user.value.nickname.trim() === '') {
        errors.push('昵称不能为空')
    }

    // 2. 用户名验证
    if (!user.value.username || user.value.username.length < 3) {
        errors.push('用户名长度至少需要3位')
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(user.value.username)) {
        errors.push('用户名只能包含字母、数字和下划线')
    }

    // 3. 邮箱验证
    if (user.value.email && user.value.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(user.value.email)) {
            errors.push('邮箱格式不正确')
        }
    }

    // 4. 电话验证
    if (phoneError.value) {
        errors.push('电话号码格式不正确')
    }

    // 5. 网址验证
    if (user.value.social_link && user.value.social_link.trim() !== '') {
        try {
            new URL(user.value.social_link)
        } catch {
            errors.push('社交媒体链接格式不正确')
        }
    }

    return errors
}

// 提交保存逻辑
const handlePublish = async () => {
    console.log('📝 开始提交用户信息...')

    // 表单验证
    const errors = validateForm()
    if (errors.length > 0) {
        message.warning(errors[0])
        return
    }

    isSaving.value = true


    // 1. 基础校验
    if (!user.value.nickname || user.value.nickname.trim() === '') {
        message.warning('昵称不能为空哦～')
        return
    }

    if (!user.value.username || user.value.username.length < 3) {
        message.warning('用户名长度至少需要3位')
        return
    }

    // 检查用户名格式（只能包含字母、数字、下划线）
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(user.value.username)) {
        message.warning('用户名只能包含字母、数字和下划线')
        return
    }

    // 邮箱格式验证（如果填写了邮箱）
    if (user.value.email && user.value.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(user.value.email)) {
            message.warning('邮箱格式不正确')
            return
        }
    }

    // 手机号验证
    if (phoneError.value) {
        message.warning('请检查电话号码格式')
        return
    }

    isSaving.value = true

    // 2. 构建提交数据 - 确保格式正确
    const payload = {
        id: user.value.id,
        username: user.value.username,
        nickname: user.value.nickname,
        // 如果邮箱是空字符串，发送 null
        email: user.value.email && user.value.email.trim() !== '' ? user.value.email.trim() : null,
        // 手机号同样处理
        phone: user.value.phone && user.value.phone.trim() !== '' ? user.value.phone.trim() : null,
        gender: user.value.gender || null,
        birthday: user.value.birthday || null,
        bio: user.value.bio && user.value.bio.trim() !== '' ? user.value.bio.trim() : null,
        social_link: user.value.social_link && user.value.social_link.trim() !== '' ? user.value.social_link.trim() : null,
        region: user.value.region || null,
    }

    console.log('📦 提交的数据:', JSON.stringify(payload, null, 2))

    // 头像处理
    if (user.value.avatar && user.value.avatar.startsWith('data:image')) {
        payload.avatar = user.value.avatar
    } else if (user.value.avatar) {
        // 如果是URL，保持原样
        payload.avatar = user.value.avatar
    }

    try {
        console.log('📡 提交到 /user/update')
        const res = await api.post('/user/update', payload)

        const responseData = res.data
        console.log('✅ 服务器响应:', responseData)

        if (responseData.success) {
            message.success('🎉 保存成功! 数据已同步')

            // 🔥🔥🔥 核心修复开始 🔥🔥🔥
            // 1. 获取后端返回的最新完整用户对象
            const newUserInfo = responseData.data;

            // 如果后端返回了新 Token，立即更新
            if (newUserInfo.token) {
                console.log('🔐 收到新 Token，正在更新...');
                // 1. 更新 Pinia Store 中的 Token
                userStore.setToken(newUserInfo.token);
                // 2. 更新 LocalStorage 中的 Token (setToken 方法里其实已经做了，但为了保险可以显式写一下)
                localStorage.setItem('token', newUserInfo.token);

                // ⚠️ 注意：不要把 token 存进 user 对象里，虽然存了也没大碍，但保持数据纯净比较好
                // 删除 newUserInfo 里的 token 字段后再更新用户状态
                delete newUserInfo.token;
            }

            // 2. 强制更新本地视图数据
            Object.assign(user.value, newUserInfo);

            // 3. 立即更新 Pinia Store (这一步会修复 Navbar 头像消失的问题)
            userStore.updateUser(newUserInfo);
            // 补充：确保 store 里的 token 对应的 user 也是新的
            if (userStore.user) {
                userStore.user = { ...userStore.user, ...newUserInfo };
            }

            // 4. 💀 强制更新 LocalStorage (这一步修复刷新后 404 的问题)
            // 必须保存完整的 user 对象字符串
            localStorage.setItem('user', JSON.stringify(newUserInfo));
            // 必须更新单独的 username 字段
            localStorage.setItem('username', newUserInfo.username);

            // 5. 更新原始数据备份 (防止"未保存修改"弹窗误报)
            originalUser.value = JSON.parse(JSON.stringify(user.value));

            console.log(`🔄 本地缓存已强制更新为: ${newUserInfo.username}`);
            // 🔥🔥🔥 核心修复结束 🔥🔥🔥

        } else {
            console.error('❌ 保存失败，服务器返回:', responseData)
            message.error('保存失败: ' + (responseData.message || '未知错误'))
        }
    } catch (error) {
        console.error('❌ 提交失败详情:', error)

        // 根据不同的错误类型提供更具体的提示
        if (error.response) {
            const status = error.response.status
            const errorData = error.response.data

            console.error('服务器错误详情:', errorData)

            switch (status) {
                case 400:
                    // 验证错误
                    if (errorData.message?.includes('邮箱') || errorData.message?.includes('email')) {
                        message.error('邮箱格式不正确')
                    } else if (errorData.message?.includes('用户名') || errorData.message?.includes('username')) {
                        message.error('用户名格式不正确或已存在')
                    } else if (errorData.message) {
                        message.error('验证失败: ' + errorData.message)
                    } else {
                        message.error('输入数据有误，请检查填写内容')
                    }
                    break
                case 401:
                    message.error('登录已过期，请重新登录')
                    setTimeout(() => {
                        router.push('/login')
                    }, 1500)
                    break
                case 403:
                    message.error('没有权限修改用户信息')
                    break
                case 404:
                    message.error('用户不存在')
                    break
                case 409:
                    message.error('用户名已存在')
                    break
                case 413:
                    message.error('头像文件太大了')
                    break
                case 500:
                    message.error('服务器内部错误，请稍后重试')
                    break
                default:
                    message.error('保存失败，请稍后重试')
            }
        } else if (error.request) {
            // 请求已发送但无响应
            console.error('请求无响应:', error.request)
            message.error('网络连接失败，请检查网络')
        } else {
            // 请求配置出错
            console.error('请求配置错误:', error.message)
            message.error('请求配置出错: ' + error.message)
        }
    } finally {
        isSaving.value = false
    }
}

const fileInput = ref(null)
const triggerUpload = () => fileInput.value.click()
const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
        if (file.size > 1024 * 1024) {
            message.warning('图片太大了，请上传 1MB 以内的图片')
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => { user.value.avatar = e.target.result }
        reader.readAsDataURL(file)
    }
}

const formFields = [
    'username', 'nickname', 'email', 'avatar',
    'birthday', 'gender', 'phone', 'region',
    'bio', 'social_link'
];

// 在 computed 中添加安全访问
const hasUnsavedChanges = computed(() => {
    if (!user.value || !originalUser.value) return false;

    // 只对比 formFields 列表中的字段
    return formFields.some(field => {
        const current = user.value[field] || ''; // 处理 null/undefined 为空串
        const original = originalUser.value[field] || '';
        return String(current) !== String(original);
    });
});

/**
 * 场景 A: 顶部返回箭头按钮调用
 * 意图：离开当前页面
 */
const goBack = () => {
    // 只有当数据真的有变动时，才弹窗询问
    if (hasUnsavedChanges.value) {
        if (confirm('您有尚未保存的修改，确定要放弃修改并返回吗?')) {
            router.back();
        }
    } else {
        // 如果数据已保存或未变动，直接静默返回
        router.back();
    }
}

/**
 * 场景 B: 底部“放弃修改”按钮调用
 * 意图：清空本次编辑的内容，回退到初始状态，但不离开页面
 */
const resetForm = () => {
    if (hasUnsavedChanges.value) {
        if (confirm('确定要重置所有修改吗？该操作无法撤销。')) {
            // 使用备份数据覆盖当前数据（深拷贝防止引用污染）
            user.value = JSON.parse(JSON.stringify(originalUser.value));

            // 如果涉及到电话号码组件，记得同步重置其内部状态
            if (user.value.phone) {
                const phoneMatch = user.value.phone.match(/^(\+\d+)\s(.+)$/);
                if (phoneMatch) {
                    phoneInput.value = phoneMatch[2];
                    const country = phoneCountries.find(c => c.code === phoneMatch[1]);
                    if (country) selectedPhoneCountry.value = country;
                }
            } else {
                phoneInput.value = '';
            }

            message.info('表单已重置');
        }
    }
}

const closeAllDropdowns = () => {
    showGenderDropdown.value = false
    showPhoneDropdown.value = false
}


// 修改 watch，添加 null 检查
watch(() => userStore.user, (newUser) => {
    console.log('👤 用户状态变化:', newUser)
    if (newUser && newUser.username) {
        // 只有当有新的用户名时才重新获取
        if (newUser.username !== user.value.username) {
            fetchUserInfo()
        }
    } else {
        console.log('⚠️ 用户信息为空')
    }
}, { immediate: true, deep: true })

// ========== 🔐 安全与登录逻辑 (新增) ==========
const passwordData = ref({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
});

const isChangingPassword = ref(false);

// 判断密码表单是否有改动
const hasPasswordChanges = computed(() => {
    return passwordData.value.oldPassword !== '' ||
        passwordData.value.newPassword !== '' ||
        passwordData.value.confirmPassword !== '';
});

// 重置密码表单
const resetPasswordForm = () => {
    passwordData.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
};

// 提交修改密码
const handleChangePassword = async () => {
    // 1. 前端基础校验
    if (!passwordData.value.oldPassword) return message.warning('请输入原密码');
    if (passwordData.value.newPassword.length < 6) return message.warning('新密码至少6位');
    if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
        return message.warning('两次输入的新密码不一致');
    }
    if (passwordData.value.oldPassword === passwordData.value.newPassword) {
        return message.warning('新密码不能与原密码相同');
    }

    isChangingPassword.value = true;
    try {
        const res = await api.post('/user/update-password', {
            oldPassword: passwordData.value.oldPassword,
            newPassword: passwordData.value.newPassword
        });

        if (res.data.success) {
            message.success('🎉 密码修改成功！为了安全，请重新登录');
            resetPasswordForm();

            // 延时跳转到登录页，让用户看清提示
            setTimeout(() => {
                userStore.logout(); // 清除本地token和状态
                router.push('/login');
            }, 1500);
        }
    } catch (error) {
        // 错误已经在 api.js 拦截处理了，这里可以做特定 UI 响应
    } finally {
        isChangingPassword.value = false;
    }
};

// ========== 🛡️ 数据与隐私逻辑 (新增) ==========
const isExporting = ref(false);
const isDeleting = ref(false);

const handleExportData = async () => {
    isExporting.value = true
    try {
        const res = await api.get('/user/export-data', { responseType: 'blob' })
        const blob = new Blob([res.data], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `Veritas_Data_${userStore.user.username}_${new Date().toISOString().split('T')[0]}.json`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        message.success('数据导出成功！')
    } catch (err) {
        message.error('导出失败，请重试')
    } finally {
        isExporting.value = false
    }
}

// 2. 注销账户逻辑
const handleDeleteAccount = async () => {
    // 第一次确认
    if (!confirm('🚨 警告：注销后您的所有资料及设置将被永久删除且无法恢复。确定要继续吗？')) return;

    // 第二次确认（防止误触）
    const confirmName = prompt('请输入您的用户名以确认注销账户：');
    if (confirmName !== user.value.username) {
        return message.warning('验证失败，操作已取消');
    }

    isDeleting.value = true;
    try {
        const res = await api.delete('/user/account');
        if (res.data.success) {
            message.success('👋 账号已注销，感谢您的陪伴');
            userStore.logout();
            router.push('/');
        }
    } catch (error) {
        // 报错由拦截器处理
    } finally {
        isDeleting.value = false;
    }
};

// ========== 🤝 用户与分享逻辑 (新增) ==========
const shareUrl = computed(() => {
    // 假设你的个人资料页面路径是 /user/:username
    const origin = window.location.origin;
    return `${origin}/blog?author=${user.value.username}`;
});

// 复制链接功能
const handleCopyLink = async () => {
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        message.success('🔗 个人主页链接已复制到剪贴板');
    } catch (err) {
        // 降级处理：手动选中文本
        const input = document.createElement('input');
        input.value = shareUrl.value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        message.success('🔗 链接已复制');
    }
};

const siteStats = ref({
    articleCount: 0,
    categoryCount: 0,
    totalViews: 0
})

const fetchSiteStats = async () => {
    try {
        const res = await api.get('/blog/stats')
        if (res.data.success) {
            siteStats.value = res.data.data
        }
    } catch (error) {
        console.error('获取统计失败', error)
    }
}

// 监听路由变化，防止用户在页面内多次点击“你的数据”不刷新
watch(() => route.query.tab, () => {
    handleTabSwitch()
})

onMounted(async () => {
    try {
        // 添加延迟，确保路由完全加载
        await new Promise(resolve => setTimeout(resolve, 100))

        // 检查用户状态
        if (!userStore.user || !userStore.user.username) {
            // 尝试从本地存储恢复
            const storedUsername = localStorage.getItem('username')
            if (storedUsername) {
                console.log('从本地存储恢复用户名:', storedUsername)
                userStore.setUsername(storedUsername)
            } else {
                // 如果没有用户信息，跳转到登录页
                console.warn('未找到用户信息，跳转到登录页')
                router.push('/login')
                return
            }
        }

        // 获取用户信息
        await fetchUserInfo()

    } catch (error) {
        console.error('Account页面初始化失败:', error)
        // 如果是网络错误，可能是扩展引起的
        if (error.message.includes('Failed to fetch') ||
            error.message.includes('adblock')) {
            console.warn('忽略扩展相关的网络错误')
            // 继续尝试获取用户信息
            await fetchUserInfo()
        } else {
            message.error('页面加载失败，请刷新重试')
        }
    }
    window.addEventListener('click', closeAllDropdowns)
    fetchSiteStats()
    handleTabSwitch()
})

onUnmounted(() => {
    window.removeEventListener('click', closeAllDropdowns)
})
</script>

<template>
    <div class="account-container">
        <div class="unified-card">
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

            <main class="content">
                <div v-if="activeTab === 'personal'" class="panel">
                    <div class="panel-header">
                        <button class="back-btn" @click="goBack" title="返回上一页">
                            <svg viewBox="0 0 24 24" class="back-icon">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                                    fill="currentColor" />
                            </svg>
                        </button>
                        <h2 class="panel-title">个人信息</h2>
                    </div>

                    <div class="form-group">
                        <label class="label">头像 (最大1MB)</label>
                        <div class="avatar-upload">
                            <img v-if="avatarSrc" :src="avatarSrc" alt="头像" class="avatar-preview" />
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

                    <div class="form-group">
                        <label class="label">
                            用户名
                            <span class="hint">(可修改，3-50位，字母、数字、下划线)</span>
                        </label>
                        <input type="text" v-model="user.username" class="input"
                            :placeholder="user.username || '加载中...'" />
                        <p class="tip" v-if="user.username && originalUser.username !== user.username">
                            ⚠️ 注意：修改用户名会影响个人主页地址
                        </p>
                    </div>

                    <div class="form-group">
                        <label class="label">昵称</label>
                        <input type="text" v-model="user.nickname" class="input" placeholder="请输入昵称" />
                    </div>

                    <div class="form-group">
                        <label class="label">邮箱</label>
                        <input type="email" v-model="user.email" class="input" placeholder="请输入邮箱" />
                    </div>



                    <div class="form-group">
                        <label class="label">生日</label>
                        <div class="date-picker-wrapper">
                            <input type="text" v-model="user.birthday" class="input" placeholder="请选择出生日期"
                                @click="showDatePicker = true" readonly />
                            <div v-if="showDatePicker" class="date-picker-modal" @click.self="showDatePicker = false">
                                <div class="date-picker-content">
                                    <h3>选择出生日期</h3>
                                    <div class="date-selectors">
                                        <div class="date-column">
                                            <label>年份</label>
                                            <select v-model="selectedYear" class="date-select">
                                                <option v-for="year in years" :key="year" :value="year">{{ year }}
                                                </option>
                                            </select>
                                        </div>
                                        <div class="date-column">
                                            <label>月份</label>
                                            <select v-model="selectedMonth" class="date-select">
                                                <option v-for="month in months" :key="month" :value="month">{{ month }}月
                                                </option>
                                            </select>
                                        </div>
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

                    <div class="form-group">
                        <label class="label">性别</label>
                        <div class="dropdown-wrapper">
                            <div class="dropdown-input" @click.stop="showGenderDropdown = !showGenderDropdown">
                                <span v-if="user.gender">{{genders.find(g => g.value === user.gender)?.label}}</span>
                                <span v-else class="placeholder">请选择性别</span>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" width="20" height="20">
                                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                </svg>
                            </div>
                            <div v-if="showGenderDropdown" class="dropdown-menu" @click.stop>
                                <div v-for="gender in genders" :key="gender.value" class="dropdown-item"
                                    @click="selectGender(gender); showGenderDropdown = false"> {{ gender.label }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="label">电话</label>
                        <div class="phone-wrapper">
                            <div class="phone-code" @click.stop="showPhoneDropdown = !showPhoneDropdown">
                                <span class="flag">{{ selectedPhoneCountry.flag }}</span>
                                <span>{{ selectedPhoneCountry.code }}</span>
                                <svg class="dropdown-icon" viewBox="0 0 24 24" width="16" height="16">
                                    <path d="M7 10l5 5 5-5z" fill="currentColor" />
                                </svg>
                            </div>

                            <input type="tel" v-model="phoneInput" @input="handlePhoneInput" class="phone-input"
                                :class="{ error: phoneError }"
                                :placeholder="`请输入${selectedPhoneCountry.minLength}位号码`" />

                            <div v-if="showPhoneDropdown" class="phone-dropdown" @click.stop>
                                <div v-for="country in phoneCountries" :key="country.code" class="phone-dropdown-item"
                                    @click="selectPhoneCountry(country)"> <span class="flag">{{ country.flag }}</span>
                                    <span class="country-name">{{ country.country }}</span>
                                    <span class="country-code">{{ country.code }}</span>
                                </div>
                            </div>
                        </div>
                        <p v-if="phoneError" class="error-text">{{ phoneError }}</p>
                    </div>

                    <div class="form-group">
                        <label class="label">地区</label>
                        <div class="region-wrapper">
                            <input type="text" v-model="user.region" class="input" placeholder="请选择地区"
                                @click="openRegionPicker" readonly />
                            <div v-if="showRegionPicker" class="region-modal" @click.self="showRegionPicker = false">
                                <div class="region-content">
                                    <h3>🌍 选择地区</h3>
                                    <div class="region-selectors">
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
                                        </div>
                                        <div class="region-column">
                                            <label>市/县</label>
                                            <select v-model="selectedCityName" class="region-select"
                                                :disabled="!selectedStateCode || cities.length === 0">
                                                <option value="">请选择</option>
                                                <option v-for="city in cities" :key="city.name" :value="city.name">
                                                    {{ city.name }}
                                                </option>
                                            </select>
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

                    <div class="form-group">
                        <label class="label">自我介绍</label>
                        <textarea v-model="user.bio" class="textarea" placeholder="介绍一下你自己吧" rows="4"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="label">社交媒体链接</label>
                        <input type="url" v-model="user.social_link" class="input" placeholder="https://..." />
                    </div>

                    <div class="actions">
                        <button @click="resetForm" class="btn-secondary" :disabled="!hasUnsavedChanges">
                            放弃修改
                        </button>

                        <button @click="handlePublish" class="btn-primary" :disabled="isSaving || !hasUnsavedChanges">
                            {{ isSaving ? '保存中...' : '保存修改' }}
                        </button>
                    </div>
                </div>

                <div v-else-if="activeTab === 'security'" class="panel animate__animated animate__fadeIn">
                    <div class="panel-header">
                        <button class="back-btn" @click="goBack">
                            <svg viewBox="0 0 24 24" class="back-icon">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                                    fill="currentColor" />
                            </svg>
                        </button>
                        <h2 class="panel-title">安全与登录</h2>
                    </div>

                    <div class="security-section">
                        <h3 class="section-subtitle">修改账户密码</h3>

                        <div class="form-group">
                            <label class="label">原密码</label>
                            <input type="password" v-model="passwordData.oldPassword" class="input"
                                placeholder="输入当前使用的密码" />
                        </div>

                        <div class="form-group">
                            <label class="label">新密码</label>
                            <input type="password" v-model="passwordData.newPassword" class="input"
                                placeholder="设置新的登录密码 (至少6位)" />
                        </div>

                        <div class="form-group">
                            <label class="label">确认新密码</label>
                            <input type="password" v-model="passwordData.confirmPassword" class="input"
                                placeholder="再次输入新密码" />
                        </div>

                        <div class="actions">
                            <button @click="resetPasswordForm" class="btn-secondary" :disabled="!hasPasswordChanges">
                                重置表单
                            </button>
                            <button @click="handleChangePassword" class="btn-primary"
                                :disabled="isChangingPassword || !hasPasswordChanges">
                                {{ isChangingPassword ? '提交中...' : '更新密码' }}
                            </button>
                        </div>
                    </div>

                    <div class="security-info-box">
                        <p class="tip">💡 安全建议：请勿在多个网站使用相同的密码，并定期更换密码以保障账户安全。</p>
                    </div>
                </div>

                <div v-else-if="activeTab === 'data'" class="panel animate__animated animate__fadeIn">
                    <div class="panel-header">
                        <button class="back-btn" @click="goBack">
                            <svg viewBox="0 0 24 24" class="back-icon">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                                    fill="currentColor" />
                            </svg>
                        </button>
                        <h2 class="panel-title">数据与隐私</h2>
                    </div>

                    <div class="privacy-section">
                        <h3 class="section-subtitle">个人数据副本</h3>
                        <p class="section-desc">您可以下载一份您在 Veritas 博客上的所有个人信息、设置和活动历史记录。数据将以 JSON 格式提供。</p>
                        <button @click="handleExportData" class="btn-secondary" :disabled="isExporting">
                            {{ isExporting ? '打包中...' : '📦 导出我的所有数据' }}
                        </button>
                    </div>

                    <div class="divider"></div>

                    <div class="privacy-section danger-zone">
                        <h3 class="section-subtitle danger">注销您的账户</h3>
                        <p class="section-desc">一旦您注销了账户，将无法撤回。该账户的所有内容、个性化壁纸及评论标识将被移除。</p>
                        <button @click="handleDeleteAccount" class="btn-danger" :disabled="isDeleting">
                            {{ isDeleting ? '正在注销...' : '删除账户' }}
                        </button>
                    </div>
                </div>

                <div v-else-if="activeTab === 'people'" class="panel animate__animated animate__fadeIn">
                    <div class="panel-header">
                        <button class="back-btn" @click="goBack">
                            <svg viewBox="0 0 24 24" class="back-icon">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                                    fill="currentColor" />
                            </svg>
                        </button>
                        <h2 class="panel-title">用户与分享</h2>
                    </div>

                    <div class="share-section">
                        <h3 class="section-subtitle">个性化数字名片</h3>
                        <p class="section-desc">这是其他用户在博客页看到您的真实样子：</p>

                        <div class="card-preview-container">
                            <div class="sidebar-card profile-card-crystal mini-preview">
                                <div class="profile-bg-illustration">
                                    <img src="https://w.wallhaven.cc/full/5g/wallhaven-5gjgj8.jpg" class="illus-img"
                                        alt="bg">
                                </div>

                                <div class="profile-avatar-wrapper">
                                    <img :src="avatarSrc" alt="Avatar" class="avatar-img" v-if="avatarSrc">
                                    <div class="avatar-placeholder-mini" v-else>👤</div>
                                </div>

                                <div class="profile-info-text">
                                    <h2 class="profile-name">{{ user.nickname || user.username }}</h2>
                                </div>

                                <div class="profile-stats-grid">
                                    <div class="stat-col">
                                        <div class="stat-label-row"><span class="stat-icon">📖</span><span
                                                class="stat-label">文章</span></div>
                                        <div class="stat-num">{{ siteStats.articleCount }}</div>
                                    </div>
                                    <div class="stat-col">
                                        <div class="stat-label-row"><span class="stat-icon">🗂️</span><span
                                                class="stat-label">分类</span></div>
                                        <div class="stat-num">{{ siteStats.categoryCount }}</div>
                                    </div>
                                    <div class="stat-col">
                                        <div class="stat-label-row"><span class="stat-icon">🔥</span><span
                                                class="stat-label">访问量</span></div>
                                        <div class="stat-num">{{ siteStats.totalViews }}</div>
                                    </div>
                                </div>

                                <div class="profile-action-btn">
                                    <button class="friend-btn-crystal">
                                        <span class="icon-star">☆</span> 友链
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="share-section">
                        <h3 class="section-subtitle">分享我的博客</h3>
                        <p class="section-desc">通过唯一链接让朋友们快速找到你的文章和足迹。</p>

                        <div class="share-link-wrapper">
                            <div class="link-display">{{ shareUrl }}</div>
                            <button @click="handleCopyLink" class="copy-link-btn">复制链接</button>
                        </div>
                    </div>

                    <div class="share-section">
                        <h3 class="section-subtitle">社交链接管理</h3>
                        <p class="section-desc">在这里配置您的社交账号（如 GitHub、CSDN等）。</p>

                        <div class="social-input-group">
                            <div class="input-with-icon">
                                <span class="input-prefix">🔗</span>
                                <input type="url" v-model="user.social_link" class="input"
                                    placeholder="请输入您的社交主页完整链接 (https://...)" />
                            </div>

                            <div class="social-actions-row">
                                <span class="status-hint" v-if="user.social_link">
                                    <i class="icon-check">✅</i> 已准备好展示
                                </span>
                                <span class="status-hint warning" v-else>
                                    <i class="icon-info">ℹ️</i> 当前未设置链接，首页将隐藏此入口
                                </span>

                                <button @click="handlePublish" class="btn-primary-sm"
                                    :disabled="isSaving || !hasUnsavedChanges">
                                    {{ isSaving ? '同步中...' : '同步到数据库' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
/* ==================== 1. 布局容器 ==================== */
.account-container {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    padding-top: 60px;
    box-sizing: border-box;
}

.unified-card {
    display: flex;
    width: 90%;
    max-width: 1200px;
    height: 85%;
    max-height: 800px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
}

/* ==================== 2. 侧边栏 ==================== */
.sidebar {
    width: 260px;
    flex-shrink: 0;
    padding: 30px 20px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.1);
}

.menu-item {
    display: flex;
    align-items: center;
    padding: 14px 18px;
    margin-bottom: 8px;
    border-radius: 12px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.3s ease;
    font-weight: 500;
}

.menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    transform: translateX(5px);
}

.menu-item.active {
    background: linear-gradient(90deg, rgba(66, 184, 131, 0.2), rgba(66, 184, 131, 0.05));
    color: #42b883;
    border-left: 3px solid #42b883;
}

.menu-icon {
    width: 22px;
    height: 22px;
    margin-right: 12px;
}

/* ==================== 3. 内容区域 ==================== */
.content {
    flex: 1;
    height: 100%;
    overflow-y: auto;
    padding: 40px 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    scroll-behavior: smooth;
}

.content::-webkit-scrollbar {
    width: 8px;
}

.content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
}

.content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    transition: background 0.3s;
}

.content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
}

.panel {
    width: 100%;
    max-width: 650px;
    padding-bottom: 40px;
}

.panel-header {
    display: flex;
    align-items: center;
    margin-bottom: 30px;
    position: relative;
}

.panel-title {
    font-size: 28px;
    font-weight: 700;
    color: white;
    margin-bottom: 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.section-subtitle {
    color: #42b883;
    font-size: 18px;
    margin-bottom: 20px;
    padding-left: 5px;
    border-left: 4px solid #42b883;
}

.section-subtitle.danger {
    color: #ff5f56;
    border-left-color: #ff5f56;
}

.section-desc {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 20px;
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
    margin: 20px 0;
}

/* ==================== 4. 返回按钮 ==================== */
.back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    margin-right: 20px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
}

.back-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateX(-3px);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
}

.back-btn:active {
    transform: scale(0.95);
}

.back-icon {
    width: 24px;
    height: 24px;
    fill: currentColor;
}

/* ==================== 5. 表单通用样式 ==================== */
.form-group {
    margin-bottom: 28px;
}

.label {
    display: block;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: normal;
    margin-left: 8px;
}

.tip {
    font-size: 12px;
    color: #ff9800;
    margin-top: 5px;
    padding-left: 5px;
}

.input,
.textarea {
    width: 100%;
    padding: 14px 18px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    font-size: 15px;
    transition: all 0.3s;
    box-sizing: border-box;
}

.input:focus,
.textarea:focus {
    outline: none;
    border-color: #42b883;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.05);
}

.textarea {
    resize: vertical;
    min-height: 120px;
}

/* ==================== 6. 头像上传 ==================== */
.avatar-upload {
    display: flex;
    align-items: center;
    gap: 24px;
}

.avatar-preview,
.avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
}

.upload-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
}

.upload-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}

/* ==================== 7. 下拉框与特殊输入框 ==================== */
.dropdown-wrapper,
.phone-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    gap: 12px;
}

.dropdown-input,
.phone-code,
.phone-input {
    padding: 14px 18px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: white;
    font-size: 15px;
    transition: all 0.3s;
    box-sizing: border-box;
}

.dropdown-input:hover,
.phone-code:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.2);
    cursor: pointer;
}

.phone-input:focus {
    outline: none;
    border-color: #42b883;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 3px rgba(66, 184, 131, 0.1);
}

.dropdown-input {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.phone-code {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 110px;
}

.phone-input {
    flex: 1;
}

.phone-input.error {
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
}

.dropdown-menu,
.phone-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 100%;
    max-height: 240px;
    overflow-y: auto;
    background: #2c2c2c;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
}

.dropdown-item,
.phone-dropdown-item {
    padding: 12px 18px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: center;
    transition: background 0.2s;
}

.dropdown-item:hover,
.phone-dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.country-name {
    flex: 1;
}

.country-code {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
}

.error-text {
    color: #ff6b6b;
    font-size: 13px;
    margin-top: 8px;
    padding-left: 4px;
}

.placeholder {
    color: rgba(255, 255, 255, 0.3);
}

.dropdown-icon {
    opacity: 0.7;
}

/* ==================== 8. 弹窗样式 ==================== */
.date-picker-modal,
.region-modal {
    position: fixed;
    z-index: 9999;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
    display: flex;
    justify-content: center;
    align-items: center;
}

.date-picker-content,
.region-content {
    background: #2c2c2c;
    padding: 30px;
    border-radius: 16px;
    min-width: 420px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.date-picker-content h3,
.region-content h3 {
    color: white;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 1px;
    text-align: center;
    margin-bottom: 24px;
}

.date-selectors,
.region-selectors {
    display: flex;
    gap: 12px;
    margin-bottom: 30px;
}

.date-column,
.region-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.date-column label,
.region-column label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    padding-left: 4px;
}

.date-select,
.region-select {
    width: 100%;
    padding: 10px;
    background: #444;
    color: white;
    border: 1px solid transparent;
    border-radius: 8px;
    outline: none;
    cursor: pointer;
    transition: all 0.2s;
}

.date-select:hover,
.region-select:hover {
    background: #505050;
}

.date-select:disabled,
.region-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ==================== 9. 按钮样式 ==================== */
.actions {
    display: flex;
    gap: 20px;
    justify-content: flex-end;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.date-picker-actions,
.region-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.btn-primary,
.btn-secondary,
.btn-confirm,
.btn-cancel {
    height: 42px;
    padding: 0 24px;
    border-radius: 12px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.5px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
}

.btn-primary,
.btn-confirm {
    background: linear-gradient(135deg, #42b883 0%, #33a06f 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(66, 184, 131, 0.3);
}

.btn-primary:hover,
.btn-confirm:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(66, 184, 131, 0.4);
    filter: brightness(1.1);
}

.btn-secondary,
.btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.btn-secondary:hover,
.btn-cancel:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
}

.btn-primary:disabled,
.btn-confirm:disabled,
.btn-secondary:disabled,
.btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: rgba(128, 128, 128, 0.2);
    color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
    transform: none;
    border-color: transparent;
    filter: none;
}

.btn-danger {
    height: 42px;
    padding: 0 24px;
    border-radius: 12px;
    background: #ff5f56;
    color: white;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(255, 95, 86, 0.3);
}

.btn-danger:hover {
    background: #ff473d;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 95, 86, 0.4);
}

.btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ==================== 10. 安全与登录 ==================== */
.security-info-box {
    margin-top: 40px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
}

.security-info-box .tip {
    margin: 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    line-height: 1.6;
}

.danger-zone {
    margin-top: 20px;
    padding: 25px;
    background: rgba(255, 95, 86, 0.05);
    border: 1px solid rgba(255, 95, 86, 0.2);
    border-radius: 12px;
}

/* ==================== 11. 用户与分享 ==================== */
.card-preview-container {
    padding: 40px;
    background: rgba(15, 23, 42, 0.4);
    border-radius: 20px;
    display: flex;
    justify-content: center;
    margin-bottom: 30px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.mini-preview {
    width: 280px !important;
    background: linear-gradient(0deg, #d9f4f0 0%, #f6fcfb 100%) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15) !important;
    border: 1px solid rgba(255, 255, 255, 0.8) !important;
    overflow: hidden;
    margin-bottom: 0 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    text-align: center;
}

.mini-preview .profile-bg-illustration {
    width: 100%;
    height: 110px;
    overflow: hidden;
    clip-path: ellipse(130% 100% at 50% 0%);
}

.mini-preview .profile-avatar-wrapper {
    width: 70px;
    height: 70px;
    margin: -35px auto 10px;
    border-radius: 50%;
    padding: 2px;
    background: #fff;
    position: relative;
    z-index: 2;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.mini-preview .profile-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2c3e50 !important;
    margin: 5px 0 15px;
}

.mini-preview .profile-stats-grid {
    display: flex;
    justify-content: space-around;
    padding: 0 15px;
    margin-bottom: 20px;
}

.mini-preview .stat-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.mini-preview .stat-label-row {
    font-size: 0.8rem;
    color: #666 !important;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
}

.mini-preview .stat-num {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333 !important;
}

.mini-preview .profile-action-btn {
    padding: 0 25px 25px;
}

.mini-preview .friend-btn-crystal {
    width: 100%;
    height: 40px;
    background: #48cbb6 !important;
    border: none !important;
    border-radius: 50px !important;
    color: white !important;
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 5px 15px rgba(72, 203, 182, 0.3) !important;
}

.mini-preview .friend-btn-crystal .icon-star {
    font-size: 1.1rem;
}

.illus-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.profile-avatar-wrapper {
    width: 70px;
    height: 70px;
    margin: -35px auto 10px;
    border-radius: 50%;
    padding: 2px;
    background: #fff;
    position: relative;
    z-index: 2;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.profile-name {
    font-size: 1.4rem;
    font-weight: 700;
    color: #2c3e50;
    margin: 5px 0 15px;
}

.profile-stats-grid {
    display: flex;
    justify-content: space-around;
    padding: 0 15px;
    margin-bottom: 20px;
}

.stat-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.stat-label-row {
    font-size: 0.75rem;
    color: #666;
    display: flex;
    align-items: center;
    gap: 3px;
}

.stat-num {
    font-size: 1.1rem;
    font-weight: 700;
    color: #333;
}

.profile-action-btn {
    padding: 0 25px 20px;
}

.share-link-wrapper {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.link-display {
    flex: 1;
    padding: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.copy-link-btn {
    background: #42b883;
    color: white;
    border: none;
    padding: 0 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.3s;
}

.copy-link-btn:hover {
    background: #3aa876;
}

.social-input-group {
    background: rgba(255, 255, 255, 0.05);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.input-with-icon {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 15px;
}

.input-prefix {
    padding: 0 15px;
    font-size: 18px;
}

.input-with-icon .input {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
}

.social-actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.status-hint {
    font-size: 13px;
    color: #42b883;
    display: flex;
    align-items: center;
    gap: 5px;
}

.status-hint.warning {
    color: rgba(255, 255, 255, 0.4);
}

.btn-primary-sm {
    height: 34px;
    padding: 0 15px;
    font-size: 12px;
    background: #42b883;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
}

.btn-primary-sm:hover:not(:disabled) {
    background: #3aa876;
    transform: translateY(-1px);
}

/* ==================== 12. 移动端适配 ==================== */
@media (max-width: 768px) {
    .account-container {
        padding-top: 60px;
    }

    .unified-card {
        width: 100%;
        height: 100%;
        max-height: none;
        border-radius: 0;
        flex-direction: column;
        background: transparent;
    }

    .sidebar {
        width: 100%;
        padding: 10px;
        display: flex;
        overflow-x: auto;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        border-right: none;
        background: rgba(0, 0, 0, 0.3);
    }

    .menu {
        display: flex;
        gap: 10px;
        width: 100%;
    }

    .menu-item {
        white-space: nowrap;
        margin-bottom: 0;
        padding: 8px 12px;
        font-size: 14px;
    }

    .content {
        padding: 20px;
    }

    .date-picker-content,
    .region-content {
        min-width: 90%;
        padding: 20px;
    }

    .panel-header {
        margin-bottom: 20px;
    }

    .panel-title {
        font-size: 24px;
    }

    .back-btn {
        width: 36px;
        height: 36px;
        margin-right: 15px;
    }
}
</style>