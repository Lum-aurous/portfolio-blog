const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ==========================================
// 数据库连接配置
// ==========================================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "123456",
  database: "my_portfolio",
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error("❌ 数据库连接失败: " + err.message);
    process.exit(1); // 数据库连接失败则退出程序
  }
  console.log("✅ 数据库连接成功！(MySQL)");

  // 🔥 数据库连接成功后再执行初始化操作
  initializeWallpaperSystem();
});

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
    console.log("📝 文件重命名:", file.originalname, "->", safeName);
    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片格式
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

// 全局壁纸配置缓存
let globalWallpaperCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// Fisher-Yates 洗牌算法
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 清空壁纸缓存
function clearWallpaperCache() {
  globalWallpaperCache = null;
  cacheTime = 0;
  console.log("🧹 壁纸缓存已清空");
}

// 洗牌全局壁纸顺序
function shuffleGlobalWallpapers(callback) {
  console.log("🔄 开始洗牌全局壁纸顺序…");

  const sql = "SELECT id, random_urls FROM global_wallpapers";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ 读取 global_wallpapers 失败:", err);
      if (callback) callback(err);
      return;
    }

    if (results.length === 0) {
      console.log("ℹ️ 没有找到全局壁纸配置");
      if (callback) callback(null);
      return;
    }

    let processedCount = 0;
    let hasError = false;

    results.forEach((row) => {
      if (!row.random_urls) {
        processedCount++;
        if (processedCount === results.length && callback) {
          callback(hasError ? new Error("部分洗牌失败") : null);
        }
        return;
      }

      let urls = [];

      // 兼容 JSON 数组和字符串格式
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
        console.log(`⚠️ 壁纸 ID=${row.id} 没有可洗牌的URL`);
        processedCount++;
        if (processedCount === results.length && callback) {
          callback(hasError ? new Error("部分洗牌失败") : null);
        }
        return;
      }

      const shuffled = shuffleArray(urls);
      const updateSql =
        "UPDATE global_wallpapers SET random_urls = ? WHERE id = ?";

      db.query(updateSql, [JSON.stringify(shuffled), row.id], (updateErr) => {
        processedCount++;

        if (updateErr) {
          console.error(`❌ 壁纸 ID=${row.id} 洗牌失败:`, updateErr);
          hasError = true;
        } else {
          console.log(`✅ 壁纸 ID=${row.id} 洗牌完成 (${urls.length} 张)`);
        }

        // 所有记录处理完毕
        if (processedCount === results.length) {
          // 清空缓存
          clearWallpaperCache();

          if (callback) {
            callback(hasError ? new Error("部分洗牌失败") : null);
          }
        }
      });
    });
  });
}

// 初始化壁纸系统
function initializeWallpaperSystem() {
  console.log("🚀 初始化壁纸系统...");

  // 启动时洗牌一次
  shuffleGlobalWallpapers((err) => {
    if (err) {
      console.error("❌ 启动洗牌失败:", err);
    } else {
      console.log("✅ 启动洗牌完成");
    }
  });

  // 🔥 每天凌晨3点自动洗牌
  scheduleDaily3AMShuffle();
}

// 定时任务：每天凌晨3点洗牌
function scheduleDaily3AMShuffle() {
  const now = new Date();
  const target = new Date();

  // 设置为今天凌晨3点
  target.setHours(3, 0, 0, 0);

  // 如果已经过了今天的3点，设置为明天3点
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const msUntil3AM = target.getTime() - now.getTime();

  console.log(`⏰ 下次自动洗牌时间: ${target.toLocaleString("zh-CN")}`);

  setTimeout(() => {
    shuffleGlobalWallpapers((err) => {
      if (err) {
        console.error("❌ 定时洗牌失败:", err);
      } else {
        console.log("✅ 定时洗牌完成");
      }
    });

    // 洗牌后，设置下一次（24小时后）
    setInterval(() => {
      shuffleGlobalWallpapers((err) => {
        if (err) {
          console.error("❌ 定时洗牌失败:", err);
        } else {
          console.log("✅ 定时洗牌完成");
        }
      });
    }, 24 * 60 * 60 * 1000); // 每24小时
  }, msUntil3AM);
}

// ==========================================
// 基础接口
// ==========================================

// 上传接口
app.post("/api/upload", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "请选择图片" });
  }
  res.json({ filePath: file.path });
});

// 获取个人简介接口
app.get("/api/profile", (req, res) => {
  const sql = "SELECT * FROM profile LIMIT 1";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("查询出错: ", err);
      return res.status(500).send("服务器内部错误");
    }
    res.json(results.length > 0 ? results[0] : {});
  });
});

// 获取文章列表接口
app.get("/api/articles", (req, res) => {
  const sql = "SELECT * FROM articles ORDER BY created_at DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("查询文章出错: ", err);
      return res.status(500).send("服务器错误");
    }
    res.json(results);
  });
});

// 获取单篇文章详情接口
app.get("/api/articles/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM articles WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).send("服务器错误");
    }
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).send("文章不存在");
    }
  });
});

// 发布文章接口
app.post("/api/articles", (req, res) => {
  const { title, summary, content, cover_image } = req.body;
  const sql =
    "INSERT INTO articles (title, summary, content, cover_image) VALUES (?, ?, ?, ?)";
  db.query(sql, [title, summary, content, cover_image], (err, result) => {
    if (err) {
      console.error("发布失败:", err);
      return res.status(500).send("发布失败");
    }
    res.json({ id: result.insertId, message: "发布成功" });
  });
});

// ==========================================
// 用户注册接口
// ==========================================
app.post("/api/register", (req, res) => {
  const { username, password, email, phone } = req.body;

  if (!username && !email && !phone) {
    return res
      .status(400)
      .json({ message: "至少提供用户名、邮箱或手机号中的一种" });
  }

  if (!password) {
    return res.status(400).json({ message: "密码不能为空" });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: "邮箱格式不正确" });
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function formatPhoneNumber(phone) {
    if (!phone) return null;
    if (phone.startsWith("+86")) return phone;
    const cleanPhone = phone.replace(/\D/g, "");
    if (/^1[3-9]\d{9}$/.test(cleanPhone)) {
      return `+86 ${cleanPhone}`;
    }
    return phone;
  }

  let formattedPhone = phone ? formatPhoneNumber(phone) : null;

  if (
    formattedPhone &&
    formattedPhone.startsWith("+86") &&
    !/^\+86\s1[3-9]\d{9}$/.test(formattedPhone)
  ) {
    return res.status(400).json({ message: "请输入有效的中国手机号" });
  }

  const loginIdentifier = username || email || formattedPhone || phone;
  const checkSql =
    "SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?";

  db.query(
    checkSql,
    [loginIdentifier, email, formattedPhone],
    (err, results) => {
      if (err) {
        console.error("数据库查询错误:", err);
        return res.status(500).json({ message: "服务器错误" });
      }

      if (results.length > 0) {
        const existingUser = results[0];
        if (existingUser.username === loginIdentifier) {
          return res.status(409).json({ message: "用户名已被占用" });
        }
        if (email && existingUser.email === email) {
          return res.status(409).json({ message: "邮箱已被注册" });
        }
        if (formattedPhone && existingUser.phone === formattedPhone) {
          return res.status(409).json({ message: "手机号已被注册" });
        }
      }

      const hash = bcrypt.hashSync(password, 10);
      const insertSql =
        "INSERT INTO users (username, password, email, phone) VALUES (?, ?, ?, ?)";

      db.query(
        insertSql,
        [loginIdentifier, hash, email, formattedPhone],
        (err, result) => {
          if (err) {
            console.error("注册失败:", err);
            return res.status(500).json({ message: "注册失败" });
          }
          res.json({
            success: true,
            message: "注册成功",
            loginIdentifier: loginIdentifier,
            phone: formattedPhone,
          });
        }
      );
    }
  );
});

// ==========================================
// 用户登录接口
// ==========================================
app.post("/api/login", (req, res) => {
  const { account, password } = req.body;

  if (!account || !password) {
    return res
      .status(400)
      .json({ success: false, message: "请输入账号和密码" });
  }

  let formattedAccount = account;

  if (/^1[3-9]\d{9}$/.test(account)) {
    formattedAccount = `+86 ${account}`;
  } else if (/^\+86\s?1[3-9]\d{9}$/.test(account)) {
    formattedAccount = account.replace(/\+86\s?/, "+86 ");
  }

  const sql = `
    SELECT id, username, password, role, avatar, nickname, email, phone 
    FROM users 
    WHERE username = ? OR email = ? OR phone = ?
  `;

  db.query(sql, [account, account, formattedAccount], (err, results) => {
    if (err) {
      console.error("登录查询错误:", err);
      return res.status(500).json({ success: false, message: "服务器错误" });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "账号不存在" });
    }

    const user = results[0];
    const isMatch = bcrypt.compareSync(password, user.password);

    if (isMatch) {
      res.json({
        success: true,
        message: "登录成功",
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
    } else {
      res.status(401).json({ success: false, message: "密码错误" });
    }
  });
});

// ==========================================
// 评论相关接口
// ==========================================

// 发表评论
app.post("/api/comments", (req, res) => {
  const { article_id, nickname, content } = req.body;
  console.log("正在尝试写入评论:", { article_id, nickname, content });
  const sql =
    "INSERT INTO comments (article_id, nickname, content) VALUES (?, ?, ?)";
  db.query(sql, [article_id, nickname, content], (err, result) => {
    if (err) {
      console.error("数据库报错详情:", err.message);
      return res.status(500).send("评论失败");
    }
    res.json({ success: true, message: "评论成功" });
  });
});

// 删除评论
app.delete("/api/comments/:id", (req, res) => {
  const id = req.params.id;
  console.log("正在删除评论 ID:", id);
  const sql = "DELETE FROM comments WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("删除失败");
    }
    res.json({ success: true, message: "已删除" });
  });
});

// 获取评论列表
app.get("/api/comments", (req, res) => {
  const article_id = req.query.article_id;
  const sql =
    "SELECT * FROM comments WHERE article_id = ? ORDER BY created_at DESC";
  db.query(sql, [article_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("获取评论失败");
    }
    res.json(results);
  });
});

// ==========================================
// 用户信息相关接口
// ==========================================

// 获取用户详细信息
app.get("/api/user/profile", (req, res) => {
  const { username } = req.query;
  const sql =
    "SELECT id, username, nickname, email, avatar, phone, gender, birthday, region, bio, social_link, role FROM users WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.send({ success: false, message: "数据库错误" });
    }
    if (results.length === 0) {
      return res.send({ success: false, message: "用户不存在" });
    }
    res.send({ success: true, user: results[0] });
  });
});

// 更新用户个人信息
app.post("/api/user/update", (req, res) => {
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

  if (!username) {
    return res.status(400).json({ success: false, message: "用户名不能为空" });
  }

  const sql = `
    UPDATE users
    SET nickname = ?, email = ?, avatar = ?, phone = ?, gender = ?, 
        birthday = ?, region = ?, bio = ?, social_link = ?
    WHERE username = ?
  `;

  const values = [
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
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("更新失败:", err);
      return res
        .status(500)
        .json({ success: false, message: "数据库更新失败" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "用户不存在" });
    }

    const selectSql = `
      SELECT id, username, nickname, email, avatar, phone, gender, 
             birthday, region, bio, social_link, role 
      FROM users 
      WHERE username = ?
    `;

    db.query(selectSql, [username], (selectErr, selectResults) => {
      if (selectErr || selectResults.length === 0) {
        return res.json({
          success: true,
          message: "更新成功，但获取更新后数据失败",
        });
      }

      res.json({
        success: true,
        message: "个人信息已保存到数据库",
        user: selectResults[0],
      });
    });
  });
});

// ==========================================
// 🔥 壁纸相关接口（优化版）
// ==========================================

// 获取全局壁纸配置（带缓存）
app.get("/api/wallpaper/global", (req, res) => {
  const now = Date.now();

  if (globalWallpaperCache && now - cacheTime < CACHE_DURATION) {
    console.log("📦 使用缓存的全局壁纸配置");
    return res.json(globalWallpaperCache);
  }

  const sql = "SELECT * FROM global_wallpapers LIMIT 1";
  db.query(sql, (err, results) => {
    if (err || results.length === 0) {
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
      return res.json(defaultConfig);
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
    res.json(config);
  });
});

// 🔥 新增：手动触发洗牌接口（管理员专用）
app.post("/api/wallpaper/shuffle", (req, res) => {
  const { adminKey } = req.body;

  // 简单的管理员验证（建议使用更安全的方式）
  if (adminKey !== "your-secret-admin-key") {
    return res.status(403).json({ success: false, message: "无权限" });
  }

  shuffleGlobalWallpapers((err) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "洗牌失败", error: err.message });
    }
    res.json({ success: true, message: "洗牌成功" });
  });
});

// 获取用户壁纸
app.get("/api/wallpaper/user", (req, res) => {
  const userId = req.query.userId;
  const username = req.query.username;

  if (!userId && !username) {
    console.warn("⚠️ 未提供用户ID或用户名");
    return res.status(401).json({ error: "未登录" });
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

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ 查询壁纸失败:", err);
      return res.status(500).json({ error: "查询失败" });
    }

    if (results.length > 0) {
      const url = results[0].wallpaper_url;
      console.log("✅ 找到用户壁纸:", { userId, username, url });
      res.json({ hasCustom: true, url });
    } else {
      console.log("ℹ️ 用户无自定义壁纸");
      res.json({ hasCustom: false });
    }
  });
});

// 批量获取用户壁纸
app.post("/api/wallpaper/batch", (req, res) => {
  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.json({});
  }

  const placeholders = userIds.map(() => "?").join(",");
  const sql = `SELECT user_id, wallpaper_url FROM user_wallpapers WHERE user_id IN (${placeholders})`;

  db.query(sql, userIds, (err, results) => {
    if (err) {
      console.error("批量查询壁纸失败:", err);
      return res.status(500).json({ error: "批量查询失败" });
    }

    const wallpapers = {};
    results.forEach((row) => {
      wallpapers[row.user_id] = row.wallpaper_url;
    });

    res.json({ wallpapers });
  });
});

// 用户壁纸上传
app.post("/api/wallpaper/user", upload.single("image"), async (req, res) => {
  console.log("🔍 收到上传请求", req.body);

  const userId = req.body.userId;
  const username = req.body.username;

  if ((!userId && !username) || !req.file) {
    console.error("❌ 参数错误");
    return res.status(400).json({ success: false, error: "参数错误" });
  }

  try {
    let actualUserId = userId;

    if (!userId && username) {
      const userResult = await new Promise((resolve, reject) => {
        const sql = "SELECT id FROM users WHERE username = ?";
        db.query(sql, [username], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: "用户不存在" });
      }
      actualUserId = userResult[0].id;
    }

    const filePath = req.file.path.replace(/\\/g, "/");
    const dbPath = "/" + filePath;

    console.log("📁 文件路径:", dbPath);

    clearWallpaperCache();

    const sql = `REPLACE INTO user_wallpapers (user_id, wallpaper_url, updated_at) VALUES (?, ?, NOW())`;

    db.query(sql, [actualUserId, dbPath], (err, result) => {
      if (err) {
        console.error("❌ 数据库操作失败:", err);
        return res
          .status(500)
          .json({ success: false, error: "保存到数据库失败" });
      }

      console.log("✅ 壁纸保存成功，影响行数:", result.affectedRows);

      res.json({
        success: true,
        url: `/${filePath}`,
        userId: actualUserId,
        message: "壁纸上传成功",
      });
    });
  } catch (error) {
    console.error("处理上传时出错:", error);
    res.status(500).json({ success: false, error: "服务器错误" });
  }
});

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

// SPA 页面刷新处理
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

// ==========================================
// 启动服务
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动！`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`📂 静态文件: ${path.join(__dirname, "../client/dist")}`);
  console.log(`📁 上传目录: ${path.join(__dirname, "uploads")}`);
});

// ==========================================
// 优雅关闭处理
// ==========================================
process.on("SIGINT", () => {
  console.log("\n🛑 正在关闭服务器...");
  db.end((err) => {
    if (err) {
      console.error("❌ 数据库关闭失败:", err);
    } else {
      console.log("✅ 数据库连接已关闭");
    }
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n🛑 收到终止信号，正在关闭服务器...");
  db.end((err) => {
    if (err) {
      console.error("❌ 数据库关闭失败:", err);
    } else {
      console.log("✅ 数据库连接已关闭");
    }
    process.exit(0);
  });
});
