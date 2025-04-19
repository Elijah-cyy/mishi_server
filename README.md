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

# 安装所有必需的依赖（如果npm install没有自动安装）
npm install helmet compression body-parser dotenv axios
```

2. 本地运行：
```bash
node server.js
```


服务将在 http://localhost:3000 启动

### 开发模式运行（带热更新）：
```bash
# 安装开发依赖
npm install nodemon

# 启动开发模式
npm run dev
```

> 注意：如果遇到模块找不到的错误，请检查package.json并确保已安装所有必需的依赖包。

## 系统架构

```
前端(微信小游戏) <---> HTTP API(Express后端) <---> 数据持久化层
        |                    |                     (文件存储)
        |                    v                         ^
        |               微信开放API                    |
        |                                             |
        v                                             |
    WebSocket服务 <---------> 内存数据层 <-------------+
        |                   (活跃状态)
        |                       |
        v                       v
    房间状态管理 <-----> 用户会话管理
```

### 架构说明

1. **通信层**
   - **HTTP API**: 处理非实时请求，如用户登录、游戏配置获取等
   - **WebSocket服务**: 提供实时通信能力，支持游戏状态同步、玩家操作广播等

2. **数据存储层**
   - **内存数据层**: 
     - 存储活跃房间信息和实时游戏状态
     - 维护玩家ID索引和房间ID索引
     - 支持高频读写操作，确保游戏实时性
   - **持久化层**: 
     - 使用文件存储玩家基本信息和历史游戏记录
     - 结构化存储设计，便于后期迁移到微信云托管MySQL
     - 定期从内存层同步数据

3. **状态同步机制**
   - 定时同步策略（每5分钟执行一次）
   - 关键事件触发同步（如玩家离开游戏）
   - 增量更新机制减少I/O开销
   - 异常恢复机制保障数据完整性

4. **功能模块**
   - **房间状态管理**: 负责房间创建、加入、状态更新等
   - **用户会话管理**: 处理用户身份验证和会话保持
   - **微信API集成**: 与微信小游戏平台对接

这种架构设计具有以下优势：
- 满足多人在线游戏的实时通信需求
- 平衡系统性能和数据持久性
- 符合微信云托管的技术要求
- 支持后期功能扩展和服务迁移

## 目录结构

```
mishi_server/
├── data/                  # 数据文件目录
│   ├── users/             # 用户数据存储
│   │   └── profiles.json  # 用户配置文件
│   ├── games/             # 游戏数据存储
│   │   └── history.json   # 游戏历史记录
│   └── game_config.json   # 游戏配置
├── src/
│   ├── controllers/       # HTTP控制器
│   │   ├── userController.js
│   │   ├── gameController.js
│   │   └── roomController.js
│   ├── services/          # 业务逻辑层
│   │   ├── userService.js
│   │   ├── gameService.js
│   │   └── roomService.js
│   ├── websocket/         # WebSocket模块
│   │   ├── wsServer.js    # WebSocket服务器
│   │   ├── handlers/      # 消息处理器
│   │   │   ├── gameHandler.js
│   │   │   ├── roomHandler.js
│   │   │   └── playerHandler.js
│   │   └── events.js      # 事件定义
│   ├── storage/           # 存储层
│   │   ├── memory/        # 内存存储
│   │   │   ├── roomStore.js  # 房间内存存储
│   │   │   ├── sessionStore.js # 会话内存存储
│   │   │   └── gameStateStore.js # 游戏状态存储
│   │   ├── file/          # 文件存储
│   │   │   ├── userStore.js
│   │   │   └── gameStore.js
│   │   └── syncManager.js # 数据同步管理器
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   ├── logger.js      # 日志中间件
│   │   └── rateLimit.js   # 请求限流中间件
│   ├── utils/             # 工具函数
│   │   ├── wxAuth.js      # 微信认证工具
│   │   ├── validation.js  # 数据验证工具
│   │   └── helpers.js     # 通用辅助函数
│   ├── managers/          # 管理器模块
│   │   ├── roomManager.js # 房间管理器
│   │   ├── sessionManager.js # 会话管理器
│   │   └── gameManager.js # 游戏状态管理器
│   ├── routes/            # HTTP路由
│   │   ├── api/           # API路由
│   │   │   ├── userRoutes.js
│   │   │   ├── gameRoutes.js
│   │   │   └── roomRoutes.js
│   │   └── index.js       # 路由注册
│   └── config.js          # 配置文件
├── app.js                 # Express应用入口
├── wsApp.js               # WebSocket应用入口
├── server.js              # 服务器启动文件
└── package.json
```

## 模块说明

### 通信模块
- **HTTP API**: 通过Express路由提供RESTful接口
- **WebSocket**: 基于ws或socket.io实现实时通信

### 数据存储模块
- **内存存储**: 高性能，适用于活跃游戏数据
- **文件存储**: 持久化，支持数据备份与恢复

### 管理器模块
- **房间管理器**: 负责房间生命周期、状态同步
- **会话管理器**: 管理用户连接与身份验证
- **游戏管理器**: 控制游戏逻辑与状态更新

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

## WebSocket通信协议

### 连接建立

WebSocket连接URL:
```
ws://server-url/ws?token={token}&openId={openId}
```

其中:
- `token`: 用户登录后获取的认证令牌
- `openId`: 用户的唯一标识

### 消息格式

所有WebSocket消息使用JSON格式，基本结构如下:

```json
{
  "type": "消息类型",
  "data": {
    // 消息数据，根据type不同而变化
  },
  "timestamp": 1684231296142
}
```

### 客户端发送的消息类型

#### 加入房间
```json
{
  "type": "JOIN_ROOM",
  "data": {
    "roomId": "123456",
    "playerInfo": {
      "nickname": "玩家昵称",
      "avatarUrl": "头像URL",
      "characterId": "角色ID"
    }
  }
}
```

#### 准备状态变更
```json
{
  "type": "PLAYER_READY",
  "data": {
    "roomId": "123456",
    "ready": true
  }
}
```

#### 游戏操作
```json
{
  "type": "GAME_ACTION",
  "data": {
    "roomId": "123456",
    "action": "move",
    "position": {"x": 100, "y": 200},
    "direction": "right"
  }
}
```

#### 游戏事件
```json
{
  "type": "GAME_EVENT",
  "data": {
    "roomId": "123456",
    "eventType": "item_collected",
    "itemId": "key_gold",
    "position": {"x": 320, "y": 240}
  }
}
```

#### 聊天消息
```json
{
  "type": "CHAT_MESSAGE",
  "data": {
    "roomId": "123456",
    "message": "大家好！"
  }
}
```

#### 心跳包
```json
{
  "type": "PING",
  "data": {
    "timestamp": 1684231296142
  }
}
```

### 服务端发送的消息类型

#### 加入房间响应
```json
{
  "type": "JOIN_ROOM_RESULT",
  "data": {
    "success": true,
    "roomId": "123456",
    "roomInfo": {
      "hostId": "房主ID",
      "players": [
        {
          "openId": "玩家1ID",
          "nickname": "玩家1昵称",
          "ready": true
        },
        {
          "openId": "玩家2ID",
          "nickname": "玩家2昵称",
          "ready": false
        }
      ],
      "gameMode": "racing",
      "maxPlayers": 4
    }
  }
}
```

#### 房间状态更新
```json
{
  "type": "ROOM_UPDATE",
  "data": {
    "roomId": "123456",
    "updateType": "player_joined/player_left/player_ready",
    "player": {
      "openId": "玩家ID",
      "nickname": "玩家昵称",
      "ready": true
    }
  }
}
```

#### 游戏开始
```json
{
  "type": "GAME_START",
  "data": {
    "roomId": "123456",
    "gameState": {
      "startTime": "2023-04-08T12:34:56Z",
      "map": "bedroom",
      "playerPositions": {
        "player1Id": {"x": 100, "y": 100},
        "player2Id": {"x": 200, "y": 100}
      },
      "items": [
        {"id": "key_1", "position": {"x": 300, "y": 200}},
        {"id": "puzzle_1", "position": {"x": 400, "y": 300}}
      ]
    }
  }
}
```

#### 游戏状态同步
```json
{
  "type": "GAME_STATE_SYNC",
  "data": {
    "roomId": "123456",
    "playerStates": {
      "player1Id": {
        "position": {"x": 120, "y": 150},
        "direction": "right",
        "items": ["key_1"]
      },
      "player2Id": {
        "position": {"x": 220, "y": 180},
        "direction": "left",
        "items": []
      }
    },
    "gameTime": 45,
    "events": [
      {"type": "door_unlocked", "doorId": "door_1"}
    ]
  }
}
```

#### 游戏结束
```json
{
  "type": "GAME_END",
  "data": {
    "roomId": "123456",
    "winner": "player1Id",
    "gameStats": {
      "player1Id": {
        "score": 1200,
        "itemsCollected": 3,
        "timeUsed": 120
      },
      "player2Id": {
        "score": 800,
        "itemsCollected": 1,
        "timeUsed": 120
      }
    }
  }
}
```

#### 广播操作
```json
{
  "type": "BROADCAST_ACTION",
  "data": {
    "roomId": "123456",
    "playerId": "player1Id",
    "action": "move",
    "position": {"x": 150, "y": 200},
    "direction": "right"
  }
}
```

#### 聊天广播
```json
{
  "type": "CHAT_BROADCAST",
  "data": {
    "roomId": "123456",
    "senderId": "player1Id",
    "senderName": "玩家1昵称",
    "message": "大家好！"
  }
}
```

#### 心跳响应
```json
{
  "type": "PONG",
  "data": {
    "timestamp": 1684231296142
  }
}
```

#### 错误消息
```json
{
  "type": "ERROR",
  "data": {
    "code": 4001,
    "message": "房间不存在"
  }
}
```

### 错误码定义

| 错误码 | 描述 |
|-------|------|
| 4000 | 一般错误 |
| 4001 | 房间不存在 |
| 4002 | 房间已满 |
| 4003 | 玩家未准备 |
| 4004 | 玩家不在房间中 |
| 4005 | 不是房主 |
| 4006 | 游戏已开始 |
| 4007 | 操作无效 |
| 4008 | 用户未认证 |
| 4009 | 超时错误 |
| 5000 | 服务器内部错误 |

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
