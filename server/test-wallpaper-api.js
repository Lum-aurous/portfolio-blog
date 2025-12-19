// test-wallpaper-api.js
require("dotenv").config();
const axios = require("axios");

async function testBingAPI() {
  try {
    console.log("🔍 测试Bing API...");
    const response = await axios.get(process.env.WALLPAPER_API_BING);
    const data = response.data;

    if (data.images && data.images[0]) {
      console.log("✅ Bing API 正常");
      console.log(`   标题: ${data.images[0].title}`);
      console.log(`   URL: https://cn.bing.com${data.images[0].url}`);
    } else {
      console.log("❌ Bing API 返回数据格式异常");
    }
  } catch (error) {
    console.log("❌ Bing API 请求失败:", error.message);
  }
}

async function testFallback() {
  console.log("🔍 测试备用壁纸...");
  const fallbacks = process.env.FALLBACK_WALLPAPERS.split(",");
  console.log(`   找到 ${fallbacks.length} 个备用壁纸`);
  console.log(`   第一个备用壁纸: ${fallbacks[0].substring(0, 80)}...`);
}

// 运行测试
testBingAPI();
testFallback();
