/**
 * 房间内存存储模块
 * 负责管理所有活跃房间的数据
 */

// 存储所有房间对象
const rooms = new Map();

/**
 * 设置房间
 * @param {string} roomId 房间ID
 * @param {Object} roomData 房间数据
 * @returns {Object} 存储的房间数据
 */
function setRoom(roomId, roomData) {
  if (!roomId) {
    throw new Error('房间ID不能为空');
  }
  
  rooms.set(roomId, roomData);
  return roomData;
}

/**
 * 获取房间
 * @param {string} roomId 房间ID
 * @returns {Object|null} 房间数据或null
 */
function getRoom(roomId) {
  return rooms.has(roomId) ? rooms.get(roomId) : null;
}

/**
 * 检查房间是否存在
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否存在
 */
function hasRoom(roomId) {
  return rooms.has(roomId);
}

/**
 * 移除房间
 * @param {string} roomId 房间ID
 * @returns {boolean} 是否成功移除
 */
function removeRoom(roomId) {
  return rooms.delete(roomId);
}

/**
 * 获取所有房间
 * @returns {Array} 房间数组
 */
function getAllRooms() {
  return Array.from(rooms.values());
}

/**
 * 获取房间数量
 * @returns {number} 房间数量
 */
function getRoomCount() {
  return rooms.size;
}

/**
 * 根据条件查找房间
 * @param {Function} predicate 过滤函数
 * @returns {Array} 符合条件的房间数组
 */
function findRooms(predicate) {
  return Array.from(rooms.values()).filter(predicate);
}

/**
 * 根据房主ID获取房间
 * @param {string} hostId 房主ID
 * @returns {Object|null} 房间数据或null
 */
function getRoomByHostId(hostId) {
  return Array.from(rooms.values()).find(room => room.hostId === hostId) || null;
}

/**
 * 根据玩家ID获取房间
 * @param {string} playerId 玩家ID
 * @returns {Object|null} 房间数据或null
 */
function getRoomByPlayerId(playerId) {
  return Array.from(rooms.values()).find(room => 
    room.players.some(player => player.openId === playerId)
  ) || null;
}

/**
 * 清空所有房间数据
 */
function clearAllRooms() {
  rooms.clear();
}

/**
 * 获取所有房间的ID
 * @returns {Array} 房间ID数组
 */
function getAllRoomIds() {
  return Array.from(rooms.keys());
}

/**
 * 清理过期房间
 * 清理条件：
 * 1. 已结束的房间(status='ended')且超过一定时间
 * 2. 等待中但长时间无人加入的房间
 * 3. 游戏中但长时间未更新的房间
 * @param {number} options.endedMaxAge 已结束房间的最大保留时间(毫秒)，默认2分钟
 * @param {number} options.waitingMaxAge 等待中房间的最大保留时间(毫秒)，默认3小时
 * @param {number} options.playingMaxAge 游戏中房间的最大无更新时间(毫秒)，默认6小时
 * @returns {number} 清理的房间数量
 */
function cleanupExpiredRooms(options = {}) {
  const now = Date.now();
  const { 
    endedMaxAge = 2 * 60 * 1000,     // 默认2分钟
    waitingMaxAge = 3 * 60 * 60 * 1000, // 默认3小时
    playingMaxAge = 6 * 60 * 60 * 1000  // 默认6小时
  } = options;
  
  let cleanedCount = 0;
  const roomsToDelete = [];
  
  // 遍历所有房间，检查是否过期
  for (const [roomId, room] of rooms.entries()) {
    const roomAge = now - room.updatedAt;
    
    // 根据房间状态决定是否清理
    if (
      // 已结束的房间，超过endedMaxAge
      (room.status === 'ended' && roomAge > endedMaxAge) ||
      // 等待中的房间，超过waitingMaxAge
      (room.status === 'waiting' && roomAge > waitingMaxAge) ||
      // 游戏中的房间，超过playingMaxAge
      (room.status === 'playing' && roomAge > playingMaxAge)
    ) {
      roomsToDelete.push(roomId);
    }
  }
  
  // 删除标记的房间
  for (const roomId of roomsToDelete) {
    rooms.delete(roomId);
    cleanedCount++;
    console.log(`清理过期房间: ${roomId}`);
  }
  
  return cleanedCount;
}

module.exports = {
  setRoom,
  getRoom,
  hasRoom,
  removeRoom,
  getAllRooms,
  getRoomCount,
  findRooms,
  getRoomByHostId,
  getRoomByPlayerId,
  clearAllRooms,
  getAllRoomIds,
  cleanupExpiredRooms
}; 