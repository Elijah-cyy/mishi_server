/**
 * 请求速率限制中间件
 * 限制客户端API请求频率，防止滥用
 */

/**
 * 创建内存存储的请求计数器
 * @returns {Object} 请求计数器存储对象
 */
function createMemoryStore() {
  const store = new Map();
  
  // 定期清理过期的计数器
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000); // 每5分钟清理一次
  
  // 确保进程退出时清理定时器
  process.on('exit', () => {
    clearInterval(cleanup);
  });
  
  return {
    /**
     * 递增指定键的计数并返回当前值
     * @param {string} key 键名
     * @param {number} windowMs 时间窗口（毫秒）
     * @returns {Object} 包含计数和重置时间的对象
     */
    increment(key, windowMs) {
      const now = Date.now();
      
      // 获取现有记录或创建新记录
      let record = store.get(key);
      
      if (!record || now > record.resetTime) {
        // 创建新记录
        record = {
          count: 1,
          resetTime: now + windowMs
        };
      } else {
        // 递增现有记录
        record.count += 1;
      }
      
      // 保存记录
      store.set(key, record);
      
      return record;
    },
    
    /**
     * 重置指定键的计数
     * @param {string} key 键名
     */
    reset(key) {
      store.delete(key);
    }
  };
}

/**
 * 创建请求速率限制中间件
 * @param {Object} options 配置选项
 * @param {number} [options.windowMs=60000] 时间窗口（毫秒）
 * @param {number} [options.max=100] 窗口内最大请求数
 * @param {Function} [options.keyGenerator] 生成请求标识键的函数
 * @param {Function} [options.handler] 请求超限时的处理函数
 * @param {boolean} [options.skipSuccessfulRequests=false] 是否跳过成功的请求
 * @returns {Function} Express中间件函数
 */
function rateLimit(options = {}) {
  // 默认选项
  const {
    windowMs = 60 * 1000, // 默认1分钟
    max = 100, // 默认每分钟100次请求
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    handler = (req, res) => {
      res.status(429).json({
        code: 429,
        message: '请求过于频繁，请稍后再试'
      });
    },
    skipSuccessfulRequests = false
  } = options;
  
  // 创建存储
  const store = createMemoryStore();
  
  // 返回中间件函数
  return (req, res, next) => {
    // 生成请求键
    const key = keyGenerator(req);
    
    // 递增计数
    const { count, resetTime } = store.increment(key, windowMs);
    
    // 设置响应头
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
    
    // 检查是否超出限制
    if (count > max) {
      return handler(req, res);
    }
    
    // 如果配置为跳过成功的请求，在请求完成后重置计数
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          store.reset(key);
        }
      });
    }
    
    // 继续处理请求
    next();
  };
}

// 预设配置

/**
 * 通用API限流 - 适用于大多数API端点
 */
function apiLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 60 // 每分钟60次请求
  });
}

/**
 * 严格限流 - 适用于敏感操作
 */
function strictLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 10 // 每分钟10次请求
  });
}

/**
 * 宽松限流 - 适用于公共资源
 */
function publicLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 120 // 每分钟120次请求
  });
}

module.exports = {
  rateLimit,
  apiLimiter,
  strictLimiter,
  publicLimiter
}; 