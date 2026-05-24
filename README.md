# 🧩 拼豆管理器 — Perler Beads Manager

面向拼豆爱好者的全功能本地管理工具，覆盖**色号管理**、**库存追踪**、**图纸设计**、**购物车**和**色差计算**五大核心模块。数据以 JSON 文件持久化，无需数据库，clone 即用。

---

## 功能特性

- 🎨 **色号管理** — 221 种色号按色系分类浏览，支持搜索、名称编辑、色彩预览
- 📦 **库存追踪** — 实时库存管理，快速增减、批量采购录入、流水记录追溯
- 📐 **图纸管理** — 创建和管理拼豆图纸，色号用量统计，自动库存充足性检查
- 🛒 **购物车** — 将图纸加入购物车，支持多份制作，一键提交自动扣减库存
- 🔬 **色差计算器** — 基于 CIEDE2000 算法，计算目标颜色与所有色号的精确色差
- 🌗 **日夜主题** — 亮色/暗色/跟随系统三种模式，使用 CSS Variables 实现
- 📱 **响应式设计** — 支持手机、平板、桌面三种设备自适应布局
- 💾 **本地优先** — 所有数据存储在本地 JSON 文件，无需网络，无外部依赖数据库

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js (CommonJS) |
| Web 框架 | Express 4.x |
| 模板引擎 | EJS |
| 样式 | 原生 CSS (Variables + Grid + 毛玻璃) |
| 前端脚本 | Vanilla JavaScript |
| 数据持久化 | 本地 JSON 文件 (`data/` 目录) |
| 色差计算 | `color-diff` (CIEDE2000) |

### 依赖

| 依赖 | 用途 |
|------|------|
| `express` | HTTP 服务器、路由、静态资源 |
| `ejs` | 服务端 HTML 模板渲染 |
| `color-diff` | CIEDE2000 色差计算 |
| `uuid` | 唯一 ID 生成 |
| `nodemon` (dev) | 开发热重载 |

---

## 快速开始

### 环境要求

- Node.js ≥ 18

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd perler-beads-manager

# 安装依赖
npm install

# 初始化色号数据（从 colors.csv 生成 data/colors.json）
npm run init

# 启动服务
npm start
```

首次启动时，系统会自动检查并创建所需的数据文件（`inventory.json`、`transactions.json` 等）。此后访问 `http://localhost:3000` 即可使用。

### 开发模式

```bash
npm run dev
```

使用 `nodemon` 监听文件变更自动重启，方便开发。

### 自定义端口

```bash
PORT=8080 npm start
LISTEN=127.0.0.1 PORT=8080 npm start
```

---

## 页面总览

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 仪表盘 | 库存概览、不足预警、最近图纸 |
| `/colors` | 色号管理 | 按色系筛选/搜索，色块网格展示 |
| `/inventory` | 库存管理 | 库存表格、快捷操作、批量购买、流水记录 |
| `/patterns` | 图纸管理 | 图纸创建/编辑/导入/导出 |
| `/cart` | 购物车 | 需求汇总、库存对比、一键提交 |
| `/color-diff` | 色差计算器 | HEX 输入、色号库选取、结果排序 |

---

## 项目结构

```
perler-beads-manager/
├── server.js                  # 应用入口
├── package.json
├── colors.csv                 # 色号源数据
├── scripts/
│   └── init-colors.js         # 初始化：CSV → JSON
├── src/
│   ├── routes/                # API 路由
│   │   ├── colors.js
│   │   ├── inventory.js
│   │   ├── transactions.js
│   │   ├── patterns.js
│   │   ├── cart.js
│   │   └── colorDiff.js
│   ├── services/              # 业务逻辑
│   │   ├── colorService.js
│   │   ├── inventoryService.js
│   │   ├── transactionService.js
│   │   ├── patternService.js
│   │   ├── cartService.js
│   │   └── colorDiffService.js
│   ├── utils/                 # 工具函数
│   │   ├── dataStore.js       # JSON 文件读写
│   │   ├── colorConverter.js  # 颜色空间转换
│   │   └── validator.js       # 输入校验
│   └── middleware/
│       └── errorHandler.js
├── views/                     # EJS 模板
│   ├── layout.ejs             # 公共布局
│   ├── index.ejs              # 仪表盘
│   ├── colors.ejs
│   ├── inventory.ejs
│   ├── patterns.ejs
│   ├── pattern-editor.ejs
│   ├── cart.ejs
│   ├── color-diff.ejs
│   └── error.ejs
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js             # 公共工具（主题切换等）
│       ├── colors.js
│       ├── inventory.js
│       ├── batch-purchase.js  # 批量采购
│       ├── patterns.js
│       ├── cart.js
│       └── color-diff.js
└── data/                      # 运行时持久化数据
    ├── colors.json
    ├── inventory.json
    ├── transactions.json
    ├── patterns.json
    ├── cart.json
    └── stores.json
```

---

## 色号体系

本系统包含 **221 种色号**，按色系分为 9 组，采用"字母前缀 + 数字序号"编码：

| 前缀 | 色系 | 数量 |
|------|------|------|
| A | 黄色系 | 26 |
| B | 绿色系 | 32 |
| C | 蓝色系 | 29 |
| D | 紫色系 | 26 |
| E | 粉红色系 | 24 |
| F | 红色系 | 25 |
| G | 棕色/橙色系 | 21 |
| H | 黑白灰色系 | 23 |
| M | 莫兰迪/中性色系 | 15 |

色号数据来源于 `colors.csv`，首次运行 `npm run init` 生成 `data/colors.json`。用户可以编辑各色号的中英文名称。

---

## 色差计算

色差计算器使用 **CIEDE2000** (ΔE00) 算法，这是 CIE 国际照明委员会推荐的最新色差标准，相比旧版 CIE76/CIE94 对人眼感知有更好的准确性。

| ΔE00 | 人眼感知 | 拼豆适用场景 |
|------|---------|------------|
| 0 – 1 | 几乎不可感知 | 完美替代 |
| 1 – 2 | 仅近距离可察觉 | 优秀替代 |
| 2 – 3.5 | 普通观察可察觉 | 可接受替代 |
| 3.5 – 5 | 明显差异 | 仅大色块远观 |
| 5+ | 显著不同 | 不可替代 |

---

## API 端点一览

### 色号
- `GET /api/colors` — 获取全部色号（支持 `?series=A&q=搜索` 筛选）
- `GET /api/colors/:code` — 获取单个色号详情
- `PUT /api/colors/:code` — 编辑色号名称

### 库存
- `GET /api/inventory` — 获取库存列表（支持 `?series=A&sort=asc`）
- `GET /api/inventory/stats` — 获取库存统计数据
- `GET /api/inventory/stores` — 获取店家列表
- `PUT /api/inventory/stores` — 更新店家列表
- `GET /api/inventory/:code` — 获取单个色号库存
- `PUT /api/inventory/:code` — 调整库存（支持增量/设置模式）
- `POST /api/inventory/mix-transfer` — 转入混色库存

### 流水记录
- `GET /api/transactions` — 查询流水（支持 `?code=&type=&from=&to=`）
- `POST /api/transactions` — 创建记录
- `PUT /api/transactions/:id` — 修改记录
- `DELETE /api/transactions/:id` — 删除记录
- `POST /api/transactions/batch` — 批量创建购买记录

### 图纸
- `GET /api/patterns` — 获取全部图纸
- `POST /api/patterns` — 创建图纸
- `GET /api/patterns/:id` — 获取详情
- `PUT /api/patterns/:id` — 更新图纸
- `DELETE /api/patterns/:id` — 删除图纸
- `GET /api/patterns/:id/check` — 库存充足性检查
- `GET /api/patterns/:id/export` — 导出 JSON
- `POST /api/patterns/import` — 导入 JSON
- `POST /api/patterns/batch-delete` — 批量删除

### 购物车
- `GET /api/cart` — 获取购物车内容及需求汇总
- `POST /api/cart` — 添加图纸到购物车
- `PUT /api/cart/:id` — 修改份数
- `DELETE /api/cart/:id` — 移除条目
- `POST /api/cart/mixed-beads` — 添加混色需求
- `POST /api/cart/submit` — 提交扣减库存
- `DELETE /api/cart` — 清空购物车

### 色差计算
- `GET /api/color-diff?hex=FF6B35&limit=20&inStockOnly=true` — 计算色差

---

## 视觉风格

- **毛玻璃导航栏** — 全局导航使用 `backdrop-filter: blur()` 实现半透明模糊效果
- **自适应色块** — 色号卡片文字颜色根据背景亮度自动计算黑/白对比度
- **CSS Variables 主题** — 通过 `data-theme` 属性切换亮/暗色系，支持跟随系统偏好
- **响应式断点** — Mobile (<768px) / Tablet (768–1024px) / Desktop (>1024px)

---

## License

MIT
