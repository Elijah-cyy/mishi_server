# 后端调试接口手册

本文档介绍如何使用后端提供的调试接口来查看服务器的内部状态，例如当前活跃的房间和会话列表。这些接口主要用于开发和调试目的。

**重要提示：** 这些调试接口默认只在 **非生产环境** (`NODE_ENV !== 'production'`) 下启用。在生产环境中它们会被禁用。

## 接口列表

### 1. 获取活跃房间列表

*   **URL:** `/api/debug/rooms`
*   **方法:** GET
*   **描述:** 返回当前服务器上所有活跃房间的详细信息列表。
*   **查询参数 (可选):**
    *   `activeOnly=false`: 如果添加此参数，将返回所有房间（包括非活跃状态的），默认为 `true` (只返回活跃房间)。
*   **成功响应 (200 OK):**
    ```json
    {
      "code": 200,
      "message": "Active rooms retrieved successfully.",
      "data": {
        "rooms": [
          {
            "roomId": "room_17...",
            "name": "玩家xxx的房间",
            "hostId": "oOWGl7...",
            "players": [
              {
                "id": "oOWGl7...",
                "nickname": "玩家昵称",
                "avatar": "...",
                "isReady": false,
                "isHost": true
                // ... 其他玩家数据
              }
            ],
            "maxPlayers": 4,
            "status": "waiting", // "waiting", "playing", "closed"
            "createdAt": 17...,
            "updatedAt": 17...,
            "gameSettings": { ... },
            "mapId": "default",
            "timeLimit": 3600
            // ... 其他房间数据
          }
          // ... 更多房间
        ]
      }
    }
    ```
*   **失败响应 (500 Internal Server Error):**
    ```json
    {
      "code": 500,
      "message": "Failed to retrieve rooms",
      "errors": {
        "message": "具体的错误信息"
      }
    }
    ```

### 2. 获取活跃会话列表

*   **URL:** `/api/debug/sessions`
*   **方法:** GET
*   **描述:** 返回当前服务器上所有活跃用户会话的列表（部分敏感信息已过滤）。
*   **成功响应 (200 OK):**
    ```json
    {
      "code": 200,
      "message": "Active sessions retrieved successfully.",
      "data": {
        "sessions": [
          {
            "userId": "oOWGl7...",
            "token": "oOWGl7bkN1...", // 只显示前缀
            "createdAt": 17...,
            "expiresAt": 17...,
            "lastAccessedAt": 17...,
            "userData": { // 注意：这里可能包含需要小心处理的数据
              "nickname": "玩家昵称",
              "avatar": "...",
              "role": "user"
            }
          }
          // ... 更多会话
        ]
      }
    }
    ```
*   **失败响应 (500 Internal Server Error):**
    ```json
    {
      "code": 500,
      "message": "Failed to retrieve sessions",
      "errors": {
        "message": "具体的错误信息"
      }
    }
    ```

## 如何调用接口

假设你的后端服务器运行在 `http://localhost:3000`。

### 方法一：使用网页浏览器

1.  打开你的网页浏览器 (Chrome, Firefox, Edge 等)。
2.  在地址栏输入接口的完整 URL，例如：`http://localhost:3000/api/debug/rooms`
3.  按下回车。浏览器将显示返回的 JSON 数据。

### 方法二：使用 `curl` (命令行)

1.  打开命令行终端 (PowerShell, CMD, Git Bash, Terminal 等)。
2.  输入命令，例如：
    ```bash
    curl http://localhost:3000/api/debug/rooms
    ```
    或者查看会话：
    ```bash
    curl http://localhost:3000/api/debug/sessions
    ```
3.  按下回车。JSON 数据将直接打印在命令行中。

### 方法三：使用 API 测试工具 (Postman, Insomnia 等)

1.  打开你的 API 测试工具。
2.  创建一个新的请求。
3.  设置请求方法为 `GET`。
4.  输入接口的完整 URL (例如 `http://localhost:3000/api/debug/rooms`)。
5.  发送请求。
6.  工具将显示完整的响应头和响应体 (JSON 数据)。

--- 