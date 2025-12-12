// main.js
import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import router from "./router.js";
import scrollManager from "@/utils/scrollManager.js";
import "./style.css";

const app = createApp(App);
const pinia = createPinia();

pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);

// 初始化滚动管理器
scrollManager.init(router);

app.mount("#app");

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error("Vue 错误:", err, "组件:", instance, "信息:", info);
};
