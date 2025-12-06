<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Lunar } from 'lunar-javascript'

// ==================== 1. 搜索与时钟逻辑 ====================
const searchQuery = ref('')
const selectedEngineName = ref('Bing')
const showEngineDropdown = ref(false)

const searchEngines = [
    { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: '🔷' },
    { name: 'Google', url: 'https://www.google.com/search?q=', icon: '🌐' },
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=', icon: '🐻' },
    { name: 'GitHub', url: 'https://github.com/search?q=', icon: '🐱' }
]

const currentEngine = computed(() => {
    return searchEngines.find(e => e.name === selectedEngineName.value) || searchEngines[0]
})

const toggleDropdown = () => { showEngineDropdown.value = !showEngineDropdown.value }
const selectEngine = (engineName) => {
    selectedEngineName.value = engineName
    showEngineDropdown.value = false
}

// 时钟状态
const currentTime = ref('')
const currentAmPm = ref('')
const currentDate = ref('')
const lunarDate = ref('')
let timer = null

const updateTime = () => {
    const now = new Date()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    currentAmPm.value = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    currentTime.value = `${hours.toString().padStart(2, '0')}:${minutes}`

    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const week = weekDays[now.getDay()]
    currentDate.value = `${year}年${month}月${day}日 ${week}`

    const lunar = Lunar.fromDate(now)
    lunarDate.value = `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
}

const handleSearch = () => {
    if (searchQuery.value.trim()) {
        window.open(currentEngine.value.url + encodeURIComponent(searchQuery.value), '_blank')
        searchQuery.value = ''
    }
}

// ==================== 生命周期 ====================
onMounted(() => {
    updateTime()
    timer = setInterval(updateTime, 1000)
    
    // 👇 进入首页时：强制隐藏 body 的滚动条
    document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
    clearInterval(timer)
    
    // 👇 离开首页时(比如去博客页)：恢复滚动条，否则别的页面也滚不动了！
    document.body.style.overflow = 'auto'
})
</script>

<template>
    <div class="home-container">
        <div class="hero-section">

            <div class="clock-section animate__animated animate__fadeInDown">
                <div class="time-wrapper">
                    <span class="time">{{ currentTime }}</span>
                    <span class="am-pm">{{ currentAmPm }}</span>
                </div>
                <div class="date-wrapper">
                    <p class="lunar-date">{{ lunarDate }}</p>
                    <p class="solar-date">{{ currentDate }}</p>
                </div>
            </div>

            <div class="search-section animate__animated animate__fadeInUp animate__delay-0.5s">
                <div class="glass-search-box" :class="{ 'dropdown-open': showEngineDropdown }">
                    <div class="search-input-wrapper">
                        <div class="engine-trigger" @click.stop="toggleDropdown">
                            <span class="trigger-icon">{{ currentEngine.icon }}</span>
                            <span class="trigger-arrow">▼</span>
                        </div>

                        <input type="text" v-model="searchQuery" @keyup.enter="handleSearch"
                            :placeholder="'在 ' + currentEngine.name + ' 中搜索...'" class="glass-input">
                        <button @click="handleSearch" class="glass-search-btn">
                            <span class="search-icon">🔍</span>
                        </button>
                    </div>

                    <transition name="fade">
                        <div v-if="showEngineDropdown" class="engine-dropdown-menu">
                            <div v-for="engine in searchEngines" :key="engine.name" class="dropdown-item"
                                :class="{ 'selected': engine.name === selectedEngineName }"
                                @click="selectEngine(engine.name)">
                                <span class="item-icon">{{ engine.icon }}</span>
                                <span class="item-name">{{ engine.name }}</span>
                                <span v-if="engine.name === selectedEngineName" class="item-check">✓</span>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ==================== 整体布局 (无滚动条版) ==================== */
.home-container {
    /* 1. 铺满全屏 */
    height: 100vh; 
    width: 100%;
    
    /* 2. 布局 */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 0 20px;
    box-sizing: border-box;
    
    /* 3. 关键：允许内容在容器内滚动，防止小屏幕内容被切断 */
    overflow-y: auto; 
    overflow-x: hidden;

    /* 4. 核武器：隐藏滚动条 UI (但保留滚动功能) */
    scrollbar-width: none; /* Firefox 隐藏 */
    -ms-overflow-style: none; /* IE/Edge 隐藏 */
}

/* Chrome/Safari/Edge 隐藏滚动条 */
.home-container::-webkit-scrollbar {
    display: none;
}

.hero-section {
    width: 100%;
    /* 限制最大宽度，视觉更聚焦 */
    max-width: 600px; 
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 50px; 
    z-index: 10;
}

/* ==================== 时钟样式 ==================== */
.clock-section {
    text-align: center;
    color: white;
    text-shadow: 0 2px 15px rgba(0, 0, 0, 0.4);
    /* 防止文字被选中，增加壁纸感 */
    user-select: none; 
    cursor: default;
}

.time-wrapper {
    display: flex;
    justify-content: center;
    align-items: baseline;
    line-height: 1;
    margin-bottom: 10px;
}

.time {
    font-size: 6rem;
    font-weight: 200; /* 极细字重 */
    letter-spacing: -2px;
}

.am-pm {
    font-size: 1.2rem;
    font-weight: 500;
    margin-left: 10px;
}

.date-wrapper {
    font-size: 1.1rem;
    opacity: 0.9;
    font-weight: 400;
    letter-spacing: 1px;
}

.lunar-date { margin-bottom: 5px; }

/* ==================== 搜索框样式 ==================== */
.search-section { width: 100%; position: relative; }

.glass-search-box {
    width: 100%;
    position: relative;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2));
    backdrop-filter: blur(20px);
    border-radius: 50px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    padding: 4px;
    transition: all 0.3s ease;
    z-index: 20;
}
.glass-search-box:focus-within:not(.dropdown-open) {
    background: linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.3));
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
}
.glass-search-box.dropdown-open {
    background: linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.3));
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
}

.search-input-wrapper { display: flex; align-items: center; height: 50px; }

/* 触发器 */
.engine-trigger {
    display: flex; align-items: center; height: 100%; padding: 0 12px 0 18px; cursor: pointer;
    border-right: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.9);
    transition: background 0.3s; border-top-left-radius: 45px; border-bottom-left-radius: 45px;
    user-select: none;
}
.engine-trigger:hover { background: rgba(255, 255, 255, 0.1); }
.trigger-icon { font-size: 1.2rem; margin-right: 6px; }
.trigger-arrow { font-size: 0.7rem; opacity: 0.6; transition: transform 0.3s ease; }
.glass-search-box.dropdown-open .trigger-arrow { transform: rotate(180deg); }

/* 输入框 */
.glass-input { flex: 1; background: transparent; border: none; outline: none; font-size: 1.1rem; color: white; padding: 0 15px; font-weight: 300; }
.glass-input::placeholder { color: rgba(255, 255, 255, 0.6); }

/* 按钮 */
.glass-search-btn { background: transparent; border: none; cursor: pointer; padding: 0 24px; font-size: 1.3rem; display: flex; align-items: center; opacity: 0.8; transition: opacity 0.3s, transform 0.3s; }
.glass-search-btn:hover { opacity: 1; transform: scale(1.1); }

/* 下拉菜单 */
.engine-dropdown-menu {
    position: absolute; top: calc(100% + 10px); left: 0; width: 180px;
    background: rgba(40, 40, 40, 0.85); backdrop-filter: blur(25px);
    border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3); padding: 6px; overflow: hidden; z-index: 100; transform-origin: top left;
}
.dropdown-item { display: flex; align-items: center; padding: 10px 14px; color: rgba(255, 255, 255, 0.75); cursor: pointer; border-radius: 10px; transition: all 0.2s ease; font-weight: 500; font-size: 0.95rem; }
.dropdown-item:hover { background: rgba(255, 255, 255, 0.1); color: white; }
.dropdown-item.selected { background: rgba(66, 184, 131, 0.15); color: #42b883; }
.item-icon { font-size: 1.1rem; margin-right: 10px; }
.item-name { flex: 1; }
.item-check { font-size: 0.9rem; }

/* 动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-10px); }

/* 响应式 */
@media (max-width: 768px) {
    .time { font-size: 4rem; }
    .glass-input { font-size: 1rem; }
    /* 移动端如果内容太多，可以允许滚动，防止切断内容 */
    /* .home-container { overflow-y: auto; } */
}
</style>