<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import { useWallpaperStore } from '@/stores/wallpaper'
import Clock from '@/components/Clock.vue'
import logger from '@/utils/logger'

const userStore = useUserStore()
const wallpaperStore = useWallpaperStore()

// ==================== 基础状态 ====================
const isSettingsOpen = ref(false)
const fileInput = ref(null)

// 时钟设置
const showSeconds = ref(false)
const showLunar = ref(true)
const use12Hour = ref(true)

// 搜索相关状态
const searchQuery = ref('')
const selectedEngineName = ref('Bing')
const showEngineDropdown = ref(false)

// 🔥 新增：切换反馈状态
const isSwitchingWallpaper = ref(false)

// ==================== 计算属性 ====================
const hasUserCustomWallpaper = computed(() => wallpaperStore.userHasCustom)

// 🔥 优化：壁纸模式切换（即时响应）
const wallpaperSource = computed({
    get: () => wallpaperStore.wallpaperMode,
    set: (value) => {
        // 防抖：防止快速连续点击
        if (isSwitchingWallpaper.value) return;

        isSwitchingWallpaper.value = true;

        // 🔥 立即切换
        wallpaperStore.changeWallpaper(value).finally(() => {
            setTimeout(() => {
                isSwitchingWallpaper.value = false;
            }, 300);
        });
    }
})

const wallpaperBlur = computed({
    get: () => wallpaperStore.wallpaperBlur,
    set: (value) => wallpaperStore.wallpaperBlur = value
})

const wallpaperMask = computed({
    get: () => wallpaperStore.wallpaperMask,
    set: (value) => wallpaperStore.wallpaperMask = value
})

// ==================== 壁纸相关方法 ====================
const triggerCustomWallpaper = () => {
    if (!userStore.isLoggedIn) {
        alert('请先登录才能上传自定义壁纸哦～')
        return
    }
    fileInput.value?.click()
}

const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) {
        logger.warn('没有选择文件')
        return
    }

    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件哦～')
        return
    }

    try {
        logger.upload('开始上传文件', file.name)
        const result = await wallpaperStore.uploadUserWallpaper(file)
        if (result.success) {
            alert('🎉 壁纸上传成功！')
        }
    } catch (error) {
        logger.error('上传失败:', error)
        alert('上传失败: ' + error.message)
    } finally {
        e.target.value = ''
    }
}

// ==================== 搜索相关方法 ====================
const searchEngines = [
    { name: 'Bing', url: 'https://www.bing.com/search?q=', viewBox: '0 0 1024 1024', iconPath: 'M917.077333 447.061333c0-0.256 0.170667-0.512 0.170667-0.768-0.085333-1.152-0.938667-2.048-1.194667-3.157333a20.992 20.992 0 0 0-2.602666-6.826667c-0.853333-1.28-2.048-2.133333-3.157334-3.2-1.194667-1.152-2.005333-2.645333-3.456-3.498666-0.64-0.384-1.408-0.256-2.090666-0.597334-0.554667-0.256-0.853333-0.853333-1.450667-1.066666l-469.333333-170.666667a21.205333 21.205333 0 0 0-27.050667 27.946667l85.333333 213.333333a21.162667 21.162667 0 0 0 11.946667 11.904l137.429333 54.4-390.826666 217.130667 105.6-105.6A21.162667 21.162667 0 0 0 362.666667 661.333333v-554.666666a21.290667 21.290667 0 0 0-13.397334-19.797334l-213.333333-85.333333A21.376 21.376 0 0 0 106.666667 21.333333v853.333334c0 0.597333 0.469333 1.066667 0.512 1.664a20.650667 20.650667 0 0 0 2.858666 9.344c0.725333 1.194667 1.92 1.92 2.858667 2.944 1.365333 1.450667 2.389333 3.242667 4.138667 4.266666l213.333333 128a21.418667 21.418667 0 0 0 22.144-0.042666l554.666667-341.333334a21.333333 21.333333 0 0 0 10.154666-18.176v-213.333333c0-0.341333-0.213333-0.597333-0.256-0.938667z' },
    { name: 'Google', url: 'https://www.google.com/search?q=', viewBox: '0 0 24 24', iconPath: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333 .533 12S5.867 24 12.48 24c3.44 0 6.013-1.133 8.053-3.24 2.107-2.107 2.773-5.227 2.773-7.92 0-.787-.067-1.453-.16-1.92h-10.667z' },
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=', viewBox: '0 0 1024 1024', iconPath: 'M184.081688 539.606474c111.325025-23.971136 95.969849-157.134634 92.813507-186.224162-5.459618-44.78593-58.264362-123.182633-129.836543-116.86995-89.998392 7.933508-103.135598 138.196583-103.135598 138.196584-12.241487 60.141106 29.089528 188.783357 140.158634 164.854874m206.655076-223.503116c61.420704 0 111.069106-70.804422 111.069105-158.243618 0-87.012664-49.477789-157.817086-110.898492-157.817086S279.539698 70.420543 279.539698 157.859739s49.904322 158.243618 111.325025 158.243619m264.748825 10.45005c82.320804 11.089849 134.869628-76.77588 145.532945-143.314975 10.663317-66.112563-42.653266-143.314975-100.661709-156.537488-58.434975-13.478432-130.518995 79.932221-137.77005 140.755779-7.677588 74.643216 10.663317 148.8599 92.557588 159.395257M981.185931 438.688845c0-31.819337-26.146452-127.661226-124.121006-127.661226-97.889246 0-111.325025 90.424925-111.325025 154.404824 0 60.994171 5.033085 145.874171 127.32 143.314976 121.775076-2.985729 108.467257-138.196583 108.467257-170.186534M857.491458 717.470595s-127.32-98.529045-201.579337-204.735679c-100.661709-156.836061-243.763418-92.984121-291.492423-13.478432-47.771658 80.316101-121.988342 130.604302-132.438392 144.04008-10.663317 13.222513-153.551759 90.424925-121.732423 231.180704 31.98995 140.755779 143.314975 138.196583 143.314976 138.196584s81.894272 8.104121 177.437588-13.222513 177.437588 5.118392 177.437588 5.118392 222.095558 74.643216 283.558916-68.671759c60.738251-143.741508-34.549146-217.958191-34.549146-217.958191' },
    { name: 'GitHub', url: 'https://github.com/search?q=', viewBox: '0 0 24 24', iconPath: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' }
]

const currentEngine = computed(() => searchEngines.find(e => e.name === selectedEngineName.value) || searchEngines[0])

const toggleDropdown = () => { showEngineDropdown.value = !showEngineDropdown.value }
const selectEngine = (name) => {
    selectedEngineName.value = name
    showEngineDropdown.value = false
}

const handleSearch = () => {
    if (searchQuery.value.trim()) {
        window.location.href = currentEngine.value.url + encodeURIComponent(searchQuery.value)
        searchQuery.value = ''
    }
}

// ==================== 快捷链接 ====================
const shortcutLinks = [
    {
        name: 'GitHub', url: 'https://github.com', viewBox: '0 0 1049 1024', paths: [
            { d: 'M524.979332 0C234.676191 0 0 234.676191 0 524.979332c0 232.068678 150.366597 428.501342 358.967656 498.035028 26.075132 5.215026 35.636014-11.299224 35.636014-25.205961 0-12.168395-0.869171-53.888607-0.869171-97.347161-146.020741 31.290159-176.441729-62.580318-176.441729-62.580318-23.467619-60.841976-58.234462-76.487055-58.234463-76.487055-47.804409-32.15933 3.476684-32.15933 3.476685-32.15933 53.019436 3.476684 80.83291 53.888607 80.83291 53.888607 46.935238 79.963739 122.553122 57.365291 152.97411 43.458554 4.345855-33.897672 18.252593-57.365291 33.028501-70.402857-116.468925-12.168395-239.022047-57.365291-239.022047-259.012982 0-57.365291 20.860106-104.300529 53.888607-140.805715-5.215026-13.037566-23.467619-66.926173 5.215027-139.067372 0 0 44.327725-13.906737 144.282399 53.888607 41.720212-11.299224 86.917108-17.383422 131.244833-17.383422s89.524621 6.084198 131.244833 17.383422C756.178839 203.386032 800.506564 217.29277 800.506564 217.29277c28.682646 72.1412 10.430053 126.029806 5.215026 139.067372 33.897672 36.505185 53.888607 83.440424 53.888607 140.805715 0 201.64769-122.553122 245.975415-239.891218 259.012982 19.121764 16.514251 35.636014 47.804409 35.636015 97.347161 0 70.402857-0.869171 126.898978-0.869172 144.282399 0 13.906737 9.560882 30.420988 35.636015 25.205961 208.601059-69.533686 358.967656-265.96635 358.967655-498.035028C1049.958663 234.676191 814.413301 0 524.979332 0z', fill: 'currentColor' },
            { d: 'M199.040177 753.571326c-0.869171 2.607513-5.215026 3.476684-8.691711 1.738342s-6.084198-5.215026-4.345855-7.82254c0.869171-2.607513 5.215026-3.476684 8.691711-1.738342s5.215026 5.215026 4.345855 7.82254z m-6.953369-4.345856M219.900283 777.038945c-2.607513 2.607513-7.82254 0.869171-10.430053-2.607514-3.476684-3.476684-4.345855-8.691711-1.738342-11.299224 2.607513-2.607513 6.953369-0.869171 10.430053 2.607514 3.476684 4.345855 4.345855 9.560882 1.738342 11.299224z m-5.215026-5.215027M240.760389 807.459932c-3.476684 2.607513-8.691711 0-11.299224-4.345855-3.476684-4.345855-3.476684-10.430053 0-12.168395 3.476684-2.607513 8.691711 0 11.299224 4.345855 3.476684 4.345855 3.476684 9.560882 0 12.168395z m0 0M269.443034 837.011749c-2.607513 3.476684-8.691711 2.607513-13.906737-1.738342-4.345855-4.345855-6.084198-10.430053-2.607513-13.037566 2.607513-3.476684 8.691711-2.607513 13.906737 1.738342 4.345855 3.476684 5.215026 9.560882 2.607513 13.037566z m0 0M308.555733 853.526c-0.869171 4.345855-6.953369 6.084198-13.037566 4.345855-6.084198-1.738342-9.560882-6.953369-8.691711-10.430053 0.869171-4.345855 6.953369-6.084198 13.037566-4.345855 6.084198 1.738342 9.560882 6.084198 8.691711 10.430053z m0 0M351.145116 857.002684c0 4.345855-5.215026 7.82254-11.299224 7.82254-6.084198 0-11.299224-3.476684-11.299224-7.82254s5.215026-7.82254 11.299224-7.82254c6.084198 0 11.299224 3.476684 11.299224 7.82254z m0 0M391.126986 850.049315c0.869171 4.345855-3.476684 8.691711-9.560882 9.560882-6.084198 0.869171-11.299224-1.738342-12.168395-6.084197-0.869171-4.345855 3.476684-8.691711 9.560881-9.560882 6.084198-0.869171 11.299224 1.738342 12.168396 6.084197z m0 0', fill: 'currentColor' }
        ]
    },
    { name: 'X', url: 'https://twitter.com', viewBox: '0 0 1024 1024', paths: [{ d: 'M761.759375 122h132.320625L605 452.4003125 945.08 902H678.8L470.24 629.3196875 231.599375 902H99.2l309.1996875-353.4L82.16 122h273.0403125l188.52 249.24z m-46.4390625 700.8h73.32L315.359375 197.0403125h-78.680625z', fill: 'currentColor' }] },
    { name: 'YouTube', url: 'https://youtube.com', viewBox: '0 0 1024 1024', paths: [{ d: 'M426.666667 682.666667V384l256 149.845333L426.666667 682.666667z m587.093333-355.541334s-10.026667-71.04-40.704-102.357333c-38.954667-41.088-82.602667-41.258667-102.613333-43.648C727.168 170.666667 512.213333 170.666667 512.213333 170.666667h-0.426666s-214.954667 0-358.229334 10.453333c-20.053333 2.389333-63.658667 2.56-102.656 43.648-30.677333 31.317333-40.661333 102.4-40.661333 102.4S0 410.538667 0 493.952v78.293333c0 83.456 10.24 166.912 10.24 166.912s9.984 71.04 40.661333 102.357334c38.997333 41.088 90.154667 39.765333 112.938667 44.074666C245.76 893.568 512 896 512 896s215.168-0.341333 358.442667-10.752c20.053333-2.432 63.658667-2.602667 102.613333-43.690667 30.72-31.317333 40.704-102.4 40.704-102.4s10.24-83.413333 10.24-166.869333v-78.250667c0-83.456-10.24-166.912-10.24-166.912z', fill: '#FF0000' }] },
    { name: 'Instagram', url: 'https://instagram.com', viewBox: '0 0 1024 1024', paths: [{ d: 'M1020.416 301.568a373.76 373.76 0 0 0-24.064-124.416 240.128 240.128 0 0 0-58.368-91.136A250.368 250.368 0 0 0 847.36 27.648a374.784 374.784 0 0 0-123.904-24.064C668.672 0 651.264 0 512 0 373.76 0 358.4 0 301.568 3.072a373.76 373.76 0 0 0-123.904 24.064 249.344 249.344 0 0 0-91.136 58.88A250.368 250.368 0 0 0 27.648 176.64a374.784 374.784 0 0 0-24.064 123.904C0 355.84 0 373.248 0 512s0 156.672 3.072 210.944a373.76 373.76 0 0 0 24.064 124.416 249.856 249.856 0 0 0 59.392 90.624 250.368 250.368 0 0 0 90.112 58.88 375.296 375.296 0 0 0 124.416 24.064C358.4 1024 373.248 1024 512 1024s156.672 0 210.944-3.072a373.76 373.76 0 0 0 124.416-24.064 262.656 262.656 0 0 0 149.504-149.504 374.784 374.784 0 0 0 24.064-124.416c0-54.784 3.072-72.192 3.072-210.944s0-153.6-3.584-210.432z', fill: 'currentColor' }, { d: 'M786.432 238.592m-61.44 0a61.44 61.44 0 1 0 122.88 0 61.44 61.44 0 1 0-122.88 0Z', fill: 'currentColor' }, { d: 'M512 248.832A263.168 263.168 0 1 0 776.192 512 263.168 263.168 0 0 0 512 248.832z m0 433.664A170.496 170.496 0 1 1 683.52 512 170.496 170.496 0 0 1 512 682.496z', fill: 'currentColor' }] },
    { name: 'Spotify', url: 'https://open.spotify.com', viewBox: '0 0 1024 1024', paths: [{ d: 'M512 0C230.4 0 0 230.4 0 512s230.4 512 512 512 512-230.4 512-512S796.16 0 512 0z', fill: '#1ED75F' }, { d: 'M747.52 739.84c-10.24 15.36-28.16 20.48-43.52 10.24-120.32-74.24-271.36-89.6-450.56-48.64-17.92 5.12-33.28-7.68-38.4-23.04-5.12-17.92 7.68-33.28 23.04-38.4 194.56-43.52 363.52-25.6 496.64 56.32 17.92 7.68 20.48 28.16 12.8 43.52z m61.44-140.8c-12.8 17.92-35.84 25.6-53.76 12.8-138.24-84.48-348.16-110.08-509.44-58.88-20.48 5.12-43.52-5.12-48.64-25.6-5.12-20.48 5.12-43.52 25.6-48.64 186.88-56.32 417.28-28.16 576 69.12 15.36 7.68 23.04 33.28 10.24 51.2z m5.12-143.36C650.24 358.4 376.32 348.16 220.16 396.8c-25.6 7.68-51.2-7.68-58.88-30.72-7.68-25.6 7.68-51.2 30.72-58.88 181.76-53.76 481.28-43.52 670.72 69.12 23.04 12.8 30.72 43.52 17.92 66.56-12.8 17.92-43.52 25.6-66.56 12.8z', fill: '#ffffff' }] },
    { name: '更多', url: '#', viewBox: '0 0 1024 1024', paths: [{ d: 'M62 401.8V167.73c0-44.02 35.69-79.71 79.71-79.71h234.07c44.02 0 79.71 35.69 79.71 79.71V401.8c0 44.02-35.69 79.71-79.71 79.71H141.71C97.69 481.52 62 445.83 62 401.8z', fill: '#FF4F4F' }, { d: 'M62 856.27V622.2c0-44.02 35.69-79.71 79.71-79.71h234.07c44.02 0 79.71 35.69 79.71 79.71v234.2c0 43.95-35.63 79.58-79.58 79.58h-234.2c-44.02 0-79.71-35.69-79.71-79.71z', fill: '#FFBC55' }, { d: 'M509.02 401.8V167.73c0-44.02 35.69-79.71 79.71-79.71H822.8c44.02 0 79.71 35.69 79.71 79.71V401.8c0 44.02-35.69 79.71-79.71 79.71H588.73c-44.02 0.01-79.71-35.68-79.71-79.71z', fill: '#1AADF9' }, { d: 'M705.77 542.48c-108.66 0-196.75 88.09-196.75 196.75s88.09 196.75 196.75 196.75c53.61 0 102.1-21.58 137.59-56.36l61.13 39.36a37.107 37.107 0 0 0 20.16 5.94c12.28 0 24.28-6.04 31.43-17.12 11.14-17.33 6.15-40.43-11.18-51.57l-59.11-38.06c10.64-24.2 16.75-50.82 16.75-78.95-0.02-108.65-88.11-196.74-196.77-196.74', fill: '#4381F1' }] }
]

// ==================== 生命周期优化 ====================

onMounted(() => {
    logger.info('🏠 Home 页面初始化')

    // 🔥 修复：移除这里的初始化调用
    // 只在第一次访问页面时检查壁纸状态，但不要重新初始化
    if (!wallpaperStore.currentWallpaper) {
        logger.warn('Home: 当前无壁纸，尝试从 App.vue 恢复')
        // 不要调用 initialize()，等待 App.vue 的初始化
    }

    // 🔥 检查壁纸状态
    console.log('Home 壁纸状态:', {
        currentWallpaper: wallpaperStore.currentWallpaper,
        wallpaperMode: wallpaperStore.wallpaperMode,
        isInitialized: wallpaperStore.isInitialized,
        isLoading: wallpaperStore.isLoading
    })
})

onUnmounted(() => {
    logger.info('🏠 Home 页面卸载')
})

// 🔥 监听壁纸变化（仅用于日志）
watch(() => wallpaperStore.currentWallpaper, (newVal) => {
    if (newVal) {
        logger.debug('Home: 壁纸已更新')
    }
})

// 🔥 新增：监听壁纸初始化状态
watch(() => wallpaperStore.isInitialized, (initialized) => {
    if (initialized) {
        console.log('✅ Home: 壁纸系统已初始化')
    }
})
</script>

<template>
    <div class="home-container">
        <!-- 🔥 壁纸切换指示器 -->
        <transition name="fade">
            <div v-if="isSwitchingWallpaper" class="wallpaper-switch-indicator">
                <div class="switch-spinner"></div>
                <span class="switch-text">切换中...</span>
            </div>
        </transition>

        <!-- 页面内容 -->
        <div class="hero-section">
            <!-- 时钟组件 -->
            <Clock :show-seconds="showSeconds" :show-lunar="showLunar" :use12-hour="use12Hour" />

            <!-- 搜索框 -->
            <div class="search-section">
                <div class="glass-search-box" :class="{ 'dropdown-open': showEngineDropdown }">
                    <div class="engine-trigger" @click.stop="toggleDropdown">
                        <svg class="engine-icon-svg" :viewBox="currentEngine.viewBox || '0 0 24 24'"
                            xmlns="http://www.w3.org/2000/svg">
                            <path :d="currentEngine.iconPath" fill="currentColor" />
                        </svg>
                    </div>

                    <input type="text" v-model="searchQuery" @keyup.enter="handleSearch" placeholder="搜点什么呢 ~"
                        class="glass-input">

                    <button @click="handleSearch" class="glass-search-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="search-icon-svg" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>

                    <transition name="fade">
                        <div v-if="showEngineDropdown" class="engine-dropdown-menu">
                            <div v-for="engine in searchEngines" :key="engine.name" class="dropdown-item"
                                :class="{ 'selected': engine.name === selectedEngineName }"
                                @click="selectEngine(engine.name)">
                                <span class="item-name">{{ engine.name }}</span>
                            </div>
                        </div>
                    </transition>
                </div>

                <div class="shortcut-dock animate__animated animate__fadeInUp animate__delay-1s">
                    <a v-for="link in shortcutLinks" :key="link.name" :href="link.url" class="shortcut-icon-btn"
                        :title="link.name" target="_blank" rel="noopener noreferrer">
                        <svg :viewBox="link.viewBox" xmlns="http://www.w3.org/2000/svg" class="icon-svg">
                            <path v-for="(path, idx) in link.paths" :key="idx" :d="path.d" :fill="path.fill" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>

        <!-- 设置按钮 -->
        <div class="settings-btn" @click="isSettingsOpen = true">
            <svg class="settings-icon-svg" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M995.555556 455.111111h-89.884445a395.377778 395.377778 0 0 0-75.093333-181.304889l63.544889-63.544889a28.387556 28.387556 0 0 0 0-40.220444l-40.220445-40.163556a28.387556 28.387556 0 0 0-40.220444 0L750.136889 193.422222A394.922667 394.922667 0 0 0 568.888889 118.328889V28.444444a28.444444 28.444444 0 0 0-28.444445-28.444444h-56.888888a28.444444 28.444444 0 0 0-28.444445 28.444444v89.884445A395.377778 395.377778 0 0 0 273.806222 193.422222L210.318222 129.877333a28.444444 28.444444 0 0 0-40.220444 0l-40.220445 40.220445a28.444444 28.444444 0 0 0 0 40.220444L193.422222 273.863111A394.922667 394.922667 0 0 0 118.328889 455.111111H28.444444a28.444444 28.444444 0 0 0-28.444444 28.444445v56.888888a28.444444 28.444444 0 0 0 28.444444 28.444445h89.884445a395.377778 395.377778 0 0 0 75.093333 181.304889l-63.544889 63.544889a28.387556 28.387556 0 0 0 0 40.220444l40.220445 40.220445a28.387556 28.387556 0 0 0 40.220444 0l63.544889-63.544889A395.491556 395.491556 0 0 0 455.111111 905.671111v89.884445a28.444444 28.444444 0 0 0 28.444445 28.444444h56.888888a28.444444 28.444444 0 0 0 28.444445-28.444444v-89.884445a395.377778 395.377778 0 0 0 181.304889-75.093333l63.544889 63.544889a28.444444 28.444444 0 0 0 40.220444 0l40.220445-40.220445a28.444444 28.444444 0 0 0 0-40.220444l-63.544889-63.544889a395.377778 395.377778 0 0 0 75.093333-181.304889h89.884444a28.444444 28.444444 0 0 0 28.444445-28.444444v-56.888889A28.501333 28.501333 0 0 0 995.555556 455.111111zM512 796.444444a284.444444 284.444444 0 1 1 0.056889-568.945777A284.444444 284.444444 0 0 1 512 796.444444z"
                    fill="currentColor"></path>
                <path
                    d="M512 341.333333a170.666667 170.666667 0 1 0 0 341.333334 170.666667 170.666667 0 0 0 0-341.333334z m0 227.555556a56.888889 56.888889 0 1 1 0-113.777778 56.888889 56.888889 0 1 1 0 113.777778z"
                    fill="currentColor"></path>
            </svg>
        </div>

        <!-- 设置弹窗 -->
        <transition name="modal-fade">
            <div v-if="isSettingsOpen" class="settings-overlay" @click.self="isSettingsOpen = false">
                <div class="settings-modal">
                    <h2 class="settings-title">设置</h2>

                    <div class="settings-group">
                        <div class="group-label">壁纸</div>

                        <div class="setting-row">
                            <div class="row-info">
                                <div class="row-name">壁纸偏好</div>
                            </div>
                            <div class="segmented-control">
                                <div class="segment-item"
                                    :class="{ active: wallpaperSource === 'daily', switching: isSwitchingWallpaper && wallpaperSource === 'daily' }"
                                    @click="wallpaperSource = 'daily'">
                                    每日一图
                                </div>
                                <div class="segment-item"
                                    :class="{ active: wallpaperSource === 'random', switching: isSwitchingWallpaper && wallpaperSource === 'random' }"
                                    @click="wallpaperSource = 'random'">
                                    随机封面
                                </div>
                                <div class="segment-item"
                                    :class="{ active: wallpaperSource === 'website', switching: isSwitchingWallpaper && wallpaperSource === 'website' }"
                                    @click="wallpaperSource = 'website'">
                                    网站背景
                                </div>
                                <div class="segment-item custom-wallpaper-btn"
                                    :class="{ active: hasUserCustomWallpaper && wallpaperSource === 'userCustom' }"
                                    @click="triggerCustomWallpaper()">
                                    <span>自定义</span>
                                    <span v-if="hasUserCustomWallpaper" class="custom-indicator">✓</span>
                                </div>
                            </div>
                            <input type="file" ref="fileInput" accept="image/*" style="display: none"
                                @change="handleFileUpload" />
                        </div>

                        <div class="setting-row">
                            <div class="row-name">壁纸遮罩</div>
                            <label class="switch">
                                <input type="checkbox" v-model="wallpaperMask">
                                <span class="slider round"></span>
                            </label>
                        </div>

                        <div class="setting-row">
                            <div class="row-name">壁纸模糊</div>
                            <div class="range-wrapper">
                                <input type="range" v-model="wallpaperBlur" min="0" max="20" class="custom-range">
                            </div>
                        </div>
                    </div>

                    <div class="settings-group">
                        <div class="group-label">搜索</div>
                        <div class="setting-row">
                            <div class="row-name">搜索建议</div>
                            <label class="switch">
                                <input type="checkbox" v-model="showSuggestions">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>

                    <div class="settings-group">
                        <div class="group-label">时间</div>
                        <div class="setting-row">
                            <div class="row-name">时间显秒</div>
                            <label class="switch">
                                <input type="checkbox" v-model="showSeconds">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <div class="row-name">显示农历</div>
                            <label class="switch">
                                <input type="checkbox" v-model="showLunar">
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <div class="row-name">12小时制</div>
                            <label class="switch">
                                <input type="checkbox" v-model="use12Hour">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
/* 样式保持不变，只需调整部分细节 */
.home-container {
    height: 100vh;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 20px;
    box-sizing: border-box;
    overflow: hidden;
    /* 🔥 首页需要隐藏溢出 */
    position: relative;
}

/* 🔥 壁纸切换指示器 */
.wallpaper-switch-indicator {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(20px);
    padding: 20px 30px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 99999;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.switch-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    border-top-color: #42b883;
    animation: spin 0.8s linear infinite;
}

.switch-text {
    color: white;
    font-size: 1rem;
    font-weight: 500;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}


/* 🔥 新增：分段控制器切换状态 */
.segment-item.switching {
    position: relative;
    overflow: hidden;
}

.segment-item.switching::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(66, 184, 131, 0.1);
    animation: switchingPulse 1.5s infinite;
}

.switch-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: #42b883;
    border-radius: 50%;
    margin-left: 6px;
    animation: dotPulse 0.6s infinite alternate;
}

@keyframes switchingPulse {

    0%,
    100% {
        opacity: 0.1;
    }

    50% {
        opacity: 0.3;
    }
}

@keyframes dotPulse {
    from {
        transform: scale(0.8);
        opacity: 0.6;
    }

    to {
        transform: scale(1.2);
        opacity: 1;
    }
}


/* 🔥 修复9：添加加载状态样式 */
.home-loading {
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.home-loading .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #42b883;
    animation: spin 1s ease-in-out infinite;
}

.hero-section {
    width: 100%;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    z-index: 10;
}

/* ==================== 时钟样式 ==================== */
.clock-section {
    text-align: center;
    color: #ffffff;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.9));
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: clockAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}

@keyframes clockAppear {
    0% {
        opacity: 0;
        transform: translateY(-20px);
    }

    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

.time-row {
    display: flex;
    align-items: baseline;
    line-height: 1;
    margin-bottom: 5px;
}

.time {
    font-size: 5.5rem;
    font-weight: 500;
    letter-spacing: -2px;
    font-family: 'Segoe UI', sans-serif;
}

.am-pm {
    font-size: 1.5rem;
    font-weight: 600;
    margin-left: 12px;
    opacity: 0.9;
}

.date-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.lunar-text {
    font-size: 1.1rem;
    font-weight: 300;
    opacity: 0.95;
    letter-spacing: 2px;
}

.solar-text {
    font-size: 1.3rem;
    font-weight: 600;
    letter-spacing: 1px;
}

/* ==================== 搜索框样式 ==================== */
.search-section {
    width: 100%;
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.search-section:hover {
    transform: scale(1.01);
}

.glass-search-box {
    width: 100%;
    height: 54px;
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 50px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    padding: 0 6px;
    transition: all 0.3s ease;
}

.glass-search-box:hover,
.glass-search-box:focus-within {
    background: rgba(0, 0, 0, 0.6);
    border-color: rgba(255, 255, 255, 0.3);
}

.engine-trigger {
    height: 40px;
    width: 46px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    border-radius: 50%;
    margin-left: 5px;
    transition: background 0.2s;
    color: white;
}

.engine-trigger:hover {
    background: rgba(255, 255, 255, 0.15);
}

.engine-icon-svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    flex-shrink: 0;
}

.glass-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    height: 100%;
    font-size: 1.1rem;
    color: white;
    text-align: center;
    font-weight: 400;
}

.glass-input::placeholder {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 300;
}

.glass-search-btn {
    width: 46px;
    height: 46px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;
    border: none;
    cursor: pointer;
    color: white;
    margin-right: 5px;
    opacity: 0.9;
    transition: transform 0.2s;
}

.glass-search-btn:hover {
    transform: scale(1.1);
    opacity: 1;
}

.search-icon-svg {
    width: 22px;
    height: 22px;
}

/* ==================== 快捷图标栏样式 ==================== */
.shortcut-dock {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.shortcut-icon-btn {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
    color: rgba(255, 255, 255, 0.8);
    overflow: hidden;
}

.shortcut-icon-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-3px);
    color: white;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.icon-svg {
    width: 24px;
    height: 24px;
}

/* 下拉菜单 */
.engine-dropdown-menu {
    position: absolute;
    top: 60px;
    left: 0;
    width: 140px;
    background: rgba(30, 30, 30, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 5px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 100;
}

.dropdown-item {
    padding: 10px 15px;
    color: #ccc;
    font-size: 0.9rem;
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    transition: background 0.2s;
}

.dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
}

.dropdown-item.selected {
    color: #42b883;
    font-weight: bold;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

@media (max-width: 768px) {
    .time {
        font-size: 4rem;
    }

    .hero-section {
        max-width: 90%;
    }
}

/* ==================== 悬浮设置按钮 ==================== */
.settings-btn {
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 48px;
    height: 48px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.9);
    z-index: 900;
    transition: background 0.3s, transform 0.3s;
}

.settings-btn:hover {
    background: rgba(0, 0, 0, 0.6);
    transform: scale(1.1);
}

.settings-icon-svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
    animation: rotate-gear 10s linear infinite;
}

@keyframes rotate-gear {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* ==================== 设置弹窗样式 ==================== */
.settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(5px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.settings-modal {
    width: 600px;
    max-width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
    padding: 30px;
    color: white;
    animation: modalAppear 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}

@keyframes modalAppear {
    0% {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
    }

    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}


.settings-modal::-webkit-scrollbar {
    display: none;
}


.settings-title {
    text-align: center;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 20px;
    letter-spacing: 2px;
}

.settings-group {
    margin-bottom: 25px;
}

.group-label {
    font-size: 1.1rem;
    font-weight: 600;
    border-left: 3px solid #fff;
    padding-left: 10px;
    margin-bottom: 15px;
    opacity: 0.9;
}

.setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    margin-bottom: 10px;
    padding: 15px 20px;
    border-radius: 12px;
    transition: background 0.3s;
}

.setting-row:hover {
    background: rgba(255, 255, 255, 0.2);
}

.row-name {
    font-size: 1rem;
    font-weight: 500;
}

/* 开关组件 */
.switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 28px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    transition: .4s;
    border-radius: 34px;
}

.slider:before {
    position: absolute;
    content: "";
    height: 22px;
    width: 22px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
}

input:checked+.slider {
    background-color: #2196F3;
}

input:checked+.slider:before {
    transform: translateX(22px);
}

/* 分段控制器 */
.segmented-control {
    display: flex;
    background: rgba(0, 0, 0, 0.2);
    padding: 4px;
    border-radius: 10px;
}

.segment-item {
    padding: 6px 12px;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 8px;
    opacity: 0.7;
    transition: all 0.3s;
}

.segment-item.active {
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    font-weight: 600;
    opacity: 1;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.custom-wallpaper-btn {
    position: relative;
}

.custom-indicator {
    margin-left: 6px;
    font-size: 0.8em;
    color: #4ade80;
    font-weight: bold;
}

/* 滑动条 */
.range-wrapper {
    width: 150px;
    display: flex;
    align-items: center;
}

.custom-range {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    outline: none;
}

.custom-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    transition: transform 0.1s;
}

.custom-range::-webkit-slider-thumb:hover {
    transform: scale(1.2);
}

/* 弹窗动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-active .settings-modal {
    animation: modal-pop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.modal-fade-leave-active .settings-modal {
    animation: modal-pop 0.3s reverse;
}

@keyframes modal-pop {
    0% {
        transform: scale(0.9);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>