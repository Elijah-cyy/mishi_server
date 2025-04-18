/**
 * WebSocket应用入口
 * 负责处理实时通信
 */

const WebSocket = require('ws');
const url = require('url');
const sessionManager = require('./managers/sessionManager');

// WebSocket服务实例
let wss = null;
// 心跳检测定时器
let heartbeatInterval = null;

// 客户端连接映射，key为userId，value为WebSocket连接
const clients = new Map();

/**
 * 创建并附加WebSocket服务到HTTP服务器
 * @param {Object} server HTTP服务器实例
 */
function attach(server) {
  if (!server) {
    throw new Error('HTTP服务器实例不能为空');
  }

  // 创建WebSocket服务 (不再使用 verifyClient)
  wss = new WebSocket.Server({ 
    noServer: true // 重要：因为我们将手动处理升级
    // server, // 不再直接传递 server
    // verifyClient: verifyClientMiddleware // 这个选项在这种模式下会被忽略
  });

  // 设置连接事件处理 (仍然需要，但由 upgrade 事件手动触发)
  wss.on('connection', handleConnection);

  // !! 启动心跳检测定时器 !!
  heartbeatInterval = setInterval(() => {
    clients.forEach((ws, userId) => {
      // 检查 isAlive 标记，默认为 true，第一次检查设为 false
      // 如果第二次检查时仍然是 false，说明客户端无响应
      if (ws.isAlive === false) {
        console.log(`[wsApp.heartbeat] 检测到客户端 ${userId} 无响应，正在终止连接。`);
        return ws.terminate(); // 强制终止连接，会触发 'close' 事件完成清理
      }

      ws.isAlive = false; // 标记为可能不活跃，等待下次 PING 或消息来确认
      // 可选：服务器主动发送 PING，客户端会自动响应 PONG
      // ws.ping(() => {}); 
    });
  }, 30000); // 每 30 秒检查一次

  // !! 关键改动：监听 HTTP 服务器的 'upgrade' 事件来进行验证和连接处理 !!
  server.on('upgrade', (request, socket, head) => {
    // 1. 解析 URL 和 Token
    const parsedUrl = url.parse(request.url, true);
    const pathname = parsedUrl.pathname; // 可能用于路径检查
    const token = parsedUrl.query.token;

    // 可选的路径检查
    // if (pathname !== '/ws') { ... }

    if (!token) {
      console.log('[wsApp.server.on(\'upgrade\')] Verification failed: Missing token.');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 2. 验证 Token/Session
    const session = sessionManager.verifySession(token);
    if (!session) {
      console.log('[wsApp.server.on(\'upgrade\')] Verification failed: Invalid or expired token.');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 3. 调用 wss.handleUpgrade 完成握手
    wss.handleUpgrade(request, socket, head, (ws) => {
      // 4. 将 userId 附加到 request 对象
      request.userId = session.userId;
      request.session = session;

      // 5. 手动触发 'connection' 事件
      wss.emit('connection', ws, request);
    });
  });

  console.log('WebSocket服务准备就绪，监听 HTTP 服务器的 upgrade 事件');
  return wss;
}

/**
 * 处理新的WebSocket连接
 * @param {Object} ws WebSocket连接实例
 * @param {Object} req HTTP请求对象
 */
function handleConnection(ws, req) {
  // 尝试从 req 对象获取 userId (由 upgrade 事件附加)
  const userId = req.userId;

  // !! 关键检查：确保 userId 不是 undefined !!
  if (userId === undefined) {
    // 如果 userId 是 undefined，记录严重错误并可能关闭连接
    console.error(`[wsApp.handleConnection] CRITICAL: userId is undefined for the incoming WebSocket connection! URL: ${req.url}. Closing connection.`);
    // 可以选择发送一个错误消息给客户端再关闭
    // ws.send(JSON.stringify({ type: 'ERROR', data: { code: 4001, message: 'User identification failed during WebSocket connection.' }}));
    ws.close(1011, 'User ID could not be determined'); // 1011 = Internal Error
    return; // 阻止后续代码执行
  }

  console.log(`WebSocket客户端已连接: ${userId}`); // 现在应该打印正确的 userId

  // 检查是否已有此用户的连接，处理重复连接
  if (clients.has(userId)) {
    console.warn(`[wsApp.handleConnection] 检测到用户 ${userId} 的重复WebSocket连接。正在关闭旧连接...`);
    const oldWs = clients.get(userId);
    // 发送一个消息给旧连接，告知其被取代
    if (oldWs && oldWs.readyState === WebSocket.OPEN) {
      try {
        oldWs.send(JSON.stringify({ type: 'CONNECTION_REPLACED', data: { message: 'A newer connection has been established.' }}));
      } catch (e) {
        console.error(`[wsApp.handleConnection] 发送 CONNECTION_REPLACED 消息给旧连接失败:`, e);
      }
      // 给旧连接一点时间处理消息再关闭
      setTimeout(() => oldWs.close(1008, 'New connection established'), 100);
    }
    // 立即从 Map 中移除旧记录，避免干扰新连接
    clients.delete(userId);
  }

  // 存储新的连接 (使用正确的 userId)
  clients.set(userId, ws);

  // !! 初始化心跳标记 !!
  ws.isAlive = true;

  // !! 监听 PONG 响应，更新心跳标记 !!
  ws.on('pong', () => {
    // console.log(`[wsApp] Received PONG from ${userId}`); // 可选调试日志
    ws.isAlive = true;
  });

  // 发送欢迎消息
  sendToClient(userId, {
    type: 'CONNECTED',
    data: {
      userId,
      timestamp: Date.now(),
      message: '连接已建立'
    }
  });

  // 设置消息事件处理 (在处理前更新 isAlive 标记)
  ws.on('message', (message) => {
    ws.isAlive = true; // 收到任何消息都认为活跃
    handleMessage(userId, message);
  });

  // 设置关闭事件处理
  ws.on('close', () => handleClose(userId));

  // 设置错误事件处理
  ws.on('error', (error) => handleError(userId, error));

  // 发送在线通知
  broadcastUserStatus(userId, 'online');
}

/**
 * 处理WebSocket消息
 * @param {string} userId 用户ID
 * @param {string} message 收到的消息
 */
function handleMessage(userId, message) {
  try {
    const parsedMessage = JSON.parse(message);
    console.log(`收到来自 ${userId} 的消息: ${parsedMessage.type}`);

    // 根据消息类型处理
    switch (parsedMessage.type) {
      case 'PING':
        // 心跳响应
        sendToClient(userId, {
          type: 'PONG',
          data: {
            timestamp: Date.now()
          }
        });
        break;

      case 'JOIN_ROOM':
        // 处理加入房间请求
        handleJoinRoom(userId, parsedMessage.data);
        break;

      case 'PLAYER_READY':
        // 处理玩家准备状态
        handlePlayerReady(userId, parsedMessage.data);
        break;

      case 'GAME_ACTION':
        // 处理游戏操作
        handleGameAction(userId, parsedMessage.data);
        break;

      case 'GAME_EVENT':
        // 处理游戏事件
        handleGameEvent(userId, parsedMessage.data);
        break;

      case 'CHAT_MESSAGE':
        // 处理聊天消息
        handleChatMessage(userId, parsedMessage.data);
        break;

      default:
        console.warn(`未处理的消息类型: ${parsedMessage.type}`);
        // 发送错误响应
        sendToClient(userId, {
          type: 'ERROR',
          data: {
            code: 4000,
            message: '不支持的消息类型'
          }
        });
    }
  } catch (error) {
    console.error(`处理消息失败: ${error.message}`);
    // 发送错误响应
    sendToClient(userId, {
      type: 'ERROR',
      data: {
        code: 4000,
        message: '消息格式无效'
      }
    });
  }
}

/**
 * 处理WebSocket连接关闭
 * @param {string} userId 用户ID
 */
function handleClose(userId) {
  console.log(`WebSocket客户端已断开连接: ${userId}`);
  
  // 从客户端列表中移除
  clients.delete(userId);
  
  // 发送离线通知
  broadcastUserStatus(userId, 'offline');
}

/**
 * 处理WebSocket连接错误
 * @param {string} userId 用户ID
 * @param {Error} error 错误对象
 */
function handleError(userId, error) {
  console.error(`WebSocket连接错误 (${userId}):`, error);
}

/**
 * 向指定客户端发送消息
 * @param {string} userId 用户ID
 * @param {Object} message 消息对象
 * @returns {boolean} 是否发送成功
 */
function sendToClient(userId, message) {
  const client = clients.get(userId);
  
  if (client && client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`向客户端 ${userId} 发送消息失败:`, error);
    }
  }
  
  return false;
}

/**
 * 向多个客户端广播消息
 * @param {Array} userIds 用户ID数组
 * @param {Object} message 消息对象
 * @param {string} excludeUserId 要排除的用户ID
 * @returns {number} 成功发送的客户端数量
 */
function broadcastToClients(userIds, message, excludeUserId = null) {
  let sentCount = 0;
  
  userIds.forEach(userId => {
    if (userId !== excludeUserId && sendToClient(userId, message)) {
      sentCount++;
    }
  });
  
  return sentCount;
}

/**
 * 向所有连接的客户端广播消息
 * @param {Object} message 消息对象
 * @param {string} excludeUserId 要排除的用户ID
 * @returns {number} 成功发送的客户端数量
 */
function broadcastToAll(message, excludeUserId = null) {
  let sentCount = 0;
  
  clients.forEach((_, userId) => {
    if (userId !== excludeUserId && sendToClient(userId, message)) {
      sentCount++;
    }
  });
  
  return sentCount;
}

/**
 * 广播用户状态变更
 * @param {string} userId 用户ID
 * @param {string} status 状态('online'/'offline')
 */
function broadcastUserStatus(userId, status) {
  broadcastToAll({
    type: 'USER_STATUS',
    data: {
      userId,
      status,
      timestamp: Date.now()
    }
  }, userId);
}

/**
 * 处理加入房间请求
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据
 */
function handleJoinRoom(userId, data) {
  // TODO: 实现加入房间逻辑
  console.log(`用户 ${userId} 请求加入房间: ${data.roomId}`);
}

/**
 * 处理玩家准备状态变更
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据
 */
function handlePlayerReady(userId, data) {
  // TODO: 实现玩家准备状态处理
  console.log(`用户 ${userId} 更新准备状态: ${data.ready}`);
}

/**
 * 处理游戏操作
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据
 */
function handleGameAction(userId, data) {
  // TODO: 实现游戏操作处理
  console.log(`用户 ${userId} 执行游戏操作: ${data.action}`);
}

/**
 * 处理游戏事件
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据
 */
function handleGameEvent(userId, data) {
  // TODO: 实现游戏事件处理
  console.log(`用户 ${userId} 触发游戏事件: ${data.eventType}`);
}

/**
 * 处理聊天消息
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据
 */
function handleChatMessage(userId, data) {
  // TODO: 实现聊天消息处理
  console.log(`用户 ${userId} 发送聊天消息: ${data.message}`);
}

/**
 * 关闭WebSocket服务器
 */
function close() {
  // !! 清除心跳定时器 !!
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[wsApp] 心跳检测定时器已清除');
  }

  if (wss) {
    // 关闭所有连接
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, '服务器关闭');
      }
    });
    
    // 清空客户端映射
    clients.clear();
    
    // 关闭服务器
    wss.close();
    console.log('WebSocket服务器已关闭');
  }
}

/**
 * 获取已连接的客户端数量
 * @returns {number} 客户端数量
 */
function getClientCount() {
  return clients.size;
}

module.exports = {
  attach,
  close,
  sendToClient,
  broadcastToClients,
  broadcastToAll,
  getClientCount
}; 