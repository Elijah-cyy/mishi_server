/**
 * 用户路由模块
 */

const express = require('express');
const router = express.Router();
const userHandlers = require('../../handlers/userHandlers');
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth');

/**
 * @route POST /api/user/login/wx
 * @desc 微信登录
 * @access 公开
 */
router.post('/login/wx', userHandlers.handleWxLogin);

/**
 * @route POST /api/user/logout
 * @desc 用户登出
 * @access 私有
 */
router.post('/logout', authMiddleware, userHandlers.handleLogout);

/**
 * @route GET /api/user/info
 * @desc 获取当前用户信息
 * @access 私有
 */
router.get('/info', authMiddleware, userHandlers.handleGetUserInfo);

/**
 * @route PUT /api/user/info
 * @desc 更新用户信息
 * @access 私有
 */
router.put('/info', authMiddleware, userHandlers.handleUpdateUserInfo);

/**
 * @route GET /api/user/stats
 * @desc 获取当前用户游戏统计
 * @access 私有
 */
router.get('/stats', authMiddleware, userHandlers.handleGetUserStats);

/**
 * @route GET /api/user/:userId/stats
 * @desc 获取指定用户的游戏统计
 * @access 公开
 */
router.get('/:userId/stats', optionalAuthMiddleware, userHandlers.handleGetUserStats);

module.exports = router; 