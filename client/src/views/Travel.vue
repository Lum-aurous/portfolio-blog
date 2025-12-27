<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import Navbar from '@/components/Navbar.vue'
import * as echarts from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { TooltipComponent, GeoComponent, TitleComponent } from 'echarts/components'; // Added TitleComponent
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([MapChart, TooltipComponent, GeoComponent, CanvasRenderer, TitleComponent]);

const router = useRouter()
const isLoading = ref(true)
const travelList = ref([])
const page = ref(1)
const hasMore = ref(true)
const mapContainer = ref(null)
let myChart = null

const activeContinent = ref('全部足迹')
const continents = [
    { name: '全部足迹', key: '' },
    { name: '亚洲', key: '亚洲' },
    { name: '欧洲', key: '欧洲' },
    { name: '北美洲', key: '北美洲' },
    { name: '南美洲', key: '南美洲' },
    { name: '非洲', key: '非洲' },
    { name: '大洋洲', key: '大洋洲' },
    { name: '南极洲', key: '南极洲' }
]

const getProxyUrl = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500'
    if (url.startsWith('http')) return url
    const isDev = import.meta.env.VITE_APP_ENV === 'development'
    const apiBase = isDev ? 'http://localhost:3000' : window.location.origin
    if (url.startsWith('/uploads') || url.startsWith('/')) {
        return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

const initMap = async () => {
    if (!mapContainer.value) return

    myChart = echarts.init(mapContainer.value)
    myChart.showLoading({ color: '#42b883', maskColor: 'rgba(255, 255, 255, 0.8)' })

    try {
        // 🔥 FIX: Use a highly reliable CDN for the World Map GeoJSON
        // This is the standard file used in ECharts examples
        const response = await fetch('https://raw.githubusercontent.com/apache/echarts-examples/gh-pages/public/data/asset/geo/world.json');

        if (!response.ok) throw new Error('Network response was not ok');

        const geoJson = await response.json();
        echarts.registerMap('world', geoJson);

        myChart.hideLoading();

        const option = {
            backgroundColor: '#eef6fc',
            tooltip: {
                trigger: 'item',
                formatter: '{b}',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: '#ccc',
                textStyle: { color: '#333' }
            },
            geo: {
                map: 'world',
                roam: true,
                zoom: 1.2,
                label: { show: false },
                itemStyle: {
                    areaColor: '#dce2e8',
                    borderColor: '#ffffff',
                    borderWidth: 1
                },
                emphasis: {
                    itemStyle: {
                        areaColor: '#42b883',
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.1)'
                    },
                    label: { show: true, color: '#fff' }
                },
                select: {
                    itemStyle: { areaColor: '#42b883' },
                    label: { show: true, color: '#fff' }
                }
            },
            series: []
        };

        myChart.setOption(option);

        myChart.on('click', (params) => {
            console.log('Clicked:', params.name);
            // You can map countries to continents here if you want auto-filtering
        });

    } catch (e) {
        console.error('Map load failed:', e);
        myChart.hideLoading();

        // 🔥 FALLBACK: If map data fails (e.g. GitHub raw blocked), show a nice static image
        // instead of a broken chart.
        mapContainer.value.style.backgroundImage = "url('https://images.unsplash.com/photo-1589519160732-57fc498494f8?q=80&w=2070&auto=format&fit=crop')";
        mapContainer.value.style.backgroundSize = "cover";
        mapContainer.value.style.backgroundPosition = "center";

        myChart.dispose(); // Cleanup since we are using CSS background
        myChart = null;
    }

    window.addEventListener('resize', () => myChart && myChart.resize());
}

const fetchTravelogs = async (isLoadMore = false) => {
    if (!isLoadMore) {
        isLoading.value = true;
        page.value = 1;
        travelList.value = [];
    }

    try {
        const res = await api.get('/articles', {
            params: {
                category: '游记',
                // 🔥 核心：如果选了"全部足迹"，就传空字符串；否则传大洲名字
                continent: activeContinent.value === '全部足迹' ? '' : activeContinent.value,
                page: page.value,
                limit: 12
            }
        })

        if (res.data.success) {
            const newItems = res.data.data.list;
            if (page.value === 1) travelList.value = newItems;
            else travelList.value = [...travelList.value, ...newItems];

            hasMore.value = newItems.length >= 12;
        }
    } catch (err) {
        console.error('Fetch failed:', err);
    } finally {
        isLoading.value = false;
    }
}

const handleFilterChange = (continentName) => {
    if (activeContinent.value === continentName) return;
    activeContinent.value = continentName;
    fetchTravelogs();
}

const loadMore = () => {
    if (!hasMore.value) return;
    page.value++;
    fetchTravelogs(true);
}

const goToDetail = (id) => {
    router.push(`/article/${id}`);
}

onMounted(() => {
    fetchTravelogs();
    setTimeout(initMap, 100);
});

onUnmounted(() => {
    if (myChart) {
        myChart.dispose();
        myChart = null;
    }
    window.removeEventListener('resize', () => myChart && myChart.resize());
});
</script>

<template>
    <div class="travel-page-light">
        <Navbar />

        <header class="map-hero-container">
            <div class="echarts-map" ref="mapContainer"></div>

            <div class="hero-text-overlay">
                <h1 class="hero-title animate__animated animate__fadeInDown">MY GLOBAL FOOTPRINTS</h1>
                <p class="hero-subtitle animate__animated animate__fadeInUp">用脚步丈量世界，点亮地图上的每一个角落。</p>
            </div>
        </header>

        <main class="travel-content-container">
            <div class="continent-nav animate__animated animate__fadeIn">
                <div v-for="item in continents" :key="item.name" class="nav-pill"
                    :class="{ active: activeContinent === item.name }" @click="handleFilterChange(item.name)">
                    {{ item.name }}
                </div>
            </div>

            <div v-if="isLoading && page === 1" class="loading-box">
                <div class="spinner"></div>
            </div>

            <div v-else-if="travelList.length > 0" class="masonry-grid animate__animated animate__fadeInUp">
                <div v-for="item in travelList" :key="item.id" class="masonry-item" @click="goToDetail(item.id)">
                    <div class="travel-card-light">
                        <div class="card-image-wrapper">
                            <img :src="getProxyUrl(item.cover_image)" loading="lazy" alt="cover">
                            <div class="location-badge">
                                📍 {{ item.location || item.continent || '未知秘境' }}
                            </div>
                        </div>
                        <div class="card-info">
                            <h3 class="card-title">{{ item.title }}</h3>
                            <div class="card-meta">
                                <span class="author">
                                    <img :src="getProxyUrl(item.author_avatar)" class="avatar-tiny">
                                    {{ item.author_name }}
                                </span>
                                <span class="date">{{ new Date(item.created_at).toLocaleDateString() }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="empty-state-light">
                <span class="empty-icon">🗺️</span>
                <p>在 {{ activeContinent }} 还没有留下足迹哦~</p>
                <router-link :to="{ path: '/creation-center', query: { tab: 'article', category: '游记' } }"
                    class="go-create-btn">
                    去点亮地图
                </router-link>
            </div>

            <div v-if="travelList.length > 0 && hasMore" class="load-more-wrapper">
                <button class="load-more-btn-light" @click="loadMore" :disabled="isLoading">
                    {{ isLoading ? '加载中...' : '探索更多' }}
                </button>
            </div>
            <div v-if="!hasMore && travelList.length > 0" class="end-mark-light">
                <span>- 旅途暂告一段落，期待下一次出发 -</span>
            </div>
        </main>
    </div>
</template>

<style scoped>
/* 全局浅色背景 */
.travel-page-light {
    background-color: #f9fbfd;
    /* 非常浅的灰蓝色，干净清爽 */
    min-height: 100vh;
    color: #333;
    /* 深色文字 */
    font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
}

/* --- Map Hero 区域 --- */
.map-hero-container {
    position: relative;
    width: 100%;
    height: 65vh;
    /* 高度适中 */
    min-height: 500px;
    background: #eef6fc;
    /* 与地图背景一致的海洋色 */
    overflow: hidden;
    border-bottom: 1px solid #e1e4e8;
}

.echarts-map {
    width: 100%;
    height: 100%;
}

.hero-text-overlay {
    position: absolute;
    top: 45%;
    /* 原来是 40%，稍微往下挪一点，避开北半球密集区 */
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    z-index: 10;
    width: 100%;
    /* 确保文字容器宽度够，防止意外换行 */
}

.hero-title {
    font-family: 'Georgia', serif;
    font-size: 4rem;
    /* 稍微加大一点，更有气势 */
    letter-spacing: 8px;
    margin-bottom: 20px;
    color: #2c3e50;
    font-weight: 800;
    /* 加粗 */

    /* 🔥 核心优化：多重文字阴影，制造“白色背光”效果 */
    text-shadow:
        0 0 10px rgba(255, 255, 255, 0.8),
        0 0 20px rgba(255, 255, 255, 0.8),
        0 0 30px rgba(255, 255, 255, 0.8);

    /* 增加一个入场动画的缓动，看起来更高级 */
    animation: fadeInDown 1s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
}

.hero-subtitle {
    font-size: 1.1rem;
    color: #455a64;
    /* 稍微加深一点副标题颜色 */
    letter-spacing: 3px;
    font-weight: 500;

    /* 同样的背光处理 */
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.9);

    animation: fadeInUp 1s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
    animation-delay: 0.3s;
    /* 比标题晚一点出来 */
}

/* 补充：如果你之前的 animate.css 没加载，这里手动补一个简单的淡入动画 */
@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translate3d(0, -30px, 0);
    }

    to {
        opacity: 1;
        transform: translate3d(0, 0, 0);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translate3d(0, 30px, 0);
    }

    to {
        opacity: 1;
        transform: translate3d(0, 0, 0);
    }
}

/* --- 内容区域 --- */
.travel-content-container {
    max-width: 1300px;
    margin: 0 auto;
    padding: 50px 20px;
    position: relative;
    z-index: 20;
}

/* --- 清新风格导航栏 --- */
.continent-nav {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 50px;
}

.nav-pill {
    padding: 8px 22px;
    border-radius: 50px;
    background: #fff;
    border: 1px solid #e1e4e8;
    color: #606266;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    font-size: 0.95rem;
    font-weight: 500;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.nav-pill:hover {
    border-color: #42b883;
    color: #42b883;
    transform: translateY(-2px);
}

.nav-pill.active {
    background: #42b883;
    color: #fff;
    border-color: #42b883;
    box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
}

/* --- 瀑布流卡片 (浅色版) --- */
.masonry-grid {
    column-count: 4;
    column-gap: 24px;
}

.masonry-item {
    break-inside: avoid;
    margin-bottom: 24px;
    display: inline-block;
    width: 100%;
}

@media (max-width: 1200px) {
    .masonry-grid {
        column-count: 3;
    }
}

@media (max-width: 900px) {
    .masonry-grid {
        column-count: 2;
    }
}

@media (max-width: 600px) {
    .masonry-grid {
        column-count: 1;
    }
}

.travel-card-light {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid #f1f2f4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    cursor: pointer;
}

.travel-card-light:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06);
    border-color: #e1e4e8;
}

.card-image-wrapper {
    position: relative;
    overflow: hidden;
}

.card-image-wrapper img {
    width: 100%;
    display: block;
    transition: transform 0.5s ease;
}

.travel-card-light:hover .card-image-wrapper img {
    transform: scale(1.05);
}

.location-badge {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(255, 255, 255, 0.85);
    color: #333;
    font-size: 0.75rem;
    padding: 4px 10px;
    border-radius: 20px;
    font-weight: 600;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.card-info {
    padding: 16px;
}

.card-title {
    font-size: 1.1rem;
    color: #2c3e50;
    margin: 0 0 10px 0;
    line-height: 1.4;
    font-weight: 600;
}

.card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #909399;
}

.author {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #606266;
}

.avatar-tiny {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid #f1f2f4;
}

/* --- 其他工具样式 (浅色版) --- */
.loading-box {
    display: flex;
    justify-content: center;
    padding: 60px;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #42b883;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.empty-state-light {
    text-align: center;
    padding: 80px 0;
    color: #909399;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #f1f2f4;
}

.empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 16px;
    opacity: 0.5;
}

.go-create-btn {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 28px;
    background: #42b883;
    color: #fff;
    border-radius: 50px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(66, 184, 131, 0.25);
}

.go-create-btn:hover {
    background: #3aa876;
    transform: translateY(-2px);
}

.load-more-wrapper {
    text-align: center;
    margin-top: 40px;
}

.load-more-btn-light {
    padding: 10px 36px;
    background: #fff;
    border: 1px solid #e1e4e8;
    color: #606266;
    border-radius: 50px;
    cursor: pointer;
    transition: 0.3s;
    font-size: 0.95rem;
    font-weight: 500;
}

.load-more-btn-light:hover {
    border-color: #42b883;
    color: #42b883;
    background: #f0f9f6;
}

.end-mark-light {
    text-align: center;
    color: #c0c4cc;
    margin-top: 40px;
    font-size: 0.85rem;
    letter-spacing: 1px;
}
</style>