/**
 * 连接管理器
 * 负责管理所有的WebSocket连接
 */

// 存储所有连接
const connections = new Map();
// 存储房间连接映射
const roomConnections = new Map();

/**
 * 注册新连接
 * @param {string} connectionId 连接ID
 * @param {WebSocket} socket WebSocket连接
 * @param {Object} metadata 连接元数据
 * @returns {boolean} 是否成功注册
 */
function registerConnection(connectionId, socket, metadata = {}) {
  if (!connectionId || !socket) {
    console.error(`注册连接失败：参数不完整 connectionId=${connectionId}`);
    return false;
  }

  // 检查连接是否已存在
  if (connections.has(connectionId)) {
    console.warn(`连接 ${connectionId} 已存在，将被覆盖`);
  }

  // 存储连接
  connections.set(connectionId, {
    id: connectionId,
    socket,
    metadata: {
      ...metadata,
      connectedAt: Date.now()
    },
    lastActivity: Date.now()
  });

  // 如果元数据包含房间ID，将连接添加到房间
  if (metadata.roomId) {
    addConnectionToRoom(connectionId, metadata.roomId);
  }

  return true;
}

/**
 * 获取连接
 * @param {string} connectionId 连接ID
 * @returns {Object|null} 连接对象或null
 */
function getConnection(connectionId) {
  return connections.get(connectionId) || null;
}

/**
 * 更新连接元数据
 * @param {string} connectionId 连接ID
 * @param {Object} metadata 要更新的元数据
 * @returns {boolean} 是否成功更新
 */
function updateConnectionMetadata(connectionId, metadata) {
  const connection = connections.get(connectionId);
  if (!connection) {
    console.error(`更新连接元数据失败：找不到连接 ${connectionId}`);
    return false;
  }

  // 更新元数据
  connection.metadata = {
    ...connection.metadata,
    ...metadata,
    lastUpdated: Date.now()
  };

  // 更新活动时间
  connection.lastActivity = Date.now();

  // 如果更新了房间ID，更新房间连接映射
  if (metadata.roomId && metadata.roomId !== connection.metadata.roomId) {
    // 从旧房间移除
    if (connection.metadata.roomId) {
      removeConnectionFromRoom(connectionId, connection.metadata.roomId);
    }
    // 添加到新房间
    addConnectionToRoom(connectionId, metadata.roomId);
  }

  return true;
}

/**
 * 关闭连接
 * @param {string} connectionId 连接ID
 * @param {number} code 关闭代码
 * @param {string} reason 关闭原因
 * @returns {boolean} 是否成功关闭
 */
function closeConnection(connectionId, code = 1000, reason = '正常关闭') {
  const connection = connections.get(connectionId);
  if (!connection) {
    console.error(`关闭连接失败：找不到连接 ${connectionId}`);
    return false;
  }

  try {
    // 如果连接仍然开放，关闭它
    if (connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.close(code, reason);
    }

    // 从房间中移除连接
    if (connection.metadata.roomId) {
      removeConnectionFromRoom(connectionId, connection.metadata.roomId);
    }

    // 从连接映射中移除
    connections.delete(connectionId);

    return true;
  } catch (error) {
    console.error(`关闭连接 ${connectionId} 时出错:`, error);
    return false;
  }
}

/**
 * 向连接发送消息
 * @param {string} connectionId 连接ID
 * @param {Object|string} message 消息内容
 * @returns {boolean} 是否成功发送
 */
function sendMessage(connectionId, message) {
  const connection = connections.get(connectionId);
  if (!connection) {
    console.error(`发送消息失败：找不到连接 ${connectionId}`);
    return false;
  }

  try {
    // 确保连接是开放的
    if (connection.socket.readyState !== connection.socket.OPEN) {
      console.error(`发送消息失败：连接 ${connectionId} 未开放`);
      return false;
    }

    // 准备消息
    let messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    // 发送消息
    connection.socket.send(messageStr);

    // 更新活动时间
    connection.lastActivity = Date.now();

    return true;
  } catch (error) {
    console.error(`向连接 ${connectionId} 发送消息时出错:`, error);
    return false;
  }
}

/**
 * 广播消息到房间
 * @param {string} roomId 房间ID
 * @param {Object|string} message 消息内容
 * @param {Array} excludeConnections 要排除的连接ID数组
 * @returns {number} 成功发送消息的连接数量
 */
function broadcastToRoom(roomId, message, excludeConnections = []) {
  if (!roomId) {
    console.error(`广播消息失败：房间ID不能为空`);
    return 0;
  }

  // 获取房间内的连接
  const roomConns = roomConnections.get(roomId) || new Set();
  if (roomConns.size === 0) {
    return 0;
  }

  let sentCount = 0;
  // 准备消息
  let messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  // 遍历所有连接并发送消息
  for (const connectionId of roomConns) {
    // 如果连接在排除列表中，跳过
    if (excludeConnections.includes(connectionId)) {
      continue;
    }

    // 发送消息
    if (sendMessage(connectionId, messageStr)) {
      sentCount++;
    }
  }

  return sentCount;
}

/**
 * 广播消息到所有连接
 * @param {Object|string} message 消息内容
 * @param {Array} excludeConnections 要排除的连接ID数组
 * @returns {number} 成功发送消息的连接数量
 */
function broadcastToAll(message, excludeConnections = []) {
  let sentCount = 0;
  // 准备消息
  let messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  // 遍历所有连接并发送消息
  for (const [connectionId, connection] of connections.entries()) {
    // 如果连接在排除列表中，跳过
    if (excludeConnections.includes(connectionId)) {
      continue;
    }

    // 发送消息
    if (connection.socket.readyState === connection.socket.OPEN) {
      try {
        connection.socket.send(messageStr);
        connection.lastActivity = Date.now();
        sentCount++;
      } catch (error) {
        console.error(`向连接 ${connectionId} 广播消息时出错:`, error);
      }
    }
  }

  return sentCount;
}

/**
 * 将连接添加到房间
 * @param {string} connectionId 连接ID
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否成功添加
 */
function addConnectionToRoom(connectionId, roomId) {
  if (!connectionId || !roomId) {
    console.error(`添加连接到房间失败：参数不完整 connectionId=${connectionId}, roomId=${roomId}`);
    return false;
  }

  // 检查连接是否存在
  if (!connections.has(connectionId)) {
    console.error(`添加连接到房间失败：找不到连接 ${connectionId}`);
    return false;
  }

  // 获取房间连接集合，如果不存在则创建
  let roomConns = roomConnections.get(roomId);
  if (!roomConns) {
    roomConns = new Set();
    roomConnections.set(roomId, roomConns);
  }

  // 添加连接到房间
  roomConns.add(connectionId);

  // 更新连接元数据
  const connection = connections.get(connectionId);
  connection.metadata.roomId = roomId;

  return true;
}

/**
 * 从房间移除连接
 * @param {string} connectionId 连接ID
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否成功移除
 */
function removeConnectionFromRoom(connectionId, roomId) {
  if (!connectionId || !roomId) {
    console.error(`从房间移除连接失败：参数不完整 connectionId=${connectionId}, roomId=${roomId}`);
    return false;
  }

  // 获取房间连接集合
  const roomConns = roomConnections.get(roomId);
  if (!roomConns) {
    return false; // 房间不存在
  }

  // 从房间移除连接
  const result = roomConns.delete(connectionId);

  // 如果房间为空，从映射中移除
  if (roomConns.size === 0) {
    roomConnections.delete(roomId);
  }

  // 更新连接元数据
  if (result && connections.has(connectionId)) {
    const connection = connections.get(connectionId);
    if (connection.metadata.roomId === roomId) {
      connection.metadata.roomId = null;
    }
  }

  return result;
}

/**
 * 获取连接数量
 * @returns {number} 连接总数
 */
function getConnectionCount() {
  return connections.size;
}

/**
 * 获取房间连接数量
 * @param {string} roomId 房间ID
 * @returns {number} 房间内的连接数量
 */
function getRoomConnectionCount(roomId) {
  const roomConns = roomConnections.get(roomId);
  return roomConns ? roomConns.size : 0;
}

/**
 * 获取房间内的所有连接
 * @param {string} roomId 房间ID
 * @returns {Array} 连接ID数组
 */
function getRoomConnections(roomId) {
  const roomConns = roomConnections.get(roomId);
  return roomConns ? Array.from(roomConns) : [];
}

/**
 * 清理所有超时连接
 * @param {number} timeoutMs 超时时间（毫秒）
 * @returns {number} 清理的连接数量
 */
function cleanupIdleConnections(timeoutMs = 30 * 60 * 1000) { // 默认30分钟
  const now = Date.now();
  let cleanedCount = 0;

  for (const [connectionId, connection] of connections.entries()) {
    // 如果连接超时，关闭它
    if (now - connection.lastActivity > timeoutMs) {
      if (closeConnection(connectionId, 1001, '连接超时')) {
        cleanedCount++;
      }
    }
  }

  return cleanedCount;
}

module.exports = {
  registerConnection,
  getConnection,
  updateConnectionMetadata,
  closeConnection,
  sendMessage,
  broadcastToRoom,
  broadcastToAll,
  addConnectionToRoom,
  removeConnectionFromRoom,
  getConnectionCount,
  getRoomConnectionCount,
  getRoomConnections,
  cleanupIdleConnections
}; 