/**
 * WebSocket应用入口
 * 负责处理实时通信
 */

const WebSocket = require('ws');
const url = require('url');
const sessionManager = require('./managers/sessionManager');

// WebSocket服务实例
let wss = null;

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

  // 创建WebSocket服务
  wss = new WebSocket.Server({ 
    server,
    // 验证用户身份
    verifyClient: verifyClientMiddleware
  });

  // 设置连接事件处理
  wss.on('connection', handleConnection);

  console.log('WebSocket服务已附加到HTTP服务器');
  return wss;
}

/**
 * 验证客户端连接中间件
 * @param {Object} info 连接信息
 * @param {Function} callback 回调函数
 */
function verifyClientMiddleware(info, callback) {
  // 解析查询参数
  const query = url.parse(info.req.url, true).query;
  const { token } = query;

  if (!token) {
    console.log('WebSocket连接被拒绝: 缺少认证令牌');
    return callback(false, 401, '缺少认证令牌');
  }

  // 验证令牌
  const session = sessionManager.verifySession(token);
  if (!session) {
    console.log('WebSocket连接被拒绝: 无效或已过期的令牌');
    return callback(false, 401, '无效或已过期的令牌');
  }

  // 将用户ID附加到请求对象，以便在连接处理中使用
  info.req.userId = session.userId;
  info.req.session = session;

  callback(true);
}

/**
 * 处理新的WebSocket连接
 * @param {Object} ws WebSocket连接实例
 * @param {Object} req HTTP请求对象
 */
function handleConnection(ws, req) {
  const userId = req.userId;
  
  console.log(`WebSocket客户端已连接: ${userId}`);

  // 存储连接
  clients.set(userId, ws);

  // 发送欢迎消息
  sendToClient(userId, {
    type: 'CONNECTED',
    data: {
      userId,
      timestamp: Date.now(),
      message: '连接已建立'
    }
  });

  // 设置消息事件处理
  ws.on('message', (message) => handleMessage(userId, message));

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