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
const nodemailer = require("nodemailer");

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

// 配置邮件发送器 (放在接口外面，复用连接)
const transporter = nodemailer.createTransport({
  service: "qq", // 使用内置的 QQ 邮箱服务
  auth: {
    user: "bojackjck@foxmail.com", // ❌【重要】请替换为你的真实QQ邮箱
    pass: "nysuimbzmxipdddh", // ❌【重要】请替换为你的16位授权码
  },
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

// 放在 CORS 之前，这样加载网页/图片永远不会报跨域错误
app.use("/uploads", express.static("uploads", { maxAge: "1d" }));
app.use(express.static(path.join(__dirname, "../client/dist")));

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

    // 🔍 逻辑修改：
    // 1. !origin: 允许同源请求（比如后端直接渲染页面）
    // 2. includes: 在白名单里
    // 3. 包含 'cpolar': 允许内网穿透的域名
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.includes("cpolar") || // 🔥 新增：允许 cpolar
      origin.includes("ngrok") // 🔥 备用：允许 ngrok (如果以后用的话)
    ) {
      callback(null, true);
    } else {
      console.log("❌ CORS 拦截了请求，来源:", origin); // 方便调试看日志
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
// 🔥 新增：显式处理所有 OPTIONS 请求，直接返回 200，不走后面的中间件
app.options(/.*/, cors(corsOptions));
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
        from: '"Veritas 博客" <bojackjck@foxmail.com>', // ❌【重要】这里也要改成你的QQ邮箱，必须和上面 auth.user 一致
        to: account, // 收件人
        subject: "【Veritas】找回密码验证码", // 标题
        text: `您的验证码是：${code}，有效期5分钟。`, // 纯文本兜底
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

      logger.info(
        `用户信息更新成功: ID=${id}, 用户名=${
          updatedUser[0].username || username
        }`
      );
      apiResponse.success(res, "个人信息已更新", updatedUser[0]);
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
