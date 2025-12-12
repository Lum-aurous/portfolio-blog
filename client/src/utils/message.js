import { reactive } from "vue";

// 1. 创建响应式状态，存储当前所有的消息
const state = reactive({
  toasts: [],
});

let idCounter = 0;

// 2. 核心：添加消息的函数
const addToast = (type, content, duration = 3000) => {
  const id = idCounter++;
  const toast = { id, type, content };

  // 把新消息推入队列
  state.toasts.push(toast);

  // 设置定时器，时间到了自动移除
  setTimeout(() => {
    removeToast(id);
  }, duration);
};

// 3. 移除消息
const removeToast = (id) => {
  const index = state.toasts.findIndex((t) => t.id === id);
  if (index !== -1) {
    state.toasts.splice(index, 1);
  }
};

// 4. 暴露给外部调用的 API
export const message = {
  success: (content, duration) => addToast("success", content, duration),
  error: (content, duration) => addToast("error", content, duration),
  warning: (content, duration) => addToast("warning", content, duration),
  info: (content, duration) => addToast("info", content, duration),
};

// 5. 暴露给组件使用的状态
export const useToastState = () => state;
