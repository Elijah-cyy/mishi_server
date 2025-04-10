/**
 * 游戏文件存储 - 管理游戏数据的文件存储
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { safeParseJSON } = require('../../utils/helpers');

// 游戏历史数据文件路径
const GAME_HISTORY_PATH = path.resolve(config.storage.gameHistoryPath);
// 游戏配置文件路径
const GAME_CONFIG_PATH = path.resolve(config.storage.gameConfigPath);
// 游戏数据目录
const GAME_DIR = path.dirname(GAME_HISTORY_PATH);

// 游戏数据缓存
let gameHistoryCache = null;
let gameConfigCache = null;
// 上次加载时间
let lastHistoryLoadTime = 0;
let lastConfigLoadTime = 0;
// 缓存有效期（毫秒）
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 确保目录存在
 */
async function ensureDir() {
  try {
    await fs.access(GAME_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(GAME_DIR, { recursive: true });
      console.log(`创建目录: ${GAME_DIR}`);
    } else {
      throw error;
    }
  }
}

/**
 * 确保游戏历史数据文件存在
 */
async function ensureHistoryFile() {
  try {
    await fs.access(GAME_HISTORY_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(GAME_HISTORY_PATH, JSON.stringify({
        gameHistory: [],
        lastUpdated: new Date().toISOString()
      }));
      console.log(`创建文件: ${GAME_HISTORY_PATH}`);
    } else {
      throw error;
    }
  }
}

/**
 * 确保游戏配置文件存在
 */
async function ensureConfigFile() {
  try {
    await fs.access(GAME_CONFIG_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultConfig = {
        version: '1.0.0',
        levels: [
          {
            id: 1,
            name: '第一关',
            difficulty: 'easy'
          }
        ],
        items: [
          {
            id: 'shield',
            name: '护盾',
            description: '提供临时无敌效果'
          }
        ],
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(GAME_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      console.log(`创建文件: ${GAME_CONFIG_PATH}`);
    } else {
      throw error;
    }
  }
}

/**
 * 加载游戏历史数据
 * @param {boolean} forceRefresh 是否强制刷新缓存
 * @returns {Promise<Object>} 游戏历史数据对象
 */
async function loadGameHistory(forceRefresh = false) {
  // 如果缓存有效且不强制刷新，则返回缓存数据
  const now = Date.now();
  if (gameHistoryCache && (now - lastHistoryLoadTime < CACHE_TTL) && !forceRefresh) {
    return gameHistoryCache;
  }
  
  try {
    // 确保目录和文件存在
    await ensureDir();
    await ensureHistoryFile();
    
    // 读取文件
    const data = await fs.readFile(GAME_HISTORY_PATH, 'utf8');
    
    // 解析JSON
    const historyData = safeParseJSON(data, { gameHistory: [], lastUpdated: new Date().toISOString() });
    
    // 更新缓存
    gameHistoryCache = historyData;
    lastHistoryLoadTime = now;
    
    return historyData;
  } catch (error) {
    console.error('加载游戏历史数据失败:', error);
    // 如果无法加载，使用空数据
    return { gameHistory: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * 保存游戏历史数据
 * @param {Object} historyData 游戏历史数据对象
 * @returns {Promise<void>}
 */
async function saveGameHistory(historyData) {
  try {
    // 确保目录存在
    await ensureDir();
    
    // 更新最后修改时间
    historyData.lastUpdated = new Date().toISOString();
    
    // 写入文件
    await fs.writeFile(GAME_HISTORY_PATH, JSON.stringify(historyData, null, 2));
    
    // 更新缓存
    gameHistoryCache = historyData;
    lastHistoryLoadTime = Date.now();
    
    console.log('游戏历史数据已保存');
  } catch (error) {
    console.error('保存游戏历史数据失败:', error);
    throw error;
  }
}

/**
 * 加载游戏配置
 * @param {boolean} forceRefresh 是否强制刷新缓存
 * @returns {Promise<Object>} 游戏配置对象
 */
async function loadGameConfig(forceRefresh = false) {
  // 如果缓存有效且不强制刷新，则返回缓存数据
  const now = Date.now();
  if (gameConfigCache && (now - lastConfigLoadTime < CACHE_TTL) && !forceRefresh) {
    return gameConfigCache;
  }
  
  try {
    // 确保目录和文件存在
    await ensureDir();
    await ensureConfigFile();
    
    // 读取文件
    const data = await fs.readFile(GAME_CONFIG_PATH, 'utf8');
    
    // 解析JSON
    const configData = safeParseJSON(data, {
      version: '1.0.0',
      levels: [],
      items: [],
      lastUpdated: new Date().toISOString()
    });
    
    // 更新缓存
    gameConfigCache = configData;
    lastConfigLoadTime = now;
    
    return configData;
  } catch (error) {
    console.error('加载游戏配置失败:', error);
    // 如果无法加载，使用默认配置
    return {
      version: '1.0.0',
      levels: [],
      items: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * 保存游戏配置
 * @param {Object} configData 游戏配置对象
 * @returns {Promise<void>}
 */
async function saveGameConfig(configData) {
  try {
    // 确保目录存在
    await ensureDir();
    
    // 更新最后修改时间
    configData.lastUpdated = new Date().toISOString();
    
    // 写入文件
    await fs.writeFile(GAME_CONFIG_PATH, JSON.stringify(configData, null, 2));
    
    // 更新缓存
    gameConfigCache = configData;
    lastConfigLoadTime = Date.now();
    
    console.log('游戏配置已保存');
  } catch (error) {
    console.error('保存游戏配置失败:', error);
    throw error;
  }
}

/**
 * 获取游戏历史记录
 * @param {number} limit 限制返回的记录数
 * @param {number} offset 跳过的记录数
 * @returns {Promise<Array>} 游戏历史记录数组
 */
async function getGameHistory(limit = 100, offset = 0) {
  const historyData = await loadGameHistory();
  
  return historyData.gameHistory
    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime)) // 按结束时间降序排序
    .slice(offset, offset + limit);
}

/**
 * 获取用户游戏历史
 * @param {string} openId 用户ID
 * @param {number} limit 限制返回的记录数
 * @returns {Promise<Array>} 用户游戏历史记录数组
 */
async function getUserGameHistory(openId, limit = 10) {
  const historyData = await loadGameHistory();
  
  return historyData.gameHistory
    .filter(game => game.players.some(player => player.openId === openId))
    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime)) // 按结束时间降序排序
    .slice(0, limit);
}

/**
 * 添加游戏历史记录
 * @param {Object} gameRecord 游戏记录对象
 * @returns {Promise<Object>} 添加的游戏记录
 */
async function addGameRecord(gameRecord) {
  const historyData = await loadGameHistory();
  
  // 添加记录ID和时间戳
  const record = {
    ...gameRecord,
    recordId: `game_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString()
  };
  
  // 添加到历史记录
  historyData.gameHistory.push(record);
  
  // 保存数据
  await saveGameHistory(historyData);
  
  return record;
}

/**
 * 获取游戏配置
 * @returns {Promise<Object>} 游戏配置对象
 */
async function getGameConfig() {
  return loadGameConfig();
}

/**
 * 更新游戏配置
 * @param {Object} configUpdates 要更新的配置
 * @returns {Promise<Object>} 更新后的游戏配置
 */
async function updateGameConfig(configUpdates) {
  const configData = await loadGameConfig();
  
  // 合并配置更新
  const updatedConfig = {
    ...configData,
    ...configUpdates,
    // 保持version属性
    version: configUpdates.version || configData.version
  };
  
  // 保存更新后的配置
  await saveGameConfig(updatedConfig);
  
  return updatedConfig;
}

module.exports = {
  loadGameHistory,
  saveGameHistory,
  loadGameConfig,
  saveGameConfig,
  getGameHistory,
  getUserGameHistory,
  addGameRecord,
  getGameConfig,
  updateGameConfig
}; 