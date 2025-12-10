const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const multer = require("multer"); // 👈 新增：引入 multer
const fs = require("fs");
const path = require("path"); // 👈 新增：引入 path (处理路径用)
const app = express();

app.use(cors());
// 👇 关键修改：允许更大的 JSON 包体 (为了传 Base64 图片)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 1. 数据库连接配置
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
    return;
  }
  console.log("✅ 数据库连接成功！(MySQL)");
});

// ==========================================
// 👇 修改：配置 Multer 图片上传存储规则
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 确保 uploads 文件夹存在
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // ✅ 生成安全的文件名：移除所有特殊字符和空格
    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    // 生成安全的文件名：时间戳 + 随机数 + 扩展名
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const safeName = `${timestamp}-${random}${ext}`;

    console.log("📝 文件重命名:", originalName, "->", safeName);
    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
});

// ==========================================
// 👇 新增：上传接口 (单独的一个接口)
// ==========================================
// 前端发来一个叫 'image' 的文件，我们把它存下来，并返回文件路径
app.post("/api/upload", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("请选择图片");
  }
  // 返回图片的访问 URL
  // 注意：这里返回的是相对路径，比如 'uploads/123.jpg'
  res.json({ filePath: file.path });
});

// ==========================================
// 👇 新增：获取个人简介接口
// ==========================================
app.get("/api/profile", (req, res) => {
  // 准备 SQL 语句：查询 profile 表里的第一条数据
  const sql = "SELECT * FROM profile LIMIT 1";

  // 执行查询
  db.query(sql, (err, results) => {
    if (err) {
      console.error("查询出错: ", err);
      return res.status(500).send("服务器内部错误");
    }

    // 如果查到了数据，就把第一条(results[0])发给前端
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({}); // 没数据就发个空对象
    }
  });
});

// ==========================================
// 👇 新增：获取文章列表接口
// ==========================================
app.get("/api/articles", (req, res) => {
  // 按时间倒序查询所有文章（最新的在最上面）
  const sql = "SELECT * FROM articles ORDER BY created_at DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("查询文章出错: ", err);
      return res.status(500).send("服务器错误");
    }
    res.json(results);
  });
});

// ==========================================
// 👇 新增：获取单篇文章详情接口
// ==========================================
app.get("/api/articles/:id", (req, res) => {
  // 1. 拿到浏览器传过来的 ID (比如 1)
  const id = req.params.id;

  // 2. 查询数据库，只找 id 匹配的那一条
  const sql = "SELECT * FROM articles WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).send("服务器错误");
    }
    // 如果找到了，返回第一条；没找到返回 404
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).send("文章不存在");
    }
  });
});

// 👇 修改原来的发布文章接口
app.post("/api/articles", (req, res) => {
  // 1. 多接收一个 cover_image 字段
  const { title, summary, content, cover_image } = req.body;

  // 2. SQL 语句也要改，把 cover_image 加进去
  const sql =
    "INSERT INTO articles (title, summary, content, cover_image) VALUES (?, ?, ?, ?)";

  // 3. 参数数组也要加 cover_image
  db.query(sql, [title, summary, content, cover_image], (err, result) => {
    if (err) {
      console.error("发布失败:", err);
      return res.status(500).send("发布失败");
    }
    res.json({ id: result.insertId, message: "发布成功" });
  });
});

// 加密用户注册密码
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;

  // 1. 检查用户名是否存在
  const checkSql = "SELECT * FROM users WHERE username = ?";
  db.query(checkSql, [username], (err, results) => {
    if (results.length > 0)
      return res.status(409).json({ message: "用户名已被占用" });

    // 2. 🔐 核心改变：对密码进行加密
    // 10 是“加盐”的强度，数值越大越安全但越慢，10 是标准值
    const hash = bcrypt.hashSync(password, 10);

    // 3. 存入数据库的是 'hash' (乱码)，不再是 'password' (明文)
    const insertSql = "INSERT INTO users (username, password) VALUES (?, ?)";

    db.query(insertSql, [username, hash], (err, result) => {
      if (err) return res.status(500).json({ message: "注册失败" });
      res.json({ success: true, message: "注册成功" });
    });
  });
});

// 加密用户登录密码
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // ⚡️ 确保 SELECT 包含 avatar
  const sql =
    "SELECT id, username, password, role, avatar, nickname, email FROM users WHERE username = ?";

  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).json({ message: "服务器错误" });
    if (results.length === 0)
      return res.status(401).json({ success: false, message: "用户不存在" });

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
          avatar: user.avatar || null, // ⚡️ 返回 Base64 或 null
          nickname: user.nickname || null,
          email: user.email || null,
        },
      });
    } else {
      res.status(401).json({ success: false, message: "密码错误" });
    }
  });
});

// ==========================================
// 👇 1. 发表评论接口 (POST)
// ==========================================
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

// ==========================================
// 👇 2. 删除评论接口 (DELETE) - ⚠️ 你之前缺了这个！
// ==========================================
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

// ==========================================
// 👇 3. 获取评论列表接口 (GET)
// ==========================================
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
// 👇 新增：获取用户详细信息接口 (GET)
// ==========================================
app.get("/api/user/profile", (req, res) => {
  // 前端会传过来 username
  const { username } = req.query;

  const sql =
    "SELECT id, username, nickname, email, avatar, phone, gender, birthday, region, bio, social_link, role FROM users WHERE username = ?";

  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error(err);
      return res.send({ success: false, message: "数据库错误" });
    }
    if (results.length === 0)
      return res.send({ success: false, message: "用户不存在" });

    // 返回用户信息（注意：不要返回密码）
    res.send({
      success: true,
      user: results[0],
    });
  });
});

// ==========================================
// 👇 新增：更新用户个人信息接口 (POST)
// ==========================================
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

  // 验证必填字段
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

    // 🔥 返回更新后的完整用户数据
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

      const updatedUser = selectResults[0];

      res.json({
        success: true,
        message: "个人信息已保存到数据库",
        user: updatedUser,
      });
    });
  });
});

// ==================== 壁纸相关接口优化 ====================

// 1. 全局壁纸配置缓存（减少数据库查询）
let globalWallpaperCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 获取全局壁纸配置（带缓存）
app.get("/api/wallpaper/global", async (req, res) => {
  const now = Date.now();

  // 使用缓存（如果有效）
  if (globalWallpaperCache && now - cacheTime < CACHE_DURATION) {
    console.log("📦 使用缓存的全局壁纸配置");
    return res.json(globalWallpaperCache);
  }

  try {
    const sql = "SELECT * FROM global_wallpapers LIMIT 1";
    db.query(sql, (err, results) => {
      if (err || results.length === 0) {
        // 返回默认配置
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
      const config = {
        mode: data.mode || "website",
        dailyUrl: data.daily_url || "",
        websiteUrl: data.website_url || "",
        randomUrls:
          data.random_urls && typeof data.random_urls === "string"
            ? data.random_urls
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      };

      globalWallpaperCache = config;
      cacheTime = now;
      res.json(config);
    });
  } catch (error) {
    console.error("获取全局壁纸失败:", error);
    res.status(500).json({ error: "获取全局壁纸失败" });
  }
});

// 2. 获取用户壁纸（优化查询）
app.get("/api/wallpaper/user", (req, res) => {
  const userId = req.query.userId;
  const username = req.query.username; // 新增：支持通过username查询

  if (!userId && !username) {
    console.warn("⚠️ 未提供用户ID或用户名");
    return res.status(401).json({ error: "未登录" });
  }

  let sql, params;

  if (userId) {
    sql = "SELECT wallpaper_url FROM user_wallpapers WHERE user_id = ?";
    params = [userId];
  } else {
    // 通过username查询用户的壁纸
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

// 3. 新增：批量获取用户壁纸（用于页面初始化预加载）
app.post("/api/wallpaper/batch", (req, res) => {
  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.json({});
  }

  const placeholders = userIds.map(() => "?").join(",");
  const sql = `
    SELECT user_id, wallpaper_url 
    FROM user_wallpapers 
    WHERE user_id IN (${placeholders})
  `;

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

// 4. 优化用户壁纸上传
app.post("/api/wallpaper/user", upload.single("image"), async (req, res) => {
  console.log("🔍 收到上传请求", req.body);

  const userId = req.body.userId;
  const username = req.body.username; // 新增支持

  if ((!userId && !username) || !req.file) {
    console.error("❌ 参数错误");
    return res.status(400).json({
      success: false,
      error: "参数错误",
    });
  }

  try {
    let actualUserId = userId;

    // 如果传的是username，需要先获取用户ID
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

    // 清空全局缓存（因为壁纸有更新）
    globalWallpaperCache = null;

    const sql = `
      REPLACE INTO user_wallpapers (user_id, wallpaper_url, updated_at) 
      VALUES (?, ?, NOW())
    `;

    db.query(sql, [actualUserId, dbPath], (err, result) => {
      if (err) {
        console.error("❌ 数据库操作失败:", err);
        return res.status(500).json({
          success: false,
          error: "保存到数据库失败",
        });
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

// 👇 新增：把 'uploads' 文件夹变成公开的静态资源目录
// 这样浏览器访问 http://localhost:3000/uploads/xxx.jpg 就能看到图了
app.use(
  "/uploads",
  express.static("uploads", {
    // 设置缓存控制
    maxAge: "1d",
    // 设置索引文件
    index: false,
    // 处理点文件
    dotfiles: "ignore",
  })
);
// ==========================================
// 👇 1. 托管前端静态文件 (让 dist 文件夹能被访问)
// ==========================================
// 注意：这里用 ../client/dist 找到刚才打包的文件夹
app.use(express.static(path.join(__dirname, "../client/dist")));
// ==========================================
// 👇 2. 处理 SPA 页面刷新问题 (放在所有 API 接口的最后面！)
// ==========================================
// 如果用户访问了不存在的 API，或者是刷新了页面，就返回 index.html
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

// 启动服务
app.listen(3000, () => {
  console.log("后端服务已启动！访问地址：http://localhost:3000");
});
