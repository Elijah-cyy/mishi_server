/**
 * 房间管理HTTP处理器
 * 处理与房间相关的请求
 */

const roomManager = require('../managers/roomManager');
const { validateRequest } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/responses');

/**
 * 创建房间请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleCreateRoom(req, res) {
  try {
    // 从认证中间件获取用户ID (从 req.userId 获取)
    const hostId = req.userId; // Corrected
    // console.log(`[RoomHandlers.handleCreateRoom] Entered. HostID from req.userId: ${hostId}`); // Removed

    if (!hostId) {
      console.error('[RoomHandlers.handleCreateRoom] Error: hostId is missing! Auth middleware might have failed or was bypassed.');
      return sendError(res, 401, '无法获取用户信息，请重新登录');
    }
    
    // console.log('[RoomHandlers.handleCreateRoom] HostID verified. Proceeding with validation...'); // Removed

    // 校验请求数据
    const validationResult = validateRequest(req.body, {
      name: { type: 'string', required: false },
      maxPlayers: { type: 'number', min: 1, max: 10, default: 4 },
      timeLimit: { type: 'number', min: 600, max: 7200, default: 3600 },
      mapId: { type: 'string', default: 'default' },
      gameSettings: { type: 'object', default: {} }
    });

    if (!validationResult.valid) {
      console.warn('[RoomHandlers.handleCreateRoom] Validation failed:', validationResult.errors);
      return sendError(res, 400, '请求数据无效', validationResult.errors);
    }

    // console.log('[RoomHandlers.handleCreateRoom] Validation successful. Preparing options...'); // Removed
    const createOptions = validationResult.data;
    createOptions.hostId = hostId;
    // !! 从 req.user 获取 hostNickname (假设存在) !!
    createOptions.hostNickname = req.user?.nickname || `玩家${hostId.substring(0, 4)}`; // 提供后备名称
    
    if (!createOptions.name) {
      // console.log('[RoomHandlers.handleCreateRoom] No room name provided, generating default.'); // Removed
      createOptions.name = `玩家${hostId.substring(0, 4)}的房间`;
    }

    // console.log('[RoomHandlers.handleCreateRoom] Creating room with options:', createOptions); // Avoid logging potentially large object
    // 创建房间
    const roomData = roomManager.createRoom(createOptions);

    // console.log('[RoomHandlers.handleCreateRoom] Room created successfully:', roomData); // Avoid logging potentially large object
    console.log(`[RoomHandlers] Room created: ${roomData.roomId} by User: ${hostId.substring(0,8)}...`); // Concise log
    // 返回房间信息
    sendSuccess(res, 201, '房间创建成功', { room: roomData });
  } catch (error) {
    console.error('[RoomHandlers.handleCreateRoom] Error during room creation:', error); // Keep error log
    sendError(res, 500, '创建房间失败', { message: error.message });
  }
}

/**
 * 获取房间信息请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleGetRoom(req, res) {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    // 获取房间信息
    const roomData = roomManager.getRoom(roomId);

    if (!roomData) {
      return sendError(res, 404, '房间不存在');
    }

    // 返回房间信息
    sendSuccess(res, 200, '获取房间成功', { room: roomData });
  } catch (error) {
    console.error('获取房间失败:', error);
    sendError(res, 500, '获取房间失败', { message: error.message });
  }
}

/**
 * 获取所有房间请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleGetAllRooms(req, res) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    
    // 获取所有房间
    const rooms = roomManager.getAllRooms(activeOnly);

    // 返回房间列表
    sendSuccess(res, 200, '获取房间列表成功', { rooms });
  } catch (error) {
    console.error('获取房间列表失败:', error);
    sendError(res, 500, '获取房间列表失败', { message: error.message });
  }
}

/**
 * 更新房间信息请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleUpdateRoom(req, res) {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    // 校验请求数据
    const validationResult = validateRequest(req.body, {
      name: { type: 'string' },
      maxPlayers: { type: 'number', min: 1, max: 10 },
      timeLimit: { type: 'number', min: 600, max: 7200 },
      gameSettings: { type: 'object' }
    });

    if (!validationResult.valid) {
      return sendError(res, 400, '请求数据无效', validationResult.errors);
    }

    // 更新房间
    const updatedRoom = roomManager.updateRoom(roomId, validationResult.data);

    if (!updatedRoom) {
      return sendError(res, 404, '房间不存在');
    }

    // 返回更新后的房间信息
    sendSuccess(res, 200, '房间更新成功', { room: updatedRoom });
  } catch (error) {
    console.error('更新房间失败:', error);
    sendError(res, 500, '更新房间失败', { message: error.message });
  }
}

/**
 * 关闭房间请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleCloseRoom(req, res) {
  try {
    const { roomId } = req.params;
    const { reason } = req.body;

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    // 关闭房间
    const result = roomManager.closeRoom(roomId, reason || '管理员关闭');

    if (!result) {
      return sendError(res, 404, '房间不存在或已关闭');
    }

    // 返回成功信息
    sendSuccess(res, 200, '房间关闭成功');
  } catch (error) {
    console.error('关闭房间失败:', error);
    sendError(res, 500, '关闭房间失败', { message: error.message });
  }
}

/**
 * 添加玩家到房间请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleAddPlayerToRoom(req, res) {
  try {
    const { roomId } = req.params;
    // playerId 可以从 body 获取（用于管理员添加等场景），或者从认证信息 req.userId 获取
    // 这里优先使用 req.userId (通过 authMiddleware 设置)
    const playerId = req.userId || req.body.playerId; 
    const playerData = req.body.playerData; // 其他玩家信息，如 nickname

    if (!roomId) {
      return sendError(res, 400, '请求中缺少房间ID');
    }
    if (!playerId) {
        // 如果连 req.userId 和 req.body.playerId 都没有，则无法处理
        return sendError(res, 400, '请求中缺少玩家ID');
    }

    // 添加玩家到房间
    const result = roomManager.addPlayerToRoom(roomId, playerId, playerData || {});

    // 检查 result 是否包含错误信息
    if (result && result.error) {
        switch (result.error) {
            case 'ROOM_LOCKED':
                return sendError(res, 409, result.message || '房间操作繁忙，请稍后重试'); // 409 Conflict
            case 'ROOM_NOT_WAITING':
                return sendError(res, 403, result.message || '房间当前不可加入'); // 403 Forbidden
            case 'ROOM_FULL':
                return sendError(res, 403, result.message || '房间已满'); // 403 Forbidden
            case 'INTERNAL_ERROR':
                return sendError(res, 500, result.message || '处理加入房间时发生内部错误');
            default:
                // 其他未预期的错误类型，或者 result 本身是 null (例如房间不存在)
                return sendError(res, 404, '房间不存在或无法加入'); // 404 Not Found
        }
    } else if (!result || !result.room || !result.player) {
        // 如果 result 不是带 error 的对象，也不是有效的成功对象 (如 null 或 undefined)
        // 这通常对应 roomManager 返回 null 的情况 (房间不存在)
        return sendError(res, 404, '房间不存在');
    }

    // 返回成功信息
    sendSuccess(res, 200, '玩家成功加入房间', { player: result.player, room: result.room });
  } catch (error) {
    console.error('添加玩家到房间失败:', error);
    sendError(res, 500, '添加玩家到房间失败', { message: error.message });
  }
}

/**
 * 从房间移除玩家请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleRemovePlayerFromRoom(req, res) {
  try {
    const { roomId, playerId } = req.params;

    if (!roomId || !playerId) {
      return sendError(res, 400, '房间ID和玩家ID不能为空');
    }

    // 从房间移除玩家
    const result = roomManager.removePlayerFromRoom(roomId, playerId);

    if (!result) {
      return sendError(res, 404, '房间或玩家不存在');
    }

    // 返回成功信息
    sendSuccess(res, 200, '玩家成功离开房间', { room: result });
  } catch (error) {
    console.error('从房间移除玩家失败:', error);
    sendError(res, 500, '从房间移除玩家失败', { message: error.message });
  }
}

/**
 * 开始游戏请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleStartGame(req, res) {
  try {
    // roomId 可能在 params 或 body 中，取决于 roomRoutes.js 的配置
    const roomId = req.params.roomId || req.body.roomId;
    const userId = req.userId; // 从认证中间件获取

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }
    if (!userId) {
      // 这个理论上不应该发生，因为有 authMiddleware
      return sendError(res, 401, '无法获取用户信息');
    }

    const room = roomManager.getRoom(roomId);

    if (!room) {
      return sendError(res, 404, '房间不存在');
    }

    // 检查1：请求者是否是房主
    if (room.hostId !== userId) {
      return sendError(res, 403, '只有房主才能开始游戏');
    }

    // 检查2：房间状态是否是 waiting
    if (room.status !== 'waiting') {
      return sendError(res, 400, `游戏无法开始，当前房间状态: ${room.status}`);
    }

    // 检查3：房间是否已满员
    const isFull = room.players.length === room.maxPlayers;
    if (!isFull) {
      return sendError(res, 400, `房间未满员 (${room.players.length}/${room.maxPlayers})，无法开始游戏`);
    }

    // 检查4：是否所有非房主玩家都已准备好
    const nonHostPlayers = room.players.filter(p => p.openId !== room.hostId);
    const allNonHostPlayersReady = nonHostPlayers.every(p => p.ready);
    if (!allNonHostPlayersReady) {
        const notReadyNonHostPlayers = nonHostPlayers.filter(p => !p.ready).map(p => p.openId);
        console.warn(`[handleStartGame] 房间 ${roomId} 尝试开始游戏失败，有非房主玩家未准备:`, notReadyNonHostPlayers);
        // 保持通用错误消息，或根据需要修改为更具体的消息
        return sendError(res, 400, `有玩家未准备好，无法开始游戏`);
    }

    // 所有检查通过，调用 startGame
    console.log(`[handleStartGame] 房间 ${roomId} 通过所有检查，尝试调用 roomManager.startGame...`);
    const gameState = roomManager.startGame(roomId);

    if (!gameState) {
      // 如果 startGame 内部检查失败（理论上不应发生，因为前面已经检查过），返回错误
      console.error(`[handleStartGame] roomManager.startGame(${roomId}) 返回了 null/falsy，即使检查已通过！`);
      return sendError(res, 500, '尝试开始游戏时发生内部错误');
    }

    // startGame 内部会通过 WebSocket 广播 GAME_START
    // HTTP 请求只需返回成功即可
    console.log(`[handleStartGame] 房间 ${roomId} 游戏成功启动 (由HTTP请求触发)`);
    sendSuccess(res, 200, '游戏开始成功', { gameState }); // 可以选择性返回 gameState

  } catch (error) {
    console.error(`[handleStartGame] 开始游戏失败 (${req.params.roomId || req.body.roomId}):`, error);
    sendError(res, 500, '开始游戏时发生服务器错误', { message: error.message });
  }
}

/**
 * 结束游戏请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleEndGame(req, res) {
  try {
    const { roomId } = req.params;
    const { completed, results } = req.body;

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    // 结束游戏
    const result = roomManager.endGame(roomId, completed, results);

    if (!result) {
      return sendError(res, 404, '房间不存在或游戏未开始');
    }

    // 返回成功信息
    sendSuccess(res, 200, '游戏结束成功', { gameResults: result });
  } catch (error) {
    console.error('结束游戏失败:', error);
    sendError(res, 500, '结束游戏失败', { message: error.message });
  }
}

/**
 * 玩家离开房间请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleLeaveRoom(req, res) {
  try {
    const { roomId } = req.body;
    const playerId = req.userId; // 从认证中间件获取

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    if (!playerId) {
      return sendError(res, 401, '无法获取用户信息，请重新登录');
    }

    console.log(`玩家尝试离开房间: ${playerId} -> ${roomId}`);

    // 从房间移除玩家
    const result = roomManager.removePlayerFromRoom(roomId, playerId);

    if (!result) {
      return sendError(res, 404, '房间或玩家不存在');
    }

    // 返回成功信息
    sendSuccess(res, 200, '成功离开房间', { room: result });
  } catch (error) {
    console.error('离开房间失败:', error);
    sendError(res, 500, '离开房间失败', { message: error.message });
  }
}

/**
 * 更新玩家准备状态请求处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleUpdatePlayerReady(req, res) {
  try {
    const { roomId, ready } = req.body;
    const playerId = req.userId; // 从认证中间件获取

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    if (!playerId) {
      return sendError(res, 401, '无法获取用户信息，请重新登录');
    }

    console.log(`玩家更新准备状态: ${playerId} -> ${roomId}, ready: ${ready}`);

    // 更新玩家准备状态
    const result = roomManager.updatePlayerReady(roomId, playerId, ready);

    if (!result) {
      return sendError(res, 404, '房间或玩家不存在或状态无效');
    }

    // 返回成功信息
    sendSuccess(res, 200, '成功更新准备状态', { room: result });
  } catch (error) {
    console.error('更新准备状态失败:', error);
    sendError(res, 500, '更新准备状态失败', { message: error.message });
  }
}

module.exports = {
  handleCreateRoom,
  handleGetRoom,
  handleGetAllRooms,
  handleUpdateRoom,
  handleCloseRoom,
  handleAddPlayerToRoom,
  handleRemovePlayerFromRoom,
  handleStartGame,
  handleEndGame,
  handleLeaveRoom,
  handleUpdatePlayerReady
}; 