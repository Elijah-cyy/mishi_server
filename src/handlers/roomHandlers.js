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
    const { playerId, playerData } = req.body;

    if (!roomId || !playerId) {
      return sendError(res, 400, '房间ID和玩家ID不能为空');
    }

    // 添加玩家到房间
    const result = roomManager.addPlayerToRoom(roomId, playerId, playerData || {});

    if (!result) {
      return sendError(res, 404, '房间不存在或已满');
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
    const { roomId } = req.params;

    if (!roomId) {
      return sendError(res, 400, '房间ID不能为空');
    }

    // 开始游戏
    const result = roomManager.startGame(roomId);

    if (!result) {
      return sendError(res, 400, '无法开始游戏，房间可能不存在或人数不足');
    }

    // 返回成功信息
    sendSuccess(res, 200, '游戏开始成功', { gameState: result });
  } catch (error) {
    console.error('开始游戏失败:', error);
    sendError(res, 500, '开始游戏失败', { message: error.message });
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
  handleLeaveRoom
}; 