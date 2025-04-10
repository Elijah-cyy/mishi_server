/**
 * 游戏管理器 - 处理游戏逻辑和状态更新
 */
const gameStateStore = require('../storage/memory/gameStateStore');
const roomManager = require('./roomManager');
const { generateId } = require('../utils/helpers');

/**
 * 获取游戏状态
 * @param {string} roomId 房间ID
 * @returns {Object|null} 游戏状态或null
 */
function getGameState(roomId) {
  return gameStateStore.getGameState(roomId);
}

/**
 * 更新玩家位置
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} position 玩家位置
 * @param {string} direction 玩家方向
 * @returns {boolean} 是否成功更新
 */
function updatePlayerPosition(roomId, playerId, position, direction = 'right') {
  // 检查参数合法性
  if (!roomId || !playerId || !position || !position.x || !position.y) {
    console.log(`更新位置参数错误: roomId=${roomId}, playerId=${playerId}, position=`, position);
    return false;
  }
  
  // 更新玩家状态
  const updated = gameStateStore.updatePlayerState(roomId, playerId, {
    position,
    direction,
    lastUpdateTime: Date.now()
  });
  
  // 广播位置更新
  if (updated) {
    roomManager.broadcastGameAction(roomId, playerId, 'move', {
      position,
      direction
    });
    
    // 检查是否达到了游戏终点或触发了其他逻辑
    checkPositionTriggers(roomId, playerId, position);
  }
  
  return updated;
}

/**
 * 检查位置是否触发特殊逻辑
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} position 玩家位置
 * @private
 */
function checkPositionTriggers(roomId, playerId, position) {
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return;
  
  // 检查是否到达终点
  if (gameState.mapData.finish) {
    const finish = gameState.mapData.finish;
    const distance = Math.sqrt(
      Math.pow(position.x - finish.x, 2) + 
      Math.pow(position.y - finish.y, 2)
    );
    
    // 如果玩家接近终点，视为到达终点
    if (distance < 30) {
      handlePlayerReachedFinish(roomId, playerId);
      return;
    }
  }
  
  // 检查是否接近物品
  if (gameState.itemStates && gameState.itemStates.length > 0) {
    for (const item of gameState.itemStates) {
      // 跳过已收集的物品
      if (item.collected) continue;
      
      const distance = Math.sqrt(
        Math.pow(position.x - item.position.x, 2) + 
        Math.pow(position.y - item.position.y, 2)
      );
      
      // 如果玩家接近物品，触发收集
      if (distance < 50) {
        handleItemCollection(roomId, playerId, item.id);
        break;
      }
    }
  }
}

/**
 * 处理玩家到达终点
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @private
 */
function handlePlayerReachedFinish(roomId, playerId) {
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return;
  
  // 判断该玩家是否已经完成
  if (gameState.playerStates[playerId].status === 'finished') {
    return;
  }
  
  // 记录完成时间
  const finishTime = Date.now();
  const startTime = gameState.startTime || 0;
  const timeUsed = finishTime - startTime;
  
  // 更新玩家状态
  gameStateStore.updatePlayerState(roomId, playerId, {
    status: 'finished',
    finishTime,
    timeUsed
  });
  
  // 计算分数，时间越短分数越高
  let score = Math.max(1000 - Math.floor(timeUsed / 100), 100);
  
  // 检查是否是第一个完成的玩家
  const finishedPlayers = Object.values(gameState.playerStates).filter(p => p.status === 'finished');
  if (finishedPlayers.length === 1) {
    // 第一名奖励
    score += 500;
  } else if (finishedPlayers.length === 2) {
    // 第二名奖励
    score += 300;
  } else if (finishedPlayers.length === 3) {
    // 第三名奖励
    score += 100;
  }
  
  // 更新分数
  gameStateStore.updateScore(roomId, playerId, score);
  
  // 广播玩家完成事件
  roomManager.notifyAllPlayers(roomId, {
    type: 'PLAYER_FINISHED',
    data: {
      roomId,
      playerId,
      finishTime,
      timeUsed,
      score
    }
  });
  
  // 检查游戏是否结束
  checkGameCompletion(roomId);
}

/**
 * 处理物品收集
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {string} itemId 物品ID
 * @private
 */
function handleItemCollection(roomId, playerId, itemId) {
  // 更新物品状态
  const updated = gameStateStore.updateItemState(roomId, itemId, {
    collected: true,
    collectedBy: playerId,
    collectedAt: Date.now()
  });
  
  if (!updated) return;
  
  // 获取游戏状态
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return;
  
  // 找到物品信息
  const item = gameState.itemStates.find(i => i.id === itemId);
  if (!item) return;
  
  // 更新玩家物品列表
  const playerState = gameState.playerStates[playerId];
  if (playerState) {
    const playerItems = [...(playerState.items || [])];
    playerItems.push(itemId);
    
    gameStateStore.updatePlayerState(roomId, playerId, {
      items: playerItems
    });
  }
  
  // 根据物品类型给予分数
  let scoreBonus = 50; // 默认分数
  
  switch (item.type) {
    case 'key':
      scoreBonus = 100;
      break;
    case 'treasure':
      scoreBonus = 200;
      break;
    case 'powerup':
      scoreBonus = 150;
      break;
  }
  
  // 更新分数
  gameStateStore.updateScore(roomId, playerId, scoreBonus);
  
  // 广播收集事件
  roomManager.broadcastGameAction(roomId, playerId, 'collect_item', {
    itemId,
    itemType: item.type,
    scoreBonus
  });
  
  // 检查是否收集了所有物品（针对特定游戏模式）
  checkItemsCompletion(roomId);
}

/**
 * 使用物品
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {string} itemId 物品ID
 * @param {Object} targetData 目标数据
 * @returns {boolean} 是否成功使用
 */
function useItem(roomId, playerId, itemId, targetData = {}) {
  // 获取游戏状态
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return false;
  
  // 检查玩家是否有此物品
  const playerState = gameState.playerStates[playerId];
  if (!playerState || !playerState.items || !playerState.items.includes(itemId)) {
    console.log(`使用物品失败: 玩家 ${playerId} 没有物品 ${itemId}`);
    return false;
  }
  
  // 获取物品信息
  const item = gameState.itemStates.find(i => i.id === itemId);
  if (!item) return false;
  
  // 根据物品类型处理不同效果
  let effect = null;
  
  switch (item.type) {
    case 'key':
      // 开门效果
      effect = handleKeyUsage(roomId, playerId, item, targetData);
      break;
      
    case 'powerup':
      // 增益效果
      effect = handlePowerupUsage(roomId, playerId, item);
      break;
      
    case 'tool':
      // 工具效果
      effect = handleToolUsage(roomId, playerId, item, targetData);
      break;
  }
  
  if (!effect) {
    console.log(`使用物品失败: 无法处理物品类型 ${item.type}`);
    return false;
  }
  
  // 从玩家物品栏中移除物品（如果是一次性物品）
  if (effect.consumable !== false) {
    const updatedItems = playerState.items.filter(id => id !== itemId);
    gameStateStore.updatePlayerState(roomId, playerId, {
      items: updatedItems
    });
  }
  
  // 广播物品使用事件
  roomManager.broadcastGameAction(roomId, playerId, 'use_item', {
    itemId,
    itemType: item.type,
    effect: effect.type,
    targetData
  });
  
  return true;
}

/**
 * 处理钥匙使用
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} item 物品信息
 * @param {Object} targetData 目标数据
 * @returns {Object|null} 效果对象或null
 * @private
 */
function handleKeyUsage(roomId, playerId, item, targetData) {
  if (!targetData.doorId) {
    console.log(`使用钥匙失败: 未指定门ID`);
    return null;
  }
  
  // 更新地图状态，开启指定的门
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState || !gameState.mapData.doors) return null;
  
  const door = gameState.mapData.doors.find(d => d.id === targetData.doorId);
  if (!door) {
    console.log(`使用钥匙失败: 找不到门 ${targetData.doorId}`);
    return null;
  }
  
  // 检查钥匙是否匹配
  if (door.keyType && item.keyType && door.keyType !== item.keyType) {
    console.log(`使用钥匙失败: 钥匙类型不匹配，门需要 ${door.keyType}，但使用了 ${item.keyType}`);
    return null;
  }
  
  // 更新门状态
  const doors = [...gameState.mapData.doors];
  const doorIndex = doors.findIndex(d => d.id === targetData.doorId);
  if (doorIndex >= 0) {
    doors[doorIndex] = { ...door, locked: false, openedBy: playerId };
    
    gameStateStore.updateMapData(roomId, {
      doors
    });
    
    // 给予玩家开门奖励分数
    gameStateStore.updateScore(roomId, playerId, 50);
    
    return { type: 'unlock_door', consumable: true };
  }
  
  return null;
}

/**
 * 处理增益道具使用
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} item 物品信息
 * @returns {Object|null} 效果对象或null
 * @private
 */
function handlePowerupUsage(roomId, playerId, item) {
  // 获取增益类型
  const powerupType = item.powerupType || 'speed';
  
  // 应用增益效果
  let effect = null;
  
  switch (powerupType) {
    case 'speed':
      // 速度提升
      gameStateStore.updatePlayerState(roomId, playerId, {
        speedBoost: {
          active: true,
          factor: 1.5,
          expiresAt: Date.now() + 10000 // 10秒
        }
      });
      effect = { type: 'speed_boost', consumable: true };
      break;
      
    case 'vision':
      // 视野提升
      gameStateStore.updatePlayerState(roomId, playerId, {
        visionBoost: {
          active: true,
          factor: 2,
          expiresAt: Date.now() + 15000 // 15秒
        }
      });
      effect = { type: 'vision_boost', consumable: true };
      break;
      
    case 'shield':
      // 护盾效果
      gameStateStore.updatePlayerState(roomId, playerId, {
        shield: {
          active: true,
          durability: 100,
          expiresAt: Date.now() + 20000 // 20秒
        }
      });
      effect = { type: 'shield', consumable: true };
      break;
  }
  
  return effect;
}

/**
 * 处理工具道具使用
 * @param {string} roomId 房间ID
 * @param {string} playerId 玩家ID
 * @param {Object} item 物品信息
 * @param {Object} targetData 目标数据
 * @returns {Object|null} 效果对象或null
 * @private
 */
function handleToolUsage(roomId, playerId, item, targetData) {
  // 获取工具类型
  const toolType = item.toolType || 'flashlight';
  
  // 应用工具效果
  let effect = null;
  
  switch (toolType) {
    case 'flashlight':
      // 手电筒效果
      effect = { 
        type: 'illuminate', 
        consumable: false, 
        duration: 5000 // 持续照射5秒
      };
      break;
      
    case 'map':
      // 地图效果，显示部分区域
      gameStateStore.updatePlayerState(roomId, playerId, {
        revealedAreas: [...(gameState.playerStates[playerId].revealedAreas || []), targetData.areaId]
      });
      effect = { type: 'reveal_area', consumable: false };
      break;
      
    case 'detector':
      // 探测器效果，可以探测附近物品
      effect = { type: 'detect_items', consumable: false, radius: 150 };
      break;
  }
  
  return effect;
}

/**
 * 检查物品收集完成状态
 * @param {string} roomId 房间ID
 * @private
 */
function checkItemsCompletion(roomId) {
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return;
  
  // 检查是否有必须收集的物品，以及是否全部收集
  const requiredItems = gameState.itemStates.filter(item => item.required);
  if (requiredItems.length === 0) return;
  
  const allCollected = requiredItems.every(item => item.collected);
  if (!allCollected) return;
  
  // 所有必要物品已收集，通知玩家并可能解锁出口
  roomManager.notifyAllPlayers(roomId, {
    type: 'ALL_REQUIRED_ITEMS_COLLECTED',
    data: {
      roomId,
      unlockedExit: true
    }
  });
  
  // 更新地图状态，解锁出口
  if (gameState.mapData.exit) {
    const exit = { ...gameState.mapData.exit, locked: false };
    gameStateStore.updateMapData(roomId, { exit });
  }
}

/**
 * 检查游戏完成状态
 * @param {string} roomId 房间ID
 * @private
 */
function checkGameCompletion(roomId) {
  const gameState = gameStateStore.getGameState(roomId);
  if (!gameState) return;
  
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  
  let gameCompleted = false;
  let winner = null;
  
  // 根据游戏模式检查完成条件
  switch (room.gameMode) {
    case 'racing':
      // 竞速模式：检查是否所有玩家都完成或达到时间限制
      const allFinished = Object.values(gameState.playerStates).every(p => p.status === 'finished');
      const timeLimit = gameState.startTime + (gameState.timeLimit || 300000); // 默认5分钟
      
      if (allFinished || Date.now() > timeLimit) {
        gameCompleted = true;
        
        // 找出完成时间最短的玩家
        const finishedPlayers = Object.entries(gameState.playerStates)
          .filter(([_, p]) => p.status === 'finished')
          .sort((a, b) => a[1].timeUsed - b[1].timeUsed);
        
        if (finishedPlayers.length > 0) {
          winner = finishedPlayers[0][0]; // 获取ID
        }
      }
      break;
      
    case 'nightmare':
      // 恐怖模式：检查玩家是否达到出口
      const playerAtExit = Object.entries(gameState.playerStates).find(([id, p]) => {
        if (!gameState.mapData.exit || !p.position) return false;
        
        const distance = Math.sqrt(
          Math.pow(p.position.x - gameState.mapData.exit.position.x, 2) + 
          Math.pow(p.position.y - gameState.mapData.exit.position.y, 2)
        );
        
        return distance < 30 && (!gameState.mapData.exit.locked);
      });
      
      if (playerAtExit) {
        gameCompleted = true;
        winner = playerAtExit[0]; // 获取ID
      }
      break;
      
    case 'imposter':
      // 冒名者模式：检查是否只剩一名玩家
      const activePlayers = Object.values(gameState.playerStates).filter(p => p.status === 'active');
      
      if (activePlayers.length <= 1) {
        gameCompleted = true;
        
        if (activePlayers.length === 1) {
          // 找出剩余的玩家
          const lastPlayer = Object.entries(gameState.playerStates).find(([_, p]) => p.status === 'active');
          if (lastPlayer) {
            winner = lastPlayer[0]; // 获取ID
          }
        }
      }
      break;
  }
  
  // 如果游戏完成，结束游戏
  if (gameCompleted) {
    endGame(roomId, { winner });
  }
}

/**
 * 结束游戏
 * @param {string} roomId 房间ID
 * @param {Object} finalState 最终状态
 * @returns {Object|null} 更新后的房间或null
 */
function endGame(roomId, finalState = {}) {
  return roomManager.endGame(roomId, finalState);
}

/**
 * 更新游戏状态
 * @param {string} roomId 房间ID
 * @param {Object} updates 更新内容
 * @returns {Object|null} 更新后的游戏状态或null
 */
function updateGameState(roomId, updates) {
  return gameStateStore.updateGameState(roomId, updates);
}

/**
 * 删除游戏状态
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否成功删除
 */
function deleteGameState(roomId) {
  return gameStateStore.deleteGameState(roomId);
}

module.exports = {
  getGameState,
  updatePlayerPosition,
  useItem,
  endGame,
  updateGameState,
  deleteGameState
}; 