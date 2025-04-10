/**
 * 房间路由模块
 */

const express = require('express');
const router = express.Router();
const roomHandlers = require('../../handlers/roomHandlers');
const authMiddleware = require('../../middleware/auth');

// 所有房间路由都需要认证
router.use(authMiddleware);

/**
 * @route POST /api/room/create
 * @desc 创建新房间
 * @access 私有
 */
router.post('/create', roomHandlers.handleCreateRoom);

/**
 * @route GET /api/room/:roomId
 * @desc 获取房间信息
 * @access 私有
 */
router.get('/:roomId', roomHandlers.handleGetRoom);

/**
 * @route GET /api/room
 * @desc 获取所有房间或当前用户的房间
 * @access 私有
 */
router.get('/', roomHandlers.handleGetAllRooms);

/**
 * @route PUT /api/room/:roomId
 * @desc 更新房间信息
 * @access 私有（仅房主）
 */
router.put('/:roomId', roomHandlers.handleUpdateRoom);

/**
 * @route DELETE /api/room/:roomId
 * @desc 关闭房间
 * @access 私有（仅房主）
 */
router.delete('/:roomId', roomHandlers.handleCloseRoom);

/**
 * @route POST /api/room/:roomId/player
 * @desc 添加玩家到房间
 * @access 私有
 */
router.post('/:roomId/player', roomHandlers.handleAddPlayerToRoom);

/**
 * @route DELETE /api/room/:roomId/player/:playerId
 * @desc 从房间移除玩家
 * @access 私有（仅自己或房主可操作）
 */
router.delete('/:roomId/player/:playerId', roomHandlers.handleRemovePlayerFromRoom);

/**
 * @route POST /api/room/:roomId/start
 * @desc 开始游戏
 * @access 私有（仅房主）
 */
router.post('/:roomId/start', roomHandlers.handleStartGame);

/**
 * @route POST /api/room/:roomId/end
 * @desc 结束游戏
 * @access 私有（仅房主）
 */
router.post('/:roomId/end', roomHandlers.handleEndGame);

module.exports = router; 