/**
 * 响应格式化工具
 * 统一API响应格式
 */

/**
 * 发送成功响应
 * @param {Object} res Express响应对象
 * @param {number} status HTTP状态码
 * @param {string} message 成功消息
 * @param {Object} data 响应数据
 */
function sendSuccess(res, status = 200, message = '操作成功', data = {}) {
  res.status(status).json({
    code: status,
    message,
    data
  });
}

/**
 * 发送错误响应
 * @param {Object} res Express响应对象
 * @param {number} status HTTP状态码
 * @param {string} message 错误消息
 * @param {Object} errors 详细错误信息
 */
function sendError(res, status = 400, message = '操作失败', errors = null) {
  const response = {
    code: status,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  res.status(status).json(response);
}

/**
 * 发送未认证响应
 * @param {Object} res Express响应对象
 * @param {string} message 错误消息
 */
function sendUnauthorized(res, message = '未认证或认证已过期') {
  return sendError(res, 401, message);
}

/**
 * 发送禁止访问响应
 * @param {Object} res Express响应对象
 * @param {string} message 错误消息
 */
function sendForbidden(res, message = '没有权限执行此操作') {
  return sendError(res, 403, message);
}

/**
 * 发送未找到响应
 * @param {Object} res Express响应对象
 * @param {string} message 错误消息
 */
function sendNotFound(res, message = '请求的资源不存在') {
  return sendError(res, 404, message);
}

/**
 * 发送服务器错误响应
 * @param {Object} res Express响应对象
 * @param {string} message 错误消息
 * @param {Error} error 错误对象
 */
function sendServerError(res, message = '服务器内部错误', error = null) {
  console.error('服务器错误:', error);
  
  const response = {
    code: 500,
    message
  };

  // 在开发环境添加错误详情
  if (process.env.NODE_ENV === 'development' && error) {
    response.errorDetails = {
      message: error.message,
      stack: error.stack
    };
  }

  res.status(500).json(response);
}

/**
 * 发送无内容响应
 * @param {Object} res Express响应对象
 */
function sendNoContent(res) {
  return res.status(204).end();
}

/**
 * 发送重定向响应
 * @param {Object} res Express响应对象
 * @param {string} url 重定向URL
 * @param {number} statusCode HTTP状态码
 */
function sendRedirect(res, url, statusCode = 302) {
  return res.redirect(statusCode, url);
}

module.exports = {
  sendSuccess,
  sendError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendServerError,
  sendNoContent,
  sendRedirect
}; 