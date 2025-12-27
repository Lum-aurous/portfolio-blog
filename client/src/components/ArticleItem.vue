<script setup>
import { useRouter } from 'vue-router' // 🔑 引入路由

const props = defineProps({
    data: { type: Object, required: true }
})
defineEmits(['click'])

const router = useRouter() // 🔑 初始化

// ✅ 路径处理函数：支持 Base64、外链、本地代理
const getFullImageUrl = (url) => {
    // 只有当 url 真正有值（不是空字符串且不是 null）时才处理
    if (!url || url === '' || url === 'null') return null;

    if (url.startsWith('data:') || url.startsWith('http')) return url;
    return url.startsWith('/') ? url : `/${url}`;
}

const formatNumber = (num) => {
    if (!num) return 0
    return num >= 10000 ? (num / 10000).toFixed(1) + 'w' : num
}
</script>

<template>
    <div class="article-item-flat" @click="$emit('click')">
        <div class="article-main">
            <h3 class="article-title">
                <span v-if="data.work_type === 'video'" class="type-tag">🎬</span>
                <span v-else-if="data.work_type === 'music'" class="type-tag">🎵</span>
                {{ data.title }}
            </h3>

            <p class="article-excerpt">{{ data.summary }}</p>

            <div class="article-footer-row">
                <div class="footer-left">
                    <span class="category-tag">{{ data.category || '未分类' }}</span>
                </div>

                <div class="footer-center">
                    <div class="user-pill" @click.stop="router.push(`/profile/${data.author_username}`)">
                        <img :src="getFullImageUrl(data.author_avatar)" class="user-avatar-mini" alt="avatar">
                        <span class="user-nickname">{{ data.author_name || '匿名' }}</span>
                    </div>
                </div>

                <div class="footer-right">
                    <div class="meta-stats-group">
                        <span class="stat-pill">
                            <i class="stat-icon">👁️</i> {{ data.views || 0 }}
                        </span>
                        <span class="stat-pill">
                            <i class="stat-icon">❤️</i> {{ data.likes || 0 }}
                        </span>
                        <span class="stat-pill">
                            <i class="stat-icon">⭐</i> {{ data.favorites || 0 }}
                        </span>
                        <span class="stat-pill">
                            <i class="stat-icon">💬</i> {{ data.comments || 0 }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div class="article-thumb-v2">
            <div v-if="data.work_type === 'video' && data.video_url" class="media-container" @click.stop>
                <video :src="getFullImageUrl(data.video_url)" controls preload="metadata" class="item-media"
                    :poster="getFullImageUrl(data.cover_image)">
                </video>
            </div>

            <div v-else-if="data.cover_image" class="image-cover-wrapper">
                <img :src="getFullImageUrl(data.cover_image)" class="item-media" loading="lazy" alt="cover">
                <div v-if="data.work_type === 'audio'" class="type-badge audio">🎵</div>
                <div v-if="data.work_type === 'short'" class="type-badge short">📸</div>
            </div>

            <div v-else class="artistic-text-cover">
                <div class="quote-mark">“</div>
                <div class="text-preview">{{ data.title }}</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.article-item-flat {
    padding: 20px 24px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    gap: 30px;
    cursor: pointer;
    background: #fff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.article-item-flat:hover {
    background: #fafafa;
}

.article-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.article-title {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 8px 0;
    line-height: 1.4;
}

.article-excerpt {
    font-size: 14px;
    color: #666;
    line-height: 1.6;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 🔥 底部一行排版逻辑 */
.article-footer-row {
    margin-top: auto;
    /* 始终沉底 */
    display: flex;
    align-items: center;
    gap: 15px;
}

.category-tag {
    color: #42b883;
    background: rgba(66, 184, 131, 0.1);
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.user-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 8px 2px 4px;
    border-radius: 20px;
    background: #f8f9fa;
}

.user-avatar-mini {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
}

.user-nickname {
    font-size: 13px;
    color: #515767;
    font-weight: 500;
}

.footer-right {
    margin-left: auto;
    /* 将统计数据推向最右侧 */
}

.meta-stats-group {
    display: flex;
    gap: 12px;
}

.stat-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #999;
}

.stat-icon {
    font-style: normal;
}

/* --- 右侧媒体样式 --- */
.article-thumb-v2 {
    width: 160px;
    height: 100px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: #000;
    /* 视频背景通常用黑色 */
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
}

/* 🔥 新增：封面图容器 */
.image-cover-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
}

/* 🔥 新增：类型角标 */
.type-badge {
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    color: #fff;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.type-badge.audio {
    background: rgba(106, 90, 205, 0.8);
    /* 紫色 */
}

.type-badge.short {
    background: rgba(66, 184, 131, 0.8);
    /* 绿色 */
}

.media-container {
    width: 100%;
    height: 100%;
}

.item-media {
    width: 100%;
    height: 100%;
    object-fit: cover !important;
}

.text-placeholder {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    color: #fff;
    font-weight: 900;
    letter-spacing: 1px;
}

@media (max-width: 768px) {
    .article-item-flat {
        flex-direction: column-reverse;
        padding: 16px;
    }

    .article-thumb-v2 {
        width: 100%;
        height: 180px;
    }

    .footer-right {
        margin-left: 0;
        margin-top: 10px;
        width: 100%;
    }

    .article-footer-row {
        flex-wrap: wrap;
    }
}

/* ArticleItem.vue 样式 */
.artistic-text-cover {
    width: 100%;
    height: 100%;
    background: #fdfaf2;
    /* 奶油色背景 */
    background-image: url('https://www.transparenttextures.com/patterns/natural-paper.png');
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 10px;
    text-align: center;
}

.quote-mark {
    font-family: "Georgia", serif;
    font-size: 2rem;
    color: #d2a679;
    opacity: 0.3;
    line-height: 1;
}

.text-preview {
    font-size: 11px;
    color: #5d4a3b;
    font-weight: 700;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>