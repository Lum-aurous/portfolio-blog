<!-- CommentItem.vue -->
<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
    comment: {
        type: Object,
        required: true
    },
    depth: {
        type: Number,
        default: 0
    },
    isLoggedIn: Boolean,
    currentUser: Object,
    isAdmin: Boolean
})

const emit = defineEmits(['reply', 'like', 'delete'])

const handleReply = () => {
    emit('reply', props.comment)
}

const handleLike = () => {
    emit('like', props.comment)
}

const handleDelete = () => {
    emit('delete', props.comment.id)
}

// 限制最大深度，防止无限递归和样式问题
const maxDepth = 5
const shouldStopRecursion = props.depth >= maxDepth
</script>

<template>
    <div class="comment-item" :class="`comment-depth-${depth}`">
        <div class="comment-avatar">
            <img :src="comment.avatar || 'https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg'" :alt="comment.nickname">
        </div>

        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">@{{ comment.nickname }}</span>
                <span class="comment-time">{{ formatCommentDate(comment.created_at) }}</span>
            </div>

            <div class="comment-body">
                <p>{{ comment.content }}</p>
                <div v-if="comment.images?.length" class="comment-images">
                    <img v-for="(img, i) in comment.images" :key="i" :src="img" alt="评论图片">
                </div>
            </div>

            <div class="comment-actions">
                <button class="action-btn like-btn" :class="{ active: comment.is_liked }" @click="handleLike">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path
                            d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z" />
                    </svg>
                    <span class="count">{{ comment.like_count || 0 }}</span>
                </button>

                <button class="action-btn reply-btn" @click="handleReply" :disabled="!isLoggedIn">
                    回复
                </button>

                <button v-if="isAdmin || currentUser?.username === comment.nickname" class="action-btn delete-btn"
                    @click="handleDelete">
                    删除
                </button>
            </div>
        </div>

        <!-- 递归渲染回复 -->
        <div v-if="comment.replies && comment.replies.length > 0 && !shouldStopRecursion" class="comment-replies">
            <CommentItem v-for="reply in comment.replies" :key="reply.id" :comment="reply" :depth="depth + 1"
                :isLoggedIn="isLoggedIn" :currentUser="currentUser" :isAdmin="isAdmin" @reply="emit('reply', $event)"
                @like="emit('like', $event)" @delete="emit('delete', $event)" />
        </div>

        <!-- 深度限制提示 -->
        <div v-if="shouldStopRecursion && comment.replies && comment.replies.length > 0" class="depth-limit-message">
            还有 {{ comment.replies.length }} 条回复，点击展开...
        </div>
    </div>
</template>

<style scoped>
.comment-item {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    position: relative;
}

.comment-depth-0 {
    padding: 20px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e5e5;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.comment-depth-1,
.comment-depth-2,
.comment-depth-3,
.comment-depth-4 {
    padding: 16px;
    background: #f9f9f9;
    border-radius: 10px;
    border: 1px solid #eee;
    margin-left: 52px;
    position: relative;
}

.comment-depth-1::before,
.comment-depth-2::before,
.comment-depth-3::before,
.comment-depth-4::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -26px;
    width: 20px;
    height: 2px;
    background-color: #e5e5e5;
}

.comment-avatar img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.comment-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
}

.action-btn {
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: #606060;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
}

.action-btn:hover {
    background: #f0f0f0;
}

.like-btn.active {
    color: #ff0000;
}

.depth-limit-message {
    margin-top: 8px;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #666;
    cursor: pointer;
    text-align: center;
}

.depth-limit-message:hover {
    background: #e8e8e8;
}
</style>