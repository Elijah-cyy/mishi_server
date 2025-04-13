/**
 * 微信认证工具
 * 提供微信小程序和小游戏登录认证功能
 */

const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 微信小游戏配置
 */
const WX_CONFIG = {
  appId: process.env.WX_APP_ID || config.weixin.appId,
  appSecret: process.env.WX_APP_SECRET || config.weixin.appSecret
};

/**
 * 使用登录凭证向微信服务器换取用户信息
 * @param {string} code 登录凭证
 * @returns {Promise<Object|null>} 包含openId和会话密钥的对象
 */
async function code2Session(code) {
  if (!code) {
    throw new Error('登录凭证不能为空');
  }

  // 检查配置
  if (!WX_CONFIG.appId || !WX_CONFIG.appSecret) {
    throw new Error('微信小游戏配置未设置，请检查环境变量');
  }

  try {
    // 微信登录API
    const url = 'https://api.weixin.qq.com/sns/jscode2session';
    const params = {
      appid: WX_CONFIG.appId,
      secret: WX_CONFIG.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    };

    console.log('调用微信接口，参数:', params);

    const response = await axios.get(url, { params });
    const data = response.data;

    console.log('微信接口返回数据:', data);

    // 检查微信API返回的错误
    if (data.errcode) {
      console.error('微信登录API错误:', data.errcode, data.errmsg);
      throw new Error(`微信登录失败: ${data.errmsg || '未知错误'} (错误码: ${data.errcode})`);
    }

    return {
      openId: data.openid,
      sessionKey: data.session_key,
      unionId: data.unionid // 可能为undefined
    };
  } catch (error) {
    console.error('微信登录请求失败:', error);
    throw new Error('微信登录请求失败: ' + (error.message || '未知错误'));
  }
}

/**
 * 解密微信用户数据
 * @param {string} encryptedData 加密数据
 * @param {string} iv 加密算法的初始向量
 * @param {string} sessionKey 会话密钥
 * @returns {Object} 解密后的用户数据
 */
function decryptData(encryptedData, iv, sessionKey) {
  // 检查参数
  if (!encryptedData || !iv || !sessionKey) {
    throw new Error('解密参数不完整');
  }

  // Base64解码
  const decodedSessionKey = Buffer.from(sessionKey, 'base64');
  const decodedEncryptedData = Buffer.from(encryptedData, 'base64');
  const decodedIv = Buffer.from(iv, 'base64');

  try {
    // 创建解密器
    const decipher = crypto.createDecipheriv('aes-128-cbc', decodedSessionKey, decodedIv);
    
    // 禁用自动填充
    decipher.setAutoPadding(true);
    
    // 解密
    let decrypted = decipher.update(decodedEncryptedData, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    
    // 解析JSON
    const data = JSON.parse(decrypted);
    
    // 检查数据水印
    if (data.watermark && data.watermark.appid !== WX_CONFIG.appId) {
      throw new Error('数据水印AppID不匹配');
    }
    
    return data;
  } catch (error) {
    console.error('解密用户数据失败:', error);
    throw new Error('解密用户数据失败');
  }
}

/**
 * 生成签名
 * @param {Object} params 参数对象
 * @param {string} key 密钥
 * @returns {string} 签名
 */
function generateSignature(params, key) {
  // 1. 将所有参数按字典序排序
  const sortedKeys = Object.keys(params).sort();
  
  // 2. 拼接参数
  let queryString = '';
  for (const k of sortedKeys) {
    // 跳过空值
    if (params[k] === undefined || params[k] === null || params[k] === '') {
      continue;
    }
    queryString += `${k}=${params[k]}&`;
  }
  
  // 3. 拼接密钥
  queryString += `key=${key}`;
  
  // 4. MD5加密并转为大写
  return crypto.createHash('md5').update(queryString).digest('hex').toUpperCase();
}

/**
 * 验证微信服务器消息签名
 * @param {string} signature 微信签名
 * @param {string} timestamp 时间戳
 * @param {string} nonce 随机数
 * @param {string} token 令牌
 * @returns {boolean} 签名是否有效
 */
function verifySignature(signature, timestamp, nonce, token) {
  if (!signature || !timestamp || !nonce || !token) {
    return false;
  }

  try {
    // 按照微信的规则对参数进行排序并拼接
    const tmpArr = [token, timestamp, nonce];
    tmpArr.sort();
    const tmpStr = tmpArr.join('');
    
    // 进行sha1签名
    const sha1 = crypto.createHash('sha1');
    sha1.update(tmpStr);
    const hash = sha1.digest('hex');
    
    // 与微信传来的签名对比
    return hash === signature;
  } catch (error) {
    console.error('验证签名失败:', error);
    return false;
  }
}

/**
 * 生成JWT令牌
 * @param {Object} payload 令牌数据负载
 * @returns {string} JWT令牌
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/**
 * 验证JWT令牌
 * @param {string} token JWT令牌
 * @returns {Object|null} 令牌数据负载或null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    console.error('JWT令牌验证失败:', error);
    return null;
  }
}

module.exports = {
  code2Session,
  decryptData,
  verifySignature,
  generateToken,
  verifyToken,
  generateSignature
}; 