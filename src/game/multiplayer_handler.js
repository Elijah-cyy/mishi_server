// mishi_server/src/game/multiplayer_handler.js

// 存储活跃的游戏会话 { sessionId: { mapData: {}, players: {} } }
const activeSessions = {};

// ---> 新增：引入 sessionManager <--- 
const sessionManager = require('../managers/sessionManager'); 

// === [新增] 从 roomLogic.js 复制或改编的地图生成逻辑 ===

// (由于 Node.js 环境没有 import/export, 暂时移除 import/export 并直接定义函数)

// const { directionMap, getOppositeDirection } = require('../utils'); // 假设有 utils
const directionMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

function getOppositeDirection(direction) {
    const oppositeMap = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left'
    };
    return oppositeMap[direction] || '';
}

// 洗牌函数 (Fisher-Yates shuffle)
const shuffle = (array) => {
  let currentIndex = array.length, temporaryValue, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
};

// 根据权重选择随机房间类型
const selectRandomRoomType = function(roomTypes, totalWeight) {
  let random = Math.random() * totalWeight;
  for (const roomType of roomTypes) {
    if (random < roomType.weight) {
      return roomType;
    }
    random -= roomType.weight;
  }
  // Fallback in case of rounding errors
  return roomTypes[roomTypes.length - 1];
};

// 生成随机出口
const generateRandomExits = function(roomType) {
  const maxExits = 3; // 普通房间最多3个出口
  const minExits = 1; // 至少1个出口
  let numExits;

  // 根据房间类型确定出口数量范围
  switch (roomType) {
      case 'hall':
          numExits = 4; // 大厅固定4个出口
          break;
      case 'corridor':
          numExits = Math.floor(Math.random() * (maxExits - minExits + 1)) + minExits; // 走廊1-3个出口
          break;
      case 'exit':
      case 'keyroom': // 钥匙房和出口由外部设定出口
          return []; // 返回空数组，由外部逻辑处理
      default:
          numExits = Math.floor(Math.random() * (maxExits - minExits + 1)) + minExits; // 其他特殊房间1-3个出口
  }

  const allDirections = ['up', 'down', 'left', 'right'];
  return shuffle(allDirections).slice(0, numExits);
};

// 检查房间是否相邻
const areRoomsAdjacent = function(room1, room2) {
  return (
    (Math.abs(room1.x - room2.x) === 1 && room1.y === room2.y) ||
    (Math.abs(room1.y - room2.y) === 1 && room1.x === room2.x)
  );
};

// 获取方向
const getDirection = function(fromRoom, toRoom) {
  if (toRoom.x > fromRoom.x) return 'right';
  if (toRoom.x < fromRoom.x) return 'left';
  if (toRoom.y > fromRoom.y) return 'down';
  if (toRoom.y < fromRoom.y) return 'up';
  return '';
};

// 创建路径
const createPathBetweenRooms = function(startRoom, endRoom, allRooms) {
    const path = [startRoom];
    const visited = new Set([startRoom.id]);
    let currentRoom = startRoom;

    while (currentRoom.id !== endRoom.id) {
        let neighbors = allRooms.filter(room => areRoomsAdjacent(currentRoom, room) && !visited.has(room.id));

        if (neighbors.length === 0) {
            // Backtrack or handle error: No path found
            console.warn(`createPathBetweenRooms: No path found from ${startRoom.id} to ${endRoom.id}`);
            return false; // Indicate failure
        }

        // Simple pathfinding: move towards the target
        neighbors.sort((a, b) => {
            const distA = Math.abs(a.x - endRoom.x) + Math.abs(a.y - endRoom.y);
            const distB = Math.abs(b.x - endRoom.x) + Math.abs(b.y - endRoom.y);
            return distA - distB;
        });

        const nextRoom = neighbors[0];
        const direction = getDirection(currentRoom, nextRoom);
        const oppositeDirection = getOppositeDirection(direction);

        // Add exits if they don't exist
        if (!currentRoom.exits.includes(direction)) {
            currentRoom.exits.push(direction);
        }
        if (!nextRoom.exits.includes(oppositeDirection)) {
            nextRoom.exits.push(oppositeDirection);
        }

        path.push(nextRoom);
        visited.add(nextRoom.id);
        currentRoom = nextRoom;
    }
    return true; // Indicate success
};

// 确保房间连接性
const ensureRoomConnections = function(rooms) {
    const roomGraph = new Map(); // Store connections { roomId: Set(connectedRoomId) }
    const allRoomIds = new Set(rooms.map(r => r.id));
    const visited = new Set();
    const queue = [];

    // Build initial graph based on existing exits
    rooms.forEach(room => {
        if (!roomGraph.has(room.id)) {
            roomGraph.set(room.id, new Set());
        }
        room.exits.forEach(exitDir => {
            const offset = directionMap[exitDir];
            if (!offset) return;
            const neighborX = room.x + offset.x;
            const neighborY = room.y + offset.y;
            const neighbor = rooms.find(r => r.x === neighborX && r.y === neighborY);

            if (neighbor && neighbor.exits.includes(getOppositeDirection(exitDir))) {
                roomGraph.get(room.id).add(neighbor.id);
                if (!roomGraph.has(neighbor.id)) roomGraph.set(neighbor.id, new Set());
                roomGraph.get(neighbor.id).add(room.id);
            }
        });
    });

    // Perform BFS from the center room (id should be 0 if it's the first)
    const startNode = rooms.find(r => r.x === 3 && r.y === 3); // Center room
    if (!startNode) {
        console.error("ensureRoomConnections: Cannot find center room!");
        return; // Cannot proceed without a start node
    }

    queue.push(startNode.id);
    visited.add(startNode.id);

    while (queue.length > 0) {
        const currentId = queue.shift();
        const connections = roomGraph.get(currentId) || new Set();

        connections.forEach(neighborId => {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push(neighborId);
            }
        });
    }

    // Check for unconnected rooms
    const unconnectedRooms = rooms.filter(room => !visited.has(room.id));

    if (unconnectedRooms.length > 0) {
        console.warn(`Found ${unconnectedRooms.length} unconnected rooms. Attempting to connect...`);
        // Attempt to connect each unconnected room to the main component (startNode)
        unconnectedRooms.forEach(unconnectedRoom => {
            // Find the closest connected room (simple distance for now)
            let closestConnectedRoom = startNode;
            let minDistance = Infinity;

            rooms.forEach(connectedRoom => {
                if (visited.has(connectedRoom.id)) {
                    const dist = Math.abs(unconnectedRoom.x - connectedRoom.x) + Math.abs(unconnectedRoom.y - connectedRoom.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestConnectedRoom = connectedRoom;
                    }
                }
            });
            
            console.log(`Connecting room ${unconnectedRoom.id} to ${closestConnectedRoom.id}`);
            // Create a path (this function adds exits)
            createPathBetweenRooms(unconnectedRoom, closestConnectedRoom, rooms);
        });
        // Optionally: Re-run BFS check after connecting to ensure all are now connected
    }
    console.log("ensureRoomConnections: Connection check complete.");
};

// 生成房间布局 (主函数)
const generateRooms = function(gameMode = '竞速模式') {
  try {
    console.log('Backend generateRooms: 开始生成房间，游戏模式:', gameMode);

  const rooms = []; // This will hold the room objects in frontend format
  // 定义房间类型映射及其生成权重
  const roomTypes = [
    {type: 'bedroom', name: '长眠的睡房', weight: 1},
    {type: 'gameroom', name: '任性的游戏室', weight: 1.5},
    {type: 'corridor', name: '普通走廊', weight: 3},
    {type: 'storage', name: '宝藏的杂物间', weight: 1.5}
  ];

  let keyRoomPosition = null;
  if (gameMode === '梦魇模式') {
    roomTypes.forEach(type => type.weight *= 0.9);
    console.log("Backend: 梦魇模式：房间类型设置成功");
  }

  const totalWeight = roomTypes.reduce((sum, type) => sum + type.weight, 0);
  let roomId = 0;

  // 创建中心房间 (3,3)
  const centerRoom = {
    id: roomId++, x: 3, y: 3, type: 'hall', typeName: '大厅',
    isRevealed: true, publiclyRevealed: true, exits: ['up', 'down', 'left', 'right'],
    visited: false, lastVisitRound: 0, hasKey: false, hasTrap: false
  };
  rooms.push(centerRoom);

  // 随机选择出口位置
  const outerPositions = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if ((x === 0 || x === 6 || y === 0 || y === 6) && !(x === 3 && y === 3)) {
        outerPositions.push({x, y});
      }
    }
  }
  const exitPosition = outerPositions[Math.floor(Math.random() * outerPositions.length)];
  const exitExits = [];
  if (exitPosition.x === 0) exitExits.push('right');
  if (exitPosition.x === 6) exitExits.push('left');
  if (exitPosition.y === 0) exitExits.push('down');
  if (exitPosition.y === 6) exitExits.push('up');

  const exitRoom = {
    id: roomId++, x: exitPosition.x, y: exitPosition.y, type: 'exit', typeName: '出口',
    isRevealed: false, publiclyRevealed: false, exits: exitExits,
    visited: false, lastVisitRound: 0, hasKey: false, hasTrap: false,
    isExit: true, isLocked: gameMode === '梦魇模式'
  };
  rooms.push(exitRoom);

  // 梦魇模式下创建钥匙房间
  if (gameMode === '梦魇模式') {
      const innerPositions = [];
      for (let y = 1; y < 6; y++) {
        for (let x = 1; x < 6; x++) {
          if (!(x === 3 && y === 3)) innerPositions.push({x, y});
        }
      }
      const keyPosition = innerPositions[Math.floor(Math.random() * innerPositions.length)];
      keyRoomPosition = keyPosition;
      const keyRoom = {
        id: roomId++, x: keyPosition.x, y: keyPosition.y, type: 'keyroom', typeName: '神秘密室',
        isRevealed: false, publiclyRevealed: false, exits: generateRandomExits('keyroom'), // Let ensure connections handle exits
        visited: false, lastVisitRound: 0, hasKey: true, hasTrap: false
      };
      rooms.push(keyRoom);
    }

    // 生成其他房间
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isCenter = x === 3 && y === 3;
        const isExit = x === exitPosition.x && y === exitPosition.y;
        const isKeyRoom = gameMode === '梦魇模式' && keyRoomPosition && x === keyRoomPosition.x && y === keyRoomPosition.y;

        if (!isCenter && !isExit && !isKeyRoom) {
          let roomTypeInfo = selectRandomRoomType(roomTypes, totalWeight);
          const room = {
            id: roomId++, x: x, y: y, type: roomTypeInfo.type, typeName: roomTypeInfo.name,
            isRevealed: false, publiclyRevealed: false, exits: generateRandomExits(roomTypeInfo.type),
            visited: false, lastVisitRound: 0, hasKey: false,
            hasTrap: gameMode === '梦魇模式' && roomTypeInfo.type === 'corridor' && Math.random() < 0.3
          };
          rooms.push(room);
        }
      }
    }

    ensureRoomConnections(rooms);

    console.log('Backend generateRooms: 房间生成完成，总数:', rooms.length);
    return rooms; // 返回前端格式的 rooms 数组
  } catch (error) {
    console.error('Backend 生成房间时发生错误:', error);
    // 返回包含中心房间的最小地图以避免完全失败
    return [{
      id: 0, x: 3, y: 3, type: 'hall', typeName: '大厅',
      isRevealed: true, publiclyRevealed: true, exits: ['up', 'down', 'left', 'right'],
      visited: false, lastVisitRound: 0, hasKey: false, hasTrap: false
    }];
  }
};

// === 结束复制/改编的地图生成逻辑 ===

/**
 * 创建或加入一个游戏会话
 * @param {string} sessionId - 会话ID
 * @param {string} playerId - 玩家ID
 * @param {string} [gameMode='竞速模式'] - 游戏模式 (可选)
 * @param {string} [characterId=null] - 玩家选择的角色ID (新增)
 * @returns {object} 游戏初始状态，包括 mapData 和 players
 */
function joinSession(sessionId, playerId, gameMode = '竞速模式', characterId = null) { // 添加 characterId 参数
    console.log(`[MultiplayerHandler] joinSession: sessionId=${sessionId}, playerId=${playerId}, gameMode=${gameMode}, characterId=${characterId}`); // 添加日志

    if (!activeSessions[sessionId]) {
        // 创建新会话
        console.log(`[MultiplayerHandler] 创建新会话: ${sessionId}, 模式: ${gameMode}`);
        
        // --- [修改] 调用新的 generateRooms 生成前端格式地图 ---
        const generatedRooms = generateRooms(gameMode); // generates array of room objects
        
        // --- [新增] 将前端 rooms 数组转换回后端 mapData 格式 --- 
        const mapData = {
            width: 7,
            height: 7,
            tiles: Array(7).fill(0).map(() => Array(7).fill(0)), // Initialize 7x7 grid with 0
            spawnPoints: [{ x: 3, y: 3 }] // Fixed spawn point at center
        };
        const typeToTileValueMapping = {
            'hall': 1,
            'bedroom': 2,
            'gameroom': 3,
            'corridor': 4,
            'storage': 5,
            'exit': 6,
            'keyroom': 7
        };
        generatedRooms.forEach(room => {
            if (room.y >= 0 && room.y < 7 && room.x >= 0 && room.x < 7) {
                 const tileValue = typeToTileValueMapping[room.type] || 0; // Default to 0 if type not found
                 mapData.tiles[room.y][room.x] = tileValue;
            }
        });
        // --- 转换结束 ---
        
        activeSessions[sessionId] = {
            sessionId: sessionId,
            gameMode: gameMode,
            mapData: mapData, // 使用转换后的 mapData
            players: {}, // { playerId: { characterId: null, position: {x, y} } }
            currentTurn: null, // 当前回合玩家ID
            round: 1, // 当前回合数
            // Store the generated rooms array for potential later use (e.g., validation)
            _internalRooms: generatedRooms,
            createdAt: Date.now()
        };
    }

    const session = activeSessions[sessionId];

    // 检查玩家是否已在会话中
    if (session.players[playerId]) {
        console.log(`[MultiplayerHandler] 玩家 ${playerId} 已在会话 ${sessionId} 中，返回现有状态。`);
        // --- 确保返回的 players 包含角色ID 和 昵称 --- 
        const playersWithCharIdAndName = {};
        for (const pId in session.players) {
            playersWithCharIdAndName[pId] = {
                ...session.players[pId],
                characterId: session.players[pId].characterId || null, // 确保 characterId 存在
                name: session.players[pId].name || `玩家_${pId.substring(0, 4)}` // 确保 name 存在
            };
        }
        return { mapData: session.mapData, players: playersWithCharIdAndName }; // 返回当前状态
    }

    // 添加新玩家到会话
    console.log(`[MultiplayerHandler] 添加新玩家 ${playerId} 到会话 ${sessionId}`);
    
    // ---> 获取玩家昵称 <--- 
    let nickname = `玩家_${playerId.substring(0, 4)}`; // Default nickname
    try {
        const userSession = sessionManager.getSessionByUserId(playerId); // 尝试获取用户会话
        if (userSession && userSession.nickname) {
            nickname = userSession.nickname;
            console.log(`[MultiplayerHandler] 获取到玩家 ${playerId} 的昵称: ${nickname}`);
        } else {
            console.log(`[MultiplayerHandler] 未能从会话获取玩家 ${playerId} 的昵称，使用默认值。`);
        }
    } catch (error) {
        console.error(`[MultiplayerHandler] 获取玩家 ${playerId} 会话时出错:`, error);
    }
    // ---------------------

    // --- 关键：在这里设置玩家的 characterId 和 name --- 
    session.players[playerId] = {
        id: playerId,
        characterId: characterId, // 使用传入的 characterId
        name: nickname,           // <-- 设置获取到的昵称
        hp: 3, // 初始血量 (可能需要根据角色或模式调整)
        maxHp: 3, // 最大血量
        position: { x: 3, y: 3 }, // 初始位置 (中心)
        items: [],
        buffs: [],
        debuffs: [],
        skills: [], // 可能需要根据角色初始化
        joinTime: Date.now()
        // isHost 状态需要在创建会话或加入时确定，这里暂时缺失
    };

    // 确定当前回合玩家 (例如，第一个加入的玩家)
    if (!session.currentTurn) {
        session.currentTurn = playerId;
    }

     // --- 确保返回的 players 包含角色ID 和 昵称 --- 
    const playersToSend = {};
    for (const pId in session.players) {
        playersToSend[pId] = {
            ...session.players[pId],
            characterId: session.players[pId].characterId || null,
            name: session.players[pId].name || `玩家_${pId.substring(0, 4)}` // 使用玩家对象中的 name
        };
    }

    console.log(`[MultiplayerHandler] joinSession 完成，返回 gameState:`, { mapData: session.mapData, players: playersToSend });
    // 返回完整的初始游戏状态
    return { mapData: session.mapData, players: playersToSend };
}

/**
 * 处理玩家移动
 * @param {string} sessionId - 会话ID
 * @param {string} playerId - 玩家ID
 * @param {object} newPosition - 新位置 {x, y}
 */
function handlePlayerMove(sessionId, playerId, newPosition) {
    if (activeSessions[sessionId] && activeSessions[sessionId].players[playerId]) {
        // TODO: 在这里可以添加服务器端的位置验证逻辑
        // 例如：检查移动是否合法（是否相邻、是否有墙等）
        // 可以使用存储的 _internalRooms 数据进行验证
        
        activeSessions[sessionId].players[playerId].position = newPosition;
        console.log(`Player ${playerId} moved to ${JSON.stringify(newPosition)} in session ${sessionId}`);

        // TODO: 将移动信息广播给会话中的其他玩家 (通过WebSocket)
        // broadcastMove(sessionId, playerId, newPosition);
    } else {
        console.warn(`Invalid move received: session ${sessionId} or player ${playerId} not found.`);
    }
}

/**
 * 玩家离开会话
 * @param {string} sessionId - 会话ID
 * @param {string} playerId - 玩家ID
 */
function leaveSession(sessionId, playerId) {
    if (activeSessions[sessionId] && activeSessions[sessionId].players[playerId]) {
        console.log(`Player ${playerId} leaving session: ${sessionId}`);
        delete activeSessions[sessionId].players[playerId];

        // TODO: 通知其他玩家有玩家离开 (通过WebSocket)

        // 如果会话为空，可以考虑清理会话
        if (Object.keys(activeSessions[sessionId].players).length === 0) {
            console.log(`Session ${sessionId} is empty, removing.`);
            delete activeSessions[sessionId];
        }
    }
}

// --- 移除旧的 generatePlaceholderMap --- 

module.exports = {
    joinSession,
    handlePlayerMove,
    leaveSession,
    activeSessions, // <-- 暴露 activeSessions 以便 wsApp 临时查找
}; 