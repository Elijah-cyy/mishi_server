/**
 * Express应用入口 - 处理HTTP请求
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./src/config');

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码的请求体
app.use(morgan('dev')); // 请求日志记录

// 健康检查接口
app.get('/', (req, res) => {
  res.json({
    code: 0,
    data: {
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    }
  });
});

// API路由（后续会添加）
// 示例: app.use('/api/user', require('./src/routes/api/userRoutes'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 5000,
    message: '服务器内部错误',
    error: config.server.env === 'development' ? err.message : undefined
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 4040,
    message: '请求的资源不存在'
  });
});

module.exports = app; 