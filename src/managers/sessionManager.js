/**
 * 会话管理器
 * 负责管理用户会话状态
 */

const crypto = require('crypto');
const sessionStore = require('../storage/memory/sessionStore');
const { extractUserIdFromToken } = require('../utils/helpers');

/**
 * 创建会话
 * @param {string} userId 用户ID
 * @param {Object} userData 用户数据
 * @param {Object} options 选项
 * @param {number} options.expiresIn 过期时间(毫秒)，默认为24小时
 * @returns {string} 会话令牌
 */
function createSession(userId, userData = {}, options = {}) {
  if (!userId) {
    throw new Error('用户ID不能为空');
  }

  // 设置默认过期时间：24小时
  const expiresIn = options.expiresIn || 24 * 60 * 60 * 1000;
  
  // 生成随机令牌
  const randomPart = crypto.randomBytes(16).toString('hex');
  const token = `${userId}-${randomPart}`;
  
  // 创建会话对象
  const session = {
    token,
    userId,
    userData,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresIn,
    lastAccessedAt: Date.now()
  };
  
  // 存储会话
  sessionStore.setSession(token, session);
  
  return token;
}

/**
 * 验证会话
 * @param {string} token 会话令牌
 * @returns {Object|null} 会话对象或null
 */
function verifySession(token) {
  // console.log('[SessionManager.verifySession] Verifying token:', token ? token.substring(0, 10) + '...' : 'null');
  if (!token) {
    return null;
  }
  
  // 获取会话
  // console.log('[SessionManager.verifySession] Getting session from store...');
  const session = sessionStore.getSession(token);
  // console.log('[SessionManager.verifySession] Session from store:', session ? { userId: session.userId, tokenMatch: true } : null);
  
  // 检查会话是否存在
  if (!session) {
    console.warn(`[会话管理器] verifySession 失败: 未找到令牌对应的会话 ${token.substring(0,10)}...`);
    return null;
  }
  
  // 检查会话是否过期
  const now = Date.now();
  const expired = session.expiresAt < now;
  // console.log(`[SessionManager.verifySession] Expiration check: expiresAt=${session.expiresAt} (${new Date(session.expiresAt).toISOString()}), now=${now} (${new Date(now).toISOString()}), expired=${expired}`);
  if (expired) {
    console.warn(`[会话管理器] verifySession 失败: 令牌已过期 ${token.substring(0,10)}...`);
    sessionStore.removeSession(token);
    return null;
  }
  
  // 更新最后访问时间
  // console.log('[SessionManager.verifySession] Session valid. Updating lastAccessedAt.');
  session.lastAccessedAt = now;
  sessionStore.setSession(token, session); // Update the session in the store
  
  return session;
}

/**
 * 移除会话
 * @param {string} token 会话令牌
 * @returns {boolean} 是否成功移除
 */
function removeSession(token) {
  if (!token) {
    return false;
  }
  
  return sessionStore.removeSession(token);
}

/**
 * 获取用户会话
 * @param {string} userId 用户ID
 * @returns {Object|null} 会话数据或null
 */
function getUserSession(userId) {
  if (!userId) {
    return null;
  }

  return sessionStore.getSessionByUserId(userId);
}

/**
 * 移除用户的所有会话
 * @param {string} userId 用户ID
 * @returns {number} 移除的会话数量
 */
function removeUserSessions(userId) {
  if (!userId) {
    return 0;
  }
  
  return sessionStore.removeSessionsByUserId(userId);
}

/**
 * 从请求中提取令牌
 * @param {Object} req 请求对象
 * @returns {string|null} 令牌或null
 */
function extractTokenFromRequest(req) {
  // 从Authorization头中获取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 从查询参数中获取
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  // 从cookie中获取
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * 清理过期会话
 * @returns {number} 清理的会话数量
 */
function cleanupExpiredSessions() {
  return sessionStore.removeExpiredSessions();
}

module.exports = {
  createSession,
  verifySession,
  removeSession,
  getUserSession,
  removeUserSessions,
  extractTokenFromRequest,
  cleanupExpiredSessions,
  extractUserIdFromToken
}; 