/**
 * 用户管理器
 * 负责用户数据的创建、更新和查询操作
 */

const userStore = require('../storage/file/userStore');

/**
 * 获取用户信息
 * @param {string} openId 用户ID
 * @returns {Promise<Object|null>} 用户对象或null
 */
async function getUser(openId) {
  if (!openId) {
    return null;
  }
  
  try {
    return await userStore.getUser(openId);
  } catch (error) {
    console.error('获取用户失败:', error);
    return null;
  }
}

/**
 * 保存（创建或更新）用户信息
 * @param {string} openId 用户ID
 * @param {Object} userInfo 用户信息
 * @returns {Promise<Object|null>} 保存后的用户对象或null
 */
async function saveUser(openId, userInfo) {
  if (!openId) {
    throw new Error('用户ID不能为空');
  }
  
  try {
    // 获取现有用户数据（如果存在）
    const existingUser = await userStore.getUser(openId);
    
    // 合并数据并保存
    return await userStore.saveUser(openId, {
      ...(existingUser || {}),
      ...userInfo,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('保存用户失败:', error);
    throw error;
  }
}

/**
 * 删除用户
 * @param {string} openId 用户ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteUser(openId) {
  if (!openId) {
    return false;
  }
  
  try {
    return await userStore.deleteUser(openId);
  } catch (error) {
    console.error('删除用户失败:', error);
    return false;
  }
}

/**
 * 更新用户游戏统计数据
 * @param {string} openId 用户ID
 * @param {Object} gameStats 游戏统计数据
 * @returns {Promise<Object|null>} 更新后的用户对象或null
 */
async function updateUserGameStats(openId, gameStats) {
  if (!openId) {
    return null;
  }
  
  try {
    // 获取现有用户数据
    const userData = await userStore.getUser(openId);
    
    if (!userData) {
      console.error('用户不存在:', openId);
      return null;
    }
    
    // 合并统计数据
    const updatedStats = {
      ...(userData.gameStats || {}),
      ...gameStats,
      lastUpdated: new Date().toISOString()
    };
    
    // 保存更新后的用户数据
    return await userStore.saveUser(openId, {
      ...userData,
      gameStats: updatedStats
    });
  } catch (error) {
    console.error('更新用户游戏统计失败:', error);
    return null;
  }
}

/**
 * 获取所有用户
 * @returns {Promise<Array>} 用户数组
 */
async function getAllUsers() {
  try {
    const users = await userStore.getAllUsers();
    return Object.values(users);
  } catch (error) {
    console.error('获取所有用户失败:', error);
    return [];
  }
}

/**
 * 查找符合条件的用户
 * @param {Function} predicate 过滤函数
 * @returns {Promise<Array>} 符合条件的用户数组
 */
async function findUsers(predicate) {
  try {
    const users = await userStore.getAllUsers();
    return Object.values(users).filter(predicate);
  } catch (error) {
    console.error('查找用户失败:', error);
    return [];
  }
}

module.exports = {
  getUser,
  saveUser,
  deleteUser,
  updateUserGameStats,
  getAllUsers,
  findUsers
}; 