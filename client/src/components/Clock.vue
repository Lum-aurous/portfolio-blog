<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Lunar } from 'lunar-javascript'

const props = defineProps({
    showSeconds: {
        type: Boolean,
        default: false
    },
    showLunar: {
        type: Boolean,
        default: true
    },
    use12Hour: {
        type: Boolean,
        default: true
    }
})

// 🔥 优化：分别定义状态，减少不必要的更新
const currentTime = ref('')
const currentAmPm = ref('')
const currentDate = ref('')
const lunarDate = ref('')
let timer = null

// 更新时间
const updateTime = () => {
    const now = new Date()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')

    if (props.use12Hour) {
        currentAmPm.value = hours >= 12 ? 'PM' : 'AM'
        hours = hours % 12 || 12
    } else {
        currentAmPm.value = ''
    }

    const newTime = props.showSeconds
        ? `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`
        : `${hours.toString().padStart(2, '0')}:${minutes}`

    // 🔥 优化：只在时间真正改变时更新
    if (newTime !== currentTime.value) {
        currentTime.value = newTime
    }

    // 🔥 优化：日期和农历只在必要时更新（每分钟）
    if (now.getSeconds() === 0 || !currentDate.value) {
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        currentDate.value = `${month}月${day}日 ${weekDays[now.getDay()]}`

        if (props.showLunar) {
            const lunar = Lunar.fromDate(now)
            lunarDate.value = `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
        }
    }
}

// 启动时钟
const startClock = () => {
    if (timer) clearInterval(timer)
    updateTime()
    timer = setInterval(updateTime, 1000)
}

// 停止时钟
const stopClock = () => {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
}

// 生命周期
onMounted(() => {
    console.log('时钟组件挂载，启动定时器')
    startClock()
})

onUnmounted(() => {
    console.log('时钟组件卸载，清除定时器')
    stopClock()
})

// 监听props变化
watch(
    () => [props.showSeconds, props.showLunar, props.use12Hour],
    () => {
        updateTime()
    },
    { deep: true }
)

defineExpose({
    startClock,
    stopClock,
    updateTime
})
</script>

<template>
    <!-- 🔥 优化：使用 v-memo 减少重新渲染 -->
    <div class="clock-section" v-memo="[currentTime, currentDate, lunarDate, currentAmPm]">
        <div class="time-row">
            <span class="time">{{ currentTime }}</span>
            <span class="am-pm" v-if="use12Hour">{{ currentAmPm }}</span>
        </div>

        <div class="date-group">
            <div class="lunar-text" v-if="showLunar">{{ lunarDate }}</div>
            <div class="solar-text">{{ currentDate }}</div>
        </div>
    </div>
</template>

<style scoped>
.clock-section {
    text-align: center;
    color: #ffffff;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.9));
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: center;
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
    /* 🔥 优化：使用 will-change 提示浏览器优化 */
    will-change: contents;
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

@media (max-width: 768px) {
    .time {
        font-size: 4rem;
    }

    .am-pm {
        font-size: 1.2rem;
    }

    .lunar-text {
        font-size: 1rem;
    }

    .solar-text {
        font-size: 1.1rem;
    }
}

@media (max-width: 480px) {
    .time {
        font-size: 3rem;
    }

    .date-group {
        gap: 1px;
    }
}
</style>