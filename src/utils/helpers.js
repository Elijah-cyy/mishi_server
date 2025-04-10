/**
 * 通用辅助函数
 * 提供各种辅助功能
 */

const crypto = require('crypto');

/**
 * 安全解析JSON
 * @param {string} jsonString JSON字符串
 * @param {*} defaultValue 解析失败时返回的默认值
 * @returns {*} 解析结果或默认值
 */
function safeParseJSON(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON解析错误:', error);
    return defaultValue;
  }
}

/**
 * 生成唯一ID
 * @param {string} prefix ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}${timestamp}_${random}`;
}

/**
 * 生成房间ID
 * @returns {string} 房间ID
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * 从会话令牌中提取用户ID
 * @param {string} token 会话令牌
 * @returns {string|null} 用户ID或null
 */
function extractUserIdFromToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  const parts = token.split('-');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * 深度合并对象
 * @param {Object} target 目标对象
 * @param {Object} source 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  if (!source) return target;
  
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

/**
 * 检查值是否为对象
 * @param {*} item 要检查的值
 * @returns {boolean} 是否为对象
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 延迟执行
 * @param {number} ms 延迟毫秒数
 * @returns {Promise} Promise对象
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 对象转查询字符串
 * @param {Object} params 参数对象
 * @returns {string} 查询字符串
 */
function objectToQueryString(params) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

/**
 * 生成随机字符串
 * @param {number} length 字符串长度
 * @returns {string} 随机字符串
 */
function generateRandomString(length = 16) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * 格式化日期时间
 * @param {Date|number|string} date 日期对象、时间戳或日期字符串
 * @param {string} format 格式字符串，例如 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const replacements = {
    'YYYY': d.getFullYear(),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0'),
    'ms': String(d.getMilliseconds()).padStart(3, '0')
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss|ms/g, match => replacements[match]);
}

module.exports = {
  safeParseJSON,
  generateId,
  generateRoomId,
  extractUserIdFromToken,
  deepMerge,
  isObject,
  delay,
  objectToQueryString,
  generateRandomString,
  formatDateTime
}; 