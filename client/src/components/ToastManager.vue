<script setup>
import { useToastState } from '@/utils/message.js'

// 获取全局消息状态
const { toasts } = useToastState()

// 图标数据 (SVG)
const icons = {
    success: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#42b883"/>',
    error: '<path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="#ff6b6b"/>',
    warning: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#fca5a5"/>', // 这里的颜色可以调整
    info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="#3b82f6"/>'
}
</script>

<template>
    <div class="toast-container">
        <TransitionGroup name="toast-slide">
            <div v-for="toast in toasts" :key="toast.id" class="toast-item">
                <svg viewBox="0 0 24 24" class="toast-icon" v-html="icons[toast.type]"></svg>
                <span class="toast-text">{{ toast.content }}</span>
            </div>
        </TransitionGroup>
    </div>
</template>

<style scoped>
.toast-container {
    position: fixed;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    /* 最高层级，确保在所有弹窗之上 */
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    pointer-events: none;
    /* 让鼠标事件穿透容器，不挡下面操作 */
}

.toast-item {
    pointer-events: auto;
    /* 恢复消息本身的鼠标事件 */
    display: flex;
    align-items: center;
    padding: 12px 24px;
    min-width: 300px;
    max-width: 90vw;
    background: rgba(30, 30, 30, 0.85);
    /* 深色背景 */
    backdrop-filter: blur(12px) saturate(180%);
    /* 毛玻璃 */
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50px;
    /* 大圆角，胶囊状 */
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

.toast-icon {
    width: 20px;
    height: 20px;
    margin-right: 12px;
    flex-shrink: 0;
}

/* 动画效果：从上滑下，消失时上浮 */
.toast-slide-enter-active,
.toast-slide-leave-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    /* 弹性效果 */
}

.toast-slide-enter-from {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
}

.toast-slide-leave-to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
}
</style>