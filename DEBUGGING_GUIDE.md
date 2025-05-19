# 后端调试接口手册

本文档介绍如何使用后端提供的调试接口来查看服务器的内部状态，例如当前活跃的房间和会话列表。这些接口主要用于开发和调试目的。

**重要提示：** 这些调试接口默认只在 **非生产环境** (`NODE_ENV !== 'production'`) 下启用。在生产环境中它们会被禁用。

## 如何通过浏览器访问调试信息

我们提供了一个统一的调试面板，方便您通过浏览器查看后端状态。

1.  打开您的网页浏览器 (Chrome, Firefox, Edge 等)。
2.  在地址栏输入调试面板的 URL：`http://localhost:3000/api/debug/`
3.  按下回车。浏览器将显示调试面板，您可以从中选择查看“活跃房间”或“活跃会话”。
    *   点击“查看活跃房间”会跳转到 `/api/debug/rooms`，以美化的 HTML 表格形式展示房间数据。
    *   点击“查看活跃会话”会跳转到 `/api/debug/sessions`，以美化的 HTML 表格形式展示会话数据。

如果您需要原始的 JSON 数据（例如，用于程序化处理或使用 API 测试工具），您可以直接访问以下接口：

*   获取活跃房间列表 (JSON): `/api/debug/rooms` (通过 Postman, curl 等工具，或在请求头中明确 `Accept: application/json`)
*   获取活跃会话列表 (JSON): `/api/debug/sessions` (通过 Postman, curl 等工具，或在请求头中明确 `Accept: application/json`)

## 接口详情 (JSON 格式)

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

### 使用网页浏览器

1.  打开你的网页浏览器 (Chrome, Firefox, Edge 等)。
2.  在地址栏输入接口的完整 URL，例如：`http://localhost:3000/api/debug/rooms` 或者查看会话 `http://localhost:3000/api/debug/sessions`
3.  按下回车。浏览器将显示一个格式化后的 HTML 页面，其中包含了请求的数据。如果需要原始的 JSON 数据，请使用 Postman、curl 或其他 API 测试工具访问这些 URL。
