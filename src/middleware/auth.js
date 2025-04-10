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
  // 从请求中提取令牌
  const token = sessionManager.extractTokenFromRequest(req);

  if (!token) {
    return sendUnauthorized(res, '未提供认证令牌');
  }

  // 验证令牌
  const session = sessionManager.verifySession(token);

  if (!session) {
    return sendUnauthorized(res, '无效或已过期的令牌');
  }

  // 将用户ID和会话信息添加到请求对象
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