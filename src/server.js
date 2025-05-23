/**
 * 服务器启动文件
 * 负责启动HTTP和WebSocket服务
 */

const http = require('http');
const app = require('./app');
const wsApp = require('./wsApp');
const syncManager = require('./storage/syncManager');

// 默认配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 创建HTTP服务器
const server = http.createServer(app);

// 将WebSocket服务器附加到HTTP服务器
wsApp.attach(server);

// 启动服务器
server.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST}:${PORT}`);
  
  // 输出当前环境信息
  console.log(`运行环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`进程ID: ${process.pid}`);
});

// 处理异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 异常记录到日志或通知系统
});

// 处理未处理的Promise异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise异常:', reason);
});

// 优雅关闭
const shutdown = async () => {
  console.log('开始关闭服务器...');
  
  // 执行最终数据同步
  try {
    console.log('执行最终数据同步...');
    await syncManager.syncAll(true);
    console.log('数据同步完成');
  } catch (error) {
    console.error('最终数据同步失败:', error);
  }
  
  // 停止接收新的连接
  server.close(() => {
    console.log('HTTP服务器已关闭');
    
    // 关闭WebSocket连接
    wsApp.close();
    
    // 其他清理工作
    // 例如关闭数据库连接等
    
    console.log('所有连接已关闭，进程退出');
    process.exit(0);
  });
  
  // 设置强制退出的超时处理，防止清理过程卡住
  setTimeout(() => {
    console.log('强制退出进程');
    process.exit(1);
  }, 10000); // 10秒后强制退出
};

// 监听终止信号
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = server; 