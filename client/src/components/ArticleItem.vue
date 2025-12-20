<template>
    <div class="article-item-flat" @click="$emit('click')">
        <div class="article-main">
            <h3 class="article-title">{{ data.title }}</h3>
            <p class="article-excerpt">{{ data.summary }}</p>

            <div class="article-meta-v2">
                <span class="category-tag">{{ data.category || '未分类' }}</span>

                <div class="author-tag">
                    <img :src="data.author_avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'"
                        class="author-mini-img" alt="avatar">
                    <span class="author-name">{{ data.author_name || '匿名作者' }}</span>
                </div>

                <div class="meta-stats">
                    <span class="stat-item" title="浏览量">
                        <span class="stat-icon">👁️</span>
                        {{ formatNumber(data.views) }}
                    </span>
                    <span class="stat-item" title="点赞数" v-if="data.likes !== undefined">
                        <span class="stat-icon">👍</span>
                        {{ formatNumber(data.likes) }}
                    </span>
                    <span class="stat-item" title="评论数" v-if="data.comments !== undefined">
                        <span class="stat-icon">💬</span>
                        {{ formatNumber(data.comments) }}
                    </span>
                </div>
            </div>
        </div>

        <div v-if="data.cover_image" class="article-thumb-v2">
            <img :src="data.cover_image" alt="cover" loading="lazy">
        </div>
    </div>
</template>

<script setup>
defineProps({
    data: {
        type: Object,
        required: true
    }
})
defineEmits(['click'])

// 辅助函数：数字过万时显示 1.2w 格式
const formatNumber = (num) => {
    if (!num) return 0
    return num >= 10000 ? (num / 10000).toFixed(1) + 'w' : num
}
</script>

<style scoped>
.article-item-flat {
    padding: 24px;
    border-bottom: 1px solid #f2f2f2;
    display: flex;
    justify-content: space-between;
    gap: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fff;
}

.article-item-flat:hover {
    background: #fafafa;
    /* 稍微给一点向上的位移感 */
    transform: translateY(-1px);
}

/* 标题样式：悬停变色 */
.article-title {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 10px 0;
    transition: color 0.2s;
}

.article-item-flat:hover .article-title {
    color: #42b883;
    /* 使用你站点的绿色主调 */
}

.article-excerpt {
    font-size: 14px;
    color: #515767;
    /* 稍深一点的灰色，提升阅读体验 */
    line-height: 1.6;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.article-meta-v2 {
    font-size: 13px;
    color: #8a919f;
    display: flex;
    flex-wrap: wrap;
    /* 适配窄屏 */
    gap: 20px;
    align-items: center;
    margin-top: auto;
}

/* 分类标签微调 */
.category-tag {
    color: #42b883;
    background: rgba(66, 184, 131, 0.1);
    padding: 2px 10px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 12px;
}

/* 作者样式 */
.author-tag {
    display: flex;
    align-items: center;
    gap: 6px;
}

.author-mini-img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #eee;
}

.author-name {
    color: #515767;
}

/* 🔥 核心：互动数据区样式 */
.meta-stats {
    display: flex;
    gap: 16px;
    margin-left: 4px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
}

.stat-item:hover {
    color: #1a1a1a;
}

.stat-icon {
    font-size: 14px;
    filter: grayscale(1);
    /* 默认图标灰色 */
    opacity: 0.7;
}

.stat-item:hover .stat-icon {
    filter: grayscale(0);
    /* 悬停时恢复颜色 */
    opacity: 1;
}

/* 封面图优化 */
.article-thumb-v2 {
    width: 150px;
    height: 95px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.article-thumb-v2 img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s;
}

/* 悬停时图片轻微放大 */
.article-item-flat:hover .article-thumb-v2 img {
    transform: scale(1.05);
}

/* 响应式适配 */
@media (max-width: 640px) {
    .article-item-flat {
        padding: 16px;
        flex-direction: column-reverse;
        /* 移动端图片放到文字下方或隐藏 */
        gap: 12px;
    }

    .article-thumb-v2 {
        width: 100%;
        height: 160px;
    }
}
</style>