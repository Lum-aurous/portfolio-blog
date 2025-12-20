require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const winston = require("winston");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const axios = require("axios");
const compression = require("compression"); // 🔥 新增：启用gzip压缩
const helmet = require("helmet"); // 🔥 新增：安全头

const app = express();

// ==========================================
// 🔥 优化1: 启用 Helmet 安全防护
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: false, // 关闭 CSP，因为有前端资源
    crossOriginEmbedderPolicy: false, // 允许跨域嵌入
  })
);

// ==========================================
// 🔥 优化2: 启用 Gzip 压缩（减少传输体积）
// ==========================================
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
    level: 6, // 压缩级别 (0-9，6是平衡点)
  })
);

// ==========================================
// 🔥 Winston 日志系统配置（优化）
// ==========================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "portfolio-backend" },
  transports: [
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 🔥 5MB 自动轮换
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 10485760, // 🔥 10MB 自动轮换
      maxFiles: 7,
    }),
  ],
});

// 开发环境输出到控制台
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// ==========================================
// 📧 邮件服务配置
// ==========================================
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "qq",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// 验证邮件配置（异步）
(async () => {
  try {
    await transporter.verify();
    logger.info("✅ 邮件服务配置成功！");
  } catch (err) {
    logger.error("❌ 邮件服务配置失败:", err.message);
    logger.warn("⚠️ 找回密码功能将不可用");
  }
})();

// ==========================================
// 🔥 优化3: 目录结构检查
// ==========================================
const ensureDirectories = () => {
  const dirs = ["logs", "uploads"];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`📁 创建目录: ${dir}`);
    }
  });
};
ensureDirectories();

// ==========================================
// 🔥 优化4: 静态资源优化（缓存控制）
// ==========================================
app.use(
  "/api/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "7d",
    etag: true,
    lastModified: true,
    immutable: true,
  })
);

app.use(
  express.static(path.join(__dirname, "../client/dist"), {
    maxAge: "1h", // HTML 文件缓存1小时
    etag: true,
  })
);

// 确保 logs 目录存在
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs", { recursive: true });
}

// ==========================================
// 🔥 CORS 配置
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:5173"];

    const cpolarRegex = /^https?:\/\/[a-z0-9-]+\.cpolar\.(cn|io)$/;

    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      cpolarRegex.test(origin)
    ) {
      callback(null, true);
    } else {
      logger.warn(`❌ CORS 拒绝: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ==========================================
// 🔥 优化5: 请求体解析（添加限制）
// ==========================================
app.use(
  express.json({
    limit: "10mb", // 🔥 降低到10MB（更合理）
    verify: (req, res, buf) => {
      req.rawBody = buf.toString(); // 保存原始body用于验签
    },
  })
);
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ==========================================
// 🔥 优化6: 限流配置（简化）
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: "请求过于频繁，请稍后再试" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const skipPaths = [
      "/api/wallpaper/global",
      "/api/profile",
      "/api/articles",
      "/api/articles/hot",
    ];
    return skipPaths.includes(req.path);
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "尝试次数过多，请15分钟后再试" },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const account = req.body?.account || "anonymous";
    return `auth-${account}`;
  },
});

// 只对认证接口应用限流
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/reset-password", authLimiter);

// ==========================================
// 🔥 优化7: 数据库连接池（增强配置）
// ==========================================
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "123456",
  database: process.env.DB_NAME || "my_portfolio",
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  // acquireTimeout: 10000, // 👈 建议暂时注释掉这一行，消除黄色警告
  charset: "utf8mb4",
});

// 测试数据库连接
(async () => {
  try {
    const connection = await dbPool.getConnection();
    logger.info("✅ 数据库连接池创建成功！");
    connection.release();
    initializeWallpaperSystem();
  } catch (err) {
    logger.error("❌ 数据库连接失败:", err);
    process.exit(1);
  }
})();

// ==========================================
// 🔥 优化8: JWT 配置（增强安全性）
// ==========================================
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "your-super-secret-jwt-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24小时内自动刷新

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      iat: Math.floor(Date.now() / 1000), // 🔥 签发时间
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    logger.warn("❌ 未提供认证令牌");
    return res.status(401).json({
      success: false,
      message: "未提供认证令牌，请先登录",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`❌ JWT验证失败: ${err.message}`);
      return res.status(403).json({
        success: false,
        message: "令牌无效或已过期，请重新登录",
        error: err.message,
      });
    }

    // 🔥 优化：检查是否需要刷新token
    const tokenAge = Date.now() - user.iat * 1000;
    if (tokenAge > JWT_REFRESH_THRESHOLD) {
      // Token 即将过期，建议刷新
      res.set("X-Token-Refresh-Suggested", "true");
    }

    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "需要管理员权限",
    });
  }
  next();
}

/**
 * 核心工具：根据 IP 更新用户属地信息
 * @param {number} userId 用户ID
 * @param {string} ip 客户端IP
 */
/**
 * 精细化版：根据 IP 自动更新用户属地
 */
async function updateRegionByIP(userId, ip) {
  // 1. 本地开发环境特殊处理：模拟一个公网 IP 进行测试
  let realIp = ip;
  if (ip === "::1" || ip === "127.0.0.1") {
    // 如果是在本地测试，我们模拟一个 IP（比如香港），确保功能能跑通
    realIp = "1.1.1.1";
    logger.info(`🏠 检测到本地环境，正在使用模拟 IP (${realIp}) 测试功能...`);
  } else {
    realIp = ip.split(",")[0].trim();
  }

  try {
    const response = await axios.get(
      `http://ip-api.com/json/${realIp}?lang=zh-CN`,
      { timeout: 5000 }
    );

    if (response.data.status === "success") {
      const { country, regionName, city } = response.data;
      const regionStr = city
        ? `${country} - ${regionName} - ${city}`
        : `${country} - ${regionName}`;

      await dbPool.query("UPDATE users SET region = ? WHERE id = ?", [
        regionStr,
        userId,
      ]);
      logger.info(`📍 用户 ID=${userId} 属地已更新: ${regionStr}`);
    } else {
      // 如果 API 解析失败，给个保底值，不要让它一直是 NULL
      await dbPool.query(
        "UPDATE users SET region = ? WHERE id = ? AND region IS NULL",
        ["来自星辰大海", userId]
      );
    }
  } catch (err) {
    logger.error(`❌ IP 解析异常: ${err.message}`);
  }
}

// ==========================================
// 🔥 优化9: Multer 配置（增加安全检查）
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const safeName = `${timestamp}-${random}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 9, // 最多9个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("只允许上传图片文件！"));
    }
  },
});

// ==========================================
// 🔥 后台壁纸管理接口
// ==========================================

// 1. 更新全局壁纸配置 (管理员)
app.put(
  "/api/admin/wallpaper/global",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { mode, websiteUrl, dailyUrl, randomUrls } = req.body;

      // 验证模式
      if (!["website", "daily", "random"].includes(mode)) {
        return apiResponse.error(res, "无效的壁纸模式", 400);
      }

      // 构建更新数据
      const updateData = {
        mode: mode,
        website_url: websiteUrl || null,
        daily_url: dailyUrl || null,
        random_urls: JSON.stringify(randomUrls || []),
      };

      // 更新数据库 (假设只有一条记录)
      const [result] = await dbPool.query(
        `UPDATE global_wallpapers 
         SET mode = ?, website_url = ?, daily_url = ?, random_urls = ? 
         WHERE id = 1`,
        [
          updateData.mode,
          updateData.website_url,
          updateData.daily_url,
          updateData.random_urls,
        ]
      );

      // 清除缓存
      clearWallpaperCache();

      logger.info(`📸 全局壁纸配置已更新: mode=${mode}`);
      apiResponse.success(res, "配置更新成功");
    } catch (err) {
      logger.error("更新全局壁纸失败:", err);
      apiResponse.error(res, "更新失败");
    }
  }
);

// 2. 获取所有用户壁纸列表 (管理员)
app.get(
  "/api/admin/wallpapers/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // 查询用户壁纸，关联用户信息
      const [rows] = await dbPool.query(
        `SELECT 
          uw.user_id, 
          uw.wallpaper_url, 
          uw.updated_at,
          u.username,
          u.nickname,
          u.avatar
        FROM user_wallpapers uw
        LEFT JOIN users u ON uw.user_id = u.id
        ORDER BY uw.updated_at DESC
        LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      // 查询总数
      const [countResult] = await dbPool.query(
        "SELECT COUNT(*) as total FROM user_wallpapers"
      );
      const total = countResult[0].total;

      apiResponse.success(res, "获取成功", {
        list: rows,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("获取用户壁纸列表失败:", err);
      apiResponse.error(res, "获取失败");
    }
  }
);

// 3. 删除用户壁纸 (管理员)
app.delete(
  "/api/admin/wallpapers/users/:userId",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.params.userId;

      const [result] = await dbPool.query(
        "DELETE FROM user_wallpapers WHERE user_id = ?",
        [userId]
      );

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "该用户无自定义壁纸", 404);
      }

      logger.info(
        `🗑️ 删除用户壁纸: userId=${userId}, 操作者=${req.user.username}`
      );
      apiResponse.success(res, "删除成功");
    } catch (err) {
      logger.error("删除用户壁纸失败:", err);
      apiResponse.error(res, "删除失败");
    }
  }
);

// ==========================================
// 🔥 优化10: 随机壁纸洗牌系统
// ==========================================
let globalWallpaperCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function clearWallpaperCache() {
  globalWallpaperCache = null;
  cacheTime = 0;
}

async function shuffleGlobalWallpapers() {
  logger.info("🔄 开始洗牌全局壁纸顺序…");
  try {
    const [results] = await dbPool.query(
      "SELECT id, random_urls FROM global_wallpapers"
    );

    if (results.length === 0) {
      logger.info("ℹ️ 没有找到全局壁纸配置");
      return;
    }

    for (const row of results) {
      if (!row.random_urls) continue;

      let urls = Array.isArray(row.random_urls)
        ? row.random_urls
        : JSON.parse(row.random_urls || "[]");

      if (urls.length === 0) continue;

      const shuffled = shuffleArray(urls);
      await dbPool.query(
        "UPDATE global_wallpapers SET random_urls = ? WHERE id = ?",
        [JSON.stringify(shuffled), row.id]
      );

      logger.info(`✅ 壁纸 ID=${row.id} 洗牌完成 (${urls.length} 张)`);
    }

    clearWallpaperCache();
    logger.info("✅ 所有壁纸洗牌完成");
  } catch (err) {
    logger.error("❌ 壁纸洗牌失败:", err);
  }
}

// ==========================================
// 🔥 新增：每日壁纸自动更新逻辑
// ==========================================

// 每日壁纸自动更新函数
async function updateDailyWallpaper() {
  logger.info("📅 开始更新每日壁纸...");
  try {
    // 获取当前全局配置
    const [results] = await dbPool.query(
      "SELECT id, random_urls, daily_url, website_url FROM global_wallpapers LIMIT 1"
    );

    if (results.length === 0) {
      logger.warn("ℹ️ 没有找到全局壁纸配置，跳过每日壁纸更新");
      return;
    }

    const row = results[0];

    // 如果随机轮播列表为空，使用网站背景作为后备
    let urls = [];
    if (row.random_urls) {
      // 解析随机轮播列表
      if (Array.isArray(row.random_urls)) {
        urls = row.random_urls;
      } else if (typeof row.random_urls === "string") {
        try {
          urls = JSON.parse(row.random_urls);
        } catch (e) {
          logger.error("解析随机轮播列表失败:", e);
          urls = [];
        }
      }
    }

    let dailyUrl;

    if (urls.length > 0) {
      // 策略1：按日期选择（确保每天相同）
      const today = new Date();
      const dayOfYear = Math.floor(
        (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
      );
      const index = dayOfYear % urls.length;

      // 策略2：随机选择（如果希望每天随机）
      // const index = Math.floor(Math.random() * urls.length);

      dailyUrl = urls[index];
    } else {
      // 如果随机列表为空，使用网站背景
      dailyUrl = row.website_url || "";
      logger.warn("⚠️ 随机轮播列表为空，使用网站背景作为每日壁纸");
    }

    if (!dailyUrl) {
      logger.warn("ℹ️ 无法确定每日壁纸URL，跳过更新");
      return;
    }

    // 检查是否需要更新（避免重复更新相同的图片）
    if (row.daily_url === dailyUrl) {
      logger.info("📅 每日壁纸无需更新（与昨日相同）");
      return;
    }

    // 更新每日壁纸
    await dbPool.query(
      "UPDATE global_wallpapers SET daily_url = ?, updated_at = NOW() WHERE id = ?",
      [dailyUrl, row.id]
    );

    clearWallpaperCache();
    logger.info(`✅ 每日壁纸已更新: ${dailyUrl.substring(0, 100)}...`);
  } catch (err) {
    logger.error("❌ 更新每日壁纸失败:", err);
  }
}

// ==========================================
// 🔥 修改：安排每日凌晨0点更新每日壁纸（外部API版）
// ==========================================
function scheduleDailyMidnightUpdateAPI() {
  const now = new Date();
  const target = new Date();

  // 设置为第二天凌晨0点
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 1);

  const msUntilMidnight = target.getTime() - now.getTime();

  logger.info(
    `⏰ 下次每日壁纸（API）更新时间: ${target.toLocaleString("zh-CN")}`
  );

  setTimeout(() => {
    // 执行更新
    updateDailyWallpaperFromAPI();

    // 设置每天重复执行
    setInterval(updateDailyWallpaperFromAPI, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

// ==========================================
// 🔥 新增：手动更新每日壁纸接口（管理员用）
// ==========================================
app.post(
  "/api/wallpaper/update-daily",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await updateDailyWallpaper();
      apiResponse.success(res, "每日壁纸已手动更新");
    } catch (err) {
      logger.error("手动更新每日壁纸失败:", err);
      apiResponse.error(res, "更新失败");
    }
  }
);

function scheduleDaily3AMShuffle() {
  const now = new Date();
  const target = new Date();
  target.setHours(3, 0, 0, 0);
  if (now > target) target.setDate(target.getDate() + 1);

  const msUntil3AM = target.getTime() - now.getTime();
  logger.info(`⏰ 下次自动洗牌时间: ${target.toLocaleString("zh-CN")}`);

  setTimeout(() => {
    // 洗牌完成后，再更新每日壁纸
    shuffleGlobalWallpapers().then(() => {
      logger.info("🔄 洗牌完成，更新每日壁纸");
      updateDailyWallpaper().catch((err) =>
        logger.error("洗牌后更新每日壁纸失败:", err)
      );
    });
    // 设置每天重复
    setInterval(() => {
      shuffleGlobalWallpapers().then(() => {
        updateDailyWallpaper().catch((err) =>
          logger.error("每日洗牌后更新每日壁纸失败:", err)
        );
      });
    }, 24 * 60 * 60 * 1000);
  }, msUntil3AM);
}

// ==========================================
// 🔥 新增：外部壁纸API服务
// ==========================================

// 支持的外部API列表
const WALLPAPER_APIS = {
  BING: {
    url:
      process.env.WALLPAPER_API_BING ||
      "https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN",
    parser: (data) => {
      // Bing API返回格式（cn.bing.com版本）
      if (data && data.images && data.images[0]) {
        const image = data.images[0];
        const baseUrl = "https://cn.bing.com";
        return {
          url: `${baseUrl}${image.url}`,
          copyright: image.copyright || "",
          title: image.title || "",
        };
      }
      return null;
    },
  },
  UNSPLASH: {
    url: process.env.WALLPAPER_API_UNSPLASH || null,
    parser: (data) => {
      // Unsplash API返回格式
      if (data && data.urls && data.urls.full) {
        return {
          url: `${data.urls.full}&w=1920&q=80`,
          copyright: data.user ? `Photo by ${data.user.name}` : "",
          title: data.description || data.alt_description || "",
        };
      }
      return null;
    },
  },
  PEXELS: {
    url: process.env.WALLPAPER_API_PEXELS || null,
    parser: (data) => {
      if (data && data.photos && data.photos[0]) {
        const photo = data.photos[0];
        // 🔧 优化：在URL后添加尺寸参数，确保获取适合壁纸的尺寸
        return {
          url: `${photo.src.original}?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop`,
          copyright: photo.photographer ? `Photo by ${photo.photographer}` : "",
          title: photo.alt || "",
        };
      }
      return null;
    },
  },
};
// 备用壁纸列表
const FALLBACK_WALLPAPERS = process.env.FALLBACK_WALLPAPERS
  ? process.env.FALLBACK_WALLPAPERS.split(",")
  : [
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920&q=80",
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1920&q=80",
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1920&q=80",
    ];

/**
 * 从外部API获取每日壁纸
 */
async function fetchWallpaperFromAPI() {
  logger.info("🌐 尝试从外部API获取每日壁纸...");

  // 从配置读取优先级
  const priority = (
    process.env.WALLPAPER_API_PRIORITY || "BING,PEXELS,UNSPLASH"
  )
    .split(",")
    .map((name) => name.trim());

  for (const apiName of priority) {
    const api = WALLPAPER_APIS[apiName];
    if (
      !api ||
      !api.url ||
      (apiName === "UNSPLASH" && api.url.includes("YOUR_"))
    ) {
      continue; // 跳过未配置的API
    }

    try {
      logger.info(`📡 尝试使用 ${apiName} API...`);
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      };
      // 为Pexels添加Authorization头
      if (apiName === "PEXELS" && process.env.PEXELS_API_KEY) {
        headers["Authorization"] = process.env.PEXELS_API_KEY;
      }

      const response = await axios.get(api.url, { headers, timeout: 8000 });
      const wallpaper = api.parser(response.data);
      if (wallpaper && wallpaper.url) {
        logger.info(`✅ 从 ${apiName} API 获取壁纸成功`);
        return wallpaper;
      }
    } catch (error) {
      logger.warn(`⚠️ ${apiName} API 请求失败: ${error.message}`);
    }
  }
  return null;
}

/**
 * 获取备用壁纸
 */
function getFallbackWallpaper() {
  // 使用日期作为种子，确保每天使用不同的备用壁纸
  const today = new Date();
  const dayOfYear = Math.floor(
    (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );
  const index = dayOfYear % FALLBACK_WALLPAPERS.length;

  return {
    url: FALLBACK_WALLPAPERS[index],
    copyright: "备用壁纸",
    title: "每日一图",
  };
}

/**
 * 更新每日壁纸（使用外部API）
 */
async function updateDailyWallpaperFromAPI() {
  logger.info("📅 开始更新每日壁纸（外部API）...");

  try {
    // 1. 尝试从外部API获取
    let wallpaper = null;
    if (process.env.WALLPAPER_API_ENABLED === "true") {
      wallpaper = await fetchWallpaperFromAPI();
    }

    // 2. 如果API失败，使用备用壁纸
    if (!wallpaper) {
      logger.warn("⚠️ 外部API获取失败，使用备用壁纸");
      wallpaper = getFallbackWallpaper();
    }

    // 3. 检查是否需要更新（避免重复更新相同的图片）
    const [currentConfig] = await dbPool.query(
      "SELECT daily_url FROM global_wallpapers LIMIT 1"
    );

    if (
      currentConfig.length > 0 &&
      currentConfig[0].daily_url === wallpaper.url
    ) {
      logger.info("📅 每日壁纸无需更新（与昨日相同）");
      return wallpaper; // 仍然返回壁纸信息
    }

    // 4. 更新数据库
    await dbPool.query(
      "UPDATE global_wallpapers SET daily_url = ?, updated_at = NOW() WHERE id = 1",
      [wallpaper.url]
    );

    // 5. 记录壁纸详情（可选：保存到日志或单独的表）
    await dbPool.query(
      `INSERT INTO wallpaper_history (url, source, title, copyright, used_date) 
       VALUES (?, 'external_api', ?, ?, CURDATE())
       ON DUPLICATE KEY UPDATE 
         url = VALUES(url), 
         title = VALUES(title), 
         copyright = VALUES(copyright)`,
      [wallpaper.url, wallpaper.title, wallpaper.copyright]
    );

    clearWallpaperCache();
    logger.info(`✅ 每日壁纸已更新: ${wallpaper.title}`);
    logger.info(`   URL: ${wallpaper.url.substring(0, 80)}...`);

    return wallpaper;
  } catch (err) {
    logger.error("❌ 更新每日壁纸失败:", err);
    return getFallbackWallpaper();
  }
}

// ==========================================
// 🔥 修改：初始化壁纸系统，添加每日壁纸更新
// ==========================================
function initializeWallpaperSystem() {
  logger.info("🚀 初始化壁纸系统...");

  // 1. 启动时更新每日壁纸（使用外部API）
  updateDailyWallpaperFromAPI().catch((err) =>
    logger.error("❌ 启动时更新每日壁纸失败:", err)
  );

  // 2. 洗牌随机轮播（保持原有的随机轮播系统不变）
  shuffleGlobalWallpapers().catch((err) =>
    logger.error("❌ 启动洗牌失败:", err)
  );

  // 3. 安排每日凌晨3点洗牌（仅洗牌随机轮播，不影响每日壁纸）
  scheduleDaily3AMShuffle();

  // 4. 🔥 新增：安排每日凌晨0点更新每日壁纸（使用外部API）
  scheduleDailyMidnightUpdateAPI();
}

// ==========================================
// 🔥 新增：手动从API更新每日壁纸接口
// ==========================================
app.post(
  "/api/wallpaper/update-daily-api",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const wallpaper = await updateDailyWallpaperFromAPI();

      apiResponse.success(res, "每日壁纸已从API更新", wallpaper);
    } catch (err) {
      logger.error("手动更新每日壁纸失败:", err);
      apiResponse.error(res, "更新失败");
    }
  }
);

// ==========================================
// 🔥 新增：获取壁纸历史记录
// ==========================================
app.get(
  "/api/wallpaper/history",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // 查询历史记录
      const [rows] = await dbPool.query(
        `SELECT * FROM wallpaper_history 
         ORDER BY used_date DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      // 查询总数
      const [countResult] = await dbPool.query(
        "SELECT COUNT(*) as total FROM wallpaper_history"
      );
      const total = countResult[0].total;

      apiResponse.success(res, "获取成功", {
        list: rows,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("获取壁纸历史失败:", err);
      apiResponse.error(res, "获取失败");
    }
  }
);

// ==========================================
// 🔥 验证码定时清理（服务器启动时立即启动）
// ==========================================
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, value] of verificationCodes.entries()) {
    if (now > value.expires) {
      verificationCodes.delete(key);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    logger.info(`🧹 清理了 ${cleanedCount} 个过期验证码`);
  }
}, 60 * 1000); // 每分钟清理一次

// ==========================================
// 🔥 优化12: 统一响应格式
// ==========================================
const apiResponse = {
  success: (res, message, data = null, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },
  error: (res, message, statusCode = 500, errors = null) => {
    res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  },
};

// ==========================================
// 上传接口（需要认证）
// ==========================================

app.post(
  "/api/upload",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return apiResponse.error(res, "请选择图片", 400);
    }

    const fileName = req.file.filename;
    const thumbName = "thumb_" + fileName;

    await sharp(req.file.path)
      .resize(200)
      .jpeg({ quality: 80 })
      .toFile(path.join("uploads", thumbName));

    // 🔥🔥🔥 核心修复：确保返回的路径是相对路径，不含 /api/uploads/
    // 因为前端已经通过代理访问 /uploads 路径
    const webPath = `/uploads/${fileName}`;
    const thumbPath = `/uploads/${thumbName}`;

    console.log(`📁 上传文件路径信息:`);
    console.log(`  物理路径: ${req.file.path}`);
    console.log(`  网络路径: ${webPath}`);
    console.log(`  缩略图路径: ${thumbPath}`);

    apiResponse.success(res, "上传成功", {
      url: webPath, // 返回 /uploads/xxx.jpg
      thumbUrl: thumbPath, // 返回 /uploads/thumb_xxx.jpg
    });
  }
);

// 获取个人简介接口
app.get("/api/profile", async (req, res) => {
  try {
    const [results] = await dbPool.query("SELECT * FROM profile LIMIT 1");
    apiResponse.success(res, "获取成功", results.length > 0 ? results[0] : {});
  } catch (err) {
    logger.error("查询个人简介出错:", err);
    apiResponse.error(res, "服务器内部错误");
  }
});

// ==========================================
// 🔥 获取热门文章（按浏览量排名）
// ==========================================
app.get("/api/articles/hot", async (req, res) => {
  try {
    // 默认返回3篇文章，但允许前端传递不同的limit参数
    const limit = parseInt(req.query.limit) || 3;

    console.log(`📊 请求热门文章, limit=${limit}`);

    // ✅ 关键修改：你的articles表没有status字段，所以不需要WHERE条件
    // 按浏览量降序排序，如果浏览量相同，按更新时间降序排序
    const [results] = await dbPool.query(
      `SELECT 
        id, 
        title, 
        cover_image, 
        created_at, 
        updated_at,
        views,
        comments,
        category,
        summary,
        author_id
      FROM articles 
      ORDER BY views DESC, updated_at DESC 
      LIMIT ?`,
      [limit]
    );

    // 如果没有文章，返回空数组
    if (results.length === 0) {
      console.log("ℹ️ 数据库中没有文章");
      return apiResponse.success(res, "暂无热门文章", []);
    }

    console.log(`✅ 从数据库查询到 ${results.length} 篇热门文章`);

    // 格式化处理
    const formattedResults = await Promise.all(
      results.map(async (article) => {
        // 获取作者信息（如果需要的话）
        let authorInfo = null;
        if (article.author_id) {
          try {
            const [authorResult] = await dbPool.query(
              "SELECT username, nickname, avatar FROM users WHERE id = ?",
              [article.author_id]
            );
            if (authorResult.length > 0) {
              authorInfo = {
                username: authorResult[0].username,
                nickname: authorResult[0].nickname,
                avatar: authorResult[0].avatar,
              };
            }
          } catch (err) {
            console.log(`⚠️ 获取作者信息失败: ${err.message}`);
          }
        }

        const createdDate = new Date(article.created_at);
        const updatedDate = new Date(article.updated_at);
        const isUpdated =
          Math.abs(updatedDate.getTime() - createdDate.getTime()) > 1000;

        return {
          id: article.id,
          title: article.title,
          cover_image: article.cover_image,
          views: article.views || 0,
          comments: article.comments || 0,
          category: article.category || "未分类",
          summary: article.summary || "",
          created_at: article.created_at,
          updated_at: article.updated_at,
          // 格式化后的日期
          created_at_formatted: formatDateTime(article.created_at),
          updated_at_formatted: formatDateTime(article.updated_at),
          // 显示用日期（带前缀说明）
          display_date: isUpdated
            ? `📝 ${formatDateTime(article.updated_at)}`
            : `📅 ${formatDateTime(article.created_at)}`,
          // 是否更新过
          has_been_updated: isUpdated,
          // 作者信息
          author: authorInfo,
        };
      })
    );

    logger.info(`热门文章获取成功: ${formattedResults.length}篇`);
    apiResponse.success(res, "获取热门文章成功", formattedResults);
  } catch (err) {
    logger.error("获取热门文章失败:", err);
    // 返回更详细的错误信息
    apiResponse.error(res, "获取热门文章失败: " + err.message, 500);
  }
});

// 1. 获取互动状态 (点赞、收藏)
app.get(
  "/api/articles/:id/interaction-status",
  authenticateToken,
  async (req, res) => {
    try {
      const articleId = req.params.id;
      const userId = req.user.id;

      // 使用 try-catch 包裹查询，如果表不存在则返回 false 而不是崩溃
      let liked = false;
      let favorited = false;

      try {
        const [likes] = await dbPool.query(
          "SELECT id FROM article_likes WHERE user_id = ? AND article_id = ?",
          [userId, articleId]
        );
        liked = likes.length > 0;
        const [favs] = await dbPool.query(
          "SELECT id FROM article_favorites WHERE user_id = ? AND article_id = ?",
          [userId, articleId]
        );
        favorited = favs.length > 0;
      } catch (dbErr) {
        logger.error("数据库查询失败（可能表未创建）:", dbErr.message);
      }

      apiResponse.success(res, "获取成功", {
        isLiked: liked,
        isFavorited: favorited,
      });
    } catch (err) {
      apiResponse.error(res, "服务器错误");
    }
  }
);

// ==========================================
// 1. 获取当前用户拥有的专栏列表 (用于下拉选择)
// ==========================================
app.get("/api/user/columns/simple", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // 只查询 ID 和名称，效率最高
    const [rows] = await dbPool.query(
      "SELECT id, name FROM columns WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    apiResponse.success(res, "获取成功", rows);
  } catch (err) {
    apiResponse.error(res, "获取失败");
  }
});

// ==========================================
// 2. 将文章加入专栏 (核心操作)
// ==========================================
app.post(
  "/api/columns/:columnId/articles",
  authenticateToken,
  async (req, res) => {
    try {
      const { columnId } = req.params;
      const { articleId } = req.body;
      const userId = req.user.id;

      // 安全检查：确保该专栏确实属于当前用户
      const [col] = await dbPool.query(
        "SELECT id FROM columns WHERE id = ? AND user_id = ?",
        [columnId, userId]
      );
      if (col.length === 0)
        return apiResponse.error(res, "专栏不存在或无权操作", 403);

      // 插入关联表 (使用 IGNORE 或 ON DUPLICATE 防止重复添加)
      await dbPool.query(
        "INSERT IGNORE INTO column_articles (column_id, article_id) VALUES (?, ?)",
        [columnId, articleId]
      );

      apiResponse.success(res, "已成功归类到专栏");
    } catch (err) {
      logger.error("归类失败:", err);
      apiResponse.error(res, "操作失败");
    }
  }
);

// ==========================================
// 🔥 新增：文章互动操作接口 (点赞/收藏/加入专栏)
// ==========================================

// 1. 点赞/取消点赞
app.post("/api/articles/:id/like", authenticateToken, async (req, res) => {
  try {
    const articleId = req.params.id;
    const userId = req.user.id;

    // 检查是否已点赞
    const [existing] = await dbPool.query(
      "SELECT id FROM article_likes WHERE user_id = ? AND article_id = ?",
      [userId, articleId]
    );

    if (existing.length > 0) {
      // 已点赞 -> 取消
      await dbPool.query("DELETE FROM article_likes WHERE id = ?", [
        existing[0].id,
      ]);
      return apiResponse.success(res, "已取消点赞", { status: "unliked" });
    } else {
      // 未点赞 -> 添加
      await dbPool.query(
        "INSERT INTO article_likes (user_id, article_id) VALUES (?, ?)",
        [userId, articleId]
      );
      return apiResponse.success(res, "点赞成功", { status: "liked" });
    }
  } catch (err) {
    logger.error("点赞失败:", err);
    apiResponse.error(res, "操作失败");
  }
});

// 2. 收藏/取消收藏
app.post("/api/articles/:id/favorite", authenticateToken, async (req, res) => {
  try {
    const articleId = req.params.id;
    const userId = req.user.id;

    const [existing] = await dbPool.query(
      "SELECT id FROM article_favorites WHERE user_id = ? AND article_id = ?",
      [userId, articleId]
    );

    if (existing.length > 0) {
      await dbPool.query("DELETE FROM article_favorites WHERE id = ?", [
        existing[0].id,
      ]);
      return apiResponse.success(res, "已取消收藏", { status: "unfavorited" });
    } else {
      await dbPool.query(
        "INSERT INTO article_favorites (user_id, article_id) VALUES (?, ?)",
        [userId, articleId]
      );
      return apiResponse.success(res, "收藏成功", { status: "favorited" });
    }
  } catch (err) {
    logger.error("收藏失败:", err);
    apiResponse.error(res, "操作失败");
  }
});

// 3. 将文章添加到指定专栏
app.post(
  "/api/columns/:columnId/articles",
  authenticateToken,
  async (req, res) => {
    try {
      const { columnId } = req.params;
      const { articleId } = req.body;

      // 检查该文章是否已在专栏中 (假设你有 column_articles 关联表)
      // 如果你还没建关联表，建议建一个：column_id, article_id
      await dbPool.query(
        "INSERT INTO column_articles (column_id, article_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE article_id=article_id",
        [columnId, articleId]
      );
      apiResponse.success(res, "已添加到专栏");
    } catch (err) {
      apiResponse.error(res, "添加失败");
    }
  }
);

// 🔥 新增：获取用户收藏的文章列表
app.get("/api/user/favorites", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return apiResponse.error(res, "缺少用户名", 400);

    // 1. 先根据用户名查出用户 ID
    const [userRows] = await dbPool.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    if (userRows.length === 0) return apiResponse.error(res, "用户不存在", 404);
    const userId = userRows[0].id;

    // 2. 关联查询：查出该用户收藏的所有文章详情
    const [favorites] = await dbPool.query(
      `SELECT 
        a.id, a.title, a.summary, a.cover_image, a.category, a.views, a.created_at,
        u.nickname as author_name, u.avatar as author_avatar
      FROM articles a
      JOIN article_favorites f ON a.id = f.article_id
      JOIN users u ON a.author_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC`,
      [userId]
    );

    apiResponse.success(res, "获取收藏列表成功", favorites);
  } catch (err) {
    logger.error("获取收藏列表失败:", err);
    apiResponse.error(res, "服务器错误");
  }
});

// ==========================================
// 🔥 补全：获取指定用户的专栏列表 (Profile 页面使用)
// ==========================================
app.get("/api/columns", async (req, res) => {
  try {
    const { author } = req.query; // 接收前端传来的用户名
    if (!author) return apiResponse.error(res, "缺少作者参数", 400);

    // 1. 先根据用户名查出该用户的 ID
    const [userRows] = await dbPool.query(
      "SELECT id FROM users WHERE username = ?",
      [author]
    );
    if (userRows.length === 0) return apiResponse.error(res, "用户不存在", 404);
    const userId = userRows[0].id;

    // 2. 查询专栏，并关联统计该专栏下的文章总数
    const [columns] = await dbPool.query(
      `
      SELECT 
        c.id, 
        c.name, 
        c.description, 
        c.cover, 
        c.created_at,
        (SELECT COUNT(*) FROM column_articles WHERE column_id = c.id) as articleCount
      FROM columns c
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `,
      [userId]
    );

    apiResponse.success(res, "获取专栏列表成功", columns);
  } catch (err) {
    logger.error("获取专栏列表失败:", err);
    apiResponse.error(res, "服务器内部错误");
  }
});

// ==========================================
// 🔥 新增：创建专栏 (像创建文件夹一样)
// ==========================================
app.post("/api/columns", authenticateToken, async (req, res) => {
  try {
    const { name, description, cover } = req.body;
    const userId = req.user.id;

    if (!name) return apiResponse.error(res, "专栏名称不能为空", 400);

    const [result] = await dbPool.query(
      "INSERT INTO columns (user_id, name, description, cover) VALUES (?, ?, ?, ?)",
      [userId, name, description || "", cover || ""]
    );

    logger.info(`📁 用户 ID=${userId} 创建了新专栏: ${name}`);
    apiResponse.success(res, "专栏创建成功", { id: result.insertId }, 201);
  } catch (err) {
    logger.error("创建专栏失败:", err);
    logger.error("创建专栏失败:", err);
    // 🔥 修改这里：把 err.message 返回给前端，这样你就不用看终端也能知道错哪了
    apiResponse.error(res, "创建失败: " + err.message);
  }
});

// ==========================================
// 🔥 新增：删除专栏
// ==========================================
app.delete("/api/columns/:id", authenticateToken, async (req, res) => {
  try {
    const columnId = req.params.id;
    const userId = req.user.id;

    // 1. 权限检查：只能删除自己的专栏
    const [existing] = await dbPool.query(
      "SELECT id FROM columns WHERE id = ? AND user_id = ?",
      [columnId, userId]
    );
    if (existing.length === 0)
      return apiResponse.error(res, "专栏不存在或无权操作", 403);

    // 2. 开启事务：删除专栏本身，并解除所有文章关联
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();
    try {
      await connection.query(
        "DELETE FROM column_articles WHERE column_id = ?",
        [columnId]
      );
      await connection.query("DELETE FROM columns WHERE id = ?", [columnId]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    apiResponse.success(res, "专栏已删除");
  } catch (err) {
    logger.error("删除专栏失败:", err);
    apiResponse.error(res, "删除失败");
  }
});

// ==========================================
// 🔥 获取专栏详情及其包含的文章列表
// ==========================================
app.get("/api/columns/:id", async (req, res) => {
  try {
    const columnId = req.params.id;

    // 1. 修改这里：在 SELECT 中增加 u.avatar
    const [columnRows] = await dbPool.query(
      `SELECT c.*, u.username, u.nickname, u.avatar 
       FROM columns c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.id = ?`,
      [columnId]
    );

    if (columnRows.length === 0) {
      return apiResponse.error(res, "该专栏不存在", 404);
    }

    // 2. 查询文章列表（之前我们已经写了关联 author_avatar，确保它存在即可）
    const [articles] = await dbPool.query(
      `SELECT 
          a.id, a.title, a.summary, a.cover_image, a.category, a.views, a.created_at,
          u.nickname as author_name, u.avatar as author_avatar, u.username as author_username
       FROM articles a
       JOIN column_articles ca ON a.id = ca.article_id
       JOIN users u ON a.author_id = u.id
       WHERE ca.column_id = ?
       ORDER BY ca.added_at DESC`,
      [columnId]
    );

    apiResponse.success(res, "获取成功", {
      info: columnRows[0],
      articles: articles,
    });
  } catch (err) {
    logger.error("获取专栏详情失败:", err);
    apiResponse.error(res, "服务器内部错误");
  }
});

// ==========================================
// 🔥 从专栏中移除文章 (仅解除关联，不删文章)
// ==========================================
app.delete(
  "/api/columns/:columnId/articles/:articleId",
  authenticateToken,
  async (req, res) => {
    try {
      const { columnId, articleId } = req.params;
      const userId = req.user.id;

      // 1. 安全检查：确保该专栏属于当前登录用户
      const [col] = await dbPool.query(
        "SELECT id FROM columns WHERE id = ? AND user_id = ?",
        [columnId, userId]
      );

      if (col.length === 0) {
        return apiResponse.error(res, "无权操作此专栏或专栏不存在", 403);
      }

      // 2. 删除关联表中的记录
      const [result] = await dbPool.query(
        "DELETE FROM column_articles WHERE column_id = ? AND article_id = ?",
        [columnId, articleId]
      );

      if (result.affectedRows > 0) {
        apiResponse.success(res, "已从专栏中移除");
      } else {
        apiResponse.error(res, "该文章不在专栏中", 404);
      }
    } catch (err) {
      logger.error("移除专栏文章失败:", err);
      apiResponse.error(res, "移除操作失败");
    }
  }
);

// 添加日期格式化辅助函数
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ==========================================
// ✅ 完美修正版：获取文章列表 (支持分页、分类、关键词、作者筛选)
// ==========================================
app.get("/api/articles", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || "";
    const keyword = req.query.keyword || "";
    const author = req.query.author || ""; // 🔥 接收前端传来的用户名

    const offset = (page - 1) * limit;

    // 1. 构建基础的 WHERE 条件
    let whereClause = "WHERE 1=1";
    let queryParams = [];

    // 分类筛选
    if (category && category !== "latest" && category !== "all") {
      whereClause += " AND a.category = ?";
      queryParams.push(category);
    }

    // 关键词搜索
    if (keyword) {
      whereClause += " AND (a.title LIKE ? OR a.summary LIKE ?)";
      const likeKey = `%${keyword}%`;
      queryParams.push(likeKey, likeKey);
    }

    // 🔥 核心修正：正确拼接作者筛选条件
    if (author) {
      whereClause += " AND u.username = ?"; // 使用 AND 连接，变量名对应 queryParams
      queryParams.push(author);
    }

    // --- 2. 查询总数 ---
    const countSql = `
      SELECT COUNT(*) as total 
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      ${whereClause}
    `;
    const [countResult] = await dbPool.query(countSql, queryParams);
    const total = countResult[0].total;

    // --- 3. 查询当前页数据 ---
    const sql = `
          SELECT 
            a.*, 
            u.nickname as author_name, 
            u.avatar as author_avatar,
            u.username as author_username,
            (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes,
            (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments,
            (SELECT COUNT(*) FROM article_favorites WHERE article_id = a.id) as favorites
          FROM articles a
          LEFT JOIN users u ON a.author_id = u.id
          ${whereClause}
          ORDER BY a.created_at DESC
          LIMIT ? OFFSET ?
        `;

    // 组合所有参数执行查询
    const [rows] = await dbPool.query(sql, [...queryParams, limit, offset]);

    // 4. 返回结果
    apiResponse.success(res, "获取文章列表成功", {
      list: rows, // 🔥 前端通过 res.data.data.list 获取
      pagination: {
        current: page,
        pageSize: limit,
        total: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error("查询文章列表出错:", err);
    apiResponse.error(res, "获取文章列表失败: " + err.message);
  }
});

// ==========================================
// 🔥 新增：全站文章搜索接口 (支持标题、摘要、内容、分类模糊搜索)
// ==========================================
app.get("/api/articles/search", async (req, res) => {
  try {
    const { q } = req.query; // q 是前端传来的搜索关键词

    if (!q || q.trim() === "") {
      return apiResponse.error(res, "搜索关键词不能为空", 400);
    }

    const keyword = `%${q.trim()}%`; // 添加 SQL 通配符

    // 搜索逻辑：标题 OR 摘要 OR 内容 OR 分类
    const [results] = await dbPool.query(
      `
      SELECT * FROM articles 
      WHERE title LIKE ? 
         OR summary LIKE ? 
         OR content LIKE ? 
         OR category LIKE ?
      ORDER BY created_at DESC
    `,
      [keyword, keyword, keyword, keyword]
    );

    logger.info(`🔍 搜索关键词: "${q}", 找到 ${results.length} 篇匹配文章`);

    apiResponse.success(res, "搜索成功", results);
  } catch (err) {
    logger.error("搜索文章失败:", err);
    apiResponse.error(res, "搜索服务暂时不可用");
  }
});

// ==========================================
// 🔥 新增：获取博客全站统计数据
// ==========================================
app.get("/api/blog/stats", async (req, res) => {
  try {
    // 使用聚合查询一次性获取三个指标
    // COUNT(*) -> 文章总数
    // COUNT(DISTINCT category) -> 分类总数 (去重)
    // SUM(views) -> 所有文章浏览量之和 (如果为null则默认为0)
    const [results] = await dbPool.query(`
      SELECT 
        COUNT(*) as articleCount,
        COUNT(DISTINCT category) as categoryCount,
        COALESCE(SUM(views), 0) as totalViews
      FROM articles
    `);

    const stats = results[0];

    logger.info(
      `📊 获取全站统计: 文章=${stats.articleCount}, 分类=${stats.categoryCount}, 浏览=${stats.totalViews}`
    );

    apiResponse.success(res, "获取统计成功", {
      articleCount: stats.articleCount || 0,
      categoryCount: stats.categoryCount || 0,
      totalViews: stats.totalViews || 0,
    });
  } catch (err) {
    logger.error("获取博客统计失败:", err);
    // 即使失败也返回0，不阻断前端展示
    apiResponse.success(res, "获取统计失败(降级)", {
      articleCount: 0,
      categoryCount: 0,
      totalViews: 0,
    });
  }
});

// ==========================================
// 🔥 新增：获取所有已存在的分类列表
// ==========================================
app.get("/api/categories", async (req, res) => {
  try {
    // DISTINCT 用于去重，只查有文章的分类
    const [results] = await dbPool.query(
      "SELECT DISTINCT category FROM articles WHERE category IS NOT NULL AND category != ''"
    );

    // 提取纯数组格式: ['Veritas', '生活倒影', ...]
    const categories = results.map((row) => row.category);

    apiResponse.success(res, "获取分类列表成功", categories);
  } catch (err) {
    logger.error("获取分类列表失败:", err);
    apiResponse.error(res, "获取分类失败");
  }
});

// ==========================================
// 🔥 新增：智能标签云数据接口 (聚合分类 + 标题关键词)
// ==========================================
app.get("/api/tags/cloud", async (req, res) => {
  try {
    // 1. 获取所有文章的标题和分类
    const [rows] = await dbPool.query("SELECT title, category FROM articles");

    const tagSet = new Set();
    const keywordsMap = new Map();

    // 🚫 停用词表 (过滤掉无意义的词)
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "and",
      "with",
      "is",
      "are",
      "how",
      "why",
      "what",
      "的",
      "了",
      "是",
      "在",
      "和",
      "与",
      "及",
      "等",
      "篇",
      "之",
      "教程",
      "指南",
      "实战",
      "使用",
      "笔记",
    ]);

    rows.forEach((row) => {
      // A. 将分类直接作为核心标签
      if (row.category) tagSet.add(row.category);

      // B. 简单分词逻辑 (提取标题中的英文单词或较长的中文词)
      // 这里做一个简单的正则提取：提取英文单词、数字、或连续的中文字符
      const rawTitle = row.title || "";
      // 将标题按空格、标点符号拆分
      const segments = rawTitle.split(/[\s,\.\?\!，。？！\[\]【】\(\)\-\/]+/);

      segments.forEach((seg) => {
        const word = seg.trim();
        // 过滤条件：长度大于1，不在停用词表中
        if (word.length > 1 && !stopWords.has(word.toLowerCase())) {
          // 统计词频
          const count = keywordsMap.get(word) || 0;
          keywordsMap.set(word, count + 1);
        }
      });
    });

    // C. 选取高频词 (比如前 20 个)
    const sortedKeywords = [...keywordsMap.entries()]
      .sort((a, b) => b[1] - a[1]) // 按频率降序
      .slice(0, 20)
      .map((entry) => entry[0]);

    // D. 合并分类和高频词
    sortedKeywords.forEach((word) => tagSet.add(word));

    // 转为数组对象
    const result = Array.from(tagSet).map((name, index) => ({
      id: index + 1,
      name: name,
      // 随机分配一个颜色 (后端生成或前端生成均可，这里后端简单给几个色系)
      color: ["#ff9800", "#4caf50", "#2196f3", "#9c27b0", "#e91e63", "#00bcd4"][
        index % 6
      ],
    }));

    // 如果数据太少，补几个默认的，防止球体太空
    if (result.length < 10) {
      const defaults = [
        { id: 901, name: "Veritas", color: "#ff5722" },
        { id: 902, name: "Blog", color: "#795548" },
        { id: 903, name: "Life", color: "#607d8b" },
        { id: 904, name: "Tech", color: "#009688" },
      ];
      result.push(...defaults);
    }

    apiResponse.success(res, "标签云数据生成成功", result);
  } catch (err) {
    logger.error("生成标签云失败:", err);
    apiResponse.error(res, "生成标签失败");
  }
});

// 🔥 获取文章详情时实时统计评论总数
app.get("/api/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await dbPool.query(
      `SELECT 
                a.*, 
                u.nickname AS author_name, 
                u.avatar AS author_avatar,
                u.username AS author_username,
                -- 🔥 子查询：实时统计点赞总数
                (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes,
                -- 🔥 子查询：实时统计收藏总数
                (SELECT COUNT(*) FROM article_favorites WHERE article_id = a.id) as favorites
            FROM articles a 
            LEFT JOIN users u ON a.author_id = u.id 
            WHERE a.id = ?`,
      [id]
    );

    if (results.length > 0) {
      const article = results[0];

      // 🔥 新增：自动记录浏览历史
      // 尝试获取 Token
      const authHeader = req.headers["authorization"];
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
          if (!err && decoded) {
            // 登录用户访问，记录或更新历史时间
            await dbPool
              .query(
                "INSERT INTO user_browsing_history (user_id, article_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE viewed_at = NOW()",
                [decoded.id, id]
              )
              .catch((e) => logger.error("记录历史失败:", e));
          } else {
            console.log("🚫 未记录历史：Token 验证失败或未登录");
          }
        });
      }

      // 🔥 2. 实时统计该文章的所有评论数（包括回复）
      const [commentCount] = await dbPool.query(
        "SELECT COUNT(*) as total FROM comments WHERE article_id = ?",
        [id]
      );

      // 🔥 3. 用实时统计值覆盖数据库中的旧值
      article.comments = commentCount[0].total;

      apiResponse.success(res, "获取成功", article);
    } else {
      apiResponse.error(res, "文章不存在", 404);
    }
  } catch (err) {
    logger.error("查询文章详情出错:", err);
    apiResponse.error(res, "服务器错误");
  }
});

// 🔥 发布文章接口（需要认证和管理员权限）
app.post(
  "/api/articles",
  authenticateToken,
  requireAdmin,
  [
    body("title").trim().notEmpty().withMessage("标题不能为空"),
    body("summary").trim().notEmpty().withMessage("摘要不能为空"),
    body("content").trim().notEmpty().withMessage("内容不能为空"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const { title, summary, content, category, cover_image } = req.body;
      // 🔥 核心修改：从 req.user.id 获取当前登录用户的 ID (由 authenticateToken 中间件解析)
      const authorId = req.user.id;

      const [result] = await dbPool.query(
        "INSERT INTO articles (title, summary, content, category, cover_image, author_id) VALUES (?, ?, ?, ?, ?, ?)",
        [title, summary, content, category, cover_image, authorId]
      );

      logger.info(
        `文章发布成功: ID=${result.insertId}, 标题=${title}, 作者ID=${authorId}`
      );
      apiResponse.success(res, "发布成功", { id: result.insertId }, 201);
    } catch (err) {
      logger.error("发布文章失败:", err);
      apiResponse.error(res, "发布失败");
    }
  }
);

// ==========================================
// 🔥 更新文章接口（用于修改内容后重新发布）
// ==========================================
app.put(
  "/api/articles/:id",
  authenticateToken,
  requireAdmin,
  [
    body("title").trim().notEmpty().withMessage("标题不能为空"),
    body("summary").trim().notEmpty().withMessage("摘要不能为空"),
    body("content").trim().notEmpty().withMessage("内容不能为空"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const articleId = req.params.id;
      const { title, summary, content, category, cover_image } = req.body;
      const authorId = req.user.id; // 当前登录用户

      // 1. 首先检查文章是否存在且属于当前用户
      const [existingArticle] = await dbPool.query(
        "SELECT author_id, updated_at FROM articles WHERE id = ?",
        [articleId]
      );

      if (existingArticle.length === 0) {
        return apiResponse.error(res, "文章不存在", 404);
      }

      // 2. 检查权限：只有文章作者或管理员可以修改
      if (
        existingArticle[0].author_id !== authorId &&
        req.user.role !== "admin"
      ) {
        return apiResponse.error(res, "无权修改此文章", 403);
      }

      // 3. 记录更新前的时间（用于日志）
      const oldUpdateTime = existingArticle[0].updated_at;

      // 4. 更新文章内容
      // 注意：updated_at 字段会自动更新（ON UPDATE CURRENT_TIMESTAMP）
      const [result] = await dbPool.query(
        `UPDATE articles 
         SET title = ?, summary = ?, content = ?, category = ?, cover_image = ?
         WHERE id = ?`,
        [title, summary, content, category, cover_image, articleId]
      );

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "更新失败，文章可能已被删除", 404);
      }

      // 5. 获取更新后的文章信息
      const [updatedArticle] = await dbPool.query(
        `SELECT 
          a.*, 
          u.nickname AS author_name, 
          u.avatar AS author_avatar 
        FROM articles a 
        LEFT JOIN users u ON a.author_id = u.id 
        WHERE a.id = ?`,
        [articleId]
      );

      const article = updatedArticle[0];

      logger.info(`📝 文章更新成功: ID=${articleId}, 作者ID=${authorId}`);
      logger.info(`🕐 更新时间变化: ${oldUpdateTime} → ${article.updated_at}`);

      apiResponse.success(res, "文章更新成功", article);
    } catch (err) {
      logger.error("更新文章失败:", err);
      apiResponse.error(res, "更新失败");
    }
  }
);

// ==========================================
// 🔥 增加文章浏览量（自动统计）
// ==========================================
app.post("/api/articles/:id/view", async (req, res) => {
  try {
    const articleId = req.params.id;

    // 1. 获取客户端IP（用于简单的防刷）
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // 2. 使用原子操作，避免并发问题
    const [result] = await dbPool.query(
      "UPDATE articles SET views = views + 1 WHERE id = ?",
      [articleId]
    );

    if (result.affectedRows === 0) {
      return apiResponse.error(res, "文章不存在", 404);
    }

    // 🔥 核心修改：在增加文章浏览量的同时，增加全站每日访问量
    recordDailyVisit();

    // 3. 获取更新后的浏览量
    const [article] = await dbPool.query(
      "SELECT views FROM articles WHERE id = ?",
      [articleId]
    );

    logger.info(
      `📊 浏览量增加: 文章ID=${articleId}, IP=${clientIp}, 新浏览量=${article[0].views}`
    );

    apiResponse.success(res, "浏览量增加", { views: article[0].views });
  } catch (err) {
    logger.error("增加浏览量失败:", err);
    apiResponse.error(res, "操作失败");
  }
});

// ==========================================
// 🔥 获取文章的更新时间信息（判断是否被修改过）
// ==========================================
app.get("/api/articles/:id/update-status", async (req, res) => {
  try {
    const articleId = req.params.id;

    const [results] = await dbPool.query(
      "SELECT created_at, updated_at FROM articles WHERE id = ?",
      [articleId]
    );

    if (results.length === 0) {
      return apiResponse.error(res, "文章不存在", 404);
    }

    const article = results[0];

    // 判断文章是否被修改过（允许1秒的误差）
    const created = new Date(article.created_at).getTime();
    const updated = new Date(article.updated_at).getTime();
    const hasBeenUpdated = Math.abs(updated - created) > 1000;

    apiResponse.success(res, "获取成功", {
      created_at: article.created_at,
      updated_at: article.updated_at,
      has_been_updated: hasBeenUpdated,
      // 如果被修改过，返回时间差（小时）
      hours_since_update: hasBeenUpdated
        ? Math.round((updated - created) / (1000 * 60 * 60))
        : 0,
    });
  } catch (err) {
    logger.error("获取文章更新时间失败:", err);
    apiResponse.error(res, "获取失败");
  }
});

// ==========================================
// 🔥 修复版：获取全站最新评论 (兼容 JSON 类型自动解析)
// ==========================================
app.get("/api/comments/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // 🔥 核心修改：
    // 1. 关联条件改为 c.nickname = u.username (因为现在评论存的是用户名)
    // 2. 多查一个 u.nickname，用于前端显示（如果用户设置了昵称）
    const [results] = await dbPool.query(
      `
      SELECT 
        c.id, 
        c.content, 
        c.images, 
        c.nickname as comment_username, 
        c.created_at, 
        u.avatar, 
        u.nickname as user_nickname
      FROM comments c
      LEFT JOIN users u ON c.nickname = u.username
      ORDER BY c.created_at DESC
      LIMIT ?
    `,
      [limit]
    );

    const comments = results.map((row) => {
      let images = [];

      if (row.images) {
        if (Array.isArray(row.images)) {
          images = row.images;
        } else if (typeof row.images === "string") {
          try {
            const parsed = JSON.parse(row.images);
            if (Array.isArray(parsed)) images = parsed;
          } catch (e) {
            console.log("图片解析失败:", e.message);
          }
        }
      }

      let content = row.content;
      if ((!content || content.trim() === "") && images.length > 0) {
        content = "📷 分享图片";
      }

      return {
        id: row.id,
        content: content,
        images: images,
        // 🔥 优先显示用户设置的昵称，没有则显示用户名
        nickname: row.user_nickname || row.comment_username || "匿名用户",
        avatar: row.avatar || null,
        created_at: row.created_at,
      };
    });

    apiResponse.success(res, "获取最新评论成功", comments);
  } catch (err) {
    logger.error("获取最新评论失败:", err);
    apiResponse.error(res, "获取最新评论失败");
  }
});

// ==========================================
// 🔥 批量更新评论数（当评论被添加或删除时调用）
// ==========================================
app.post("/api/articles/:id/update-comments-count", async (req, res) => {
  try {
    const articleId = req.params.id;

    // 统计当前文章的评论数量
    const [commentResults] = await dbPool.query(
      "SELECT COUNT(*) as count FROM comments WHERE article_id = ?",
      [articleId]
    );

    const commentCount = commentResults[0].count;

    // 更新文章的评论数
    const [result] = await dbPool.query(
      "UPDATE articles SET comments = ? WHERE id = ?",
      [commentCount, articleId]
    );

    if (result.affectedRows === 0) {
      return apiResponse.error(res, "文章不存在", 404);
    }

    logger.info(
      `📝 更新文章评论数: 文章ID=${articleId}, 新评论数=${commentCount}`
    );

    apiResponse.success(res, "评论数更新成功", {
      article_id: articleId,
      comments: commentCount,
    });
  } catch (err) {
    logger.error("更新评论数失败:", err);
    apiResponse.error(res, "更新失败");
  }
});

// ==========================================
// 🔥 升级版：管理员获取评论 (修复图片不显示问题)
// ==========================================
app.get(
  "/api/admin/comments",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const keyword = req.query.keyword || "";

      const offset = (page - 1) * limit;

      let whereClause = "WHERE 1=1";
      let params = [];

      if (keyword) {
        whereClause += " AND (c.content LIKE ? OR c.nickname LIKE ?)";
        const likeKey = `%${keyword}%`;
        params.push(likeKey, likeKey);
      }

      // 1. 查询总数
      const [countResult] = await dbPool.query(
        `SELECT COUNT(*) as total FROM comments c ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 2. 查询数据 (注意：c.* 包含了 images 字段)
      const sql = `
      SELECT 
        c.*,
        a.title as article_title,
        u.avatar as user_avatar,
        u.nickname as user_nickname
      FROM comments c
      LEFT JOIN articles a ON c.article_id = a.id
      LEFT JOIN users u ON c.nickname = u.username
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

      const dataParams = [...params, limit, offset];
      const [rows] = await dbPool.query(sql, dataParams);

      // 3. 数据清洗 & JSON 解析
      const list = rows.map((row) => {
        // 🔥 核心：解析图片字段
        let images = [];
        try {
          if (row.images) {
            // 如果已经是数组就直接用，如果是字符串就解析
            images =
              typeof row.images === "string"
                ? JSON.parse(row.images)
                : row.images;
          }
        } catch (e) {
          console.error("后台评论图片解析失败:", e);
        }

        return {
          id: row.id,
          content: row.content,
          images: images, // 🔥 把解析好的图片数组返回给前端
          created_at: row.created_at,
          article_id: row.article_id,
          article_title: row.article_title || "未知文章",
          nickname: row.user_nickname || row.nickname,
          avatar: row.user_avatar,
          parent_id: row.parent_id,
        };
      });

      apiResponse.success(res, "获取评论列表成功", {
        list,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("管理员获取评论失败:", err);
      apiResponse.error(res, "获取评论列表失败");
    }
  }
);

// ==========================================
// 🔥 获取 Dashboard 7天趋势数据 (真实数据库版)
// ==========================================
app.get(
  "/api/admin/dashboard/trend",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      // 1. 生成过去 7 天的日期数组 (YYYY-MM-DD)
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }

      // 2. 查询 daily_stats 表中的数据
      // 我们使用 WHERE date IN (...) 查出这几天的记录
      const [rows] = await dbPool.query(
        `SELECT date, views FROM daily_stats WHERE date >= ?`,
        [dates[0]] // 从7天前开始
      );

      // 3. 查询 comments 表，按天分组统计真实评论数
      const [commentRows] = await dbPool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM comments 
       WHERE created_at >= ? 
       GROUP BY DATE(created_at)`,
        [`${dates[0]} 00:00:00`]
      );

      // 4. 数据合并与补零 (关键步骤！)
      // 数据库可能没有某一天的记录（因为那天没人访问），我们需要补 0
      const viewData = [];
      const commentData = [];

      dates.forEach((date) => {
        // 找访问量
        const vRecord = rows.find((r) => {
          // 处理时区导致的日期格式差异，确保匹配 YYYY-MM-DD
          const dbDate = new Date(r.date).toISOString().split("T")[0];
          return dbDate === date;
        });
        viewData.push(vRecord ? vRecord.views : 0);

        // 找评论数
        const cRecord = commentRows.find((r) => {
          const dbDate = new Date(r.date).toISOString().split("T")[0];
          return dbDate === date;
        });
        commentData.push(cRecord ? cRecord.count : 0);
      });

      apiResponse.success(res, "获取趋势数据成功", {
        dates, // x轴：['2025-12-11', '2025-12-12'...]
        viewData, // y轴1：[10, 5, 20...]
        commentData, // y轴2：[0, 1, 3...]
      });
    } catch (err) {
      logger.error("获取趋势图失败:", err);
      apiResponse.error(res, "获取数据失败");
    }
  }
);

// ==========================================
// 🔥 删除文章接口（需要认证和管理员权限）
// ==========================================
app.delete(
  "/api/articles/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const articleId = req.params.id;
      const authorId = req.user.id;

      // 1. 检查文章是否存在
      const [existingArticle] = await dbPool.query(
        "SELECT author_id, title FROM articles WHERE id = ?",
        [articleId]
      );

      if (existingArticle.length === 0) {
        return apiResponse.error(res, "文章不存在", 404);
      }

      // 2. 检查权限：只有文章作者或管理员可以删除
      if (
        existingArticle[0].author_id !== authorId &&
        req.user.role !== "admin"
      ) {
        return apiResponse.error(res, "无权删除此文章", 403);
      }

      // 3. 先删除相关评论（如果有外键约束，数据库会自动处理）
      await dbPool.query("DELETE FROM comments WHERE article_id = ?", [
        articleId,
      ]);

      // 4. 删除文章
      const [result] = await dbPool.query("DELETE FROM articles WHERE id = ?", [
        articleId,
      ]);

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "删除失败", 500);
      }

      logger.info(
        `🗑️ 文章删除成功: ID=${articleId}, 标题=${existingArticle[0].title}, 操作者ID=${authorId}`
      );

      apiResponse.success(res, "文章删除成功");
    } catch (err) {
      logger.error("删除文章失败:", err);
      apiResponse.error(res, "删除失败");
    }
  }
);

// ==========================================
// 🔥 8. 用户注册接口
// ==========================================
app.post(
  "/api/register",
  authLimiter,
  [
    body("account").trim().notEmpty().withMessage("请输入手机号或邮箱"),
    body("password")
      .isLength({ min: 6, max: 50 })
      .withMessage("密码长度应为6-50个字符"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, errors.array()[0].msg, 400);
    }

    try {
      const { account, password } = req.body;

      // 1. 识别账号类型（手机号/邮箱）
      const isPhone = /^1[3-9]\d{9}$/.test(account);
      const isEmail = /^\S+@\S+\.\S+$/.test(account);

      if (!isPhone && !isEmail) {
        return apiResponse.error(
          res,
          "账号格式不正确，请输入有效的手机号或邮箱",
          400
        );
      }

      // 2. 检查账号是否已存在
      let existingUser = null;

      if (isPhone) {
        // 检查手机号
        const [phoneResults] = await dbPool.query(
          "SELECT id FROM users WHERE phone = ? OR phone = ?",
          [`+86 ${account}`, account]
        );
        if (phoneResults.length > 0) {
          return apiResponse.error(res, "该手机号已被注册，请直接登录", 409);
        }
      } else {
        // 检查邮箱
        const [emailResults] = await dbPool.query(
          "SELECT id FROM users WHERE email = ?",
          [account]
        );
        if (emailResults.length > 0) {
          return apiResponse.error(res, "该邮箱已被注册，请直接登录", 409);
        }
      }

      // 3. 生成唯一的用户名（门票阶段的临时用户名）
      let autoUsername = "";
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        autoUsername = `user_${randomSuffix}`;

        // 检查用户名是否唯一
        const [existingUsernames] = await dbPool.query(
          "SELECT id FROM users WHERE username = ?",
          [autoUsername]
        );

        if (existingUsernames.length === 0) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        // 如果尝试10次都失败，使用时间戳
        autoUsername = `user_${Date.now()}`;
      }

      // 4. 密码加密
      const hash = await bcrypt.hash(password, 10);

      // 5. 准备存储数据
      let email = null;
      let phone = null;

      if (isPhone) {
        phone = `+86 ${account}`; // 统一格式
      } else {
        email = account;
      }

      // 6. 插入数据库
      const [result] = await dbPool.query(
        "INSERT INTO users (username, password, email, phone, nickname) VALUES (?, ?, ?, ?, ?)",
        [autoUsername, hash, email, phone, autoUsername] // 初始昵称和用户名相同
      );

      // 🔥 这一步至关重要：
      const clientIp =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      updateRegionByIP(result.insertId, clientIp); // 使用新生成的 ID 触发更新

      logger.info(
        `新用户注册成功: ID=${result.insertId}, 账号=${account}, 初始用户名=${autoUsername}`
      );

      apiResponse.success(
        res,
        "注册成功",
        {
          id: result.insertId,
          account: account,
          autoUsername: autoUsername,
          message: `注册成功！您的初始用户名为：${autoUsername}，登录后可修改`,
        },
        201
      );
    } catch (err) {
      logger.error("注册系统错误:", err);

      // 处理数据库错误
      if (err.code === "ER_DUP_ENTRY") {
        // 根据错误信息判断是哪个字段重复
        if (err.message.includes("username")) {
          return apiResponse.error(res, "用户名冲突，请稍后重试", 409);
        } else if (err.message.includes("email")) {
          return apiResponse.error(res, "邮箱已被注册", 409);
        } else if (err.message.includes("phone")) {
          return apiResponse.error(res, "手机号已被注册", 409);
        }
      }

      apiResponse.error(res, "服务器繁忙，请稍后再试");
    }
  }
);

// ==========================================
// 🔥 找回密码相关接口 (真实邮件发送版)
// ==========================================

// 模拟验证码存储 (内存存储)
const verificationCodes = new Map();

// 3. 发送验证码接口
app.post("/api/reset-password/send-code", authLimiter, async (req, res) => {
  try {
    const { account } = req.body;
    if (!account) return apiResponse.error(res, "请输入账号", 400);

    // --- 步骤 A: 识别账号类型 ---
    const isPhone = /^1[3-9]\d{9}$/.test(account);
    const isEmail = /^\S+@\S+\.\S+$/.test(account);

    if (!isPhone && !isEmail) {
      return apiResponse.error(res, "账号格式不正确", 400);
    }

    // --- 步骤 B: 检查账号是否已注册 ---
    let userQuery;
    let params;
    if (isPhone) {
      userQuery =
        "SELECT id, phone, email FROM users WHERE phone = ? OR phone = ?";
      params = [`+86 ${account}`, account];
    } else {
      userQuery = "SELECT id, phone, email FROM users WHERE email = ?";
      params = [account];
    }

    const [users] = await dbPool.query(userQuery, params);
    if (users.length === 0) {
      return apiResponse.error(res, "该账号未注册，无法找回密码", 404);
    }

    // --- 步骤 C: 生成并存储验证码 ---
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes.set(account, {
      code,
      expires: Date.now() + 5 * 60 * 1000,
    });

    // --- 步骤 D: 发送 (邮件 或 模拟短信) ---
    if (isEmail) {
      // 🔥 真实发送邮件逻辑
      logger.info(`📨 正在尝试向 ${account} 发送邮件...`);

      await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || "Veritas 博客"}" <${
          process.env.EMAIL_USER
        }>`,
        to: account,
        subject: "【Veritas】找回密码验证码",
        text: `您的验证码是：${code}，有效期5分钟。`,
        html: `
    <div style="padding: 20px; background-color: #f6f8fa;">
      <div style="background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #42b883;">🔐 找回密码</h2>
        <p>亲爱的用户：</p>
        <p>您正在申请重置密码，您的验证码是：</p>
        <h1 style="color: #35495e; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${code}</h1>
        <p style="color: #999; font-size: 12px;">有效期 5 分钟，请勿泄露给他人。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #aaa; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
      </div>
    </div>
  `,
      });

      logger.info(`📨 [真实邮件] 已发送至 ${account}`);
      apiResponse.success(res, "验证码已发送至邮箱，请查收");
    } else {
      // 手机号目前只能模拟
      logger.info(`📨 [模拟短信] 向 ${account} 发送验证码: ${code}`);
      apiResponse.success(res, "短信验证码已发送 (请看后端控制台)");
    }
  } catch (err) {
    logger.error("发送验证码失败:", err);
    // 区分一下是不是邮箱配置错误
    if (err.responseCode === 535) {
      return apiResponse.error(res, "邮件服务器认证失败，请联系管理员");
    }
    apiResponse.error(res, "发送失败，请稍后重试");
  }
});

// 2. 重置密码接口
app.post("/api/reset-password/verify", authLimiter, async (req, res) => {
  try {
    const { account, code, newPassword } = req.body;

    if (!account || !code || !newPassword) {
      return apiResponse.error(res, "请填写完整信息", 400);
    }

    if (newPassword.length < 6) {
      return apiResponse.error(res, "新密码长度至少 6 位", 400);
    }

    // 验证验证码
    const record = verificationCodes.get(account);
    if (!record) {
      return apiResponse.error(res, "请先获取验证码", 400);
    }
    if (Date.now() > record.expires) {
      verificationCodes.delete(account);
      return apiResponse.error(res, "验证码已过期，请重新获取", 400);
    }
    if (record.code !== code) {
      return apiResponse.error(res, "验证码错误", 400);
    }

    // 验证通过，加密新密码
    const hash = await bcrypt.hash(newPassword, 10);

    // 更新数据库
    const isPhone = /^1[3-9]\d{9}$/.test(account);
    let updateSql;
    let params;

    if (isPhone) {
      updateSql = "UPDATE users SET password = ? WHERE phone = ? OR phone = ?";
      params = [hash, `+86 ${account}`, account];
    } else {
      updateSql = "UPDATE users SET password = ? WHERE email = ?";
      params = [hash, account];
    }

    await dbPool.query(updateSql, params);

    // 清除验证码
    verificationCodes.delete(account);

    logger.info(`🔓 账号 ${account} 密码重置成功`);
    apiResponse.success(res, "密码重置成功，请重新登录");
  } catch (err) {
    logger.error("重置密码失败:", err);
    apiResponse.error(res, "重置失败，请稍后重试");
  }
});

// ==========================================
// 🔥 1 & 8. 用户登录接口（JWT + 验证）
// ==========================================
app.post(
  "/api/login",
  authLimiter,
  [
    body("account").trim().notEmpty().withMessage("账号不能为空"),
    body("password").notEmpty().withMessage("密码不能为空"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const { account, password } = req.body;

      // 处理手机号格式
      let formattedAccount = account;
      if (/^1[3-9]\d{9}$/.test(account)) {
        formattedAccount = `+86 ${account}`;
      } else if (/^\+86\s?1[3-9]\d{9}$/.test(account)) {
        formattedAccount = account.replace(/\+86\s?/, "+86 ");
      }

      // 查询用户
      const [results] = await dbPool.query(
        `SELECT id, username, password, role, avatar, nickname, email, phone 
         FROM users 
         WHERE username = ? OR email = ? OR phone = ?`,
        [account, account, formattedAccount]
      );

      if (results.length === 0) {
        return apiResponse.error(res, "账号不存在", 401);
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return apiResponse.error(res, "密码错误", 401);
      }

      // 🔥 增强版 IP 获取：考虑了多种可能的请求头
      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.headers["x-real-ip"] ||
        req.socket.remoteAddress ||
        req.ip;

      console.log(
        `[Login] 用户 ${user.username} 尝试登录，识别到 IP: ${clientIp}`
      );

      // 异步触发更新
      updateRegionByIP(user.id, clientIp);

      // 生成 Token 并返回
      const token = generateToken(user);

      logger.info(`用户登录成功: ID=${user.id}, 用户名=${user.username}`);

      apiResponse.success(res, "登录成功", {
        token, // 返回 JWT Token
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          avatar: user.avatar || null,
          nickname: user.nickname || null,
          email: user.email || null,
          phone: user.phone || null,
        },
      });
    } catch (err) {
      logger.error("登录失败:", err);
      apiResponse.error(res, "服务器错误");
    }
  }
);

// 🔥 新增：根据 Token 获取当前登录用户信息 (用于页面刷新后恢复状态)
app.get("/api/current-user", authenticateToken, async (req, res) => {
  try {
    // req.user.id 是由 authenticateToken 中间件解析出来的
    const userId = req.user.id;

    const [results] = await dbPool.query(
      `SELECT id, username, role, avatar, banner, nickname, email, phone, created_at 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (results.length === 0) {
      return apiResponse.error(res, "用户不存在", 404);
    }

    const user = results[0];

    // 成功返回用户信息
    apiResponse.success(res, "获取成功", {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar: user.avatar || null,
      nickname: user.nickname || null,
      email: user.email || null,
      phone: user.phone || null,
    });
  } catch (err) {
    logger.error("获取当前用户失败:", err);
    apiResponse.error(res, "服务器错误");
  }
});

// ==========================================
// 🔥 新增：管理员获取用户列表
// ==========================================
app.get(
  "/api/admin/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const keyword = req.query.keyword || "";
      const offset = (page - 1) * limit;

      let whereClause = "WHERE 1=1";
      let params = [];

      // 搜索用户名或昵称
      if (keyword) {
        whereClause += " AND (username LIKE ? OR nickname LIKE ?)";
        const likeKey = `%${keyword}%`;
        params.push(likeKey, likeKey);
      }

      // 1. 总数
      const [countResult] = await dbPool.query(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 2. 列表 (不查密码!)
      const sql = `
      SELECT id, username, nickname, email, phone, role, avatar, created_at 
      FROM users 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
      const dataParams = [...params, limit, offset];
      const [rows] = await dbPool.query(sql, dataParams);

      apiResponse.success(res, "获取用户列表成功", {
        list: rows,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("获取用户列表失败:", err);
      apiResponse.error(res, "获取失败");
    }
  }
);

// ==========================================
// 🔥 新增：管理员修改用户角色 (提拔/降级)
// ==========================================
app.patch(
  "/api/admin/users/:id/role",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (!["admin", "user"].includes(role)) {
        return apiResponse.error(res, "无效的角色类型", 400);
      }

      // 防止自己降级自己 (可选保护)
      if (parseInt(userId) === req.user.id && role === "user") {
        return apiResponse.error(res, "不能降级自己的管理员权限", 403);
      }

      await dbPool.query("UPDATE users SET role = ? WHERE id = ?", [
        role,
        userId,
      ]);

      logger.info(
        `👑 用户权限变更: ID=${userId} -> ${role} (操作者: ${req.user.username})`
      );
      apiResponse.success(res, "权限修改成功");
    } catch (err) {
      logger.error("修改权限失败:", err);
      apiResponse.error(res, "修改失败");
    }
  }
);

// 辅助：记录每日访问 (upsert: 有则加1，无则插入)
const recordDailyVisit = async () => {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    await dbPool.query(
      `INSERT INTO daily_stats (date, views) VALUES (?, 1) 
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [today]
    );
  } catch (err) {
    console.error("记录访问量失败:", err);
  }
};

// ==========================================
// 🔥 新增：用户个人主页背景图上传接口
// ==========================================
app.post(
  "/api/user/update-banner",
  authenticateToken,
  upload.single("banner"),
  async (req, res) => {
    try {
      if (!req.file) {
        return apiResponse.error(res, "请选择背景图片", 400);
      }
      const userId = req.user.id;
      const fileName = req.file.filename;
      const dbPath = `/uploads/${fileName}`;

      const [result] = await dbPool.query(
        "UPDATE users SET banner = ? WHERE id = ?",
        [dbPath, userId]
      );

      apiResponse.success(res, "背景图更新成功", dbPath);
    } catch (err) {
      // 🔥 关键：在这里打印错误到控制台
      console.error("❌ 后端报错详情:", err);
      // 🔥 关键：把报错信息发给前端（测试完记得改回来，为了安全不建议在生产环境暴露报错）
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ==========================================
// 🔥 新增：记录全站访问量 (独立接口)
// ==========================================
// 不需要 authenticateToken，因为访客也要记录
app.post("/api/site/visit", async (req, res) => {
  try {
    // 调用之前写好的记录函数
    await recordDailyVisit();

    // 简单响应即可，不需要返回数据
    res.status(200).json({ success: true, message: "Visit recorded" });
  } catch (err) {
    // 即使失败也不要报错给前端，默默记录日志即可
    logger.error("记录全站访问失败:", err);
    res.status(200).json({ success: false }); // 保持 200 防止前端报红
  }
});

// ==========================================
// 评论相关接口
// ==========================================

// 🔥 评论图片上传接口（新增）
app.post(
  "/api/upload/comment-images",
  authenticateToken,
  upload.array("images", 9), // 最多9张图片
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return apiResponse.error(res, "请选择图片", 400);
      }

      // 生成图片URL数组
      const urls = files.map((file) => {
        // 返回相对路径，前端可以通过静态资源访问
        const relativePath = file.path.replace(/\\/g, "/");
        return `/uploads/${path.basename(relativePath)}`;
      });

      logger.info(`评论图片上传成功: ${urls.length} 张图片`);
      apiResponse.success(res, "图片上传成功", { urls });
    } catch (err) {
      logger.error("评论图片上传失败:", err);
      apiResponse.error(res, "图片上传失败");
    }
  }
);

// ==========================================
// 🔥 修复版:发表评论接口
// ==========================================
app.post(
  "/api/comments",
  authenticateToken,
  [
    // ✅ 修复1: 使用 toInt() 将字符串转为数字
    body("article_id").toInt().isInt().withMessage("文章ID无效"),

    // ✅ 修复2: 移除 optional(),改用自定义验证
    body("content")
      .customSanitizer((value) => value?.trim() || "")
      .custom((value, { req }) => {
        const hasContent = value && value.length > 0;
        const hasImages = req.body.images && req.body.images.length > 0;
        if (!hasContent && !hasImages) {
          throw new Error("评论内容和图片不能同时为空");
        }
        return true;
      }),

    body("images").optional().isArray().withMessage("图片格式不正确"),

    // ✅ 修复3: parent_id 也可能是字符串
    body("parent_id")
      .optional({ nullable: true })
      .customSanitizer((value) => (value ? parseInt(value) : null))
      .custom((value) => value === null || Number.isInteger(value))
      .withMessage("父评论ID无效"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ 评论验证失败:", errors.array());
      return apiResponse.error(res, errors.array()[0].msg, 400, errors.array());
    }

    try {
      const { article_id, content, images, parent_id } = req.body;
      const userId = req.user.id;

      console.log(`📝 收到评论请求: 文章ID=${article_id}, 用户ID=${userId}`);

      // 获取用户信息
      const [userResults] = await dbPool.query(
        "SELECT username, nickname, avatar FROM users WHERE id = ?",
        [userId]
      );

      if (userResults.length === 0) {
        console.log("❌ 用户不存在");
        return apiResponse.error(res, "用户不存在", 404);
      }

      const user = userResults[0];
      const nickname = user.username;

      // 验证父评论
      if (parent_id) {
        const [parentComment] = await dbPool.query(
          "SELECT id, article_id FROM comments WHERE id = ?",
          [parent_id]
        );

        if (parentComment.length === 0) {
          return apiResponse.error(res, "父评论不存在", 400);
        }

        if (parentComment[0].article_id !== article_id) {
          return apiResponse.error(res, "父评论不属于当前文章", 400);
        }
      }

      // 处理图片数据
      let imagesJSON = null;
      if (images && images.length > 0) {
        imagesJSON = JSON.stringify(images);
      }

      // 插入评论
      const [result] = await dbPool.query(
        "INSERT INTO comments (article_id, nickname, content, images, parent_id) VALUES (?, ?, ?, ?, ?)",
        [article_id, nickname, content || "", imagesJSON, parent_id || null]
      );

      const commentId = result.insertId;
      console.log(`✅ 评论保存成功: ID=${commentId}`);

      // 更新文章评论数
      dbPool
        .query("UPDATE articles SET comments = comments + 1 WHERE id = ?", [
          article_id,
        ])
        .catch((err) => {
          console.log("⚠️ 更新文章评论数失败:", err);
        });

      // 返回新评论
      const responseData = {
        id: commentId,
        parent_id: parent_id || null,
        nickname: nickname,
        avatar: user.avatar || null,
        content: content || "",
        images: images || [],
        created_at: new Date().toISOString(),
        like_count: 0,
        is_liked: false,
        is_disliked: false,
        replies: [],
        level: parent_id ? 1 : 0,
      };

      apiResponse.success(res, "评论成功", responseData, 201);
    } catch (err) {
      console.error("❌ 评论失败:", err);
      logger.error("评论失败:", err);
      apiResponse.error(res, "评论失败: " + (err.message || "服务器错误"));
    }
  }
);

// 🔥 5. 删除评论（需要认证 + 权限检查）
app.delete("/api/comments/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;

    // 查询评论
    const [comments] = await dbPool.query(
      "SELECT nickname FROM comments WHERE id = ?",
      [id]
    );

    if (comments.length === 0) {
      return apiResponse.error(res, "评论不存在", 404);
    }

    const comment = comments[0];

    // 检查权限：只有评论作者或管理员可以删除
    if (comment.nickname !== req.user.username && req.user.role !== "admin") {
      return apiResponse.error(res, "无权删除此评论", 403);
    }

    await dbPool.query("DELETE FROM comments WHERE id = ?", [id]);

    logger.info(`评论删除成功: ID=${id}, 操作者=${req.user.username}`);
    apiResponse.success(res, "评论已删除");
  } catch (err) {
    logger.error("删除评论失败:", err);
    apiResponse.error(res, "删除失败");
  }
});

// ==========================================
// 🔥 获取评论列表（修复版）
// ==========================================
app.get("/api/comments", async (req, res) => {
  try {
    const article_id = req.query.article_id;
    if (!article_id) return apiResponse.error(res, "缺少文章ID", 400);

    console.log(`📝 正在获取文章 ${article_id} 的评论...`);

    // 1. 获取当前用户ID (用于判断是否点赞过)
    let currentUserId = null;
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        currentUserId = decoded.id;
      } catch (e) {
        console.log("⚠️ Token 无效，不进行用户特定查询");
      }
    }

    // 2. 查询所有评论（平铺数据）
    const [rows] = await dbPool.query(
      `
      SELECT 
        c.*, 
        u.avatar, 
        u.nickname as user_nickname,
        (SELECT COUNT(*) FROM comment_interactions WHERE comment_id = c.id AND action_type = 1) as like_count,
        (SELECT action_type FROM comment_interactions WHERE comment_id = c.id AND user_id = ?) as current_action
      FROM comments c 
      LEFT JOIN users u ON c.nickname = u.username 
      WHERE c.article_id = ?
      ORDER BY c.created_at ASC 
      `,
      [currentUserId, article_id]
    );

    console.log(`✅ 从数据库查询到 ${rows.length} 条评论`);

    if (rows.length === 0) {
      return apiResponse.success(res, "没有评论", []);
    }

    // 3. 数据预处理
    const allComments = rows.map((row) => {
      let images = [];
      try {
        if (row.images) {
          images =
            typeof row.images === "string"
              ? JSON.parse(row.images)
              : row.images;
        }
      } catch (e) {
        console.log("图片解析失败:", e.message);
      }

      return {
        id: row.id,
        parent_id: row.parent_id || null,

        // 🔥 核心修复：优先使用 users 表里的 nickname (用户昵称)，如果没有才用 c.nickname (用户名)
        // 这样前端看到的是 "Big"，但后台关联用的是 "user_7qxtgi"
        nickname: row.user_nickname || row.nickname || "匿名用户",

        // 现在因为 JOIN 成功了，avatar 就能取到了
        avatar:
          row.avatar || "https://w.wallhaven.cc/full/9o/wallhaven-9oog5d.jpg",
        content: row.content || "",
        images: images,
        created_at: row.created_at,
        like_count: row.like_count || 0,
        is_liked: row.current_action === 1,
        is_disliked: row.current_action === -1,
        replies: [],
        level: 0,
      };
    });

    // ==========================================
    // 4. 构建评论树（移除深度限制，支持无限级）
    // ==========================================
    const commentMap = {};
    const rootComments = [];

    // 第一步：建立 ID 映射，并初始化 replies 数组
    allComments.forEach((c) => {
      c.replies = []; // 确保每个评论都有 replies 数组
      commentMap[c.id] = c;
    });

    // 第二步：挂载子节点
    allComments.forEach((c) => {
      if (c.parent_id && commentMap[c.parent_id]) {
        // 检查是否形成循环（简单的死循环防止）
        if (commentMap[c.parent_id].parent_id === c.id) {
          console.warn(`⚠️ 检测到评论循环: ${c.id} <-> ${c.parent_id}`);
          rootComments.push(c);
        } else {
          // 🔥 核心修改：无条件挂载到父节点，不再检查 c.level < 5
          commentMap[c.parent_id].replies.push(c);

          // 可选：如果你还需要计算层级用于CSS缩进控制，可以保留这行
          c.level = (commentMap[c.parent_id].level || 0) + 1;
        }
      } else {
        // 如果没有父级，或者父级找不到（可能被删了），它就是一级评论
        rootComments.push(c);
      }
    });

    // 第三步：排序
    // 顶级评论按时间倒序
    rootComments.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    // 子评论按时间正序 (楼层越早越在上面)
    const sortReplies = (comments) => {
      comments.forEach((c) => {
        if (c.replies.length > 0) {
          c.replies.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          sortReplies(c.replies); // 递归排序
        }
      });
    };
    sortReplies(rootComments);

    console.log(`✅ 构建无限级评论树完成: 顶级评论 ${rootComments.length} 条`);

    apiResponse.success(res, "获取成功", rootComments);
  } catch (err) {
    logger.error("获取评论失败:", err);
    console.error("❌ 获取评论失败详情:", err.message);
    console.error("❌ SQL错误:", err.sql || "无SQL信息");

    // 返回更详细的错误信息
    apiResponse.error(res, `获取评论失败: ${err.message}`, 500);
  }
});

// ==========================================
// 🔥 新增：评论点赞/踩接口
// ==========================================
app.post("/api/comments/:id/action", authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;
    const { action } = req.body; // 'like' 或 'dislike'

    if (!["like", "dislike"].includes(action)) {
      return apiResponse.error(res, "无效的操作", 400);
    }

    const targetType = action === "like" ? 1 : -1;

    // 1. 检查是否已经操作过
    const [existing] = await dbPool.query(
      "SELECT action_type FROM comment_interactions WHERE user_id = ? AND comment_id = ?",
      [userId, commentId]
    );

    if (existing.length > 0) {
      const currentType = existing[0].action_type;

      if (currentType === targetType) {
        // 如果再次点击相同的操作，视为“取消”
        await dbPool.query(
          "DELETE FROM comment_interactions WHERE user_id = ? AND comment_id = ?",
          [userId, commentId]
        );
        return apiResponse.success(res, "已取消操作", { status: "removed" });
      } else {
        // 如果点击相反的操作（比如从赞变踩），更新记录
        await dbPool.query(
          "UPDATE comment_interactions SET action_type = ? WHERE user_id = ? AND comment_id = ?",
          [targetType, userId, commentId]
        );
        return apiResponse.success(res, "操作已更新", {
          status: "updated",
          type: targetType,
        });
      }
    } else {
      // 2. 插入新记录
      await dbPool.query(
        "INSERT INTO comment_interactions (user_id, comment_id, action_type) VALUES (?, ?, ?)",
        [userId, commentId, targetType]
      );
      return apiResponse.success(res, "操作成功", {
        status: "added",
        type: targetType,
      });
    }
  } catch (err) {
    logger.error("评论互动失败:", err);
    apiResponse.error(res, "操作失败");
  }
});

// ==========================================
// 🔥 终极修正：个人主页全量数据实时统计接口
// ==========================================
app.get("/api/user/profile", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return apiResponse.error(res, "缺少用户名参数", 400);

    // 1. 获取用户基础资料 (加上 banner 字段 👈)
    const [userResults] = await dbPool.query(
      `SELECT id, username, nickname, avatar, banner, region, bio, social_link, role, created_at 
       FROM users WHERE username = ?`,
      [username]
    );

    if (userResults.length === 0)
      return apiResponse.error(res, "用户不存在", 404);
    const user = userResults[0];
    const userId = user.id;

    // 2. 实时聚合统计 (核心修改：从 likes 和 favorites 表中统计该作者获得的总数)
    const [
      [articleStats], // 原创数、总阅读、总评论 (来自 articles 表)
      [followerResult], // 粉丝数
      [followingResult], // 关注数
      [totalLikesRes], // 🔥 累计获赞数 (跨表统计)
      [totalFavsRes], // 🔥 累计被收藏数 (跨表统计)
      [settingResult], // 导航配置
    ] = await Promise.all([
      dbPool.query(
        "SELECT COUNT(*) as originalCount, SUM(views) as totalViews, SUM(comments) as totalComments FROM articles WHERE author_id = ?",
        [userId]
      ),
      dbPool.query(
        "SELECT COUNT(*) as total FROM follows WHERE following_id = ?",
        [userId]
      ),
      dbPool.query(
        "SELECT COUNT(*) as total FROM follows WHERE follower_id = ?",
        [userId]
      ),
      // 统计所有属于该作者的文章在 article_likes 表中的总行数
      dbPool.query(
        "SELECT COUNT(*) as total FROM article_likes WHERE article_id IN (SELECT id FROM articles WHERE author_id = ?)",
        [userId]
      ),
      // 统计所有属于该作者的文章在 article_favorites 表中的总行数
      dbPool.query(
        "SELECT COUNT(*) as total FROM article_favorites WHERE article_id IN (SELECT id FROM articles WHERE author_id = ?)",
        [userId]
      ),
      dbPool.query("SELECT nav_config FROM user_settings WHERE user_id = ?", [
        userId,
      ]),
    ]);

    // 3. 组装并返回
    const finalProfile = {
      ...user,
      stats: {
        originalCount: articleStats[0].originalCount || 0,
        fansCount: followerResult[0].total || 0,
        followingCount: followingResult[0].total || 0,
        totalViews: articleStats[0].totalViews || 0,
        totalComments: articleStats[0].totalComments || 0,
        totalLikes: totalLikesRes[0].total || 0, // 🔥 现在的数字是真实的了
        totalFavorites: totalFavsRes[0].total || 0, // 🔥 现在的数字是真实的了
      },
      navConfig: settingResult.length > 0 ? settingResult[0].nav_config : null,
    };

    apiResponse.success(res, "获取资料成功", finalProfile);
  } catch (err) {
    logger.error("聚合资料获取失败:", err);
    apiResponse.error(res, "服务器错误");
  }
});
// ==========================================
// 🔥 新增：修改密码接口 (需要认证)
// ==========================================
app.post(
  "/api/user/update-password",
  authenticateToken,
  [
    body("oldPassword").notEmpty().withMessage("请输入原密码"),
    body("newPassword")
      .isLength({ min: 6, max: 50 })
      .withMessage("新密码长度需在6-50位之间"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, errors.array()[0].msg, 400);
    }

    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      // 1. 获取用户当前加密的密码
      const [users] = await dbPool.query(
        "SELECT password FROM users WHERE id = ?",
        [userId]
      );
      if (users.length === 0) return apiResponse.error(res, "用户不存在", 404);

      const user = users[0];

      // 2. 验证原密码是否正确
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return apiResponse.error(res, "原密码输入错误", 401);
      }

      // 3. 对新密码进行加密
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      // 4. 更新数据库
      await dbPool.query("UPDATE users SET password = ? WHERE id = ?", [
        newHash,
        userId,
      ]);

      logger.info(`🔐 用户 ID=${userId} 成功修改了密码`);

      // 建议：密码修改成功后，可以返回一个消息告知前端，或者强制让前端清除Token重登
      apiResponse.success(res, "密码修改成功，请牢记新密码");
    } catch (err) {
      logger.error("修改密码失败:", err);
      apiResponse.error(res, "服务器内部错误");
    }
  }
);

// ==========================================
// 🔥 新增：导出个人数据接口
// ==========================================
app.get("/api/user/export-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. 获取基本信息
    const [userRows] = await dbPool.query(
      "SELECT id, username, nickname, email, phone, gender, birthday, region, bio, social_link, created_at FROM users WHERE id = ?",
      [userId]
    );

    // 2. 获取该用户的评论记录
    const [commentRows] = await dbPool.query(
      "SELECT content, created_at, article_id FROM comments WHERE nickname = ?",
      [req.user.username]
    );

    const exportData = {
      profile: userRows[0],
      comments: commentRows,
      export_at: new Date().toISOString(),
      source: "Veritas Blog",
    };

    // 设置响应头，告诉浏览器这是一个下载文件
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=my_data_${req.user.username}.json`
    );
    res.send(JSON.stringify(exportData, null, 2));

    logger.info(`📥 用户 ID=${userId} 导出了其个人数据`);
  } catch (err) {
    logger.error("导出数据失败:", err);
    apiResponse.error(res, "导出失败，请稍后重试");
  }
});

// ==========================================
// 🔥 新增：彻底注销账户接口
// ==========================================
app.delete("/api/user/account", authenticateToken, async (req, res) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    const userId = req.user.id;
    const username = req.user.username;

    // 1. 删除用户壁纸
    await connection.query("DELETE FROM user_wallpapers WHERE user_id = ?", [
      userId,
    ]);

    // 2. 将评论设置为“已注销用户”或直接删除（这里选择保留内容但去标识化）
    await connection.query(
      "UPDATE comments SET nickname = '已注销用户' WHERE nickname = ?",
      [username]
    );

    // 3. 删除用户记录
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [
      userId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("用户不存在");
    }

    await connection.commit();
    logger.warn(`⚠️ 账号注销成功: 用户名=${username}, ID=${userId}`);
    apiResponse.success(res, "账号已注销，所有数据已清理");
  } catch (err) {
    await connection.rollback();
    logger.error("注销账号失败:", err);
    apiResponse.error(res, "操作失败，请联系管理员");
  } finally {
    connection.release();
  }
});

// ==========================================
// 🔥 更新用户个人信息（需要认证 + 权限检查）
// 支持修改用户名，但要检查唯一性
// ==========================================
app.post(
  "/api/user/update",
  authenticateToken,
  [
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage("用户名长度应为3-50个字符")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("用户名只能包含字母、数字和下划线"),
    body("nickname")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("昵称不能超过50个字符"),
    // 🔥 修改邮箱验证规则：允许为空或null，不为空时才验证格式
    body("email")
      .optional({ nullable: true, checkFalsy: true })
      .if(body("email").notEmpty())
      .isEmail()
      .withMessage("邮箱格式不正确"),
    body("bio")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("个人简介不能超过500个字符"),
    // 添加其他字段的验证
    body("phone")
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (!value) return true; // 允许空
        // 验证手机号格式：+86 1xxxxxxxxxx 或其他国际格式
        const phoneRegex = /^\+\d{1,3}\s\d{6,15}$/;
        return phoneRegex.test(value);
      })
      .withMessage("手机号格式不正确，格式应为：+国家代码 号码"),
    body("gender")
      .optional()
      .isIn(["男", "女", "不展示", null])
      .withMessage("性别只能是'男'、'女'、'不展示'或空"),
    body("social_link")
      .optional({ nullable: true, checkFalsy: true })
      .if(body("social_link").notEmpty())
      .isURL()
      .withMessage("社交媒体链接格式不正确"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const {
        id,
        username,
        nickname,
        email,
        avatar,
        phone,
        gender,
        birthday,
        region,
        bio,
        social_link,
      } = req.body;

      // 权限检查：只能修改自己的信息
      // 注意：这里 req.user.id 是从 JWT token 中获取的当前用户 ID
      if (id !== req.user.id && req.user.role !== "admin") {
        return apiResponse.error(res, "无权修改其他用户信息", 403);
      }

      // 检查用户名是否被其他用户占用
      if (username && username !== req.user.username) {
        const [existingUsername] = await dbPool.query(
          "SELECT id FROM users WHERE username = ? AND id != ?",
          [username, id]
        );

        if (existingUsername.length > 0) {
          return apiResponse.error(res, "用户名已被其他用户使用", 409);
        }
      }

      // 检查邮箱是否被其他用户占用（如果提供了邮箱）
      if (email) {
        const [existingEmail] = await dbPool.query(
          "SELECT id FROM users WHERE email = ? AND id != ? AND email IS NOT NULL",
          [email, id]
        );

        if (existingEmail.length > 0) {
          return apiResponse.error(res, "邮箱已被其他用户使用", 409);
        }
      }

      // 检查手机号是否被其他用户占用（如果提供了手机号）
      if (phone) {
        const [existingPhone] = await dbPool.query(
          "SELECT id FROM users WHERE phone = ? AND id != ? AND phone IS NOT NULL",
          [phone, id]
        );

        if (existingPhone.length > 0) {
          return apiResponse.error(res, "手机号已被其他用户使用", 409);
        }
      }

      // 构建更新字段
      const updateFields = [];
      const updateValues = [];

      if (username !== undefined) {
        updateFields.push("username = ?");
        updateValues.push(username);
      }

      if (nickname !== undefined) {
        updateFields.push("nickname = ?");
        updateValues.push(nickname);
      }

      if (email !== undefined) {
        updateFields.push("email = ?");
        updateValues.push(email || null); // 空字符串转为 null
      }

      if (avatar !== undefined) {
        updateFields.push("avatar = ?");
        updateValues.push(avatar);
      }

      if (phone !== undefined) {
        updateFields.push("phone = ?");
        updateValues.push(phone || null); // 空字符串转为 null
      }

      if (gender !== undefined) {
        updateFields.push("gender = ?");
        updateValues.push(gender);
      }

      if (birthday !== undefined) {
        updateFields.push("birthday = ?");
        updateValues.push(birthday);
      }

      if (region !== undefined) {
        updateFields.push("region = ?");
        updateValues.push(region);
      }

      if (bio !== undefined) {
        updateFields.push("bio = ?");
        updateValues.push(bio);
      }

      if (social_link !== undefined) {
        updateFields.push("social_link = ?");
        updateValues.push(social_link);
      }

      if (updateFields.length === 0) {
        return apiResponse.error(res, "没有需要更新的字段", 400);
      }

      // 添加 WHERE 条件
      updateValues.push(id);

      const [result] = await dbPool.query(
        `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "用户不存在", 404);
      }

      // 获取更新后的用户信息
      const [updatedUser] = await dbPool.query(
        `SELECT id, username, nickname, email, avatar, phone, gender, 
                birthday, region, bio, social_link, role 
         FROM users 
         WHERE id = ?`,
        [id]
      );

      // 🔥🔥🔥 新增代码开始：生成新 Token 🔥🔥🔥
      const userForToken = updatedUser[0];

      // 使用之前定义好的 generateToken 函数生成新令牌
      // 注意：generateToken 需要传入包含 id, username, role 的对象
      const newToken = generateToken(userForToken);

      logger.info(
        `用户信息更新成功: ID=${id}, 用户名=${userForToken.username}, 已签发新Token`
      );

      // 将新 Token 合并到返回数据中
      apiResponse.success(res, "个人信息已更新", {
        ...userForToken,
        token: newToken, // <--- 关键：把新 Token 给前端
      });
      // 🔥🔥🔥 新增代码结束 🔥🔥🔥
    } catch (err) {
      logger.error("更新用户信息失败:", err);

      // 处理唯一性约束错误
      if (err.code === "ER_DUP_ENTRY") {
        if (err.message.includes("username")) {
          return apiResponse.error(res, "用户名已被占用", 409);
        } else if (err.message.includes("email")) {
          return apiResponse.error(res, "邮箱已被占用", 409);
        } else if (err.message.includes("phone")) {
          return apiResponse.error(res, "手机号已被占用", 409);
        }
      }

      apiResponse.error(res, "数据库更新失败");
    }
  }
);

// ==========================================
// 壁纸相关接口
// ==========================================

// 获取全局壁纸配置（带缓存）
app.get("/api/wallpaper/global", async (req, res) => {
  try {
    const now = Date.now();

    if (globalWallpaperCache && now - cacheTime < CACHE_DURATION) {
      logger.info("📦 使用缓存的全局壁纸配置");
      return apiResponse.success(res, "获取成功", globalWallpaperCache);
    }

    const [results] = await dbPool.query(
      "SELECT * FROM global_wallpapers LIMIT 1"
    );

    if (results.length === 0) {
      const defaultConfig = {
        mode: "website",
        dailyUrl:
          "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80",
        websiteUrl:
          "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80",
        randomUrls: [],
      };
      globalWallpaperCache = defaultConfig;
      cacheTime = now;
      return apiResponse.success(res, "使用默认配置", defaultConfig);
    }

    const data = results[0];
    let parsedRandomUrls = [];

    if (Array.isArray(data.random_urls)) {
      parsedRandomUrls = data.random_urls;
    } else if (typeof data.random_urls === "string") {
      try {
        parsedRandomUrls = JSON.parse(data.random_urls);
      } catch {
        parsedRandomUrls = data.random_urls
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const config = {
      mode: data.mode || "website",
      dailyUrl: data.daily_url || "",
      websiteUrl: data.website_url || "",
      randomUrls: parsedRandomUrls,
    };

    globalWallpaperCache = config;
    cacheTime = now;
    apiResponse.success(res, "获取成功", config);
  } catch (err) {
    logger.error("获取全局壁纸失败:", err);
    apiResponse.error(res, "获取全局壁纸失败");
  }
});

// 🔥 手动触发洗牌接口（需要管理员权限）
app.post(
  "/api/wallpaper/shuffle",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await shuffleGlobalWallpapers();
      logger.info(`手动洗牌成功，操作者: ${req.user.username}`);
      apiResponse.success(res, "洗牌成功");
    } catch (err) {
      logger.error("洗牌失败:", err);
      apiResponse.error(res, "洗牌失败");
    }
  }
);

// 获取用户壁纸
app.get("/api/wallpaper/user", async (req, res) => {
  try {
    const userId = req.query.userId;
    const username = req.query.username;

    if (!userId && !username) {
      return apiResponse.error(res, "未提供用户ID或用户名", 400);
    }

    let sql, params;

    if (userId) {
      sql = "SELECT wallpaper_url FROM user_wallpapers WHERE user_id = ?";
      params = [userId];
    } else {
      sql = `
        SELECT uw.wallpaper_url 
        FROM user_wallpapers uw
        JOIN users u ON uw.user_id = u.id
        WHERE u.username = ?
      `;
      params = [username];
    }

    const [results] = await dbPool.query(sql, params);

    if (results.length > 0) {
      const url = results[0].wallpaper_url;
      logger.info(`✅ 找到用户壁纸: userId=${userId}, username=${username}`);
      apiResponse.success(res, "获取成功", { hasCustom: true, url });
    } else {
      logger.info("ℹ️ 用户无自定义壁纸");
      apiResponse.success(res, "用户无自定义壁纸", { hasCustom: false });
    }
  } catch (err) {
    logger.error("查询壁纸失败:", err);
    apiResponse.error(res, "查询失败");
  }
});

// 批量获取用户壁纸
app.post("/api/wallpaper/batch", async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return apiResponse.success(res, "无数据", {});
    }

    const placeholders = userIds.map(() => "?").join(",");
    const [results] = await dbPool.query(
      `SELECT user_id, wallpaper_url FROM user_wallpapers WHERE user_id IN (${placeholders})`,
      userIds
    );

    const wallpapers = {};
    results.forEach((row) => {
      wallpapers[row.user_id] = row.wallpaper_url;
    });

    apiResponse.success(res, "获取成功", { wallpapers });
  } catch (err) {
    logger.error("批量查询壁纸失败:", err);
    apiResponse.error(res, "批量查询失败");
  }
});

// 🔥 用户壁纸上传（需要认证）
app.post(
  "/api/wallpaper/user",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      logger.info(`🔍 收到用户壁纸上传请求: 用户=${req.user.username}`);

      if (!req.file) {
        return apiResponse.error(res, "请选择图片文件", 400);
      }

      // 使用 JWT 中的用户 ID
      const actualUserId = req.user.id;

      const fileName = req.file.filename;
      // 🔥 核心修复：数据库中存储相对路径，不含 /api
      const dbPath = `/uploads/${fileName}`;

      console.log(`📁 用户壁纸上传信息:`);
      console.log(`  用户ID: ${actualUserId}`);
      console.log(`  文件名: ${fileName}`);
      console.log(`  存储路径: ${dbPath}`);

      clearWallpaperCache();

      const [result] = await dbPool.query(
        `REPLACE INTO user_wallpapers (user_id, wallpaper_url, updated_at) VALUES (?, ?, NOW())`,
        [actualUserId, dbPath]
      );

      logger.info(
        `✅ 用户壁纸保存成功: 用户ID=${actualUserId}, 影响行数=${result.affectedRows}`
      );

      apiResponse.success(res, "壁纸上传成功", {
        url: dbPath, // 返回 /uploads/xxx.jpg
        userId: actualUserId,
      });
    } catch (err) {
      logger.error("处理用户壁纸上传时出错:", err);
      apiResponse.error(res, "服务器错误");
    }
  }
);

// ==========================================
// 🔥 新增：站点配置获取接口 (用于版权声明等)
// ==========================================

/**
 * 获取指定键名的配置内容
 * GET /api/configs/:key
 */
app.get("/api/configs/:key", async (req, res) => {
  try {
    const { key } = req.params;

    // 🔥 检查这里的白名单是否包含 'copyright_detail'
    const allowedKeys = [
      "copyright_detail",
      "site_announcement",
      "footer_info",
    ];

    if (!allowedKeys.includes(key)) {
      // 这里的错误就是你刚才看到的“无效配置项”
      return apiResponse.error(res, "无效的配置项", 400);
    }

    const [results] = await dbPool.query(
      "SELECT config_value FROM site_configs WHERE config_key = ?",
      [key]
    );

    if (results.length > 0) {
      apiResponse.success(res, "获取配置成功", results[0].config_value);
    } else {
      apiResponse.success(res, "无内容", "");
    }
  } catch (err) {
    logger.error(`获取配置 [${req.params.key}] 失败:`, err);
    apiResponse.error(res, "服务器内部错误");
  }
});

// ==========================================
// 🔥 新增：保存站点配置接口 (仅管理员)
// ==========================================
app.post(
  "/api/admin/configs/:key",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!value) return apiResponse.error(res, "配置内容不能为空", 400);

      // 使用 INSERT ... ON DUPLICATE KEY UPDATE 确保存在即更新，不存在即插入
      await dbPool.query(
        `INSERT INTO site_configs (config_key, config_value) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, value]
      );

      logger.info(`⚙️ 管理员 ${req.user.username} 更新了配置项: ${key}`);
      apiResponse.success(res, "配置保存成功");
    } catch (err) {
      logger.error(`保存配置 [${req.params.key}] 失败:`, err);
      apiResponse.error(res, "保存失败，服务器内部错误");
    }
  }
);

// ==========================================
// 🔥 公告系统接口 (Notices)
// ==========================================

// 1. 获取最新的一条启用公告 (给首页展示用)
app.get("/api/notices/latest", async (req, res) => {
  try {
    // 查询最新一条 is_active = 1 的公告
    const [results] = await dbPool.query(
      "SELECT content FROM notices WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1"
    );

    if (results.length > 0) {
      apiResponse.success(res, "获取最新公告成功", {
        content: results[0].content,
      });
    } else {
      // 🔥 修改前：返回默认文案
      // apiResponse.success(res, "使用默认公告", { content: "🎉 欢迎..." });

      // 🔥 修改后：返回空字符串，明确告知前端“没公告”
      apiResponse.success(res, "无活动公告", {
        content: "",
      });
    }
  } catch (err) {
    logger.error("获取公告失败:", err);
    // 出错时也不要报错给前端，而是返回默认值保证页面不崩
    apiResponse.success(res, "获取失败(降级)", {
      content: "🎉 欢迎访问 Veritas 的个人博客！",
    });
  }
});

// 2. 获取所有公告列表 (后台管理用 - 需要管理员权限)
app.get(
  "/api/admin/notices",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const [results] = await dbPool.query(
        "SELECT * FROM notices ORDER BY created_at DESC"
      );
      apiResponse.success(res, "获取公告列表成功", results);
    } catch (err) {
      logger.error("管理员获取公告列表失败:", err);
      apiResponse.error(res, "获取列表失败");
    }
  }
);

// 3. 发布新公告 (后台管理用 - 需要管理员权限)
app.post(
  "/api/admin/notices",
  authenticateToken,
  requireAdmin,
  [body("content").trim().notEmpty().withMessage("公告内容不能为空")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const { content, is_active } = req.body;
      // 默认启用
      const activeStatus = is_active !== undefined ? is_active : true;

      const [result] = await dbPool.query(
        "INSERT INTO notices (content, is_active) VALUES (?, ?)",
        [content, activeStatus]
      );

      logger.info(
        `📢 发布新公告: ID=${result.insertId}, 内容="${content.substring(
          0,
          20
        )}..."`
      );
      apiResponse.success(res, "公告发布成功", { id: result.insertId }, 201);
    } catch (err) {
      logger.error("发布公告失败:", err);
      apiResponse.error(res, "发布失败");
    }
  }
);

// 4. 修改公告状态或内容 (后台管理用 - 需要管理员权限)
app.put(
  "/api/admin/notices/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { content, is_active } = req.body;

      // 构建动态更新 SQL
      const fields = [];
      const values = [];

      if (content !== undefined) {
        fields.push("content = ?");
        values.push(content);
      }
      if (is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(is_active);
      }

      if (fields.length === 0) {
        return apiResponse.error(res, "没有需要修改的字段", 400);
      }

      values.push(id); // WHERE 条件

      const [result] = await dbPool.query(
        `UPDATE notices SET ${fields.join(", ")} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "公告不存在", 404);
      }

      logger.info(`📝 更新公告 ID=${id}`);
      apiResponse.success(res, "公告更新成功");
    } catch (err) {
      logger.error("更新公告失败:", err);
      apiResponse.error(res, "更新失败");
    }
  }
);

// 5. 删除公告 (后台管理用 - 需要管理员权限)
app.delete(
  "/api/admin/notices/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const id = req.params.id;
      const [result] = await dbPool.query("DELETE FROM notices WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "公告不存在", 404);
      }

      logger.info(`🗑️ 删除公告 ID=${id}`);
      apiResponse.success(res, "公告删除成功");
    } catch (err) {
      logger.error("删除公告失败:", err);
      apiResponse.error(res, "删除失败");
    }
  }
);

// ==========================================
// 🔗 友链管理接口 (Friend Links)
// ==========================================

// 1. 获取所有友链 (前台/后台通用)
// 注意：这里没加 authenticateToken，因为前台也要看。
// 如果你想区分，可以把这个作为公共接口，再写个带权限的 admin 接口，但这里没必要。
app.get("/api/friend_links", async (req, res) => {
  try {
    const [results] = await dbPool.query(
      "SELECT * FROM friend_links ORDER BY created_at ASC"
    );
    apiResponse.success(res, "获取友链成功", results);
  } catch (err) {
    logger.error("获取友链失败:", err);
    apiResponse.error(res, "获取失败");
  }
});

// 2. 新增友链 (管理员)
app.post(
  "/api/admin/friend_links",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { name, link, avatar, description } = req.body;
      if (!name || !link) return apiResponse.error(res, "名称和链接必填", 400);

      await dbPool.query(
        "INSERT INTO friend_links (name, link, avatar, description) VALUES (?, ?, ?, ?)",
        [name, link, avatar, description]
      );
      apiResponse.success(res, "添加成功");
    } catch (err) {
      logger.error("添加友链失败:", err);
      apiResponse.error(res, "添加失败");
    }
  }
);

// 3. 删除友链 (管理员)
app.delete(
  "/api/admin/friend_links/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await dbPool.query("DELETE FROM friend_links WHERE id = ?", [
        req.params.id,
      ]);
      apiResponse.success(res, "删除成功");
    } catch (err) {
      logger.error("删除友链失败:", err);
      apiResponse.error(res, "删除失败");
    }
  }
);

// 4. 修改友链 (管理员)
app.put(
  "/api/admin/friend_links/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { name, link, avatar, description } = req.body;
      await dbPool.query(
        "UPDATE friend_links SET name=?, link=?, avatar=?, description=? WHERE id=?",
        [name, link, avatar, description, req.params.id]
      );
      apiResponse.success(res, "修改成功");
    } catch (err) {
      logger.error("修改友链失败:", err);
      apiResponse.error(res, "修改失败");
    }
  }
);

// ==========================================
// 🔥 新增：用户导航偏好管理
// ==========================================

// 1. 获取导航配置
app.get("/api/user/nav-settings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await dbPool.query(
      "SELECT nav_config FROM user_settings WHERE user_id = ?",
      [userId]
    );

    // 如果没有配置，返回 null，前端使用默认值
    const config = rows.length > 0 ? rows[0].nav_config : null;
    apiResponse.success(res, "获取配置成功", config);
  } catch (err) {
    logger.error("获取导航配置失败:", err);
    apiResponse.error(res, "获取失败");
  }
});

// 2. 更新导航配置
app.post("/api/user/nav-settings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { navConfig } = req.body; // 前端传来的数组

    // 使用 REPLACE INTO 或 ON DUPLICATE KEY UPDATE 确保唯一性
    await dbPool.query(
      `INSERT INTO user_settings (user_id, nav_config) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE nav_config = VALUES(nav_config)`,
      [userId, JSON.stringify(navConfig)]
    );

    apiResponse.success(res, "设置已保存至云端");
  } catch (err) {
    logger.error("保存导航配置失败:", err);
    apiResponse.error(res, "保存失败");
  }
});

// ==========================================
// 🔥 修正版：获取当前用户的浏览历史
// ==========================================
app.get("/api/user/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await dbPool.query(
      `
      SELECT 
        h.viewed_at, 
        a.id, a.title, a.summary, a.cover_image, a.category, a.views,
        u.nickname as author_name, 
        u.avatar as author_avatar,
        u.username as author_username
      FROM user_browsing_history h
      JOIN articles a ON h.article_id = a.id
      JOIN users u ON a.author_id = u.id  -- 💡 关键：关联查询文章的作者信息
      WHERE h.user_id = ?
      ORDER BY h.viewed_at DESC
      LIMIT 15
      `,
      [userId]
    );

    apiResponse.success(res, "获取历史成功", rows);
  } catch (err) {
    logger.error("获取历史记录失败:", err);
    apiResponse.error(res, "获取失败");
  }
});

// 2. 获取当前用户的浏览历史（给个人中心“最近访问”Tab用）
// index.js 中的获取历史接口
app.get("/api/user/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await dbPool.query(
      `SELECT h.viewed_at, a.id, a.title, a.summary, a.cover_image, a.category
       FROM user_browsing_history h
       INNER JOIN articles a ON h.article_id = a.id  -- 💡 确保这里 JOIN 成功
       WHERE h.user_id = ?
       ORDER BY h.viewed_at DESC
       LIMIT 10`,
      [userId]
    );
    // 在这里打印一下 rows，看后端到底查出来没
    console.log(`查到用户 ${userId} 的历史记录共 ${rows.length} 条`);
    apiResponse.success(res, "获取成功", rows);
  } catch (err) {
    apiResponse.error(res, "获取失败");
  }
});

// ==========================================
// 🔥 新增：社交关系管理 (关注/粉丝)
// ==========================================

app.post("/api/user/follow", authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id; // 当前登录者
    const { targetUserId } = req.body; // 想要关注的博主 ID

    if (followerId === parseInt(targetUserId)) {
      return apiResponse.error(res, "不能关注你自己哦", 400);
    }

    // 1. 检查是否已经关注过
    const [existing] = await dbPool.query(
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
      [followerId, targetUserId]
    );

    if (existing.length > 0) {
      // 如果已关注，则执行“取消关注”
      await dbPool.query(
        "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
        [followerId, targetUserId]
      );
      return apiResponse.success(res, "已取消关注", { status: "unfollowed" });
    } else {
      // 如果未关注，则执行“关注”
      await dbPool.query(
        "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
        [followerId, targetUserId]
      );
      return apiResponse.success(res, "关注成功", { status: "followed" });
    }
  } catch (err) {
    logger.error("关注操作失败:", err);
    apiResponse.error(res, "操作失败");
  }
});

app.get("/api/user/follow-status", authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const { targetUserId } = req.query;

    const [rows] = await dbPool.query(
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
      [followerId, targetUserId]
    );

    apiResponse.success(res, "获取成功", { isFollowing: rows.length > 0 });
  } catch (err) {
    apiResponse.error(res, "获取失败");
  }
});

// ==========================================
// 🔥 优化13: 图片代理接口（增强版）
// ==========================================
// 🔥 添加内存缓存（减少重复请求）
const imageCache = new Map();
const IMAGE_CACHE_DURATION = 10 * 60 * 1000; // 10分钟

app.get("/api/proxy-image", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: "缺少 URL 参数" });

  url = url.replace(/['"]/g, "").trim();

  // 🔥 检查内存缓存
  const cached = imageCache.get(url);
  if (cached && Date.now() - cached.time < IMAGE_CACHE_DURATION) {
    logger.info(`📦 [缓存命中] ${url.substring(0, 50)}...`);
    res.set(cached.headers);
    return res.send(cached.data);
  }

  logger.info(`🖼️ [代理请求] ${url.substring(0, 50)}...`);

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    };

    if (url.includes("wallhaven")) {
      headers["Referer"] = "https://wallhaven.cc/";
      headers["Origin"] = "https://wallhaven.cc";
    } else if (url.includes("unsplash")) {
      headers["Referer"] = "https://unsplash.com/";
    }

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404) {
      logger.warn(`⚠️ [图片不存在] ${url}`);
      return res.status(404).json({ error: "Image not found" });
    }

    if (response.status === 403) {
      logger.warn(`⚠️ [访问被拒绝] ${url}`);
      return res.status(403).json({ error: "Access forbidden" });
    }

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers["content-type"] || "image/jpeg";
    const responseHeaders = {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    };

    // 🔥 存入内存缓存
    imageCache.set(url, {
      data: response.data,
      headers: responseHeaders,
      time: Date.now(),
    });

    // 🔥 限制缓存大小（最多100个）
    if (imageCache.size > 100) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }

    res.set(responseHeaders);
    res.send(response.data);

    logger.info(`✅ [代理成功] 大小: ${response.data.length} bytes`);
  } catch (error) {
    logger.error(`❌ [代理失败] ${error.message}`);
    res.status(500).json({ error: "Image proxy failed" });
  }
});

app.options("/api/proxy-image", cors(corsOptions), (req, res) =>
  res.sendStatus(200)
);

// ==========================================
// 静态文件服务
// ==========================================
app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1d",
    index: false,
    dotfiles: "ignore",
  })
);

app.use(express.static(path.join(__dirname, "../client/dist")));

// ==========================================
// 🔥 优化14: 全局错误处理（增强）
// ==========================================
app.use((err, req, res, next) => {
  console.error("❌ 捕捉到全局错误:", err);
  logger.error("全局错误:", {
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    url: req.url,
    method: req.method,
    body: process.env.NODE_ENV === "production" ? undefined : req.body,
  });

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return apiResponse.error(res, "文件大小超过限制（最大10MB）", 400);
    }
    return apiResponse.error(res, `文件上传错误: ${err.message}`, 400);
  }

  // 🔥 关键修改：把 err.message 传给前端，这样你就不用猜了
  apiResponse.error(res, `服务器内部错误: ${err.message}`, 500);
});

// ==========================================
// 🔥 优化15: SPA 路由处理（性能优化）
// ==========================================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error("发送 index.html 失败:", err);
      res.status(500).send("页面加载失败");
    }
  });
});
// ==========================================
// 🔥 优化16 & 17: 服务启动与优雅关闭
// ==========================================
const PORT = process.env.PORT || 3000;

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// 🔥 核心修复：只调用一次 app.listen，并赋值给 server 变量
const server = app.listen(PORT, () => {
  logger.info(`🚀 后端服务已启动！`);
  logger.info(`📍 访问地址: http://localhost:${PORT}`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV || "development"}`);
  logger.info(
    `💾 内存使用: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    )} MB`
  );
});

// 优雅关闭逻辑
const gracefulShutdown = async (signal) => {
  logger.info(`\n🛑 收到 ${signal} 信号，正在优雅关闭...`);

  // 停止接受新连接
  server.close(() => {
    logger.info("✅ HTTP 服务器已关闭");
  });

  try {
    // 关闭数据库连接池
    await dbPool.end();
    logger.info("✅ 数据库连接池已关闭");

    // 清理缓存
    if (typeof imageCache !== "undefined") imageCache.clear();
    if (typeof verificationCodes !== "undefined") verificationCodes.clear();
    logger.info("✅ 缓存已清理");

    process.exit(0);
  } catch (err) {
    logger.error("❌ 关闭失败:", err);
    process.exit(1);
  }
};

// 监听关闭信号
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// 未捕获异常处理
process.on("uncaughtException", (err) => {
  // 忽略 EADDRINUSE 以外的错误防止无限重启，或者只记录不退出
  if (err.code === "EADDRINUSE") {
    logger.error("❌ 端口被占用，请检查是否有其他 Node 进程在运行");
    process.exit(1);
  }
  logger.error("❌ 未捕获的异常:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ 未处理的Promise拒绝:", reason);
});
