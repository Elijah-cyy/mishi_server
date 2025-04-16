/**
 * Debugging HTTP Handlers
 * Provides endpoints for inspecting server state during development.
 */

const roomManager = require('../managers/roomManager');
const sessionManager = require('../managers/sessionManager');
const { sendSuccess, sendError } = require('../utils/responses');

/**
 * Get all active rooms
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
function handleGetActiveRooms(req, res) {
  try {
    // Optionally allow filtering (e.g., ?activeOnly=false)
    const activeOnly = req.query.activeOnly !== 'false'; // Default to true
    console.log(`[调试处理器.处理获取活动房间] 获取房间 (仅活动=${activeOnly})...`);

    const rooms = roomManager.getAllRooms(activeOnly);
    console.log(`[调试处理器.处理获取活动房间] 找到 ${rooms.length} 个房间。`);

    sendSuccess(res, 200, '成功获取活动房间。', { rooms });
  } catch (error) {
    console.error('[调试处理器.处理获取活动房间] 获取房间时出错:', error);
    sendError(res, 500, '无法获取房间', { message: error.message });
  }
}

/**
 * Get all active sessions (Example, might be useful)
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
function handleGetActiveSessions(req, res) {
  try {
    console.log('[调试处理器.处理获取活动会话] 获取所有会话...');
    // Note: Directly accessing sessionStore might be needed if sessionManager doesn't expose getAll
    const sessionStore = require('../storage/memory/sessionStore');
    const sessions = sessionStore.getAllSessions(); // Assuming sessionStore has this method
    console.log(`[调试处理器.处理获取活动会话] 找到 ${sessions.length} 个会话。`);
    // Filter sensitive data before sending
    const safeSessions = sessions.map(s => ({ 
      userId: s.userId,
      token: s.token ? s.token.substring(0,10) + '...' : null, 
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastAccessedAt: s.lastAccessedAt,
      userData: s.userData // Be careful about what userData contains
    })); 
    sendSuccess(res, 200, '成功获取活动会话。', { sessions: safeSessions });
  } catch (error) {
    console.error('[调试处理器.处理获取活动会话] 获取会话时出错:', error);
    sendError(res, 500, '无法获取会话', { message: error.message });
  }
}


module.exports = {
  handleGetActiveRooms,
  handleGetActiveSessions // Export if you want to use it
}; 