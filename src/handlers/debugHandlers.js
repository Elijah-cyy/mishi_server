/**
 * Debugging HTTP Handlers
 * Provides endpoints for inspecting server state during development.
 */

const roomManager = require('../managers/roomManager');
const sessionManager = require('../managers/sessionManager');
const { sendSuccess, sendError } = require('../utils/responses');
const fs = require('fs'); // 引入fs模块
const path = require('path'); // 引入path模块

/**
 * 生成房间列表的 HTML 视图
 * @param {Array} rooms 房间列表
 * @returns {string} HTML 字符串
 */
function generateRoomsHtml(rooms) {
  let html =
    '<!DOCTYPE html>' +
    '<html lang="zh-CN">' +
    '<head>' +
    '  <meta charset="UTF-8">' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '  <title>活跃房间列表</title>' +
    '  <style>' +
    '    body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f0f2f5; color: #333; }' +
    '    .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }' +
    '    h1 { color: #1877f2; margin: 0; font-size: 24px; }' +
    '    .back-link { display: inline-block; padding: 8px 15px; background-color: #1877f2; color: white; text-decoration: none; border-radius: 5px; font-size: 14px; transition: background-color 0.3s ease; }' +
    '    .back-link:hover { background-color: #166fe5; }' +
    '    .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }' +
    '    table { width: 100%; border-collapse: collapse; margin-top: 20px; }' +
    '    th, td { padding: 12px 15px; border: 1px solid #ddd; text-align: left; vertical-align: top; }' +
    '    th { background-color: #e9ecef; color: #495057; font-weight: 600; }' +
    '    tr:nth-child(even) { background-color: #f8f9fa; }' +
    '    tr:hover { background-color: #e9ecef; }' +
    '    pre { background-color: #e9ecef; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; max-height: 200px; overflow-y: auto; }' +
    '    .empty-state { text-align: center; padding: 20px; color: #777; font-size: 16px; }' +
    '    .player-list { list-style-type: none; padding-left: 0; margin: 0; }' +
    '    .player-list li { padding: 3px 0; font-size: 14px; border-bottom: 1px dashed #eee; }' +
    '    .player-list li:last-child { border-bottom: none; }' +
    '    .player-status-ready { color: green; font-weight: bold; }' +
    '    .player-status-not-ready { color: orange; }' +
    '    .player-host { font-weight: bold; color: #007bff; }' +
    '  </style>' +
    '</head>' +
    '<body>' +
    '  <div class="header-container">' +
    '    <h1>活跃房间列表</h1>' +
    '    <a href="/api/debug/" class="back-link">返回调试主页</a>' +
    '  </div>' +
    '  <div class="container">';

  if (rooms.length === 0) {
    html += '<div class="empty-state"><p>当前没有活跃的房间。</p></div>';
  } else {
    html +=
        '<p>共找到 ' + rooms.length + ' 个房间。</p>' +
        '<table>' +
        '  <thead>' +
        '    <tr>' +
        '      <th>房间ID</th>' +
        '      <th>房间名称</th>' +
        '      <th>房主ID</th>' +
        '      <th>玩家详情</th>' +
        '      <th>当前/最大玩家</th>' +
        '      <th>状态</th>' +
        '      <th>地图ID</th>' +
        '      <th>创建时间</th>' +
        '      <th>更新时间</th>' +
        '      <th>房间数据 (JSON)</th>' +
        '    </tr>' +
        '  </thead>' +
        '  <tbody>';
    rooms.forEach(room => {
      let playersListHtml = '<ul class="player-list">';
      if (room.players && room.players.length > 0) {
        room.players.forEach(player => {
          let playerStatusText = player.isReady ? '<span class="player-status-ready">已准备</span>' : '<span class="player-status-not-ready">未准备</span>';
          let playerHostText = player.isHost ? '<span class="player-host">(房主)</span>' : '';
          playersListHtml += '<li>' + 
                             (player.nickname || '匿名玩家') + 
                             ' (ID: ' + (player.id || 'N/A') + ') ' + 
                             playerHostText + ' - ' + 
                             playerStatusText + 
                             '</li>';
        });
      } else {
        playersListHtml += '<li>暂无玩家</li>';
      }
      playersListHtml += '</ul>';

      html +=
            '<tr>' +
            '  <td>' + (room.roomId || 'N/A') + '</td>' +
            '  <td>' + (room.name || '未命名') + '</td>' +
            '  <td>' + (room.hostId || 'N/A') + '</td>' +
            '  <td>' + playersListHtml + '</td>' +
            '  <td>' + (room.players ? room.players.length : 0) + ' / ' + (room.maxPlayers || 'N/A') + '</td>' +
            '  <td>' + (room.status || 'N/A') + '</td>' +
            '  <td>' + (room.mapId || '默认') + '</td>' +
            '  <td>' + (room.createdAt ? new Date(room.createdAt).toLocaleString() : 'N/A') + '</td>' +
            '  <td>' + (room.updatedAt ? new Date(room.updatedAt).toLocaleString() : 'N/A') + '</td>' +
            '  <td><pre>' + JSON.stringify(room, null, 2) + '</pre></td>' +
            '</tr>';
    });
    html +=
        '  </tbody>' +
        '</table>';
  }
  html +=
    '  </div>' +
    '</body>' +
    '</html>';
  return html;
}

/**
 * 生成会话列表的 HTML 视图
 * @param {Array} sessions 会话列表
 * @returns {string} HTML 字符串
 */
function generateSessionsHtml(sessions) {
  let html =
    '<!DOCTYPE html>' +
    '<html lang="zh-CN">' +
    '<head>' +
    '  <meta charset="UTF-8">' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '  <title>活跃会话列表</title>' +
    '  <style>' +
    '    body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f0f2f5; color: #333; }' +
    '    .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }' +
    '    h1 { color: #1877f2; margin: 0; font-size: 24px; }' +
    '    .back-link { display: inline-block; padding: 8px 15px; background-color: #1877f2; color: white; text-decoration: none; border-radius: 5px; font-size: 14px; transition: background-color 0.3s ease; }' +
    '    .back-link:hover { background-color: #166fe5; }' +
    '    .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }' +
    '    table { width: 100%; border-collapse: collapse; margin-top: 20px; }' +
    '    th, td { padding: 12px 15px; border: 1px solid #ddd; text-align: left; vertical-align: top; }' +
    '    th { background-color: #e9ecef; color: #495057; font-weight: 600; }' +
    '    tr:nth-child(even) { background-color: #f8f9fa; }' +
    '    tr:hover { background-color: #e9ecef; }' +
    '    pre { background-color: #e9ecef; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; max-height: 150px; overflow-y: auto; }' +
    '    .empty-state { text-align: center; padding: 20px; color: #777; font-size: 16px; }' +
    '    .user-data-field { font-weight: bold; color: #555; }' +
    '  </style>' +
    '</head>' +
    '<body>' +
    '  <div class="header-container">' +
    '    <h1>活跃会话列表</h1>' +
    '    <a href="/api/debug/" class="back-link">返回调试主页</a>' +
    '  </div>' +
    '  <div class="container">';

  if (sessions.length === 0) {
    html += '<div class="empty-state"><p>当前没有活跃的会话。</p></div>';
  } else {
    html +=
        '<p>共找到 ' + sessions.length + ' 个会话。</p>' +
        '<table>' +
        '  <thead>' +
        '    <tr>' +
        '      <th>用户ID</th>' +
        '      <th>Token (前缀)</th>' +
        '      <th>玩家昵称</th>' +
        '      <th>创建时间</th>' +
        '      <th>过期时间</th>' +
        '      <th>最后访问时间</th>' +
        '      <th>用户数据 (JSON)</th>' +
        '    </tr>' +
        '  </thead>' +
        '  <tbody>';
    sessions.forEach(session => {
      const userNickname = (session.userData && session.userData.nickname) ? session.userData.nickname : 'N/A';
      html +=
            '<tr>' +
            '  <td>' + (session.userId || 'N/A') + '</td>' +
            '  <td>' + (session.token || 'N/A') + '</td>' +
            '  <td>' + userNickname + '</td>' +
            '  <td>' + (session.createdAt ? new Date(session.createdAt).toLocaleString() : 'N/A') + '</td>' +
            '  <td>' + (session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'N/A') + '</td>' +
            '  <td>' + (session.lastAccessedAt ? new Date(session.lastAccessedAt).toLocaleString() : 'N/A') + '</td>' +
            '  <td><pre>' + JSON.stringify(session.userData, null, 2) + '</pre></td>' +
            '</tr>';
    });
    html +=
        '  </tbody>' +
        '</table>';
  }
  html +=
    '  </div>' +
    '</body>' +
    '</html>';
  return html;
}

/**
 * Get all active rooms
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
function handleGetActiveRooms(req, res) {
  try {
    // Optionally allow filtering (e.g., ?activeOnly=false)
    const activeOnly = req.query.activeOnly !== 'false'; // Default to true
    console.log('[调试处理器.处理获取活动房间] 获取房间 (仅活动=' + activeOnly + ')...');

    const rooms = roomManager.getAllRooms(activeOnly);
    console.log('[调试处理器.处理获取活动房间] 找到 ' + rooms.length + ' 个房间。');

    // 根据 Accept 请求头决定返回 HTML 还是 JSON
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml && process.env.NODE_ENV !== 'production') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(generateRoomsHtml(rooms));
    } else {
      sendSuccess(res, 200, '成功获取活动房间。', { rooms });
    }
  } catch (error) {
    console.error('[调试处理器.处理获取活动房间] 获取房间时出错:', error);
    sendError(res, 500, '无法获取房间', { message: error.message });
  }
}

/**
 * Get all active sessions (Example, might be useful)
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
function handleGetActiveSessions(req, res) {
  try {
    console.log('[调试处理器.处理获取活动会话] 获取所有会话...');
    const sessionStore = require('../storage/memory/sessionStore');
    let sessions = [];
    if (sessionStore && typeof sessionStore.getAllSessions === 'function') {
        sessions = sessionStore.getAllSessions();
    } else if (sessionManager && typeof sessionManager.getAllSessions === 'function') { // 后备到 sessionManager
        sessions = sessionManager.getAllSessions();
    } else {
        console.error('[调试处理器.处理获取活动会话] 无法从 sessionStore 或 sessionManager 获取会话列表方法。');
        return sendError(res, 500, '无法获取会话列表', { message: 'Session data source method not found.' });
    }
    
    console.log('[调试处理器.处理获取活动会话] 找到 ' + sessions.length + ' 个会话。');
    // Filter sensitive data before sending
    const safeSessions = sessions.map(s => ({ 
      userId: s.userId,
      token: s.token ? String(s.token).substring(0,10) + '...' : null, 
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastAccessedAt: s.lastAccessedAt,
      userData: s.userData 
    })); 

    // 根据 Accept 请求头决定返回 HTML 还是 JSON
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml && process.env.NODE_ENV !== 'production') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(generateSessionsHtml(safeSessions));
    } else {
      sendSuccess(res, 200, '成功获取活动会话。', { sessions: safeSessions });
    }
  } catch (error) {
    console.error('[调试处理器.处理获取活动会话] 获取会话时出错:', error);
    sendError(res, 500, '无法获取会话', { message: error.message });
  }
}

/**
 * Handles serving the debug dashboard HTML page.
 * @param {Object} req Request object
 * @param {Object} res Response object
 */
function handleGetDebugDashboard(req, res) {
  // 构造 debugDashboard.html 的绝对路径
  // __dirname 是当前文件(debugHandlers.js)所在的目录: mishi_server/src/handlers
  // 我们需要向上两级到 mishi_server/，然后进入 src/views/debug/
  const dashboardPath = path.join(__dirname, '..', 'views', 'debug', 'debugDashboard.html');
  fs.readFile(dashboardPath, 'utf8', (err, data) => {
    if (err) {
      console.error('[调试处理器.处理获取调试主页] 读取HTML文件时出错:', err);
      sendError(res, 500, '无法加载调试主页', { message: err.message });
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
}

module.exports = {
  handleGetActiveRooms,
  handleGetActiveSessions,
  handleGetDebugDashboard
}; 