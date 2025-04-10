/**
 * WebSocket服务入口 - 处理实时通信
 */
const WebSocket = require('ws');
const url = require('url');
const config = require('./src/config');

// 创建WebSocket服务器
function createWebSocketServer(server) {
  const wss = new WebSocket.Server({ 
    server,
    // 可以直接使用HTTP服务器或指定端口
    // port: config.server.wsPort
  });
  
  console.log(`WebSocket服务已启动`);
  
  // 连接建立处理
  wss.on('connection', (ws, req) => {
    // 解析查询参数
    const queryParams = url.parse(req.url, true).query;
    const { token, openId } = queryParams;
    
    console.log(`新的WebSocket连接: ${openId}`);
    
    // 为连接添加元数据
    ws.isAlive = true;
    ws.openId = openId;
    ws.lastActivity = Date.now();
    
    // 心跳检测
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // 消息处理
    ws.on('message', (message) => {
      try {
        // 解析JSON消息
        const data = JSON.parse(message);
        console.log(`收到消息 [${openId}]: ${data.type}`);
        
        // 根据消息类型分发处理
        handleWebSocketMessage(ws, data);
        
        // 更新最后活动时间
        ws.lastActivity = Date.now();
      } catch (error) {
        console.error('WebSocket消息处理错误:', error);
        // 发送错误响应
        sendErrorMessage(ws, 4000, '消息格式错误');
      }
    });
    
    // 关闭连接处理
    ws.on('close', () => {
      console.log(`WebSocket连接关闭: ${openId}`);
      handlePlayerDisconnect(ws);
    });
    
    // 发送连接成功消息
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      data: {
        timestamp: Date.now()
      }
    }));
  });
  
  // 定期检查连接是否存活
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      // 如果连接失效，关闭它
      if (ws.isAlive === false) {
        console.log(`关闭不活跃的连接: ${ws.openId}`);
        return ws.terminate();
      }
      
      // 标记为未响应，等待pong事件更新
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // 30秒检查一次
  
  // 服务器关闭时清理interval
  wss.on('close', () => {
    clearInterval(pingInterval);
  });
  
  return wss;
}

/**
 * 处理WebSocket消息
 */
function handleWebSocketMessage(ws, data) {
  // 后续将实现各类消息的处理逻辑
  // 示例: 
  switch (data.type) {
    case 'PING':
      sendPongResponse(ws, data.data.timestamp);
      break;
    default:
      console.warn(`未处理的消息类型: ${data.type}`);
  }
}

/**
 * 处理玩家断开连接
 */
function handlePlayerDisconnect(ws) {
  // 后续实现玩家断开后的清理逻辑
  // 例如: 从房间中移除玩家，更新房间状态等
}

/**
 * 发送心跳响应
 */
function sendPongResponse(ws, timestamp) {
  ws.send(JSON.stringify({
    type: 'PONG',
    data: {
      timestamp: timestamp || Date.now()
    }
  }));
}

/**
 * 发送错误消息
 */
function sendErrorMessage(ws, code, message) {
  ws.send(JSON.stringify({
    type: 'ERROR',
    data: {
      code,
      message
    }
  }));
}

module.exports = createWebSocketServer; 