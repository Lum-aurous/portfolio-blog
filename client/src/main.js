// main.js
import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import "./style.css";
import App from "./App.vue";
import router from "./router.js";

// 现在可以放心用 @ 了！
import { useUserStore } from "@/stores/user.js";

const app = createApp(App);

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(pinia);
app.use(router);

// 恢复登录状态（现在真的生效了！）
const userStore = useUserStore();
userStore.init();

app.mount("#app");
