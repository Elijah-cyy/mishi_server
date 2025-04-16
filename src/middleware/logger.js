/**
 * 日志中间件
 * 记录HTTP请求日志
 */

// 导入颜色库，用于终端颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * 请求日志中间件，记录请求的基本信息
 */
function requestLogger(req, res, next) {
  // 获取请求开始时间
  const startTime = Date.now();
  
  // 保存原始的res.end方法，以便我们可以拦截它
  const originalEnd = res.end;
  
  // 添加响应完成回调
  res.end = function(chunk, encoding) {
    // 先调用原始的end方法
    originalEnd.call(this, chunk, encoding);
    
    // 计算处理时间
    const duration = Date.now() - startTime;
    
    // 获取用户ID（如果已经通过认证）
    const userId = req.userId ? req.userId.substring(0, 8) + '...' : '匿名用户';
    
    // 构建日志消息
    const logMessage = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - UserId: ${userId}`;
    
    // 根据状态码选择日志级别
    if (res.statusCode >= 500) {
      console.error(logMessage);
    } else if (res.statusCode >= 400) {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  };
  
  // 继续请求处理
  next();
}

/**
 * 错误日志中间件，记录错误信息
 */
function errorLogger(err, req, res, next) {
  // 记录错误详情
  console.error('错误发生: ', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    userId: req.userId || 'anonymous',
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
  
  // 继续错误处理流程
  next(err);
}

/**
 * API访问日志中间件，记录API请求和响应（简化版）
 */
function apiLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || 
                   `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  req.requestId = requestId; // Attach for potential use elsewhere

  // Log incoming request (concise)
  console.log(`[API] Req ${requestId}: ${req.method} ${req.originalUrl}`);

  // Keep original end function to measure duration and log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    // Call original end first
    originalEnd.call(this, chunk, encoding);

    // Log response (concise)
    const duration = Date.now() - startTime;
    const userIdLog = req.userId ? ` (User: ${req.userId.substring(0,8)}...)` : ''; // Add user if available
    console.log(`[API] Res ${requestId}: ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)${userIdLog}`);
  };

  next();
}

/**
 * 慢请求日志中间件，记录处理时间超过阈值的请求
 * @param {number} threshold 时间阈值（毫秒）
 */
function slowRequestLogger(threshold = 1000) {
  return (req, res, next) => {
    // 获取请求开始时间
    const startTime = Date.now();
    
    // 处理请求完成后的回调
    res.on('finish', () => {
      // 计算处理时间
      const duration = Date.now() - startTime;
      
      // 如果处理时间超过阈值，记录慢请求日志
      if (duration >= threshold) {
        console.warn(`[SlowReq] ${req.method} ${req.originalUrl} - ${duration}ms`); // Simplified warning
      }
    });
    
    // 继续请求处理
    next();
  };
}

module.exports = {
  errorLogger,
  apiLogger,
  slowRequestLogger
}; 