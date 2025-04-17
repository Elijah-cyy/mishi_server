/**
 * 房间管理器
 * 负责房间的创建、加入、状态更新等操作
 */

const roomStore = require('../storage/memory/roomStore');
const gameStateStore = require('../storage/memory/gameStateStore');
const { generateRoomId } = require('../utils/helpers');
const wsApp = require('../wsApp');

/**
 * 创建新房间
 * @param {Object} options 房间选项
 * @param {string} options.name 房间名称
 * @param {string} options.hostId 房主ID
 * @param {number} options.maxPlayers 最大玩家数
 * @param {number} options.timeLimit 游戏时间限制(秒)
 * @param {string} options.mapId 地图ID
 * @param {Object} options.gameSettings 游戏设置
 * @returns {Object} 创建的房间信息
 */
function createRoom(options) {
  const { name, hostId, maxPlayers = 4, timeLimit = 3600, mapId = 'default', gameSettings = {} } = options;

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
      isHost: true,
      ready: false,
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
 * @returns {Object|null} 成功返回包含房间和玩家信息的对象，失败返回null
 */
function addPlayerToRoom(roomId, playerId, playerData = {}) {
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

  // 检查房间是否已满
  if (room.players.length >= room.maxPlayers) {
    console.log(`房间已满: ${roomId}`);
    return null;
  }

  // 检查玩家是否已在房间中
  const existingPlayerIndex = room.players.findIndex(p => p.openId === playerId);
  if (existingPlayerIndex !== -1) {
    console.log(`玩家已在房间中: ${playerId}`);
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
    joinTime: Date.now(),
    ...playerData
  };

  // 添加玩家到房间
  const updatedRoom = {
    ...room,
    players: [...room.players, player],
    updatedAt: Date.now()
  };

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`玩家加入房间成功: ${playerId} -> ${roomId}`);

  // 通知房间内所有玩家（包括新加入的玩家）
  notifyRoomUpdate(roomId, 'PLAYER_JOINED', {
    playerId,
    player,
    playerCount: updatedRoom.players.length
  });

  return {
    room: updatedRoom,
    player
  };
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
  console.log(`玩家准备状态更新: ${playerId}, ready=${ready}`);

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

  // 检查玩家准备状态（房主除外）
  const allReady = room.players.every(player => 
    player.isHost || player.ready
  );

  if (!allReady) {
    console.log(`有玩家未准备好`);
    return null;
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
    status: 'playing',
    gameStartTime: Date.now(),
    updatedAt: Date.now()
  };

  // 初始化玩家游戏状态
  for (const player of room.players) {
    gameStateStore.updatePlayerState(roomId, player.openId, {
      ready: false,
      position: { x: 0, y: 0 },
      items: [],
      score: 0
    });
  }

  // 保存更新后的房间信息
  roomStore.setRoom(roomId, updatedRoom);
  console.log(`游戏开始: ${roomId}`);

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
    console.log(`通知房间更新失败: 房间不存在 ${roomId}`);
    return;
  }

  // 获取房间内所有玩家ID
  const playerIds = room.players.map(player => player.openId);
  
  // 创建通知消息
  const notifyMessage = {
    type: 'ROOM_UPDATE',
    data: {
      roomId,
      eventType,
      timestamp: Date.now(),
      ...eventData,
      room  // 发送完整的房间信息
    }
  };

  // 通过WebSocket向所有玩家广播
  const sentCount = wsApp.broadcastToClients(playerIds, notifyMessage);
  console.log(`房间更新通知已发送: ${eventType}, 房间: ${roomId}, 接收玩家: ${sentCount}/${playerIds.length}`);
}

/**
 * 向房间所有玩家发送通知
 * @param {string} roomId 房间ID
 * @param {Object} message 消息内容
 * @param {string} excludePlayerId 要排除的玩家ID
 */
function notifyAllPlayers(roomId, message, excludePlayerId = null) {
  const room = roomStore.getRoom(roomId);
  if (!room) {
    console.log(`通知房间玩家失败: 房间不存在 ${roomId}`);
    return;
  }

  // 获取房间内所有玩家ID (排除特定玩家)
  const playerIds = room.players
    .filter(player => player.openId !== excludePlayerId)
    .map(player => player.openId);
  
  if (playerIds.length === 0) {
    return;
  }

  // 通过WebSocket向所有玩家广播
  const sentCount = wsApp.broadcastToClients(playerIds, message);
  console.log(`房间消息已广播: ${message.type}, 房间: ${roomId}, 接收玩家: ${sentCount}/${playerIds.length}`);
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
  notifyAllPlayers
}; 