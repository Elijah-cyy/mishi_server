/**
 * 认证中间件
 * 负责验证用户请求的身份
 */

const sessionManager = require('../managers/sessionManager');
const { sendUnauthorized } = require('../utils/responses');

/**
 * 验证用户身份中间件
 * 通过Authorization请求头中的Bearer令牌验证用户身份
 */
function authMiddleware(req, res, next) {
  // console.log('[AuthMiddleware] Processing request for:', req.originalUrl);
  // console.log('[AuthMiddleware] Authorization Header:', req.headers.authorization);
  
  // 从请求中提取令牌
  const token = sessionManager.extractTokenFromRequest(req);
  // console.log('[AuthMiddleware] Extracted Token:', token ? token.substring(0, 10) + '...' : 'null or empty');

  if (!token) {
    console.warn('[Auth] 失败 - 未提供令牌，请求路径:', req.originalUrl);
    return sendUnauthorized(res, '未提供认证令牌');
  }

  // 验证令牌
  // console.log('[AuthMiddleware] Verifying token...');
  const session = sessionManager.verifySession(token);
  // console.log('[AuthMiddleware] Verification result (session):', session ? { userId: session.userId, tokenExists: true } : null);

  if (!session) {
    console.warn(`[Auth] 失败 - 无效或过期的令牌，请求路径: ${req.originalUrl} (令牌: ${token.substring(0,10)}...)`);
    return sendUnauthorized(res, '无效或已过期的令牌');
  }

  // 将用户ID和会话信息添加到请求对象
  // console.log(`[AuthMiddleware] Auth successful for userId: ${session.userId}. Adding info to request.`);
  console.log(`[Auth] 成功 - 用户 ${session.userId.substring(0,8)}... 已通过认证，请求: ${req.method} ${req.originalUrl}`);
  req.userId = session.userId;
  req.session = session;
  req.userData = session.userData;

  // 继续处理请求
  next();
}

/**
 * 可选身份验证中间件
 * 如果提供了有效的令牌，将进行身份验证，否则继续处理请求
 */
function optionalAuthMiddleware(req, res, next) {
  // 从请求中提取令牌
  const token = sessionManager.extractTokenFromRequest(req);

  if (token) {
    // 验证令牌
    const session = sessionManager.verifySession(token);

    if (session) {
      // 将用户ID和会话信息添加到请求对象
      req.userId = session.userId;
      req.session = session;
      req.userData = session.userData;
    }
  }

  // 继续处理请求
  next();
}

/**
 * 需要特定角色的中间件
 * @param {string|Array} requiredRole 需要的角色或角色数组
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    // 首先通过身份验证
    authMiddleware(req, res, (err) => {
      if (err) return next(err);

      // 检查用户角色
      const userRole = req.userData.role || 'user';
      
      // 如果是管理员，允许访问所有内容
      if (userRole === 'admin') {
        return next();
      }

      // 检查是否有所需角色
      if (Array.isArray(requiredRole)) {
        if (!requiredRole.includes(userRole)) {
          return sendUnauthorized(res, '没有权限执行此操作');
        }
      } else if (userRole !== requiredRole) {
        return sendUnauthorized(res, '没有权限执行此操作');
      }

      // 有所需角色，继续处理请求
      next();
    });
  };
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole
}; 