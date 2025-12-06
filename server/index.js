const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const multer = require("multer"); // 👈 新增：引入 multer
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
// 👇 新增：配置 Multer 图片上传存储规则
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // 1. 存到 uploads 文件夹
  },
  filename: function (req, file, cb) {
    // 2. 给文件起个唯一的名字 (时间戳 + 原名)，防止重名覆盖
    // 比如: 1678888888-my-photo.jpg
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

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

// ==========================================
// 👇 新增：发布文章接口 (POST)
// ==========================================
// app.post('/api/articles', (req, res) => {
//     // 1. 从前端发来的包裹里拿出数据
//     const { title, summary, content } = req.body;

//     // 2. 准备 SQL：插入数据
//     const sql = 'INSERT INTO articles (title, summary, content) VALUES (?, ?, ?)';

//     // 3. 执行插入
//     db.query(sql, [title, summary, content], (err, result) => {
//         if (err) {
//             console.error('发布失败:', err);
//             return res.status(500).send('发布失败');
//         }
//         // 成功！返回新文章的 ID
//         res.json({ id: result.insertId, message: '发布成功' });
//     });
// });

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

// ==========================================
// 👇 新增：管理员登录接口
// ==========================================
// app.post('/api/login', (req, res) => {
//     const { password } = req.body;

//     // ⚠️ 这里为了演示方便，我们把密码硬编码为 'admin123'
//     // 在真实商业项目中，密码应该加密存在数据库里
//     if (password === 'admin123') {
//         res.json({ success: true, message: '登录成功' });
//     } else {
//         res.status(401).json({ success: false, message: '密码错误' });
//     }
// });

// ==========================================
// 👇 1. 新增：用户注册接口
// ==========================================
// app.post('/api/register', (req, res) => {
//     const { username, password } = req.body;

//     // 简单校验
//     if (!username || !password) {
//         return res.status(400).json({ message: '账号密码不能为空' });
//     }

//     // 检查用户名是否已存在
//     const checkSql = 'SELECT * FROM users WHERE username = ?';
//     db.query(checkSql, [username], (err, results) => {
//         if (results.length > 0) {
//             return res.status(409).json({ message: '用户名已被占用' });
//         }

//         // 插入新用户
//         const insertSql = 'INSERT INTO users (username, password) VALUES (?, ?)';
//         db.query(insertSql, [username, password], (err, result) => {
//             if (err) {
//                 return res.status(500).json({ message: '注册失败' });
//             }
//             res.json({ success: true, message: '注册成功！请登录' });
//         });
//     });
// });

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

// ==========================================
// 👇 2. 修改：用户登录接口 (查数据库)
// ==========================================
// app.post('/api/login', (req, res) => {
//     const { username, password } = req.body; // 注意：前端现在发 username 了

//     // 去数据库查：有没有这个账号 + 密码对不对
//     const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';

//     db.query(sql, [username, password], (err, results) => {
//         if (err) {
//             return res.status(500).json({ message: '服务器错误' });
//         }

//         // 如果查到了数据 (results数组不为空)
//         if (results.length > 0) {
//             const user = results[0];
//             // 返回成功，并附带用户信息 (id, username)
//             res.json({
//                 success: true,
//                 message: '登录成功',
//                 user: { id: user.id, username: user.username, role: user.role }
//             });
//         } else {
//             res.status(401).json({ success: false, message: '账号或密码错误' });
//         }
//     });
// });

// 加密用户登录密码
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // ⚡️ 确保 SELECT 包含 avatar
    const sql = 'SELECT id, username, password, role, avatar, nickname, email FROM users WHERE username = ?';
    
    db.query(sql, [username], (err, results) => {
        if (err) return res.status(500).json({ message: '服务器错误' });
        if (results.length === 0) return res.status(401).json({ success: false, message: '用户不存在' });

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password);

        if (isMatch) {
            res.json({ 
                success: true, 
                message: '登录成功', 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role,
                    avatar: user.avatar || null,        // ⚡️ 返回 Base64 或 null
                    nickname: user.nickname || null,
                    email: user.email || null
                } 
            });
        } else {
            res.status(401).json({ success: false, message: '密码错误' });
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
  // 接收前端发来的所有字段
  // 👇 1. 接收新字段
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

  // 👇 2. SQL 增加更新项
  const sql = `
        UPDATE users 
        SET nickname = ?, email = ?, avatar = ?, phone = ?, gender = ?, birthday = ?, region = ?, bio = ?, social_link = ?
        WHERE username = ?
    `;

  // 👇 3. 参数数组对应增加
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
      return res.send({ success: false, message: "更新失败" });
    }
    res.send({ success: true, message: "个人信息已保存到数据库" });
  });
});

// 👇 新增：把 'uploads' 文件夹变成公开的静态资源目录
// 这样浏览器访问 http://localhost:3000/uploads/xxx.jpg 就能看到图了
app.use("/uploads", express.static("uploads"));
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
