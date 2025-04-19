/**
 * WebSocket应用入口
 * 负责处理实时通信
 */

const WebSocket = require('ws');
const url = require('url');
const sessionManager = require('./managers/sessionManager');
const roomManager = require('./managers/roomManager'); // 确保 roomManager 被正确导入

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
  // !! 新增：打印原始消息 !!
  console.log(`[handleMessage RAW] Received from ${userId}:`, message);
  try {
    // !! 尝试解析前后的日志 !!
    let parsedMessage;
    try {
        parsedMessage = JSON.parse(message);
        console.log(`[handleMessage PARSED] Parsed message from ${userId}:`, parsedMessage);
    } catch (parseError) {
        console.error(`[handleMessage ERROR] Failed to parse message from ${userId}. Raw message:`, message, 'Error:', parseError);
        // 发送解析错误响应
        sendToClient(userId, {
          type: 'ERROR',
          data: {
            code: 4001, // Use a specific code for parsing errors
            message: 'Invalid message format (not valid JSON)'
          }
        });
        return; // 无法继续处理，直接返回
    }
    
    // 确保 parsedMessage 和 parsedMessage.type 存在
    if (!parsedMessage || typeof parsedMessage.type !== 'string') {
        console.error(`[handleMessage ERROR] Invalid message structure or missing type from ${userId}. Parsed:`, parsedMessage);
        sendToClient(userId, {
          type: 'ERROR',
          data: {
            code: 4002, // Specific code for structure/type error
            message: 'Invalid message structure or missing type'
          }
        });
        return;
    }

    console.log(`[DEBUG] Entering handleMessage switch for type: ${parsedMessage.type}`);
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

      case 'ADD_BOT': // 新增：处理添加机器人
        console.log("[DEBUG] Matched 'ADD_BOT' case."); 
        // 假设 handleAddBot 函数将在此文件或其他地方定义
        // 并假设 roomManager 和 broadcastToRoom 也在此作用域可用或已导入
        if (typeof handleAddBot === 'function') {
          handleAddBot(clients.get(userId), parsedMessage.data); // 传递 WebSocket 对象和数据
        } else {
           console.error("handleAddBot function is not defined!");
           sendToClient(userId, { type: 'ERROR', data: { code: 5001, message: 'Server error: Bot feature not available.' } });
        }
        break;

      case 'LOCK_HERO':
        handleLockHero(userId, parsedMessage.data);
        break;

      default:
        console.log(`[DEBUG] Reached default case in handleMessage for type: ${parsedMessage.type}`);
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
 * 处理玩家准备状态变更 (注意：此函数不再触发游戏开始检查)
 * @param {string} userId 用户ID
 * @param {Object} data 请求数据 { ready: boolean }
 */
function handlePlayerReady(userId, data) {
  // 保留此函数以处理可能的其他准备逻辑，或未来用于非锁定触发的准备
  console.log(`用户 ${userId} 更新准备状态: ${data.ready}`);
  const playerRoomId = roomManager.getPlayerRoomId(userId); 

  if (!playerRoomId) {
    console.error(`玩家 ${userId} 不在任何房间中，无法更新准备状态`);
    return;
  }

  try {
    // 仍然调用 roomManager 更新状态，因为可能影响 UI 或其他逻辑
    const updatedRoomResult = roomManager.updatePlayerReady(playerRoomId, userId, data.ready); 

    if (updatedRoomResult) { 
      logRoomStatus(playerRoomId, 'After Player Ready'); 

      // 仍然需要广播房间更新，以便客户端 UI 同步准备状态
      const updatedRoomData = roomManager.getRoom(playerRoomId); 
      if (updatedRoomData) {
          // 准备广播数据 (可以复用 roomManager.notifyRoomUpdate 返回的结构，如果它被修改为返回数据的话)
          const broadcastData = {
              type: 'ROOM_UPDATE',
              data: {
                  roomId: updatedRoomData.roomId,
                  eventType: 'PLAYER_READY_CHANGED', // 添加事件类型
                  // ... (包含所有需要的房间和玩家状态) ...
                  players: updatedRoomData.players.map(p => ({ 
                     openId: p.openId,
                     isHost: p.isHost,
                     ready: p.ready,
                     isHeroLocked: p.isHeroLocked,
                     selectedHeroId: p.selectedHeroId,
                     nickname: p.nickname || p.openId 
                 })),
                 // 包含其他必要信息，如 lockedCount, readyCount 等
                 lockedCount: updatedRoomData.players.filter(p => p.isHeroLocked).length,
                 readyCount: updatedRoomData.players.filter(p => p.ready).length,
                 playerCount: updatedRoomData.players.length
              }
          };
          broadcastToRoom(playerRoomId, broadcastData); // 显式广播
          console.log(`[handlePlayerReady] 已向房间 ${playerRoomId} 广播 ROOM_UPDATE`);
      } else {
          console.error(`[handlePlayerReady] 更新准备状态后无法获取房间 ${playerRoomId} 的数据`);
      }
    } else {
      console.error(`更新玩家 ${userId} 在房间 ${playerRoomId} 的准备状态失败 (roomManager.updatePlayerReady 返回了 falsy)`);
    }
  } catch (error) {
    console.error(`处理玩家 ${userId} 准备状态时出错:`, error);
  }
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
 * 处理玩家锁定英雄请求
 * @param {string} userId 玩家ID
 * @param {Object} data 数据，包含 { heroId: string, isLocked: boolean }
 */
async function handleLockHero(userId, data) {
  const { heroId, isLocked } = data;

  // 1. 获取玩家所在的房间ID
  const roomId = roomManager.getPlayerRoomId(userId);
  if (!roomId) {
    console.error(`[handleLockHero] 无法找到玩家 ${userId} 所在的房间`);
    sendToClient(userId, { type: 'ERROR', data: { message: '您似乎不在任何房间中' } });
    return;
  }

  // --- 获取触发事件的玩家信息 ---
  const roomBeforeUpdate = roomManager.getRoom(roomId);
  if (!roomBeforeUpdate || !roomBeforeUpdate.players) {
      console.error(`[handleLockHero] 无法获取房间 ${roomId} 的信息`);
      return;
  }
  const lockingPlayer = roomBeforeUpdate.players.find(p => p.openId === userId);
  if (!lockingPlayer) {
      console.error(`[handleLockHero] 无法在房间 ${roomId} 找到玩家 ${userId}`);
      return;
  }
  // --- 玩家信息获取结束 ---

  // 2. 调用 roomManager 更新锁定状态
  const updatedRoom = roomManager.setPlayerHeroLockStatus(roomId, userId, isLocked, heroId);
  if (!updatedRoom) {
    console.error(`[handleLockHero] 更新玩家 ${userId} 英雄锁定状态失败`);
    sendToClient(userId, { type: 'ERROR', data: { message: '更新英雄选择失败，可能是英雄已被选或房间状态错误' } });
    return;
  }
  console.log(`[wsApp] 成功处理玩家 ${userId} 的 LOCK_HERO 请求: locked=${isLocked}, hero=${heroId}`);

  // 3. 广播 PLAYER_HERO_LOCKED 事件给房间内所有玩家（包括自己，以便状态同步）
  broadcastToRoom(roomId, {
    type: 'PLAYER_HERO_LOCKED',
    data: {
      playerId: userId,
      heroId: updatedRoom.players.find(p => p.openId === userId)?.selectedHeroId, // 确保发送最新的英雄ID
      isLocked: updatedRoom.players.find(p => p.openId === userId)?.isHeroLocked // 确保发送最新的锁定状态
    }
  });
  logRoomStatus(roomId, 'After Hero Lock Update'); // 打印房间状态日志

  // --- 新逻辑：检查是否触发机器人锁定或最终游戏开始 ---
  const currentRoomState = roomManager.getRoom(roomId); // 获取更新锁状态后的最新房间数据
  if (!currentRoomState || currentRoomState.status !== 'CHARACTER_SELECT') {
      console.log(`[handleLockHero] 房间 ${roomId} 状态为 ${currentRoomState?.status} (非 CHARACTER_SELECT)，跳过后续检查。`);
      return; 
  }

  // 4. 如果是人类玩家刚刚锁定，检查是否所有人类玩家都已锁定
  if (!lockingPlayer.isBot && isLocked) {
      const humanPlayers = currentRoomState.players.filter(p => !p.isBot);
      const allHumansLocked = humanPlayers.every(p => p.isHeroLocked);
      
      if (allHumansLocked) {
          console.log(`[handleLockHero] 所有人类玩家已锁定，触发机器人选择英雄...`);
          await triggerBotsToLock(roomId); // 调用异步函数让机器人锁定
          // 注意：机器人锁定后会再次触发 handleLockHero，最终的游戏开始检查将在那里进行
      }
  }

  // 5. 检查是否所有玩家（人类+机器人）都已锁定，以触发最终游戏开始
  //    这个检查在每次锁定事件（人类或机器人）后都执行
  const allPlayersLocked = roomManager.checkAllPlayersLocked(roomId); // <--- 使用 roomManager 的函数

  console.log(`[handleLockHero] 检查最终开始条件: 房间 ${roomId}, 状态=${currentRoomState.status}, 玩家总数=${currentRoomState.players.length}, 是否都已锁定=${allPlayersLocked}`);

  if (allPlayersLocked) { // 如果所有人都锁定了
    console.log(`[handleLockHero] 房间 ${roomId} 满足最终开始条件 (所有玩家均已锁定英雄)，转换状态并广播游戏开始...`);
    
    // 更新房间状态为 'playing'
    const finalRoomState = roomManager.updateRoom(roomId, { 
      status: 'playing',
      gameActualStartTime: Date.now() // 记录实际游戏开始时间
    });

    if (finalRoomState) {
      // 准备广播游戏正式开始的消息
       const gameStartMessage = {
           type: 'ACTUAL_GAME_START', // 使用明确的类型 
           data: { 
               roomId: finalRoomState.roomId,
               // 可以包含最终确认的玩家列表和英雄等信息
               players: finalRoomState.players.map(p => ({ 
                   openId: p.openId,
                   isHost: p.isHost,
                   isBot: p.isBot,
                   selectedHeroId: p.selectedHeroId,
                   nickname: p.nickname || p.openId 
                })),
               startTime: finalRoomState.gameActualStartTime
           }
       };
      broadcastToRoom(roomId, gameStartMessage); // 显式广播
      console.log(`[handleLockHero] 房间 ${roomId} 游戏已由人类玩家锁定触发启动并广播`);
    } else {
      console.error(`[handleLockHero] 尝试更新房间 ${roomId} 状态为 playing 失败`);
    }
  } else {
      console.log(`[handleLockHero] 房间 ${roomId} 仍有玩家未锁定英雄，等待其他玩家。`);
  }
  // --- 新逻辑结束 ---
}

// --- 新增：触发机器人锁定英雄的函数 ---
async function triggerBotsToLock(roomId) {
    console.log(`[triggerBotsToLock] 开始为房间 ${roomId} 的机器人选择英雄...`);
    const room = roomManager.getRoom(roomId);
    if (!room || !room.players) {
        console.error(`[triggerBotsToLock] 无法获取房间 ${roomId} 信息`);
        return;
    }

    const botsToLock = room.players.filter(p => p.isBot && !p.isHeroLocked);
    if (botsToLock.length === 0) {
        console.log(`[triggerBotsToLock] 房间 ${roomId} 没有需要锁定的机器人`);
        return;
    }

    for (const bot of botsToLock) {
        try {
            const botId = bot.openId;
            // 1. 获取可用英雄
            const availableHeroIds = roomManager.getAvailableHeroIds(roomId);
            if (!availableHeroIds || availableHeroIds.length === 0) {
                console.error(`[triggerBotsToLock] 房间 ${roomId} 没有可供机器人 ${botId} 选择的英雄了！`);
                continue; // 跳过此机器人
            }

            // 2. 为机器人随机选择一个英雄
            const randomIndex = Math.floor(Math.random() * availableHeroIds.length);
            const chosenHeroId = availableHeroIds[randomIndex];
            console.log(`[triggerBotsToLock] 后端为机器人 ${botId} 选择了英雄: ${chosenHeroId}`);

            // 3. 更新机器人的锁定状态
            const botUpdatedRoom = roomManager.setPlayerHeroLockStatus(roomId, botId, true, chosenHeroId);

            if (botUpdatedRoom) {
                // 广播机器人锁定消息
                broadcastToRoom(roomId, {
                    type: 'PLAYER_HERO_LOCKED',
                    data: {
                        playerId: botId,
                        heroId: chosenHeroId,
                        isLocked: true
                    }
                });
                logRoomStatus(roomId, `After Bot ${botId} Lock Update`); // 记录机器人锁定后的状态
                
                // **** 新增：检查机器人锁定后是否所有人都已锁定 ****
                const allLockedAfterBot = roomManager.checkAllPlayersLocked(roomId); // 使用 RoomManager 的函数检查
                console.log(`[triggerBotsToLock] 检查机器人 ${botId} 锁定后，所有玩家是否锁定: ${allLockedAfterBot}`);
                
                if (allLockedAfterBot) {
                    console.log(`[triggerBotsToLock] 房间 ${roomId} 在机器人锁定后满足最终开始条件，转换状态并广播游戏开始...`);
                    // 更新房间状态为 'playing'
                    const finalRoomState = roomManager.updateRoom(roomId, { 
                        status: 'playing',
                        gameActualStartTime: Date.now() // 记录实际游戏开始时间
                    });

                    if (finalRoomState) {
                        // 准备广播游戏正式开始的消息
                        const gameStartMessage = {
                             type: 'ACTUAL_GAME_START', // 使用明确的类型 
                             data: { 
                                 roomId: finalRoomState.roomId,
                                 // 可以包含最终确认的玩家列表和英雄等信息
                                 players: finalRoomState.players.map(p => ({ 
                                     openId: p.openId,
                                     isHost: p.isHost,
                                     isBot: p.isBot,
                                     selectedHeroId: p.selectedHeroId,
                                     nickname: p.nickname || p.openId 
                                  })),
                                 startTime: finalRoomState.gameActualStartTime
                             }
                         };
                        broadcastToRoom(roomId, gameStartMessage); // 显式广播
                        console.log(`[triggerBotsToLock] 房间 ${roomId} 游戏已由机器人锁定触发启动并广播`);
                        // 注意：如果一个房间有多个机器人，这里可能会被多次触发，但 updateRoom 和 notify 应该是幂等的或安全的
                    } else {
                        console.error(`[triggerBotsToLock] 尝试更新房间 ${roomId} 状态为 playing 失败`);
                    }
                    // 如果所有人都锁定了，可能不需要再处理其他机器人了（取决于游戏逻辑），可以考虑 break
                    // break; // 如果希望第一个完成锁定的机器人就触发游戏开始
                }
                 // **** 新增结束 ****
                 
            } else {
                 console.warn(`[triggerBotsToLock] 更新机器人 ${botId} 锁定状态失败，跳过后续检查。`);
            }

            // 添加一个小延迟，模拟思考和避免同时触发过多事件 (可选)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); 

        } catch (error) {
            console.error(`[triggerBotsToLock] 为机器人 ${bot.openId} 选择英雄时出错:`, error);
        }
    }
    console.log(`[triggerBotsToLock] 房间 ${roomId} 的机器人锁定流程处理完毕`);

    // 广播更新后的房间状态（添加机器人后）
    const finalRoomState = roomManager.getRoom(roomId); 
    if(finalRoomState) {
        broadcastToRoom(roomId, {
            type: 'ROOM_UPDATE',
            data: {
                roomId: finalRoomState.roomId,
                name: finalRoomState.name,
                hostId: finalRoomState.hostId,
                status: finalRoomState.status,
                maxPlayers: finalRoomState.maxPlayers,
                players: finalRoomState.players.map(p => ({ 
                    openId: p.openId,
                    isHost: p.isHost,
                    isBot: p.isBot,
                    ready: p.ready,
                    isHeroLocked: p.isHeroLocked,
                    selectedHeroId: p.selectedHeroId,
                    nickname: p.nickname || p.openId 
                 })),
                 // ... (其他房间状态) ...
            }
        });
        logRoomStatus(roomId, 'After Bot Added');
    }
}
// --- 新增结束 ---

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

/**
 * 广播消息到指定房间
 * @param {string} roomId
 * @param {object} messageData
 * @param {WebSocket|null} excludeWs
 */
function broadcastToRoom(roomId, messageData, excludeWs = null) {
    const room = roomManager.getRoom(roomId); // 使用 getRoom 获取房间信息
    if (!room || !room.players || room.players.length === 0) {
        // 如果房间不存在或没有玩家，记录日志并返回
        console.log(`广播消息给房间 ${roomId} 失败：房间不存在或没有玩家。`);
        return;
    }

    const messageString = JSON.stringify(messageData); // 将消息对象序列化为字符串
    let sentCount = 0; // 记录成功发送的数量

    // 遍历房间中的所有玩家
    room.players.forEach(player => {
        const targetUserId = player.openId; // 获取玩家的 ID (openId)
        const clientWs = clients.get(targetUserId); // 从全局 clients Map 中查找对应的 WebSocket 连接

        // 检查连接是否存在、是否需要排除、以及连接是否处于打开状态
        if (clientWs && clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
            try {
                clientWs.send(messageString); // 发送消息
                sentCount++; // 增加成功计数
                // console.log(`成功向客户端 ${targetUserId} 发送房间消息`); // 可选的成功日志
            } catch (sendError) {
                // 如果发送失败，记录错误日志
                console.error(`向房间 ${roomId} 中的客户端 ${targetUserId} 发送消息失败:`, sendError);
            }
        }
    });

    // 如果至少成功发送给了一个客户端，记录一条汇总日志
    if (sentCount > 0) {
         console.log(`成功向房间 ${roomId} 中的 ${sentCount} 个客户端广播了消息`);
    }
}

/**
 * 处理添加机器人请求
 * @param {WebSocket} ws - 发送请求的客户端连接（应为房主）
 * @param {object} data - 消息数据，应包含 { roomId: string, botId: string, botName: string }
 */
function handleAddBot(ws, data) {
    const { roomId, botId, botName } = data;
     // 从 clients Map 中查找 userId
    const entry = Array.from(clients.entries()).find(([id, socket]) => socket === ws);
    if (!entry) {
        console.error("无法确定发送 ADD_BOT 请求的玩家 ID");
        return;
    }
    const playerId = entry[0]; // 获取 userId

    if (!roomId || !botId) {
        console.error('无效的 ADD_BOT 消息:', data);
        return;
    }

    try {
        // 检查请求者是否是房间的房主
        const playerRoomId = roomManager.getPlayerRoomId(playerId);
        if (playerRoomId !== roomId) {
            console.error(`玩家 ${playerId} 不在房间 ${roomId} 中，无法添加机器人`);
            return;
        }

        // 获取房间数据
        const room = roomManager.getRoom(roomId); // <- 使用 getRoom
        if (!room || !room.players) { // <- 检查 room 和 room.players
            console.error(`获取房间 ${roomId} 数据失败`);
            return;
        }
        // 检查发起请求的玩家是否确实在房间内
        const requestingPlayer = room.players.find(p => p.openId === playerId);
        if (!requestingPlayer) {
             console.error(`玩家 ${playerId} 数据不在获取到的房间 ${roomId} 数据中`);
             return;
        }

        // 检查是否是房主 - 现在可以从 requestingPlayer 获取
        // if (!requestingPlayer.isHost) { // <- 可以取消注释进行检查
        //     console.error(`非房主玩家 ${playerId} 尝试添加机器人`);
        //     return;
        // }

        // 添加机器人到房间
        console.log(`房主 ${playerId} 正在添加机器人 ${botId} 到房间 ${roomId}`);
        const joinResult = roomManager.addPlayerToRoom(roomId, botId, { isBot: true, nickname: botName }); 
        if (!joinResult || !joinResult.room || !joinResult.player) { 
            console.error(`添加机器人 ${botId} 到房间 ${roomId} 失败 (addPlayerToRoom 返回 null 或无效结果)`);
            return;
        }
        console.log(`[handleAddBot] 机器人 ${botId} 已成功加入房间 ${roomId}。`);

        // 获取更新后的房间状态并广播 PLAYER_JOINED 事件
        const roomAfterBotJoin = roomManager.getRoom(roomId); 
        if(roomAfterBotJoin) {
            broadcastToRoom(roomId, {
                type: 'PLAYER_JOINED', // 使用明确的事件类型
                data: {
                    roomId,
                    player: joinResult.player, // 发送新加入的玩家信息
                    playerCount: roomAfterBotJoin.players.length,
                    // 可以选择性地发送整个更新后的房间状态
                    room: { // 发送简化的房间状态或根据需要发送完整状态
                        players: roomAfterBotJoin.players.map(p => ({ 
                            openId: p.openId,
                            nickname: p.nickname || p.openId,
                            isBot: p.isBot,
                            isHost: p.isHost,
                            ready: p.ready,
                            isHeroLocked: p.isHeroLocked,
                            selectedHeroId: p.selectedHeroId
                        }))
                    } 
                }
            });
            logRoomStatus(roomId, 'After Bot Added Broadcast');
        } else {
             console.error(`[handleAddBot] 添加机器人后无法获取房间 ${roomId} 的数据用于广播`);
        }

        // --- 保留：将机器人设置为已准备状态 --- 
        const readyResult = roomManager.updatePlayerReady(roomId, botId, true);
        if (!readyResult) {
            // 这个错误理论上不应该发生，因为刚添加了机器人
            console.error(`[handleAddBot] 设置机器人 ${botId} 为准备状态失败`);
            // 可以选择继续，或者认为这是一个严重问题并返回
        } else {
            console.log(`[handleAddBot] 机器人 ${botId} 已自动设置为准备状态`);
            // 广播 ROOM_UPDATE 让前端知道机器人已准备
            // updatePlayerReady 内部已经会广播 PLAYER_READY_CHANGED, 包含了房间信息
            // 但为了确保状态完全同步，可以再广播一次完整的 ROOM_UPDATE
            const currentRoomState = roomManager.getRoom(roomId); 
            if (currentRoomState) {
                broadcastToRoom(roomId, {
                    type: 'ROOM_UPDATE',
                    data: {
                        roomId,
                        players: currentRoomState.players.map(p => ({ /* 包含 ready, locked, hero 等所有状态 */ 
                            openId: p.openId,
                            isHost: p.isHost,
                            isBot: p.isBot,
                            ready: p.ready,
                            isHeroLocked: p.isHeroLocked,
                            selectedHeroId: p.selectedHeroId,
                            nickname: p.nickname || p.openId
                         })),
                        // ... (其他房间状态) ...
                    }
                });
                logRoomStatus(roomId, 'After Bot Ready Update');
            }
        }
        // --- 机器人准备状态设置结束 ---

    } catch (error) {
        console.error(`处理添加机器人时出错 (房间: ${roomId}, 玩家: ${playerId}):`, error);
    }
}

/**
 * 打印当前房间状态的日志（用于调试）
 * @param {string} roomId - 房间ID
 * @param {string} context - 上下文信息（用于标识日志位置）
 */
function logRoomStatus(roomId, context) {
    try {
        const room = roomManager.getRoom(roomId); // <- 使用 getRoom
        if (!room || !room.players) { // <- 检查 room 和 room.players
            console.log(`[${context}] 房间 ${roomId} 不存在或无玩家数据`);
            return;
        }
        const players = room.players; // <- 获取 players 数组

        const playerCount = players.length;
        const botCount = players.filter(p => p.isBot).length; // 假设玩家对象有 isBot 属性
        const humanCount = playerCount - botCount;
        const readyCount = players.filter(p => p.ready).length;
        const lockedCount = players.filter(p => p.isHeroLocked).length; // 假设玩家数据中有 isHeroLocked

        console.log(`[${context}] 房间 ${roomId} 状态: ` +
            `总玩家=${playerCount} (人类=${humanCount}, 机器人=${botCount}), ` +
            `已准备=${readyCount}, 已锁定=${lockedCount}`);
    } catch (error) {
        console.error(`[${context}] 记录房间状态出错:`, error);
    }
}

module.exports = {
  attach,
  close,
  sendToClient,
  broadcastToClients,
  broadcastToAll,
  getClientCount
}; 