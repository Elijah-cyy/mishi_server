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
    const userId = req.userId ? req.userId.substring(0, 8) + '...' : 'anonymous';
    
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
  // 生成唯一请求ID
  const requestId = req.headers['x-request-id'] || 
                   `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  
  // 记录请求时间
  const startTime = Date.now();
  
  // 在请求对象上保存请求ID，方便其他中间件使用
  req.requestId = requestId;
  
  // 输出简化的请求信息
  console.log(`${colors.cyan}[API请求]${colors.reset} ID:${requestId} | ${colors.green}${req.method} ${req.originalUrl}${colors.reset}`);
  
  // 记录请求体 (保留参数信息)
  if (req.body && Object.keys(req.body).length > 0) {
    // 屏蔽敏感字段
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitizedBody = JSON.parse(JSON.stringify(req.body));
    
    for (const field of sensitiveFields) {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '******';
      }
    }
    
    console.log(`${colors.dim}请求参数:${colors.reset}`, sanitizedBody);
  }
  
  // 保存原始的方法
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  // 拦截响应
  res.send = function(body) {
    res.responseBody = body;
    return originalSend.apply(this, arguments);
  };
  
  res.json = function(body) {
    res.responseBody = body;
    return originalJson.apply(this, arguments);
  };
  
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // 简化的响应信息记录
    let statusColor = colors.green;
    if (res.statusCode >= 400) statusColor = colors.yellow;
    if (res.statusCode >= 500) statusColor = colors.red;
    
    console.log(`${colors.cyan}[API响应]${colors.reset} ID:${requestId} | ${statusColor}${res.statusCode}${colors.reset} | ${responseTime}ms`);
    
    // 记录响应体简要信息
    if (res.responseBody) {
      let responsePreview;
      if (typeof res.responseBody === 'string') {
        try {
          const parsed = JSON.parse(res.responseBody);
          responsePreview = JSON.stringify(parsed).substring(0, 150);
          if (JSON.stringify(parsed).length > 150) responsePreview += '...';
        } catch (e) {
          responsePreview = `${res.responseBody.substring(0, 100)}${res.responseBody.length > 100 ? '...' : ''}`;
        }
      } else {
        responsePreview = JSON.stringify(res.responseBody).substring(0, 150);
        if (JSON.stringify(res.responseBody).length > 150) responsePreview += '...';
      }
      
      console.log(`${colors.dim}响应数据:${colors.reset} ${responsePreview}`);
    }
    
    // 调用原始方法
    return originalEnd.apply(this, arguments);
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
        console.warn(`${colors.yellow}[慢请求警告]${colors.reset} ${req.method} ${req.originalUrl} - ${duration}ms`);
      }
    });
    
    // 继续请求处理
    next();
  };
}

module.exports = {
  requestLogger,
  errorLogger,
  apiLogger,
  slowRequestLogger
}; 