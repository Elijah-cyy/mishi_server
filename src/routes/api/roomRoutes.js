/**
 * 房间路由模块
 */

const express = require('express');
const router = express.Router();
const roomHandlers = require('../../handlers/roomHandlers');
const authMiddleware = require('../../middleware/auth');

// 所有房间路由都需要认证
router.use(authMiddleware.authMiddleware);

/**
 * @route POST /api/room
 * @desc 创建新房间（直接在根路径上创建）
 * @access 私有
 */
router.post('/', roomHandlers.handleCreateRoom);

/**
 * @route POST /api/room/create
 * @desc 创建新房间
 * @access 私有
 */
router.post('/create', roomHandlers.handleCreateRoom);

/**
 * @route POST /api/room/join
 * @desc 添加玩家到房间（兼容客户端接口）
 * @access 私有
 */
router.post('/join', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) {
    return res.status(400).json({ code: 400, message: '房间ID不能为空' });
  }
  
  // 从认证中间件获取用户ID作为玩家ID
  const playerId = req.userId;
  if (!playerId) {
    return res.status(401).json({ code: 401, message: '无法获取用户ID，请重新登录' });
  }
  
  // 将请求转发给handleAddPlayerToRoom处理
  req.params.roomId = roomId;
  req.body.playerId = playerId; // 添加玩家ID到请求体
  
  console.log(`[API] 玩家 ${playerId} 请求加入房间 ${roomId}`);
  return roomHandlers.handleAddPlayerToRoom(req, res);
});

/**
 * @route POST /api/room/ready
 * @desc 更新玩家准备状态
 * @access 私有
 */
router.post('/ready', roomHandlers.handleUpdatePlayerReady);

/**
 * @route POST /api/room/start
 * @desc 开始游戏（兼容客户端接口）
 * @access 私有（仅房主）
 */
router.post('/start', (req, res) => {
  const { roomId } = req.body;
  if (!roomId) {
    return res.status(400).json({ code: 400, message: '房间ID不能为空' });
  }
  
  // 将请求转发给handleStartGame处理
  req.params.roomId = roomId;
  return roomHandlers.handleStartGame(req, res);
});

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

/**
 * @route POST /api/room/leave
 * @desc 玩家离开房间
 * @access 私有
 */
router.post('/leave', roomHandlers.handleLeaveRoom);

module.exports = router; 