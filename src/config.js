/**
 * 配置文件 - 加载环境变量并提供统一的配置访问点
 */
require('dotenv').config();

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    wsPort: process.env.WS_PORT || 3001,
    env: process.env.NODE_ENV || 'development',
  },
  
  // JWT认证配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key_for_development',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // 微信小游戏配置
  weixin: {
    appId: process.env.WX_APPID,
    appSecret: process.env.WX_SECRET,
  },
  
  // 文件存储配置
  storage: {
    userDataPath: 'data/users/profiles.json',
    gameHistoryPath: 'data/games/history.json',
    gameConfigPath: 'data/game_config.json',
  },
  
  // 数据同步配置
  syncInterval: 5 * 60 * 1000, // 5分钟
};

module.exports = config; 