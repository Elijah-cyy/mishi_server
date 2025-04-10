/**
 * 游戏路由模块
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../../middleware/auth');

// TODO: 添加游戏相关处理器
const gameHandlers = {};

/**
 * @route GET /api/game/maps
 * @desc 获取所有游戏地图
 * @access 公开
 */
router.get('/maps', optionalAuthMiddleware, (req, res) => {
  // 临时返回静态地图数据
  res.json({
    code: 200,
    message: '获取地图列表成功',
    data: {
      maps: [
        { id: 'default', name: '默认地图', difficulty: 1 },
        { id: 'mansion', name: '神秘大宅', difficulty: 2 },
        { id: 'lab', name: '废弃实验室', difficulty: 3 }
      ]
    }
  });
});

/**
 * @route GET /api/game/items
 * @desc 获取所有游戏道具
 * @access 公开
 */
router.get('/items', optionalAuthMiddleware, (req, res) => {
  // 临时返回静态道具数据
  res.json({
    code: 200,
    message: '获取道具列表成功',
    data: {
      items: [
        { id: 'key', name: '钥匙', description: '可以打开锁住的门', rarity: 1 },
        { id: 'flashlight', name: '手电筒', description: '可以照亮黑暗区域', rarity: 1 },
        { id: 'medkit', name: '医疗包', description: '可以恢复生命值', rarity: 2 },
        { id: 'amulet', name: '护身符', description: '可以抵御一次致命伤害', rarity: 3 }
      ]
    }
  });
});

/**
 * @route GET /api/game/leaderboard
 * @desc 获取游戏排行榜
 * @access 公开
 */
router.get('/leaderboard', optionalAuthMiddleware, (req, res) => {
  // 临时返回静态排行榜数据
  res.json({
    code: 200,
    message: '获取排行榜成功',
    data: {
      leaderboard: [
        { rank: 1, userId: 'user1', nickname: '玩家1', score: 1000, wins: 10 },
        { rank: 2, userId: 'user2', nickname: '玩家2', score: 800, wins: 8 },
        { rank: 3, userId: 'user3', nickname: '玩家3', score: 750, wins: 7 }
      ]
    }
  });
});

/**
 * @route GET /api/game/settings
 * @desc 获取游戏设置
 * @access 私有
 */
router.get('/settings', authMiddleware, (req, res) => {
  // 临时返回静态设置数据
  res.json({
    code: 200,
    message: '获取游戏设置成功',
    data: {
      settings: {
        difficulty: 'normal',
        soundEnabled: true,
        vibrationEnabled: true,
        tutorialCompleted: false
      }
    }
  });
});

/**
 * @route PUT /api/game/settings
 * @desc 更新游戏设置
 * @access 私有
 */
router.put('/settings', authMiddleware, (req, res) => {
  // TODO: 实现游戏设置更新
  res.json({
    code: 200,
    message: '游戏设置更新成功',
    data: {
      settings: {
        ...req.body,
        updatedAt: new Date().toISOString()
      }
    }
  });
});

module.exports = router; 