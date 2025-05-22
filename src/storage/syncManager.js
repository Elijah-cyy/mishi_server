/**
 * 数据同步管理器 - 管理内存数据到文件存储的同步
 */
const roomStore = require('./memory/roomStore');
const gameStateStore = require('./memory/gameStateStore');
const userStore = require('./file/userStore');
const gameStore = require('./file/gameStore');
const config = require('../config');

// 上次同步时间
let lastSyncTime = 0;

/**
 * 检查是否需要同步
 * @param {number} now 当前时间戳
 * @returns {boolean} 是否需要同步
 */
function shouldSync(now = Date.now()) {
  return now - lastSyncTime >= config.syncInterval;
}

/**
 * 同步房间数据到游戏历史记录
 * @returns {Promise<void>}
 */
async function syncCompletedRoomsToHistory() {
  try {
    // 获取所有房间
    const allRooms = roomStore.getAllRooms();
    
    // 筛选已结束的房间
    const completedRooms = allRooms.filter(room => room.status === 'ended');
    
    if (completedRooms.length === 0) {
      return;
    }
    
    console.log(`同步已结束房间到历史记录: ${completedRooms.length} 个房间`);
    
    // 加载游戏历史数据
    const historyData = await gameStore.loadGameHistory();
    
    // 遍历已结束的房间
    for (const room of completedRooms) {
      // 检查历史记录中是否已存在该房间
      const existingRecord = historyData.gameHistory.find(record => record.roomId === room.roomId);
      
      if (!existingRecord) {
        // 转换房间数据为历史记录格式
        const gameRecord = {
          roomId: room.roomId,
          gameMode: room.gameMode,
          startTime: room.gameState ? room.gameState.startTime : room.createdAt,
          endTime: room.gameState ? room.gameState.endTime : room.updatedAt,
          players: room.players.map(player => ({
            openId: player.openId,
            nickname: player.nickname,
            score: room.gameState && room.gameState.scores ? 
              room.gameState.scores[player.openId] || 0 : 0
          })),
          winner: determineWinner(room),
          duration: room.gameState ? room.gameState.duration : null
        };
        
        // 添加到历史记录
        historyData.gameHistory.push(gameRecord);
        
        // 删除内存中的房间数据
        roomStore.deleteRoom(room.roomId);
      }
    }
    
    // 保存更新后的历史数据
    await gameStore.saveGameHistory(historyData);
    
    console.log(`同步已结束房间完成: ${completedRooms.length} 个房间已写入历史记录`);
  } catch (error) {
    console.error('同步已结束房间到历史记录失败:', error);
  }
}

/**
 * 确定游戏胜利者
 * @param {Object} room 房间对象
 * @returns {string|null} 胜利者ID或null
 */
function determineWinner(room) {
  if (!room.gameState || !room.gameState.scores) {
    return null;
  }
  
  // 获取所有玩家分数
  const scores = room.gameState.scores;
  const playerIds = Object.keys(scores);
  
  if (playerIds.length === 0) {
    return null;
  }
  
  // 找出最高分玩家
  let winnerId = playerIds[0];
  let highestScore = scores[winnerId];
  
  for (let i = 1; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    const score = scores[playerId];
    
    if (score > highestScore) {
      winnerId = playerId;
      highestScore = score;
    }
  }
  
  return winnerId;
}

/**
 * 更新用户游戏统计数据
 * @returns {Promise<void>}
 */
async function syncPlayerStats() {
  try {
    // 获取最近同步的游戏历史
    const historyData = await gameStore.loadGameHistory();
    const recentGames = historyData.gameHistory
      .filter(game => new Date(game.endTime) > new Date(lastSyncTime));
    
    if (recentGames.length === 0) {
      return;
    }
    
    console.log(`更新玩家游戏统计: 处理 ${recentGames.length} 场最近结束的游戏`);
    
    // 获取需要更新的玩家ID列表
    const playerIds = new Set();
    recentGames.forEach(game => {
      game.players.forEach(player => playerIds.add(player.openId));
    });
    
    // 加载用户数据
    const userData = await userStore.loadUsers();
    
    // 更新每个玩家的统计数据
    for (const playerId of playerIds) {
      // 获取玩家的游戏记录
      const playerGames = recentGames.filter(game => 
        game.players.some(player => player.openId === playerId)
      );
      
      // 计算统计数据
      const wins = playerGames.filter(game => game.winner === playerId).length;
      const totalGames = playerGames.length;
      const highScoreGame = playerGames.reduce((highest, game) => {
        const playerScore = game.players.find(p => p.openId === playerId)?.score || 0;
        return playerScore > highest.score ? { score: playerScore, game } : highest;
      }, { score: 0, game: null });
      
      // 确保用户存在
      if (!userData.users[playerId]) {
        userData.users[playerId] = {
          openId: playerId,
          createdAt: new Date().toISOString(),
          gameStats: {}
        };
      }
      
      // 确保gameStats对象存在
      if (!userData.users[playerId].gameStats) {
        userData.users[playerId].gameStats = {};
      }
      
      // 更新统计数据
      const stats = userData.users[playerId].gameStats;
      
      userData.users[playerId].gameStats = {
        highScore: Math.max(stats.highScore || 0, highScoreGame.score),
        totalGames: (stats.totalGames || 0) + totalGames,
        wins: (stats.wins || 0) + wins,
        lastPlayed: new Date().toISOString()
      };
    }
    
    // 保存更新后的用户数据
    await userStore.saveUsers(userData);
    
    console.log(`更新玩家游戏统计完成: ${playerIds.size} 名玩家数据已更新`);
  } catch (error) {
    console.error('更新玩家游戏统计失败:', error);
  }
}

/**
 * 清理过期数据
 * @returns {Promise<void>}
 */
async function cleanupExpiredData() {
  try {
    // 清理过期房间
    const roomsCleanCount = roomStore.cleanupExpiredRooms();
    
    // 清理过期游戏状态
    const gamesCleanCount = gameStateStore.cleanupCompletedGames();
    
    if (roomsCleanCount > 0 || gamesCleanCount > 0) {
      console.log(`清理过期数据: ${roomsCleanCount} 个房间, ${gamesCleanCount} 个游戏状态`);
    }
  } catch (error) {
    console.error('清理过期数据失败:', error);
  }
}

/**
 * 执行完整同步
 * @param {boolean} force 是否强制同步
 * @returns {Promise<void>}
 */
async function syncAll(force = false) {
  const now = Date.now();
  
  // 检查是否需要同步
  if (!force && !shouldSync(now)) {
    return;
  }
  
  // 仅在强制同步或非开发环境下打印日志
  if (force || process.env.NODE_ENV !== 'development') {
    console.log('开始数据同步...');
  }
  
  try {
    // 同步已结束的房间到历史记录
    await syncCompletedRoomsToHistory();
    
    // 更新玩家游戏统计数据
    await syncPlayerStats();
    
    // 清理过期数据
    await cleanupExpiredData();
    
    // 更新最后同步时间
    lastSyncTime = now;
    
    // 仅在强制同步或非开发环境下打印日志
    if (force || process.env.NODE_ENV !== 'development') {
      console.log('数据同步完成');
    }
  } catch (error) {
    console.error('数据同步失败:', error);
  }
}

/**
 * 启动定期同步
 */
function startPeriodicSync() {
  // 设置定期同步间隔
  setInterval(() => {
    syncAll();
  }, config.syncInterval);
  
  console.log(`启动定期数据同步, 间隔: ${config.syncInterval / 1000} 秒`);
}

module.exports = {
  syncAll,
  startPeriodicSync,
  syncCompletedRoomsToHistory,
  syncPlayerStats,
  cleanupExpiredData
}; 