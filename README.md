# 旧书版本考据社区

一个用于古籍版本考据研究的社区网站，支持词条管理、版本对照、书影上传、批注讨论和引用关系图谱。

## 技术栈

- **前端**: Vue 3 + Vite 4 + Vue Router + Pinia + Axios
- **后端**: Node.js + Fastify + better-sqlite3
- **数据库**: SQLite (文件存储在 `backend/data/oldbook.db`)

## 功能模块

| 模块 | 说明 |
|------|------|
| 词条浏览 | 首页展示所有古籍词条，含书名、作者、朝代、版本数 |
| 词条详情 | 展示某部书的基本信息、所有版本一览、引用关系 |
| 版本对照 | 并排对比两个或多个版本的全文，查看文字差异 |
| 版本详情 | 查看版本文本、书影图片、批注讨论，支持上传图片和发表批注 |
| 引用图谱 | SVG 可视化展示词条之间的异名、承袭、相关等关系 |
| 后台编辑 | 管理词条、版本、引用关系，支持增删改操作 |

## 快速开始

### 1. 安装依赖

```bash
cd /Users/a1-6/Desktop/solo-2/wt-18
npm run install:all
```

或分别安装：

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. 初始化演示数据（首次运行）

数据库文件和演示数据会在后端首次启动时自动创建。如需手动重置：

```bash
cd backend
npm run seed
```

### 3. 启动服务

**一键启动（推荐）**：
```bash
cd /Users/a1-6/Desktop/solo-2/wt-18
npm run dev
```

**分别启动**：
```bash
# 终端 1 - 后端（端口 3001）
cd backend && npm start

# 终端 2 - 前端（端口 5173）
cd frontend && npm run dev
```

### 4. 访问

- 前端页面: http://localhost:5173
- 后端 API: http://localhost:3001/api

## 目录结构

```
wt-18/
├── backend/
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   │   ├── entries.js       # 词条接口
│   │   │   ├── versions.js      # 版本接口
│   │   │   ├── images.js        # 图片接口
│   │   │   ├── annotations.js   # 批注接口
│   │   │   ├── references.js    # 引用接口
│   │   │   └── admin.js         # 后台接口
│   │   ├── db.js          # 数据库连接与建表
│   │   ├── seed.js        # 演示数据
│   │   └── server.js      # Fastify 服务入口
│   ├── data/              # SQLite 数据库文件（自动创建）
│   ├── uploads/           # 上传图片目录（自动创建）
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   │   ├── HomeView.vue       # 首页/词条列表
│   │   │   ├── EntryDetail.vue    # 词条详情
│   │   │   ├── VersionDetail.vue  # 版本详情（含图片和批注）
│   │   │   ├── CompareView.vue    # 版本对照
│   │   │   ├── GraphView.vue      # 引用图谱
│   │   │   └── AdminView.vue      # 后台管理
│   │   ├── router/        # 路由配置
│   │   ├── api/           # API 封装
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── scripts/
    └── start.js           # 一键启动脚本
```

## API 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/entries` | 词条列表 |
| GET | `/api/entries/:id` | 词条详情（含版本） |
| POST | `/api/entries` | 新建词条 |
| PUT | `/api/entries/:id` | 更新词条 |
| DELETE | `/api/entries/:id` | 删除词条 |
| GET | `/api/versions/:id` | 版本详情 |
| GET | `/api/compare?ids=1,2` | 多版本对照 |
| POST | `/api/versions` | 新建版本 |
| PUT | `/api/versions/:id` | 更新版本 |
| DELETE | `/api/versions/:id` | 删除版本 |
| GET | `/api/versions/:id/images` | 版本图片列表 |
| POST | `/api/versions/:id/images` | 上传图片 |
| DELETE | `/api/images/:id` | 删除图片 |
| GET | `/api/versions/:id/annotations` | 批注列表（树形） |
| POST | `/api/versions/:id/annotations` | 发表批注 |
| DELETE | `/api/annotations/:id` | 删除批注 |
| GET | `/api/entries/:id/references` | 词条引用关系 |
| POST | `/api/references` | 新建引用关系 |
| GET | `/api/references/graph` | 引用图谱数据 |
| GET | `/api/admin/stats` | 数据统计 |

## 演示数据

预置了以下演示内容：
- **词条**：红楼梦、石头记、金瓶梅
- **版本**：程甲本、程乙本、庚辰本、甲戌本、万历丁巳本
- **批注**：5 条不同学者的版本学见解
- **引用关系**：红楼梦↔石头记（异名）、红楼梦→金瓶梅（承袭）、石头记→金瓶梅（承袭）
