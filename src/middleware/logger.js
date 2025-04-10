/**
 * 日志中间件
 * 记录HTTP请求日志
 */

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
 * API访问日志中间件，记录API请求和响应
 */
function apiLogger(req, res, next) {
  // 记录请求信息
  console.log(`API请求: ${req.method} ${req.originalUrl}`);
  
  // 如果在开发环境，记录请求体
  if (process.env.NODE_ENV === 'development' && req.body) {
    console.log('请求体:', JSON.stringify(req.body, null, 2));
  }
  
  // 继续请求处理
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
        console.warn(`慢请求警告: ${req.method} ${req.originalUrl} - ${duration}ms`);
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