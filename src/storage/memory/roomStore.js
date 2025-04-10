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
  getAllRoomIds
}; 