/**
 * Express应用入口
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// 引入自定义中间件
const logger = require('./middleware/logger');
const { rateLimit } = require('./middleware/rateLimit');

// 引入路由
const routes = require('./routes');
const debugRoutes = require('./routes/api/debugRoutes');

// 引入数据同步管理器
const syncManager = require('./storage/syncManager');

// 创建Express应用
const app = express();

// 设置基本中间件
app.use(helmet()); // 安全头设置
app.use(compression()); // 压缩响应
app.use(cors()); // 跨域支持
app.use(bodyParser.json()); // JSON解析
app.use(bodyParser.urlencoded({ extended: true })); // URL编码解析

// 启动定期数据同步
syncManager.startPeriodicSync();
console.log('[App] 定期数据同步任务已启动');

// 执行一次初始同步
syncManager.syncAll(true).catch(err => {
  console.error('[App] 初始数据同步失败:', err);
});

// 设置日志中间件
// app.use(logger.requestLogger); // Removed this line

// 设置限速中间件 - 每IP每分钟最多60次请求
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

// 设置静态资源目录
app.use('/static', express.static(path.join(__dirname, '../public')));

// 添加API请求日志中间件 - 只记录API路由的请求
app.use('/api', logger.apiLogger);

// 添加慢请求日志中间件 - 记录处理时间超过500ms的请求
app.use(logger.slowRequestLogger(500));

// --- 注册调试路由 (仅开发环境推荐) ---
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
  console.log('[App] 调试路由已启用，路径: /api/debug');
} else {
  console.log('[App] 生产环境禁用调试路由。');
}

// 注册主路由
app.use('/', routes);

// 错误处理
app.use(logger.errorLogger);

// 404处理
app.use((req, res) => {
  // 根据URL路径提供更具体的错误信息
  let errorMessage = '请求的资源不存在';
  
  if (req.path.startsWith('/api/room')) {
    errorMessage = '房间不存在或已被删除';
  } else if (req.path.startsWith('/api/user')) {
    errorMessage = '请求的用户资源不存在';
  } else if (req.path.startsWith('/api/game')) {
    errorMessage = '请求的游戏资源不存在';
  }
  
  res.status(404).json({
    code: 404,
    message: errorMessage,
    path: req.path
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    code: statusCode,
    message: err.message || '服务器内部错误',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app; 