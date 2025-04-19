/**
 * 房间管理器
 * 负责房间的创建、加入、状态更新等操作
 */

const roomStore = require('../storage/memory/roomStore');
const gameStateStore = require('../storage/memory/gameStateStore');
const { generateRoomId } = require('../utils/helpers');

// 引入锁 Map 和超时设置
const roomLocks = new Map();
const LOCK_TIMEOUT = 5000; // 5 秒超时

// 假设在文件顶部或通过 require/import 获取了所有英雄ID
// const ALL_HERO_IDS = ['dongdong', 'missO', 'fox', ...]; 
// 暂时硬编码一个示例列表，需要替换为实际数据源
const ALL_HERO_IDS = ['dongdong', 'missO', 'fox', 'prometheus', 'drxu', 'chenYY', 'zilin', 'ying', 'qinhan', 'navigator']; 

/**
 * 创建新房间
 * @param {Object} options 房间选项
 * @param {string} options.name 房间名称
 * @param {string} options.hostId 房主ID
 * @param {string} options.hostNickname 房主昵称
 * @param {number} options.maxPlayers 最大玩家数
 * @param {number} options.timeLimit 游戏时间限制(秒)
 * @param {string} options.mapId 地图ID
 * @param {Object} options.gameSettings 游戏设置
 * @returns {Object} 创建的房间信息
 */
function createRoom(options) {
  const { name, hostId, hostNickname = '房主', maxPlayers = 4, timeLimit = 3600, mapId = 'default', gameSettings = {} } = options;

  // 验证必要参数
  if (!name || !hostId) {
    throw new Error('房间名称和房主ID不能为空');
  }

  // 生成房间ID
  const roomId = generateRoomId();

  // 创建房间对象
  const room = {
    roomId,
    name,
    hostId,
    status: 'waiting', // waiting, playing, ended
    maxPlayers: Math.min(Math.max(2, maxPlayers), 10), // 确保最大玩家数在2-10之间
    timeLimit,
    mapId,
    gameSettings,
    players: [{
      openId: hostId,
      nickname: hostNickname,
      isHost: true,
      ready: false,
      isHeroLocked: false, // 新增：初始英雄未锁定
      selectedHeroId: null, // 新增：初始未选择英雄
      isBot: false,         // 新增：是否为机器人 (房主默认为 false)
      joinTime: Date.now()
    }],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 保存房间信息
  roomStore.setRoom(roomId, room);
  console.log(`房间创建成功: ${roomId}, 房主: ${hostId}`);

  return room;
}

/**
 * 获取房间信息
 * @param {string} roomId 房间ID
 * @returns {Object} 房间信息，不存在则返回null
 */
function getRoom(roomId) {
  if (!roomId) {
    return null;
  }
  return roomStore.getRoom(roomId);
}

/**
 * 获取所有房间
 * @param {boolean} activeOnly 是否只返回活跃房间
 * @returns {Array} 房间列表
 */
function getAllRooms(activeOnly = false) {
  const rooms = roomStore.getAllRooms();
  
  if (activeOnly) {
    return rooms.filter(room => room.status !== 'ended');
  }
  
  return rooms;
}

/**
 * 更新房间信息
 * @param {string} roomId 房间ID
 * @param {Object} updateData 更新数据
 * @returns {Object} 更新后的房间信息，不存在则返回null
 */
function updateRoom(roomId, updateData) {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    return null;
  }

  // 不允许更新的字段
  const disallowedFields = ['roomId', 'hostId', 'players', 'createdAt', 'status'];
  
  // 过滤掉不允许更新的字段
  const filteredUpdateData = {};
  for (const key in updateData) {
    if (!disallowedFields.includes(key) && updateData[key] !== undefined) {
      filteredUpdateData[key] = updateData[key];
    }
  }

  // 合并更新数据
  const updatedRoom = {
    ...room,
    ...filteredUpdateData,
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`房间更新成功: ${roomId}`);

  return updatedRoom;
}

/**
 * 添加玩家到房间
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} playerData 玩家数据
 * @returns {Object|null} 成功返回包含房间和玩家信息的对象，失败返回null或错误对象
 */
function addPlayerToRoom(roomId, playerId, playerData = {}) {
  // 检查并获取锁
  if (roomLocks.has(roomId)) {
    console.log(`[addPlayerToRoom] 房间 ${roomId} 正在被其他请求处理，拒绝加入请求`);
    // 返回 null 或特定错误信息，让调用方知道是锁冲突
    return { error: 'ROOM_LOCKED', message: '房间操作繁忙，请稍后重试' }; 
    // return null; // 或者保持原有行为
  }

  // 获取锁，并设置超时自动释放
  const lockTimeoutId = setTimeout(() => {
      console.warn(`[addPlayerToRoom] 房间 ${roomId} 的锁已超时，自动释放`);
      roomLocks.delete(roomId);
  }, LOCK_TIMEOUT);
  roomLocks.set(roomId, lockTimeoutId); // 存储 Timeout ID 以便清除
  console.log(`[addPlayerToRoom] 房间 ${roomId} 已锁定`);

  try {
    const room = roomStore.getRoom(roomId);
    
    if (!room) {
      console.log(`[addPlayerToRoom] 房间不存在: ${roomId}`);
      return null;
    }

    // 检查房间状态
    if (room.status !== 'waiting') {
      console.log(`[addPlayerToRoom] 房间 ${roomId} 状态不是等待中: ${room.status}`);
      // 考虑是否应该返回一个不同的错误信息
      return { error: 'ROOM_NOT_WAITING', message: '房间当前不可加入' };
      // return null; 
    }

    // 检查房间是否已满
    if (room.players.length >= room.maxPlayers) {
      console.log(`[addPlayerToRoom] 房间 ${roomId} 已满 (${room.players.length}/${room.maxPlayers})`);
       // 明确返回房间已满的错误
      return { error: 'ROOM_FULL', message: '房间已满' };
      // return null;
    }

    // 检查玩家是否已在房间中
    const existingPlayerIndex = room.players.findIndex(p => p.openId === playerId);
    if (existingPlayerIndex !== -1) {
      console.log(`[addPlayerToRoom] 玩家 ${playerId} 已在房间 ${roomId} 中`);
      // 如果玩家已在，返回成功，包含房间和玩家信息
      return {
        room,
        player: room.players[existingPlayerIndex]
      };
    }

    // 创建玩家对象
    const player = {
      openId: playerId,
      isHost: false,
      ready: false,
      isHeroLocked: false, // 新增：初始英雄未锁定
      selectedHeroId: null, // 新增：初始未选择英雄
      isBot: playerData.isBot || false, // 新增：处理 isBot 属性
      joinTime: Date.now(),
      ...playerData // 允许传入其他玩家数据，如 nickname
    };

    // 添加玩家到房间 (创建新数组以避免直接修改原对象)
    const updatedPlayers = [...room.players, player];
    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      updatedAt: Date.now()
    };

    // 保存更新后的房间信息
    roomStore.setRoom(roomId, updatedRoom);
    console.log(`[addPlayerToRoom] 玩家 ${playerId} 加入房间 ${roomId} 成功`);

    // 通知房间内所有玩家（包括新加入的玩家）
    // 确保 notifyRoomUpdate 使用最新的信息或传递必要数据
    notifyRoomUpdate(roomId, 'PLAYER_JOINED', {
      playerId,
      player, // 传递新创建的 player 对象
      playerCount: updatedRoom.players.length,
      // 如果 notifyRoomUpdate 需要完整的 room, 可以传递 updatedRoom
      // room: updatedRoom 
    });

    // 成功加入，返回更新后的房间和新玩家信息
    return {
      room: updatedRoom,
      player
    };

  } catch (error) {
      // 捕获潜在的错误
      console.error(`[addPlayerToRoom] 处理加入房间 ${roomId} 时发生错误:`, error);
      // 返回通用错误
      return { error: 'INTERNAL_ERROR', message: '处理加入房间时发生内部错误' };
      // return null;
  } finally {
    // 无论成功或失败，都释放锁
    if (roomLocks.has(roomId)) {
        const storedTimeoutId = roomLocks.get(roomId);
        // 确保我们清除的是正确的 timeout
        if (storedTimeoutId === lockTimeoutId) {
             clearTimeout(lockTimeoutId); // 清除超时计时器
             roomLocks.delete(roomId); // 删除锁
             console.log(`[addPlayerToRoom] 房间 ${roomId} 的锁已释放`);
        } else {
            // 这通常不应该发生，但作为健壮性检查
            console.warn(`[addPlayerToRoom] 尝试释放房间 ${roomId} 的锁，但存储的 Timeout ID 不匹配`);
        }
    }
  }
}

/**
 * 从房间移除玩家
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @returns {Object|null} 更新后的房间信息，不存在则返回null
 */
function removePlayerFromRoom(roomId, playerId) {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    console.log(`房间不存在: ${roomId}`);
    return null;
  }

  // 检查玩家是否在房间中
  const playerIndex = room.players.findIndex(p => p.openId === playerId);
  if (playerIndex === -1) {
    console.log(`玩家不在房间中: ${playerId}`);
    return null;
  }

  // 保存离开的玩家信息用于通知
  const leavingPlayer = room.players[playerIndex];
  
  // 玩家离开房间处理
  const playerIsHost = leavingPlayer.isHost;
  let updatedRoom = {
    ...room,
    players: room.players.filter((_, index) => index !== playerIndex),
    updatedAt: Date.now()
  };

  // 如果是房主离开，且房间还有其他玩家，则转移房主权限
  if (playerIsHost && updatedRoom.players.length > 0) {
    updatedRoom.hostId = updatedRoom.players[0].openId;
    updatedRoom.players[0].isHost = true;
    console.log(`房主转移: ${playerId} -> ${updatedRoom.hostId}`);
  }

  // 如果房间没有玩家了，关闭房间
  if (updatedRoom.players.length === 0) {
    updatedRoom.status = 'ended';
    console.log(`房间已关闭(无玩家): ${roomId}`);
  }

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`玩家离开房间: ${playerId} <- ${roomId}`);

  // 通知房间内所有玩家（不包括离开的玩家）
  notifyRoomUpdate(roomId, 'PLAYER_LEFT', {
    playerId,
    playerCount: updatedRoom.players.length,
    newHostId: playerIsHost ? updatedRoom.hostId : null
  });

  return updatedRoom;
}

/**
 * 更新玩家准备状态
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {boolean} ready 准备状态
 * @returns {Object|null} 更新后的房间信息，不存在则返回null
 */
function updatePlayerReady(roomId, playerId, ready) {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    console.log(`房间不存在: ${roomId}`);
    return null;
  }

  // 检查玩家是否在房间中
  const playerIndex = room.players.findIndex(p => p.openId === playerId);
  if (playerIndex === -1) {
    console.log(`玩家不在房间中: ${playerId}`);
    return null;
  }

  // 检查房间状态
  if (room.status !== 'waiting') {
    console.log(`房间状态不是等待中: ${room.status}`);
    return null;
  }

  // 更新玩家准备状态
  const updatedPlayers = [...room.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    ready
  };

  // 更新房间信息
  const updatedRoom = {
    ...room,
    players: updatedPlayers,
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`[updatePlayerReady] 玩家准备状态更新: ${playerId}, ready=${ready}`);

  // 通知房间内所有玩家
  notifyRoomUpdate(roomId, 'PLAYER_READY_CHANGED', {
    playerId,
    ready,
    allReady: updatedRoom.players.every(p => p.isHost || p.ready)
  });

  return updatedRoom;
}

/**
 * 关闭房间
 * @param {string} roomId 房间ID
 * @param {string} reason 关闭原因
 * @returns {Object|null} 关闭的房间信息，不存在则返回null
 */
function closeRoom(roomId, reason = '管理员关闭') {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    console.log(`房间不存在: ${roomId}`);
    return null;
  }

  // 如果房间已经结束，则返回null
  if (room.status === 'ended') {
    console.log(`房间已经关闭: ${roomId}`);
    return null;
  }

  // 更新房间状态为已结束
  const updatedRoom = {
    ...room,
    status: 'ended',
    closedReason: reason,
    endedAt: Date.now(),
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`房间已关闭: ${roomId}, 原因: ${reason}`);

  return updatedRoom;
}

/**
 * 开始游戏
 * @param {string} roomId 房间ID
 * @returns {Object|null} 游戏状态，不存在或无法开始则返回null
 */
function startGame(roomId) {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    console.log(`房间不存在: ${roomId}`);
    return null;
  }

  // 检查房间状态
  if (room.status !== 'waiting') {
    console.log(`房间状态不是等待中: ${room.status}`);
    return null;
  }

  // 检查玩家数量
  if (room.players.length < 1) {
    console.log(`房间玩家数量不足: ${room.players.length}`);
    return null;
  }

  // !! 新增检查：确保游戏状态不存在 !!
  const existingGameState = gameStateStore.getGameState(roomId);
  if (existingGameState) {
      console.error(`[startGame] 尝试开始游戏失败：房间 ${roomId} 已存在游戏状态 (状态: ${existingGameState.status})。请先清理旧状态。`);
      // 也许尝试清理一下？或者直接报错
      // gameStateStore.removeGameState(roomId); // 谨慎使用：自动清理可能掩盖问题
      return null; // 阻止开始
  }

  // 创建游戏状态
  const gameState = gameStateStore.createGameState({
    roomId,
    timeLimit: room.timeLimit,
    mapId: room.mapId,
    gameSettings: room.gameSettings
  });

  if (!gameState) {
    console.log(`创建游戏状态失败: ${roomId}`);
    return null;
  }

  // 更新房间状态
  const updatedRoom = {
    ...room,
    status: 'CHARACTER_SELECT',
    gameStartTime: Date.now(),
    updatedAt: Date.now()
  };

  // 初始化玩家游戏状态
  for (const player of room.players) {
    gameStateStore.updatePlayerState(roomId, player.openId, {
      ready: false,
      position: 0,
      items: [],
      score: 0,
      isHeroLocked: player.isHeroLocked,
      selectedHeroId: player.selectedHeroId
    });
  }

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`房间 ${roomId} 进入角色选择阶段`);

  // !! 修改：广播 ROOM_UPDATE 消息，包含更新后的房间信息（含新状态） !!
  notifyRoomUpdate(roomId, 'START_CHARACTER_SELECT', { room: updatedRoom });

  return gameState;
}

/**
 * 结束游戏
 * @param {string} roomId 房间ID
 * @param {boolean} completed 是否完成游戏
 * @param {Object} results 游戏结果
 * @returns {Object|null} 游戏结果，不存在则返回null
 */
function endGame(roomId, completed = true, results = {}) {
  const room = roomStore.getRoom(roomId);
  
  if (!room) {
    console.log(`房间不存在: ${roomId}`);
    return null;
  }

  // 检查房间状态
  if (room.status !== 'playing') {
    console.log(`房间状态不是游戏中: ${room.status}`);
    return null;
  }

  // 获取游戏状态
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) {
    console.log(`游戏状态不存在: ${roomId}`);
    return null;
  }

  // 计算游戏时长
  const gameTimeElapsed = gameStateStore.calculateGameElapsedTime(roomId);

  // 准备游戏结果
  const gameResults = {
    roomId,
    completed,
    timeElapsed: gameTimeElapsed,
    events: gameState.events,
    playerResults: {},
    ...results
  };

  // 收集玩家结果
  for (const player of room.players) {
    const playerState = gameState.playerStates[player.openId] || {};
    gameResults.playerResults[player.openId] = {
      score: playerState.score || 0,
      items: playerState.items || [],
      ...(results.playerResults && results.playerResults[player.openId] || {})
    };
  }

  // 更新房间状态
  const updatedRoom = {
    ...room,
    status: 'ended',
    gameEndTime: Date.now(),
    gameResults,
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  
  // 清理游戏状态
  gameStateStore.removeGameState(roomId);
  
  console.log(`游戏结束: ${roomId}, 完成状态: ${completed}`);

  return gameResults;
}

/**
 * 发送房间更新通知给所有房间内的玩家
 * @param {string} roomId 房间ID
 * @param {string} eventType 事件类型
 * @param {Object} eventData 事件数据
 */
function notifyRoomUpdate(roomId, eventType, eventData = {}) {
  const room = roomStore.getRoom(roomId);
  if (!room) {
    console.log(`[RoomManager] 通知房间更新失败: 房间不存在 ${roomId}`);
    return; // 只记录日志，不发送
  }
  console.log(`[RoomManager] 准备房间更新通知: ${eventType}, 房间: ${roomId}`);
  // 注意：实际的广播操作已移至 wsApp.js
  // 返回需要广播的数据结构，供 wsApp 使用
  return {
    type: 'ROOM_UPDATE', // 或者使用更具体的类型，如 PLAYER_JOINED_UPDATE
    data: {
      roomId,
      eventType,
      timestamp: Date.now(),
      ...eventData,
      room // 包含完整的房间信息，以便 wsApp 广播
    }
  };
}

/**
 * 向房间所有玩家发送通知 (此函数可能不再需要，或需要重构)
 * @param {string} roomId 房间ID
 * @param {Object} message 消息内容
 * @param {string} excludePlayerId 要排除的玩家ID
 */
function notifyAllPlayers(roomId, message, excludePlayerId = null) {
  // 警告：此函数不再直接发送消息。广播逻辑应在 wsApp.js 中处理。
  // 如果仍需要此函数，它应该返回需要广播的信息和目标玩家列表。
  console.warn(`[RoomManager] notifyAllPlayers 不再直接发送消息。调用者应处理广播。`);
  const room = roomStore.getRoom(roomId);
  if (!room) {
    console.log(`[RoomManager] 准备通知房间玩家失败: 房间不存在 ${roomId}`);
    return null;
  }

  const playerIds = room.players
    .filter(player => player.openId !== excludePlayerId)
    .map(player => player.openId);
    
  return {
      targetPlayerIds: playerIds,
      message: message
  };
}

/**
 * 根据玩家ID查找其所在的房间ID
 * @param {string} playerId 玩家ID
 * @returns {string|null} 房间ID，如果玩家不在任何房间则返回null
 */
function getPlayerRoomId(playerId) {
  const allRooms = roomStore.getAllRooms(); // 获取所有房间
  for (const room of allRooms) {
    if (room.players && room.players.some(p => p.openId === playerId)) {
      return room.roomId; // 找到了玩家所在的房间
    }
  }
  return null; // 遍历完所有房间都未找到玩家
}

/**
 * 设置玩家在指定房间的英雄锁定状态和选择的英雄 (替代旧的 updatePlayerHeroLock)
 * @param {string} roomId - 房间ID
 * @param {string} playerId - 玩家ID
 * @param {boolean} isLocked - 是否锁定
 * @param {string | null} heroId - 选择的英雄ID (锁定后应有值, 取消锁定或未选择为null)
 * @returns {Object|null} 更新后的房间信息，不存在或失败返回null
 */
function setPlayerHeroLockStatus(roomId, playerId, isLocked, heroId) {
  const room = roomStore.getRoom(roomId);
  if (!room) {
    console.error(`[setPlayerHeroLockStatus] 房间不存在: ${roomId}`);
    return null;
  }

  const playerIndex = room.players.findIndex(p => p.openId === playerId);
  if (playerIndex === -1) {
    console.error(`[setPlayerHeroLockStatus] 玩家不在房间中: ${playerId}`);
    return null;
  }

  // 如果是锁定操作，检查英雄是否已被其他人锁定
  if (isLocked && heroId) {
    const isHeroTaken = room.players.some((p, index) => 
      index !== playerIndex && p.isHeroLocked && p.selectedHeroId === heroId
    );
    if (isHeroTaken) {
      console.warn(`[setPlayerHeroLockStatus] 英雄 ${heroId} 已被其他玩家锁定，无法选择`);
      return null; // 返回 null 表示操作失败
    }
  }

  // 更新玩家状态
  const updatedPlayers = [...room.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    isHeroLocked: isLocked,
    selectedHeroId: isLocked ? heroId : null // 只有锁定时才记录英雄ID
  };

  // 更新房间信息
  const updatedRoom = {
    ...room,
    players: updatedPlayers,
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`[setPlayerHeroLockStatus] 房间 ${roomId} 中玩家 ${playerId} 的英雄锁定状态设置为: ${isLocked}, 英雄: ${updatedPlayers[playerIndex].selectedHeroId}`);
  
  return updatedRoom; // 返回更新后的房间信息
}

/**
 * 检查指定房间内的所有玩家是否都已准备就绪
 * @param {string} roomId - 房间ID
 * @returns {boolean} 如果所有玩家都准备好则返回 true，否则返回 false
 */
function checkAllPlayersReady(roomId) {
    const room = roomStore.getRoom(roomId);
    if (!room || !room.players) {
        console.warn(`[checkAllPlayersReady] 检查准备状态失败：未找到房间 ${roomId}`);
        return false;
    }

    const players = room.players;
    // 如果房间内没有玩家或只有一个玩家（看游戏逻辑是否允许单人开始），也可能视为未准备好
    if (players.length < 2) { // 通常至少需要2个玩家才能开始
        console.log(`[checkAllPlayersReady] 房间 ${roomId} 玩家数量不足 (${players.length})`);
        return false;
    }

    for (const player of players) {
        // 假设房主不需要显式准备 (或者根据游戏逻辑调整)
        // if (!player.isHost && !player.ready) { 
        if (!player.ready) { // 修改为所有玩家都需要准备
            console.log(`[checkAllPlayersReady] 玩家 ${player.openId} 在房间 ${roomId} 未准备。`);
            return false; // 发现有玩家未准备
        }
    }

    console.log(`[checkAllPlayersReady] 房间 ${roomId} 所有玩家已准备。`);
    return true; // 所有玩家都已准备
}

/**
 * 检查指定房间内的所有玩家是否都已锁定英雄
 * @param {string} roomId - 房间ID
 * @returns {boolean} 如果所有玩家都锁定英雄则返回 true，否则返回 false
 */
function checkAllPlayersLocked(roomId) {
    const room = roomStore.getRoom(roomId);
    if (!room || !room.players) {
        console.warn(`[checkAllPlayersLocked] 检查英雄锁定状态失败：未找到房间 ${roomId}`);
        return false;
    }

    const players = room.players;
    // 如果房间内没有玩家，也视为未锁定完成
    if (players.length === 0) {
        console.log(`[checkAllPlayersLocked] 房间 ${roomId} 没有玩家。`);
        return false;
    }

    for (const player of players) {
        if (!player.isHeroLocked) {
            console.log(`[checkAllPlayersLocked] 玩家 ${player.openId} 在房间 ${roomId} 未锁定英雄。`);
            return false; // 发现有玩家未锁定
        }
    }
    
    console.log(`[checkAllPlayersLocked] 房间 ${roomId} 所有玩家已锁定英雄。`);
    return true; // 所有玩家都已锁定
}

/**
 * 获取指定房间内所有机器人的信息
 * @param {string} roomId - 房间ID
 * @returns {Array<object>} 机器人玩家对象列表 
 */
function getRoomBots(roomId) {
    const room = roomStore.getRoom(roomId);
    if (!room || !room.players) {
        return [];
    }
    return room.players.filter(player => player.isBot);
}

/**
 * 获取指定房间内所有已被锁定的角色ID
 * @param {string} roomId - 房间ID
 * @returns {Set<string>} 已被锁定角色的ID集合
 */
function getLockedCharacters(roomId) {
    const lockedIds = new Set();
    const room = roomStore.getRoom(roomId);
    if (room && room.players) {
        room.players.forEach(player => {
            if (player.isHeroLocked && player.selectedHeroId) {
                lockedIds.add(player.selectedHeroId);
            }
        });
    }
    return lockedIds;
}

/**
 * 获取房间内可用的英雄ID列表
 * @param {string} roomId 房间ID
 * @returns {Array<string>} 可用英雄ID列表
 */
function getAvailableHeroIds(roomId) {
  const room = roomStore.getRoom(roomId);
  if (!room || !room.players) {
    return [...ALL_HERO_IDS]; // 房间不存在或无玩家，返回所有英雄
  }

  // 获取已被选定的英雄ID
  const lockedIds = getLockedCharacters(roomId); // 使用新的 getLockedCharacters

  // 过滤掉已被选定的英雄
  const availableIds = ALL_HERO_IDS.filter(id => !lockedIds.has(id));

  return availableIds;
}

module.exports = {
  createRoom,
  getRoom,
  getAllRooms,
  updateRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  updatePlayerReady,
  closeRoom,
  startGame,
  endGame,
  notifyRoomUpdate,
  notifyAllPlayers,
  getPlayerRoomId,
  setPlayerHeroLockStatus,
  checkAllPlayersReady,
  checkAllPlayersLocked,
  getRoomBots,
  getLockedCharacters,
  getAvailableHeroIds
}; 