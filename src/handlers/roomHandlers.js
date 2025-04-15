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
    // 从认证中间件获取用户ID
    const hostId = req.user?.id; // 假设认证中间件将用户信息放在 req.user
    if (!hostId) {
      return sendError(res, 401, '无法获取用户信息，请重新登录');
    }

    // 校验请求数据 - 移除 hostId 验证，name 改为非必需
    const validationResult = validateRequest(req.body, {
      name: { type: 'string', required: false }, // name 改为非必需
      maxPlayers: { type: 'number', min: 1, max: 10, default: 4 },
      timeLimit: { type: 'number', min: 600, max: 7200, default: 3600 },
      mapId: { type: 'string', default: 'default' },
      gameSettings: { type: 'object', default: {} }
    });

    if (!validationResult.valid) {
      return sendError(res, 400, '请求数据无效', validationResult.errors);
    }

    // 准备创建房间的数据
    const createOptions = validationResult.data;
    createOptions.hostId = hostId; // 从 req.user 获取 hostId
    
    // 如果没有提供房间名称，生成默认名称
    if (!createOptions.name) {
      createOptions.name = `玩家${hostId.substring(0, 4)}的房间`; // 示例默认名称
    }

    // 创建房间
    const roomData = roomManager.createRoom(createOptions); // 传递包含 hostId 和 name 的完整选项

    // 返回房间信息
    sendSuccess(res, 201, '房间创建成功', { room: roomData });
  } catch (error) {
    console.error('创建房间失败:', error);
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

module.exports = {
  handleCreateRoom,
  handleGetRoom,
  handleGetAllRooms,
  handleUpdateRoom,
  handleCloseRoom,
  handleAddPlayerToRoom,
  handleRemovePlayerFromRoom,
  handleStartGame,
  handleEndGame
}; 