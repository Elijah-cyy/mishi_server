/**
 * 路由注册模块
 * 集中管理API路由
 */

const express = require('express');
const router = express.Router();

// 引入API路由模块
const userRoutes = require('./api/userRoutes');
const roomRoutes = require('./api/roomRoutes');
const gameRoutes = require('./api/gameRoutes');

// 注册API路由
router.use('/api/user', userRoutes);
router.use('/api/room', roomRoutes);
router.use('/api/game', gameRoutes);

// API通用错误处理中间件
router.use((err, req, res, next) => {
  console.error('API错误:', err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 默认路由处理
router.get('/', (req, res) => {
  res.status(200).json({
    name: '果宝大逃脱游戏服务器',
    version: '1.0.0',
    status: 'running'
  });
});

// 处理404错误
router.use('*', (req, res) => {
  res.status(404).json({
    code: 404,
    message: '请求的资源不存在'
  });
});

module.exports = router; 