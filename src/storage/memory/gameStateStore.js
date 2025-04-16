/**
 * 游戏状态内存存储模块
 * 负责管理所有活跃游戏的运行时状态
 */

// 存储所有游戏状态
const gameStates = new Map();

/**
 * 创建游戏状态
 * @param {Object} options 游戏选项
 * @param {string} options.roomId 房间ID
 * @param {number} options.timeLimit 时间限制（秒）
 * @param {string} options.mapId 地图ID
 * @param {Object} options.gameSettings 游戏设置
 * @returns {Object|null} 创建的游戏状态
 */
function createGameState(options) {
  const { roomId, timeLimit = 3600, mapId = 'default', gameSettings = {} } = options;

  if (!roomId) {
    console.error('创建游戏状态失败：房间ID不能为空');
    return null;
  }

  // 检查是否已存在游戏状态
  if (gameStates.has(roomId)) {
    console.log(`房间 ${roomId} 已有游戏状态，将被覆盖`);
  }

  // 创建初始游戏状态
  const gameState = {
    roomId,
    status: 'waiting', // waiting, running, paused, completed, aborted
    startTime: null,
    endTime: null,
    timeLimit,
    mapId,
    gameSettings,
    playerStates: {}, // 玩家状态，键为玩家ID
    objectStates: {}, // 游戏对象状态，键为对象ID
    events: [],       // 游戏事件记录
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 保存游戏状态
  gameStates.set(roomId, gameState);
  console.log(`游戏状态创建成功: ${roomId}, 地图: ${mapId}`);

  return gameState;
}

/**
 * 获取游戏状态
 * @param {string} roomId 房间ID
 * @returns {Object|null} 游戏状态或null
 */
function getGameState(roomId) {
  return gameStates.has(roomId) ? gameStates.get(roomId) : null;
}

/**
 * 更新游戏状态
 * @param {string} roomId 房间ID
 * @param {Object} updateData 更新数据
 * @returns {Object|null} 更新后的游戏状态或null
 */
function updateGameState(roomId, updateData) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`更新游戏状态失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 不允许更新的字段
  const disallowedFields = ['roomId', 'createdAt'];
  
  // 过滤掉不允许更新的字段
  const filteredUpdateData = {};
  for (const key in updateData) {
    if (!disallowedFields.includes(key) && updateData[key] !== undefined) {
      filteredUpdateData[key] = updateData[key];
    }
  }

  // 合并更新数据
  const updatedGameState = {
    ...gameState,
    ...filteredUpdateData,
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);

  return updatedGameState;
}

/**
 * 开始游戏
 * @param {string} roomId 房间ID
 * @returns {Object|null} 更新后的游戏状态或null
 */
function startGameState(roomId) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`开始游戏状态失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 更新游戏状态
  const updatedGameState = {
    ...gameState,
    status: 'running',
    startTime: Date.now(),
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);
  console.log(`游戏开始: ${roomId}`);

  return updatedGameState;
}

/**
 * 结束游戏
 * @param {string} roomId 房间ID
 * @param {string} status 结束状态(completed/aborted)
 * @param {Object} finalState 最终状态数据
 * @returns {Object|null} 更新后的游戏状态或null
 */
function endGameState(roomId, status = 'completed', finalState = {}) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`结束游戏状态失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 更新游戏状态
  const updatedGameState = {
    ...gameState,
    ...finalState,
    status: status,
    endTime: Date.now(),
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);
  console.log(`游戏结束: ${roomId}, 状态: ${status}`);

  return updatedGameState;
}

/**
 * 移除游戏状态
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否成功移除
 */
function removeGameState(roomId) {
  const result = gameStates.delete(roomId);
  if (result) {
    console.log(`游戏状态已移除: ${roomId}`);
  }
  return result;
}

/**
 * 更新玩家状态
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} playerState 玩家状态
 * @returns {Object|null} 更新后的游戏状态或null
 */
function updatePlayerState(roomId, playerId, playerState) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`更新玩家状态失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 更新玩家状态
  const updatedPlayerStates = {
    ...gameState.playerStates,
    [playerId]: {
      ...(gameState.playerStates[playerId] || {}),
      ...playerState,
      updatedAt: Date.now()
    }
  };

  // 更新游戏状态
  const updatedGameState = {
    ...gameState,
    playerStates: updatedPlayerStates,
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);

  return updatedGameState;
}

/**
 * 更新游戏对象状态
 * @param {string} roomId 房间ID
 * @param {string} objectId 对象ID
 * @param {Object} objectState 对象状态
 * @returns {Object|null} 更新后的游戏状态或null
 */
function updateObjectState(roomId, objectId, objectState) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`更新对象状态失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 更新对象状态
  const updatedObjectStates = {
    ...gameState.objectStates,
    [objectId]: {
      ...(gameState.objectStates[objectId] || {}),
      ...objectState,
      updatedAt: Date.now()
    }
  };

  // 更新游戏状态
  const updatedGameState = {
    ...gameState,
    objectStates: updatedObjectStates,
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);

  return updatedGameState;
}

/**
 * 记录游戏事件
 * @param {string} roomId 房间ID
 * @param {Object} event 事件对象
 * @returns {Object|null} 更新后的游戏状态或null
 */
function recordGameEvent(roomId, event) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState) {
    console.error(`记录游戏事件失败：找不到房间 ${roomId} 的游戏状态`);
    return null;
  }

  // 添加事件时间戳
  const eventWithTimestamp = {
    ...event,
    timestamp: Date.now()
  };

  // 更新游戏状态
  const updatedGameState = {
    ...gameState,
    events: [...gameState.events, eventWithTimestamp],
    updatedAt: Date.now()
  };

  // 保存更新后的游戏状态
  gameStates.set(roomId, updatedGameState);

  return updatedGameState;
}

/**
 * 获取游戏已运行时间（秒）
 * @param {string} roomId 房间ID
 * @returns {number} 游戏已运行时间（秒）或0
 */
function calculateGameElapsedTime(roomId) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState || !gameState.startTime) {
    return 0;
  }

  const endTime = gameState.endTime || Date.now();
  return Math.floor((endTime - gameState.startTime) / 1000);
}

/**
 * 检查游戏是否超时
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否超时
 */
function isGameTimeout(roomId) {
  const gameState = gameStates.get(roomId);
  
  if (!gameState || !gameState.startTime || !gameState.timeLimit) {
    return false;
  }

  const elapsedTime = calculateGameElapsedTime(roomId);
  return elapsedTime >= gameState.timeLimit;
}

/**
 * 获取所有活跃游戏状态
 * @returns {Array} 游戏状态数组
 */
function getAllGameStates() {
  return Array.from(gameStates.values());
}

/**
 * 获取活跃游戏数量
 * @returns {number} 游戏数量
 */
function getGameCount() {
  return gameStates.size;
}

/**
 * 清理所有游戏状态
 */
function clearAllGameStates() {
  gameStates.clear();
  console.log('所有游戏状态已清理');
}

/**
 * 清理已完成或已终止的游戏状态
 * @param {Object} options 清理选项
 * @param {number} options.completedMaxAge 已完成游戏的最大保留时间(毫秒)，默认30分钟
 * @param {number} options.abortedMaxAge 已终止游戏的最大保留时间(毫秒)，默认30分钟
 * @param {number} options.runningMaxAge 运行中游戏的最大无更新时间(毫秒)，默认6小时
 * @returns {number} 清理的游戏状态数量
 */
function cleanupCompletedGames(options = {}) {
  const now = Date.now();
  const { 
    completedMaxAge = 30 * 60 * 1000,   // 默认30分钟
    abortedMaxAge = 30 * 60 * 1000,     // 默认30分钟
    runningMaxAge = 6 * 60 * 60 * 1000  // 默认6小时
  } = options;
  
  let cleanedCount = 0;
  const statesToDelete = [];
  
  // 遍历所有游戏状态，检查是否过期
  for (const [roomId, gameState] of gameStates.entries()) {
    // 计算自上次更新以来的时间
    const stateAge = now - gameState.updatedAt;
    
    // 根据游戏状态决定是否清理
    if (
      // 已完成的游戏，超过completedMaxAge
      (gameState.status === 'completed' && stateAge > completedMaxAge) ||
      // 已终止的游戏，超过abortedMaxAge
      (gameState.status === 'aborted' && stateAge > abortedMaxAge) ||
      // 运行中但长时间未更新的游戏，超过runningMaxAge
      ((['running', 'waiting', 'paused'].includes(gameState.status)) && stateAge > runningMaxAge)
    ) {
      statesToDelete.push(roomId);
    }
  }
  
  // 删除标记的游戏状态
  for (const roomId of statesToDelete) {
    gameStates.delete(roomId);
    cleanedCount++;
    console.log(`清理游戏状态: ${roomId}`);
  }
  
  return cleanedCount;
}

module.exports = {
  createGameState,
  getGameState,
  updateGameState,
  startGameState,
  endGameState,
  removeGameState,
  updatePlayerState,
  updateObjectState,
  recordGameEvent,
  calculateGameElapsedTime,
  isGameTimeout,
  getAllGameStates,
  getGameCount,
  clearAllGameStates,
  cleanupCompletedGames
}; 