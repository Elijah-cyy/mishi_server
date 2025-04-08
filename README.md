# 果宝大逃脱 - 微信小游戏后端服务

## 项目介绍

这是《果宝大逃脱》微信小游戏的后端服务项目，为小游戏提供用户管理、游戏状态保存、多人对战等功能支持。

## 技术栈

- **后端框架**: Node.js + Express
- **数据存储**: 文件 + 内存缓存
- **用户认证**: 微信小游戏登录系统
- **部署**: 本地开发环境 -> 微信云托管

## 快速开始

### 环境要求

- Node.js 12.0+
- npm 6.0+

### 安装与运行

1. 安装依赖：
```bash
cd mishi_server
npm install
```

2. 本地运行：
```bash
npm start
```

服务将在 http://localhost:3000 启动

### 开发模式运行（带热更新）：
```bash
npm run dev
```

## 系统架构

```
前端(微信小游戏) <---> Express后端 <---> 文件存储
                        |
                        v
                   微信开放API
```

## 目录结构

```
mishi_server/
├── data/                  # 数据文件目录
│   ├── users.json         # 用户数据
│   └── game_config.json   # 游戏配置
├── src/
│   ├── controllers/       # 控制器
│   │   ├── userController.js
│   │   ├── gameController.js
│   │   └── roomController.js
│   ├── services/          # 业务逻辑
│   │   ├── userService.js
│   │   ├── gameService.js
│   │   └── roomService.js
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   └── logger.js      # 日志中间件
│   ├── utils/             # 工具函数
│   │   ├── wxAuth.js      # 微信认证工具
│   │   ├── storage.js     # 存储工具
│   │   └── roomManager.js # 房间管理
│   ├── routes/            # 路由
│   │   ├── userRoutes.js
│   │   ├── gameRoutes.js
│   │   └── roomRoutes.js
│   └── config.js          # 配置文件
├── app.js                 # 应用入口
└── package.json
```

## API 文档

### 用户管理

#### 登录
```
POST /api/user/login
```
请求体:
```json
{
  "code": "wx.login()获取的code"
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "token": "会话token",
    "user": {
      "openId": "用户ID",
      "nickname": "用户昵称",
      "settings": {
        "soundEnabled": true,
        "musicEnabled": true
      }
    }
  }
}
```

#### 获取用户信息
```
GET /api/user/info
```
请求头:
```
Authorization: Bearer {token}
```
响应:
```json
{
  "code": 0,
  "data": {
    "openId": "用户ID",
    "nickname": "用户昵称",
    "avatarUrl": "头像URL",
    "settings": {
      "soundEnabled": true,
      "musicEnabled": true
    },
    "gameStats": {
      "highScore": 100,
      "totalGames": 10,
      "wins": 3
    }
  }
}
```

#### 更新用户设置
```
PUT /api/user/settings
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "settings": {
    "soundEnabled": false,
    "musicEnabled": true
  }
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "settings": {
      "soundEnabled": false,
      "musicEnabled": true
    }
  }
}
```

### 游戏管理

#### 获取游戏配置
```
GET /api/game/config
```
响应:
```json
{
  "code": 0,
  "data": {
    "version": "1.0.0",
    "levels": [
      {
        "id": 1,
        "name": "第一关",
        "difficulty": "easy"
      }
    ],
    "items": [
      {
        "id": "shield",
        "name": "护盾",
        "description": "提供临时无敌效果"
      }
    ]
  }
}
```

#### 保存游戏进度
```
POST /api/game/save
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "gameData": {
    "level": 3,
    "score": 1500,
    "items": ["speed", "shield"],
    "position": {"x": 100, "y": 200}
  }
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "saveId": "存档ID",
    "saveTime": "2023-04-08T12:34:56Z"
  }
}
```

#### 加载游戏进度
```
GET /api/game/load
```
请求头:
```
Authorization: Bearer {token}
```
响应:
```json
{
  "code": 0,
  "data": {
    "gameData": {
      "level": 3,
      "score": 1500,
      "items": ["speed", "shield"],
      "position": {"x": 100, "y": 200}
    },
    "saveTime": "2023-04-08T12:34:56Z"
  }
}
```

### 多人房间

#### 创建房间
```
POST /api/room/create
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "maxPlayers": 4
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "roomId": "123456",
    "hostId": "用户ID",
    "status": "waiting",
    "maxPlayers": 4,
    "players": [
      {
        "openId": "用户ID",
        "nickname": "房主昵称",
        "avatarUrl": "头像URL",
        "ready": false
      }
    ]
  }
}
```

#### 加入房间
```
POST /api/room/join
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "roomId": "123456"
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "roomId": "123456",
    "hostId": "房主ID",
    "status": "waiting",
    "maxPlayers": 4,
    "players": [
      {
        "openId": "房主ID",
        "nickname": "房主昵称",
        "avatarUrl": "头像URL",
        "ready": false
      },
      {
        "openId": "用户ID",
        "nickname": "用户昵称",
        "avatarUrl": "头像URL",
        "ready": false
      }
    ]
  }
}
```

#### 获取房间信息
```
GET /api/room/info/:roomId
```
请求头:
```
Authorization: Bearer {token}
```
响应:
```json
{
  "code": 0,
  "data": {
    "roomId": "123456",
    "hostId": "房主ID",
    "status": "waiting",
    "maxPlayers": 4,
    "players": [
      {
        "openId": "房主ID",
        "nickname": "房主昵称",
        "avatarUrl": "头像URL",
        "ready": true
      },
      {
        "openId": "用户ID",
        "nickname": "用户昵称",
        "avatarUrl": "头像URL",
        "ready": false
      }
    ]
  }
}
```

#### 开始游戏
```
POST /api/room/start
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "roomId": "123456"
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "roomId": "123456",
    "status": "playing",
    "gameState": {
      "currentTurn": 0,
      "startTime": "2023-04-08T12:34:56Z"
    }
  }
}
```

#### 广播游戏操作
```
POST /api/room/broadcast
```
请求头:
```
Authorization: Bearer {token}
```
请求体:
```json
{
  "roomId": "123456",
  "action": "move",
  "data": {
    "position": {"x": 150, "y": 200},
    "direction": "right"
  }
}
```
响应:
```json
{
  "code": 0,
  "data": {
    "success": true
  }
}
```

## 数据结构

### 用户数据
```javascript
{
  openId: String,       // 微信用户唯一标识
  nickname: String,     // 昵称
  avatarUrl: String,    // 头像URL
  settings: {           // 用户设置
    soundEnabled: Boolean,  // 音效开关
    musicEnabled: Boolean   // 背景音乐开关
  },
  gameStats: {          // 游戏统计
    highScore: Number,  // 最高分
    totalGames: Number, // 总游戏场次
    wins: Number,       // 获胜次数
    lastPlayed: Date    // 最后游戏时间
  },
  createdAt: Date       // 首次登录时间
}
```

### 房间数据
```javascript
{
  roomId: String,        // 房间号（6位数字）
  hostId: String,        // 房主ID
  status: String,        // 状态：waiting/playing/ended
  maxPlayers: Number,    // 最大玩家数（2-4）
  players: [{
    openId: String,      // 玩家ID
    nickname: String,    // 昵称
    avatarUrl: String,   // 头像
    ready: Boolean,      // 准备状态
    score: Number        // 游戏分数
  }],
  gameState: {           // 当前游戏状态
    currentTurn: Number, // 当前回合
    startTime: Date,     // 开始时间
    cards: Array         // 游戏卡牌状态
  },
  createdAt: Date,       // 创建时间
  updatedAt: Date        // 最后更新时间
}
```

## 数据存储方案

项目采用文件+内存混合存储方式：

1. **内存存储**：
   - 运行时数据（房间信息、游戏状态等）
   - 高频访问的用户信息

2. **文件存储**：
   - 用户基本信息
   - 游戏配置数据
   - 定期同步内存数据

3. **同步机制**：
   - 定时将内存数据同步到文件（每5分钟）
   - 关键操作触发立即同步
   - 服务启动时从文件加载初始数据

## 扩展性考虑

1. **数据库迁移**：
   - 服务层与数据访问层分离
   - 为未来迁移到MySQL/MongoDB做准备

2. **微信云托管**：
   - 代码设计考虑云环境部署
   - 支持无状态水平扩展

3. **WebSocket支持**：
   - 预留实时通信接口
   - 多人游戏实时交互

## 部署

### 本地开发环境
```bash
npm start
```

### 微信云托管部署
1. 安装微信云托管CLI工具
2. 登录微信云托管
   ```bash
   tcb login
   ```
3. 创建云托管服务
   ```bash
   tcb service create -n mishi-server
   ```
4. 部署服务
   ```bash
   tcb deploy
   ```

## 注意事项

1. `data` 目录需要具有读写权限
2. 生产环境建议使用PM2等进程管理工具
3. 敏感配置（如微信AppSecret）应使用环境变量

## 许可证

MIT License
