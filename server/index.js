require("dotenv").config(); // 🔥 1. 加载环境变量
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise"); // 🔥 7. 使用连接池版本
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); // 🔥 1. JWT认证
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit"); // 🔥 9. 限流
const { body, validationResult } = require("express-validator"); // 🔥 8. 输入验证
const winston = require("winston"); // 🔥 4. 日志系统

const app = express();

// ==========================================
// 🔥 4. Winston 日志系统配置
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
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// 开发环境下同时输出到控制台
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

// 确保 logs 目录存在
if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs", { recursive: true });
}

// ==========================================
// 🔥 10. CORS 配置（安全加固）
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:5173", "http://localhost:3000"];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 🔥 9. 限流配置
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: { success: false, message: "请求过于频繁，请稍后再试" },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 登录/注册最多5次
  message: { success: false, message: "尝试次数过多，请15分钟后再试" },
  skipSuccessfulRequests: true, // 成功的请求不计数
});

app.use("/api/", generalLimiter);

// ==========================================
// 🔥 2 & 7. 数据库连接池配置（使用环境变量）
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
});

// 测试数据库连接
(async () => {
  try {
    const connection = await dbPool.getConnection();
    logger.info("✅ 数据库连接池创建成功！");
    connection.release();
    // 数据库连接成功后初始化壁纸系统
    initializeWallpaperSystem();
  } catch (err) {
    logger.error("❌ 数据库连接失败:", err);
    process.exit(1);
  }
})();

// ==========================================
// 🔥 1. JWT 认证中间件
// ==========================================
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "your-super-secret-jwt-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 Token 中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "未提供认证令牌，请先登录",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn("JWT验证失败:", err.message);
      return res.status(403).json({
        success: false,
        message: "令牌无效或已过期，请重新登录",
      });
    }

    req.user = user; // 将用户信息附加到请求对象
    next();
  });
}

// 🔥 5. 权限检查中间件（管理员）
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "需要管理员权限",
    });
  }
  next();
}

// ==========================================
// Multer 图片上传存储配置
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const safeName = `${timestamp}-${random}${ext}`;
    logger.info(`📝 文件重命名: ${file.originalname} -> ${safeName}`);
    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
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
// 🔥 壁纸洗牌系统（优化版）
// ==========================================
let globalWallpaperCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

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
  logger.info("🧹 壁纸缓存已清空");
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

      let urls = [];

      if (Array.isArray(row.random_urls)) {
        urls = row.random_urls;
      } else if (typeof row.random_urls === "string") {
        try {
          urls = JSON.parse(row.random_urls);
        } catch {
          urls = row.random_urls
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      if (urls.length === 0) {
        logger.warn(`⚠️ 壁纸 ID=${row.id} 没有可洗牌的URL`);
        continue;
      }

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
    throw err;
  }
}

function initializeWallpaperSystem() {
  logger.info("🚀 初始化壁纸系统...");

  shuffleGlobalWallpapers().catch((err) => {
    logger.error("❌ 启动洗牌失败:", err);
  });

  scheduleDaily3AMShuffle();
}

function scheduleDaily3AMShuffle() {
  const now = new Date();
  const target = new Date();
  target.setHours(3, 0, 0, 0);

  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const msUntil3AM = target.getTime() - now.getTime();
  logger.info(`⏰ 下次自动洗牌时间: ${target.toLocaleString("zh-CN")}`);

  setTimeout(() => {
    shuffleGlobalWallpapers().catch((err) => {
      logger.error("❌ 定时洗牌失败:", err);
    });

    setInterval(() => {
      shuffleGlobalWallpapers().catch((err) => {
        logger.error("❌ 定时洗牌失败:", err);
      });
    }, 24 * 60 * 60 * 1000);
  }, msUntil3AM);
}

// ==========================================
// 🔥 6. 统一响应格式
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
// 基础接口
// ==========================================

// 上传接口（需要认证）
app.post(
  "/api/upload",
  authenticateToken,
  upload.single("image"),
  (req, res) => {
    const file = req.file;
    if (!file) {
      return apiResponse.error(res, "请选择图片", 400);
    }
    apiResponse.success(res, "上传成功", { filePath: file.path });
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

// 获取文章列表接口
app.get("/api/articles", async (req, res) => {
  try {
    const [results] = await dbPool.query(
      "SELECT * FROM articles ORDER BY created_at DESC"
    );
    apiResponse.success(res, "获取成功", results);
  } catch (err) {
    logger.error("查询文章出错:", err);
    apiResponse.error(res, "服务器错误");
  }
});

// 获取单篇文章详情接口
app.get("/api/articles/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [results] = await dbPool.query(
      "SELECT * FROM articles WHERE id = ?",
      [id]
    );

    if (results.length > 0) {
      apiResponse.success(res, "获取成功", results[0]);
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
      const { title, summary, content, cover_image } = req.body;
      const [result] = await dbPool.query(
        "INSERT INTO articles (title, summary, content, cover_image) VALUES (?, ?, ?, ?)",
        [title, summary, content, cover_image]
      );

      logger.info(`文章发布成功: ID=${result.insertId}, 标题=${title}`);
      apiResponse.success(res, "发布成功", { id: result.insertId }, 201);
    } catch (err) {
      logger.error("发布文章失败:", err);
      apiResponse.error(res, "发布失败");
    }
  }
);

// ==========================================
// 🔥 8. 用户注册接口（加强验证）
// ==========================================
app.post(
  "/api/register",
  authLimiter,
  [
    body("username")
      .optional()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage("用户名长度应为3-20个字符")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("用户名只能包含字母、数字和下划线"),
    body("password")
      .isLength({ min: 6, max: 50 })
      .withMessage("密码长度应为6-50个字符"),
    body("email").optional().isEmail().withMessage("邮箱格式不正确"),
    body("phone")
      .optional()
      .matches(/^(\+86\s)?1[3-9]\d{9}$/)
      .withMessage("手机号格式不正确"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const { username, password, email, phone } = req.body;

      if (!username && !email && !phone) {
        return apiResponse.error(
          res,
          "至少提供用户名、邮箱或手机号中的一种",
          400
        );
      }

      // 格式化手机号
      let formattedPhone = null;
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        if (/^1[3-9]\d{9}$/.test(cleanPhone)) {
          formattedPhone = `+86 ${cleanPhone}`;
        } else if (phone.startsWith("+86")) {
          formattedPhone = phone;
        }
      }

      const loginIdentifier = username || email || formattedPhone || phone;

      // 检查是否已存在
      const [existing] = await dbPool.query(
        "SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?",
        [loginIdentifier, email, formattedPhone]
      );

      if (existing.length > 0) {
        const existingUser = existing[0];
        if (existingUser.username === loginIdentifier) {
          return apiResponse.error(res, "用户名已被占用", 409);
        }
        if (email && existingUser.email === email) {
          return apiResponse.error(res, "邮箱已被注册", 409);
        }
        if (formattedPhone && existingUser.phone === formattedPhone) {
          return apiResponse.error(res, "手机号已被注册", 409);
        }
      }

      // 加密密码
      const hash = await bcrypt.hash(password, 10);

      // 插入新用户
      const [result] = await dbPool.query(
        "INSERT INTO users (username, password, email, phone) VALUES (?, ?, ?, ?)",
        [loginIdentifier, hash, email, formattedPhone]
      );

      logger.info(
        `新用户注册成功: ID=${result.insertId}, 用户名=${loginIdentifier}`
      );

      apiResponse.success(
        res,
        "注册成功",
        {
          loginIdentifier,
          phone: formattedPhone,
        },
        201
      );
    } catch (err) {
      logger.error("注册失败:", err);
      apiResponse.error(res, "注册失败");
    }
  }
);

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

      // 🔥 生成 JWT Token
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

// ==========================================
// 评论相关接口
// ==========================================

// 🔥 发表评论（需要认证）
app.post(
  "/api/comments",
  authenticateToken,
  [
    body("article_id").isInt().withMessage("文章ID无效"),
    body("content").trim().notEmpty().withMessage("评论内容不能为空"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const { article_id, content } = req.body;
      const nickname = req.user.username; // 从 JWT 获取用户名

      logger.info(`正在尝试写入评论: 文章ID=${article_id}, 用户=${nickname}`);

      const [result] = await dbPool.query(
        "INSERT INTO comments (article_id, nickname, content) VALUES (?, ?, ?)",
        [article_id, nickname, content]
      );

      apiResponse.success(res, "评论成功", { id: result.insertId }, 201);
    } catch (err) {
      logger.error("评论失败:", err);
      apiResponse.error(res, "评论失败");
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

// 获取评论列表
app.get("/api/comments", async (req, res) => {
  try {
    const article_id = req.query.article_id;

    if (!article_id) {
      return apiResponse.error(res, "缺少文章ID", 400);
    }

    const [results] = await dbPool.query(
      "SELECT * FROM comments WHERE article_id = ? ORDER BY created_at DESC",
      [article_id]
    );

    apiResponse.success(res, "获取成功", results);
  } catch (err) {
    logger.error("获取评论失败:", err);
    apiResponse.error(res, "获取评论失败");
  }
});

// ==========================================
// 用户信息相关接口
// ==========================================

// 获取用户详细信息
app.get("/api/user/profile", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return apiResponse.error(res, "缺少用户名参数", 400);
    }

    const [results] = await dbPool.query(
      "SELECT id, username, nickname, email, avatar, phone, gender, birthday, region, bio, social_link, role FROM users WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return apiResponse.error(res, "用户不存在", 404);
    }

    apiResponse.success(res, "获取成功", results[0]);
  } catch (err) {
    logger.error("获取用户信息失败:", err);
    apiResponse.error(res, "数据库错误");
  }
});

// 🔥 更新用户个人信息（需要认证 + 权限检查）
app.post(
  "/api/user/update",
  authenticateToken,
  [
    body("nickname").optional().trim().isLength({ max: 50 }),
    body("email").optional().isEmail().withMessage("邮箱格式不正确"),
    body("bio").optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return apiResponse.error(res, "输入验证失败", 400, errors.array());
    }

    try {
      const {
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
      if (username !== req.user.username && req.user.role !== "admin") {
        return apiResponse.error(res, "无权修改其他用户信息", 403);
      }

      const [result] = await dbPool.query(
        `UPDATE users
         SET nickname = ?, email = ?, avatar = ?, phone = ?, gender = ?, 
             birthday = ?, region = ?, bio = ?, social_link = ?
         WHERE username = ?`,
        [
          nickname,
          email,
          avatar,
          phone,
          gender,
          birthday,
          region,
          bio,
          social_link,
          username,
        ]
      );

      if (result.affectedRows === 0) {
        return apiResponse.error(res, "用户不存在", 404);
      }

      // 获取更新后的用户信息
      const [updatedUser] = await dbPool.query(
        `SELECT id, username, nickname, email, avatar, phone, gender, 
                birthday, region, bio, social_link, role 
         FROM users 
         WHERE username = ?`,
        [username]
      );

      logger.info(`用户信息更新成功: 用户名=${username}`);
      apiResponse.success(res, "个人信息已更新", updatedUser[0]);
    } catch (err) {
      logger.error("更新用户信息失败:", err);
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
      logger.info(`🔍 收到上传请求: 用户=${req.user.username}`);

      if (!req.file) {
        return apiResponse.error(res, "请选择图片文件", 400);
      }

      // 使用 JWT 中的用户 ID
      const actualUserId = req.user.id;

      const filePath = req.file.path.replace(/\\/g, "/");
      const dbPath = "/" + filePath;

      logger.info(`📁 文件路径: ${dbPath}`);

      clearWallpaperCache();

      const [result] = await dbPool.query(
        `REPLACE INTO user_wallpapers (user_id, wallpaper_url, updated_at) VALUES (?, ?, NOW())`,
        [actualUserId, dbPath]
      );

      logger.info(
        `✅ 壁纸保存成功: 用户ID=${actualUserId}, 影响行数=${result.affectedRows}`
      );

      apiResponse.success(res, "壁纸上传成功", {
        url: `/${filePath}`,
        userId: actualUserId,
      });
    } catch (err) {
      logger.error("处理上传时出错:", err);
      apiResponse.error(res, "服务器错误");
    }
  }
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
// 🔥 3. 全局错误处理中间件
// ==========================================
app.use((err, req, res, next) => {
  logger.error("全局错误:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Multer 错误处理
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return apiResponse.error(res, "文件大小超过限制（最大10MB）", 400);
    }
    return apiResponse.error(res, `文件上传错误: ${err.message}`, 400);
  }

  // 其他错误
  apiResponse.error(
    res,
    process.env.NODE_ENV === "development" ? err.message : "服务器错误",
    500
  );
});

// SPA 页面刷新处理（必须放在最后）
// 将 "*" 替换为 /.*/ (正则表达式对象)
app.get(/.*/, (req, res, next) => {
  // 如果是 API 请求，跳过（双重保险）
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }

  // 返回前端页面
  res.sendFile(path.join(__dirname, "../client/dist/index.html"), (err) => {
    if (err) {
      logger.error("发送 index.html 失败:", err);
      res.status(500).send("页面加载失败");
    }
  });
});

// ==========================================
// 启动服务
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 后端服务已启动！`);
  logger.info(`📍 访问地址: http://localhost:${PORT}`);
  logger.info(`📂 静态文件: ${path.join(__dirname, "../client/dist")}`);
  logger.info(`📁 上传目录: ${path.join(__dirname, "uploads")}`);
  logger.info(`🔒 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV || "development"}`);
});

// ==========================================
// 优雅关闭处理
// ==========================================
process.on("SIGINT", async () => {
  logger.info("\n🛑 正在关闭服务器...");
  try {
    await dbPool.end();
    logger.info("✅ 数据库连接池已关闭");
    process.exit(0);
  } catch (err) {
    logger.error("❌ 数据库关闭失败:", err);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logger.info("\n🛑 收到终止信号，正在关闭服务器...");
  try {
    await dbPool.end();
    logger.info("✅ 数据库连接池已关闭");
    process.exit(0);
  } catch (err) {
    logger.error("❌ 数据库关闭失败:", err);
    process.exit(1);
  }
});
