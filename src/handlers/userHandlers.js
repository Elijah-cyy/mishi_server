/**
 * 用户管理HTTP处理器
 * 处理与用户相关的请求
 */

const userManager = require('../managers/userManager');
const sessionManager = require('../managers/sessionManager');
const wxAuth = require('../utils/wxAuth');
const { validateRequest } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/responses');

/**
 * 处理用户登录（微信）
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function handleWxLogin(req, res) {
  try {
    console.log('收到微信登录请求:', req.body);
    
    // 校验请求数据
    const validationResult = validateRequest(req.body, {
      code: { type: 'string', required: true },
      userInfo: { type: 'object' },
      encryptedData: { type: 'string' },
      iv: { type: 'string' }
    });

    if (!validationResult.valid) {
      console.error('登录请求数据无效:', validationResult.errors);
      return sendError(res, 400, '请求数据无效', validationResult.errors);
    }

    const { code, userInfo, encryptedData, iv } = validationResult.data;
    console.log('请求验证通过，开始处理微信登录，Code:', code);

    // 微信登录，获取openId
    let wxLoginResult;
    try {
      wxLoginResult = await wxAuth.code2Session(code);
      console.log('微信登录成功, 获取到openId:', wxLoginResult.openId);
    } catch (error) {
      console.error('微信登录失败:', error);
      return sendError(res, 400, '微信登录失败: ' + error.message);
    }

    if (!wxLoginResult) {
      return sendError(res, 400, '微信登录失败: 未获取到用户信息');
    }

    const { openId, sessionKey } = wxLoginResult;

    // 解密用户数据（如果有加密数据）
    let decryptedUserInfo = userInfo;
    if (encryptedData && iv && sessionKey) {
      try {
        decryptedUserInfo = wxAuth.decryptData(encryptedData, iv, sessionKey);
        console.log('用户数据解密成功');
      } catch (error) {
        console.error('解密用户数据失败:', error);
        // 继续使用未加密的数据
      }
    }

    // 创建或更新用户
    const userData = await userManager.saveUser(openId, {
      sessionKey,
      ...(decryptedUserInfo || {}),
      lastLoginAt: new Date().toISOString()
    });

    console.log('用户数据已保存:', openId);

    // 创建会话
    const token = sessionManager.createSession(openId, {
      nickname: userData.nickname || '游客',
      avatar: userData.avatarUrl,
      role: userData.role || 'user'
    });

    console.log('用户会话已创建, 生成token成功');
    console.log('准备发送给前端的 Token:', token);

    // 返回成功响应
    const responseData = {
      token,
      user: {
        openId,
        nickname: userData.nickname || '游客',
        avatar: userData.avatarUrl,
        role: userData.role || 'user'
      }
    };
    console.log('准备发送给前端的完整 Data:', responseData);
    
    sendSuccess(res, 200, '登录成功', responseData);
  } catch (error) {
    console.error('处理登录请求发生异常:', error);
    sendError(res, 500, '登录失败', { message: error.message });
  }
}

/**
 * 处理用户登出
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
function handleLogout(req, res) {
  try {
    // 获取令牌
    const token = sessionManager.extractTokenFromRequest(req);

    if (!token) {
      return sendError(res, 400, '未提供认证令牌');
    }

    // 移除会话
    const success = sessionManager.removeSession(token);

    if (!success) {
      return sendError(res, 400, '令牌无效或会话已过期');
    }

    // 返回成功响应
    sendSuccess(res, 200, '登出成功');
  } catch (error) {
    console.error('登出失败:', error);
    sendError(res, 500, '登出失败', { message: error.message });
  }
}

/**
 * 获取用户信息
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function handleGetUserInfo(req, res) {
  try {
    // 用户ID应该已经在认证中间件中设置
    const { userId } = req;

    if (!userId) {
      return sendError(res, 400, '用户ID不能为空');
    }

    // 获取用户数据
    const userData = await userManager.getUser(userId);

    if (!userData) {
      return sendError(res, 404, '用户不存在');
    }

    // 过滤敏感信息
    const safeUserData = {
      openId: userData.openId,
      nickname: userData.nickname || '游客',
      avatar: userData.avatarUrl,
      role: userData.role || 'user',
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      gameStats: userData.gameStats || {}
    };

    // 返回成功响应
    sendSuccess(res, 200, '获取用户信息成功', { user: safeUserData });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    sendError(res, 500, '获取用户信息失败', { message: error.message });
  }
}

/**
 * 更新用户信息
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function handleUpdateUserInfo(req, res) {
  try {
    // 用户ID应该已经在认证中间件中设置
    const { userId } = req;

    if (!userId) {
      return sendError(res, 400, '用户ID不能为空');
    }

    // 校验请求数据
    const validationResult = validateRequest(req.body, {
      nickname: { type: 'string' },
      avatarUrl: { type: 'string' }
    });

    if (!validationResult.valid) {
      return sendError(res, 400, '请求数据无效', validationResult.errors);
    }

    // 获取要更新的字段
    const updateData = {};
    if (validationResult.data.nickname) updateData.nickname = validationResult.data.nickname;
    if (validationResult.data.avatarUrl) updateData.avatarUrl = validationResult.data.avatarUrl;

    // 更新用户
    const updatedUser = await userManager.saveUser(userId, updateData);

    if (!updatedUser) {
      return sendError(res, 404, '用户不存在');
    }

    // 过滤敏感信息
    const safeUserData = {
      openId: updatedUser.openId,
      nickname: updatedUser.nickname || '游客',
      avatar: updatedUser.avatarUrl,
      role: updatedUser.role || 'user',
      updatedAt: updatedUser.updatedAt
    };

    // 返回成功响应
    sendSuccess(res, 200, '更新用户信息成功', { user: safeUserData });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    sendError(res, 500, '更新用户信息失败', { message: error.message });
  }
}

/**
 * 获取用户游戏统计
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
async function handleGetUserStats(req, res) {
  try {
    // 用户ID可以是请求参数中的ID，也可以是当前认证用户的ID
    const userId = req.params.userId || req.userId;

    if (!userId) {
      return sendError(res, 400, '用户ID不能为空');
    }

    // 获取用户数据
    const userData = await userManager.getUser(userId);

    if (!userData) {
      return sendError(res, 404, '用户不存在');
    }

    // 获取用户统计数据
    const stats = userData.gameStats || {
      totalGames: 0,
      wins: 0,
      losses: 0,
      rank: 0,
      points: 0,
      averageTime: 0,
      items: {},
      lastGameAt: null
    };

    // 返回成功响应
    sendSuccess(res, 200, '获取用户游戏统计成功', { stats });
  } catch (error) {
    console.error('获取用户游戏统计失败:', error);
    sendError(res, 500, '获取用户游戏统计失败', { message: error.message });
  }
}

module.exports = {
  handleWxLogin,
  handleLogout,
  handleGetUserInfo,
  handleUpdateUserInfo,
  handleGetUserStats
}; 