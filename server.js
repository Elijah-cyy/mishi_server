/**
 * 服务器启动文件 - 启动HTTP和WebSocket服务
 */
const http = require('http');
const app = require('./src/app');
const createWebSocketServer = require('./wsApp');
const config = require('./src/config');

// 创建HTTP服务器
const server = http.createServer(app);

// 在同一端口上托管WebSocket服务
const wss = createWebSocketServer(server);

// 启动服务器
server.listen(config.server.port, () => {
  console.log(`服务已启动，监听端口: ${config.server.port}`);
  console.log(`环境: ${config.server.env}`);
  console.log(`HTTP API: http://localhost:${config.server.port}`);
  console.log(`WebSocket: ws://localhost:${config.server.port}/ws`);
});

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 严重错误时，可以选择退出进程
  // process.exit(1);
}); 