/**
 * HTTP响应帮助工具
 */

/**
 * 发送成功响应
 * @param {Object} res - Express响应对象
 * @param {Object|Array|string} data - 响应数据
 * @param {number} statusCode - HTTP状态码，默认200
 * @param {string} message - 成功消息
 */
function sendSuccess(res, data = null, statusCode = 200, message = '操作成功') {
  const response = {
    success: true,
    message,
    data
  };
  
  return res.status(statusCode).json(response);
}

/**
 * 发送错误响应
 * @param {Object} res - Express响应对象
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP状态码，默认400
 * @param {Array|Object} errors - 详细错误信息
 */
function sendError(res, message = '操作失败', statusCode = 400, errors = null) {
  const response = {
    success: false,
    message,
    errors
  };
  
  return res.status(statusCode).json(response);
}

module.exports = {
  sendSuccess,
  sendError
}; 