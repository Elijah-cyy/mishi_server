/**
 * 会话内存存储模块
 * 负责管理所有活跃会话数据
 */

// 存储所有会话
const sessions = new Map();

// 用户ID到令牌的映射，便于查找用户会话
const userIdToToken = new Map();

/**
 * 设置会话
 * @param {string} token 会话令牌
 * @param {Object} sessionData 会话数据
 * @returns {Object} 保存的会话数据
 */
function setSession(token, sessionData) {
  if (!token) {
    throw new Error('会话令牌不能为空');
  }
  
  // 如果是新会话，建立用户ID到令牌的映射
  if (!sessions.has(token) && sessionData.userId) {
    // 移除当前用户的旧会话
    if (userIdToToken.has(sessionData.userId)) {
      removeSession(userIdToToken.get(sessionData.userId));
    }
    
    // 建立新的映射
    userIdToToken.set(sessionData.userId, token);
  }
  
  // 保存会话
  sessions.set(token, sessionData);
  return sessionData;
}

/**
 * 获取会话
 * @param {string} token 会话令牌
 * @returns {Object|null} 会话数据或null
 */
function getSession(token) {
  return sessions.has(token) ? sessions.get(token) : null;
}

/**
 * 根据用户ID获取会话
 * @param {string} userId 用户ID
 * @returns {Object|null} 会话数据或null
 */
function getSessionByUserId(userId) {
  if (!userId || !userIdToToken.has(userId)) {
    return null;
  }
  
  const token = userIdToToken.get(userId);
  return getSession(token);
}

/**
 * 移除会话
 * @param {string} token 会话令牌
 * @returns {boolean} 是否成功移除
 */
function removeSession(token) {
  if (!token || !sessions.has(token)) {
    return false;
  }
  
  // 获取会话
  const session = sessions.get(token);
  
  // 移除用户ID到令牌的映射
  if (session.userId) {
    userIdToToken.delete(session.userId);
  }
  
  // 移除会话
  return sessions.delete(token);
}

/**
 * 移除用户的所有会话
 * @param {string} userId 用户ID
 * @returns {number} 移除的会话数量
 */
function removeSessionsByUserId(userId) {
  if (!userId || !userIdToToken.has(userId)) {
    return 0;
  }
  
  const token = userIdToToken.get(userId);
  const result = removeSession(token);
  
  return result ? 1 : 0;
}

/**
 * 清理过期会话
 * @returns {number} 清理的会话数量
 */
function removeExpiredSessions() {
  const now = Date.now();
  let count = 0;
  
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt && session.expiresAt < now) {
      removeSession(token);
      count++;
    }
  }
  
  return count;
}

/**
 * 获取所有会话
 * @returns {Array} 会话数组
 */
function getAllSessions() {
  return Array.from(sessions.values());
}

/**
 * 获取会话数量
 * @returns {number} 会话数量
 */
function getSessionCount() {
  return sessions.size;
}

/**
 * 清空所有会话
 */
function clearAllSessions() {
  sessions.clear();
  userIdToToken.clear();
}

module.exports = {
  setSession,
  getSession,
  getSessionByUserId,
  removeSession,
  removeSessionsByUserId,
  removeExpiredSessions,
  getAllSessions,
  getSessionCount,
  clearAllSessions
}; 