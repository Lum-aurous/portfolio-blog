<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/utils/api'
import { useRouter } from 'vue-router'

// 引入 ECharts 核心模块
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent // 可选：缩放组件
} from "echarts/components";
import VChart from "vue-echarts";

// 当前激活的图表视图
const activeTab = ref('week') // 'week' 或 'month'

// 切换 Tab 的逻辑
const switchTab = async (tab) => {
    if (activeTab.value === tab) return // 没变就不动
    activeTab.value = tab

    // 重新获取数据 (假设后端支持 query.range)
    // 或者纯前端模拟切换：
    if (tab === 'month') {
        // 暂时用模拟数据展示月视图效果
        chartOption.value.xAxis.data = Array.from({ length: 30 }, (_, i) => `${i + 1}日`)
        chartOption.value.series[0].data = Array.from({ length: 30 }, () => Math.floor(Math.random() * 200))
        chartOption.value.series[1].data = Array.from({ length: 30 }, () => Math.floor(Math.random() * 50))
    } else {
        // 切回周视图，重新调接口或用缓存
        await initChart()
    }
}

// 注册组件
use([
    CanvasRenderer,
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent
]);

const router = useRouter()

// 核心统计数据 (对应顶部卡片)
const stats = ref({
    views: 0,
    articles: 0,
    comments: 0
})

// 图表配置项
const chartOption = ref(null)

// 1. 获取真实统计数据
const fetchStats = async () => {
    try {
        const res = await api.get('/blog/stats')
        if (res.data.success) {
            stats.value = {
                views: res.data.data.totalViews || 0,
                articles: res.data.data.articleCount || 0,
                comments: res.data.data.categoryCount || 0 // 这里暂时展示分类数，或者你可以改成 totalComments
            }
        }
    } catch (e) {
        console.error("获取统计失败:", e)
    }
}

// 初始化图表 (改为异步加载真实数据)
const initChart = async () => { // 👈 加上 async
    let apiData = {
        dates: [],
        views: [],
        comments: []
    }

    try {
        // 🔥 调用后端真实接口
        const res = await api.get('/admin/dashboard/trend')
        if (res.data.success) {
            apiData.dates = res.data.data.dates
            apiData.views = res.data.data.viewData
            apiData.comments = res.data.data.commentData
        }
    } catch (e) {
        console.error('加载图表数据失败，使用兜底数据', e)
        // 兜底：如果接口还没写好，防止报错
        apiData.dates = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        apiData.views = [0, 0, 0, 0, 0, 0, 0]
        apiData.comments = [0, 0, 0, 0, 0, 0, 0]
    }

    chartOption.value = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#3b82f6',
            textStyle: { color: '#e2e8f0' },
            axisPointer: { type: 'cross', label: { backgroundColor: '#3b82f6' } }
        },
        legend: {
            data: ['访问量', '评论互动'],
            textStyle: { color: '#94a3b8' },
            bottom: 0
        },
        grid: {
            left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            // 🔥 使用真实日期
            data: apiData.dates,
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
            axisLabel: { color: '#94a3b8' }
        },
        series: [
            {
                name: '访问量',
                type: 'line',
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 4, color: '#3b82f6' },
                areaStyle: {
                    opacity: 0.5,
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(59, 130, 246, 0.6)' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                        ]
                    }
                },
                // 🔥 使用真实访问量
                data: apiData.views
            },
            {
                name: '评论互动',
                type: 'line',
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 4, color: '#8b5cf6' },
                areaStyle: {
                    opacity: 0.5,
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(139, 92, 246, 0.6)' },
                            { offset: 1, color: 'rgba(139, 92, 246, 0)' }
                        ]
                    }
                },
                // 🔥 使用真实评论数
                data: apiData.comments
            }
        ]
    }
}

onMounted(() => {
    fetchStats()
    initChart() // 这里现在是异步的，但 onMounted 不阻塞也没关系
})
</script>

<template>
    <div class="dashboard-container">

        <div class="welcome-bar animate__animated animate__fadeInDown">
            <h2 class="welcome-title">📊 数据驾驶舱</h2>
            <div class="date-picker">
                <span>Real-time Data</span>
                <span class="icon blink">🟢</span>
            </div>
        </div>

        <div class="stats-grid animate__animated animate__fadeInUp">

            <div class="stat-card card-blue">
                <div class="card-header">
                    <span>总浏览量 PV</span>
                    <div class="trend-badge up">↗ 持续增长</div>
                </div>
                <div class="card-content">
                    <div class="card-num">{{ stats.views }}</div>
                    <div class="card-bg-icon">👁️</div>
                </div>
            </div>

            <div class="stat-card card-purple">
                <div class="card-header">
                    <span>文章总数 Posts</span>
                    <div class="trend-badge">累计</div>
                </div>
                <div class="card-content">
                    <div class="card-num">{{ stats.articles }}</div>
                    <div class="card-bg-icon">📝</div>
                </div>
            </div>

            <div class="stat-card card-orange">
                <div class="card-header">
                    <span>活跃分类 Tags</span>
                    <div class="trend-badge">覆盖</div>
                </div>
                <div class="card-content">
                    <div class="card-num">{{ stats.comments }}</div>
                    <div class="card-bg-icon">📂</div>
                </div>
            </div>

            <div class="stat-card add-card" @click="router.push('/admin/publish')">
                <div class="plus-btn">+</div>
                <span>发布新创作</span>
            </div>
        </div>

        <div class="chart-section glass-panel animate__animated animate__fadeInUp" style="animation-delay: 0.1s">
            <div class="chart-header">
                <h3>📈 全站流量趋势 ({{ activeTab === 'week' ? '近7天' : '近30天' }})</h3>
                <div class="chart-tabs">
                    <span :class="{ active: activeTab === 'week' }" @click="switchTab('week')">周视图</span>
                    <span :class="{ active: activeTab === 'month' }" @click="switchTab('month')">月视图</span>
                </div>
            </div>

            <div class="chart-container">
                <v-chart class="chart" :option="chartOption" autoresize />
            </div>
        </div>

    </div>
</template>

<style scoped>
/* 全局容器 */
.dashboard-container {
    display: flex;
    flex-direction: column;
    gap: 25px;
    max-width: 1400px;
    margin: 0 auto;
    color: #fff;
}

/* 1. 头部样式 */
.welcome-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
}

.welcome-title {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 1px;
    color: #fff;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.date-picker {
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 14px;
    border-radius: 50px;
    font-size: 0.8rem;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 呼吸灯动画 */
@keyframes blink {
    0% {
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
    }

    50% {
        opacity: 0.5;
        transform: scale(0.9);
        box-shadow: 0 0 0 5px rgba(74, 222, 128, 0);
    }

    100% {
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
    }
}

.icon.blink {
    animation: blink 2s infinite ease-in-out;
    /* 2秒循环一次，平滑呼吸 */
    border-radius: 50%;
    /* 确保光晕是圆的 */
}

/* 2. 统计卡片网格 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
}

.stat-card {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
    height: 150px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.15);
}

/* 卡片颜色主题 */
.card-blue {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(59, 130, 246, 0.2) 100%);
}

.card-purple {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(139, 92, 246, 0.2) 100%);
}

.card-orange {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(249, 115, 22, 0.2) 100%);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.card-header span {
    font-size: 0.9rem;
    color: #94a3b8;
    font-weight: 500;
}

.trend-badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.trend-badge.up {
    color: #4ade80;
    background: rgba(74, 222, 128, 0.1);
}

.card-content {
    display: flex;
    align-items: baseline;
    position: relative;
}

.card-num {
    font-size: 2.8rem;
    font-weight: 700;
    color: #fff;
    margin-top: 15px;
    letter-spacing: -1px;
    z-index: 2;
}

.card-bg-icon {
    position: absolute;
    right: -10px;
    bottom: -10px;
    font-size: 4rem;
    opacity: 0.1;
    transform: rotate(-15deg);
    z-index: 1;
}

/* 添加按钮卡片 */
.add-card {
    background: rgba(255, 255, 255, 0.02);
    border: 2px dashed rgba(255, 255, 255, 0.15);
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #94a3b8;
    gap: 10px;
}

.add-card:hover {
    border-color: #8b5cf6;
    color: #fff;
    background: rgba(139, 92, 246, 0.1);
}

.plus-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    transition: 0.3s;
}

.add-card:hover .plus-btn {
    background: #8b5cf6;
    transform: rotate(90deg);
}

/* 3. 图表区域 */
.glass-panel {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 16px;
    padding: 25px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    min-height: 400px;
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.chart-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #fff;
    border-left: 4px solid #3b82f6;
    padding-left: 10px;
}

.chart-tabs {
    display: flex;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 4px;
}

.chart-tabs span {
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #64748b;
    cursor: pointer;
    transition: 0.3s;
}

.chart-tabs span.active {
    background: #3b82f6;
    color: #fff;
}

/* 🔥 修改后：给一个明确的高度 */
.chart-container {
    width: 100%;
    height: 360px;
    /* 强制给一个高度 */
    position: relative;
    overflow: hidden;
}

.chart {
    width: 100%;
    height: 360px;
    /* 这里的 100% 可能失效，直接写死 360px 或 100% !important */
    min-height: 360px;
}

/* 响应式 */
@media (max-width: 1200px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
}
</style>