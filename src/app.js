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
const rateLimit = require('./middleware/rateLimit');

// 引入路由
const routes = require('./routes');

// 创建Express应用
const app = express();

// 设置基本中间件
app.use(helmet()); // 安全头设置
app.use(compression()); // 压缩响应
app.use(cors()); // 跨域支持
app.use(bodyParser.json()); // JSON解析
app.use(bodyParser.urlencoded({ extended: true })); // URL编码解析

// 设置日志中间件
app.use(logger.requestLogger);

// 设置限速中间件 - 每IP每分钟最多60次请求
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

// 设置静态资源目录
app.use('/static', express.static(path.join(__dirname, '../public')));

// 注册路由
app.use('/', routes);

// 错误处理
app.use(logger.errorLogger);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '请求的资源不存在'
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