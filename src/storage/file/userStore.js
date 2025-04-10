/**
 * 用户文件存储 - 管理用户数据的文件存储
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { safeParseJSON } = require('../../utils/helpers');

// 用户数据文件路径
const USER_DATA_PATH = path.resolve(config.storage.userDataPath);
// 用户数据目录
const USER_DIR = path.dirname(USER_DATA_PATH);

// 用户数据缓存
let usersCache = null;
// 上次加载时间
let lastLoadTime = 0;
// 缓存有效期（毫秒）
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 确保目录存在
 */
async function ensureDir() {
  try {
    await fs.access(USER_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(USER_DIR, { recursive: true });
      console.log(`创建目录: ${USER_DIR}`);
    } else {
      throw error;
    }
  }
}

/**
 * 确保用户数据文件存在
 */
async function ensureFile() {
  try {
    await fs.access(USER_DATA_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(USER_DATA_PATH, JSON.stringify({
        users: {},
        lastUpdated: new Date().toISOString()
      }));
      console.log(`创建文件: ${USER_DATA_PATH}`);
    } else {
      throw error;
    }
  }
}

/**
 * 加载用户数据
 * @param {boolean} forceRefresh 是否强制刷新缓存
 * @returns {Promise<Object>} 用户数据对象
 */
async function loadUsers(forceRefresh = false) {
  // 如果缓存有效且不强制刷新，则返回缓存数据
  const now = Date.now();
  if (usersCache && (now - lastLoadTime < CACHE_TTL) && !forceRefresh) {
    return usersCache;
  }
  
  try {
    // 确保目录和文件存在
    await ensureDir();
    await ensureFile();
    
    // 读取文件
    const data = await fs.readFile(USER_DATA_PATH, 'utf8');
    
    // 解析JSON
    const userData = safeParseJSON(data, { users: {}, lastUpdated: new Date().toISOString() });
    
    // 更新缓存
    usersCache = userData;
    lastLoadTime = now;
    
    return userData;
  } catch (error) {
    console.error('加载用户数据失败:', error);
    // 如果无法加载，使用空数据
    return { users: {}, lastUpdated: new Date().toISOString() };
  }
}

/**
 * 保存用户数据
 * @param {Object} userData 用户数据对象
 * @returns {Promise<void>}
 */
async function saveUsers(userData) {
  try {
    // 确保目录存在
    await ensureDir();
    
    // 更新最后修改时间
    userData.lastUpdated = new Date().toISOString();
    
    // 写入文件
    await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
    
    // 更新缓存
    usersCache = userData;
    lastLoadTime = Date.now();
    
    console.log('用户数据已保存');
  } catch (error) {
    console.error('保存用户数据失败:', error);
    throw error;
  }
}

/**
 * 获取所有用户
 * @returns {Promise<Object>} 所有用户对象 {openId: userObject}
 */
async function getAllUsers() {
  const userData = await loadUsers();
  return userData.users;
}

/**
 * 获取单个用户
 * @param {string} openId 用户ID
 * @returns {Promise<Object|null>} 用户对象或null
 */
async function getUser(openId) {
  const userData = await loadUsers();
  return userData.users[openId] || null;
}

/**
 * 创建或更新用户
 * @param {string} openId 用户ID
 * @param {Object} userInfo 用户信息
 * @returns {Promise<Object>} 更新后的用户对象
 */
async function saveUser(openId, userInfo) {
  const userData = await loadUsers();
  
  // 如果用户已存在，合并数据
  if (userData.users[openId]) {
    userData.users[openId] = {
      ...userData.users[openId],
      ...userInfo,
      updatedAt: new Date().toISOString()
    };
  } else {
    // 创建新用户
    userData.users[openId] = {
      openId,
      ...userInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  // 保存数据
  await saveUsers(userData);
  
  return userData.users[openId];
}

/**
 * 删除用户
 * @param {string} openId 用户ID
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteUser(openId) {
  const userData = await loadUsers();
  
  // 检查用户是否存在
  if (!userData.users[openId]) {
    return false;
  }
  
  // 删除用户
  delete userData.users[openId];
  
  // 保存数据
  await saveUsers(userData);
  
  return true;
}

module.exports = {
  loadUsers,
  saveUsers,
  getAllUsers,
  getUser,
  saveUser,
  deleteUser
}; 