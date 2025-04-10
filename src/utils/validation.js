/**
 * 数据验证工具 - 用于验证API请求数据
 */

/**
 * 检查字段是否存在且不为空
 * @param {*} value 要检查的值
 * @returns {boolean} 是否存在且不为空
 */
function isNotEmpty(value) {
  return value !== undefined && value !== null && value !== '';
}

/**
 * 验证字符串值
 * @param {*} value 要验证的值
 * @param {Object} options 验证选项
 * @param {number} options.minLength 最小长度
 * @param {number} options.maxLength 最大长度
 * @param {RegExp} options.pattern 匹配的正则表达式
 * @returns {boolean} 是否验证通过
 */
function validateString(value, options = {}) {
  const { minLength, maxLength, pattern } = options;
  
  // 检查是否为字符串类型
  if (typeof value !== 'string') {
    return false;
  }
  
  // 检查最小长度
  if (minLength !== undefined && value.length < minLength) {
    return false;
  }
  
  // 检查最大长度
  if (maxLength !== undefined && value.length > maxLength) {
    return false;
  }
  
  // 检查正则匹配
  if (pattern && !pattern.test(value)) {
    return false;
  }
  
  return true;
}

/**
 * 验证数字值
 * @param {*} value 要验证的值
 * @param {Object} options 验证选项
 * @param {number} options.min 最小值
 * @param {number} options.max 最大值
 * @param {boolean} options.integer 是否必须为整数
 * @returns {boolean} 是否验证通过
 */
function validateNumber(value, options = {}) {
  const { min, max, integer } = options;
  
  // 检查是否为数字类型
  const number = Number(value);
  if (isNaN(number)) {
    return false;
  }
  
  // 检查是否为整数
  if (integer && !Number.isInteger(number)) {
    return false;
  }
  
  // 检查最小值
  if (min !== undefined && number < min) {
    return false;
  }
  
  // 检查最大值
  if (max !== undefined && number > max) {
    return false;
  }
  
  return true;
}

/**
 * 验证数组值
 * @param {*} value 要验证的值
 * @param {Object} options 验证选项
 * @param {number} options.minLength 最小长度
 * @param {number} options.maxLength 最大长度
 * @param {Function} options.itemValidator 项目验证函数
 * @returns {boolean} 是否验证通过
 */
function validateArray(value, options = {}) {
  const { minLength, maxLength, itemValidator } = options;
  
  // 检查是否为数组类型
  if (!Array.isArray(value)) {
    return false;
  }
  
  // 检查最小长度
  if (minLength !== undefined && value.length < minLength) {
    return false;
  }
  
  // 检查最大长度
  if (maxLength !== undefined && value.length > maxLength) {
    return false;
  }
  
  // 验证数组项
  if (itemValidator && typeof itemValidator === 'function') {
    return value.every(item => itemValidator(item));
  }
  
  return true;
}

/**
 * 验证对象值
 * @param {*} value 要验证的值
 * @param {Object} schema 对象模式
 * @returns {boolean} 是否验证通过
 */
function validateObject(value, schema = {}) {
  // 检查是否为对象类型
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  
  // 验证每个字段
  for (const [key, validator] of Object.entries(schema)) {
    // 如果字段为必填项且不存在，则验证失败
    if (validator.required && !value.hasOwnProperty(key)) {
      return false;
    }
    
    // 如果字段存在，则验证其值
    if (value.hasOwnProperty(key) && validator.validate) {
      if (!validator.validate(value[key])) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * 验证ID值
 * @param {string} id ID值
 * @returns {boolean} 是否验证通过
 */
function validateId(id) {
  return typeof id === 'string' && id.length > 0;
}

/**
 * 验证邮箱格式
 * @param {string} email 邮箱地址
 * @returns {boolean} 是否验证通过
 */
function validateEmail(email) {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return validateString(email, { pattern: emailPattern });
}

/**
 * 验证URL格式
 * @param {string} url URL地址
 * @returns {boolean} 是否验证通过
 */
function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 请求数据验证工具
 */

/**
 * 验证请求数据是否符合模式定义
 * @param {Object} data 需要验证的数据
 * @param {Object} schema 数据模式定义
 * @returns {Object} 验证结果和处理后的数据
 */
function validateRequest(data, schema) {
  const errors = [];
  const validatedData = {};

  for (const [field, rules] of Object.entries(schema)) {
    // 检查必填字段
    if (rules.required && (data[field] === undefined || data[field] === null)) {
      errors.push({
        field,
        message: `字段 ${field} 是必填的`
      });
      continue;
    }

    // 如果字段不存在且不是必填，则使用默认值(如果有)
    if (data[field] === undefined || data[field] === null) {
      if (rules.default !== undefined) {
        validatedData[field] = rules.default;
      }
      continue;
    }

    // 根据类型验证数据
    const value = data[field];
    let typeError = false;

    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            field,
            message: `字段 ${field} 必须是字符串类型`
          });
          typeError = true;
        } else {
          // 验证最小长度
          if (rules.minLength !== undefined && value.length < rules.minLength) {
            errors.push({
              field,
              message: `字段 ${field} 长度必须大于等于 ${rules.minLength}`
            });
            typeError = true;
          }
          // 验证最大长度
          if (rules.maxLength !== undefined && value.length > rules.maxLength) {
            errors.push({
              field,
              message: `字段 ${field} 长度必须小于等于 ${rules.maxLength}`
            });
            typeError = true;
          }
          // 验证格式
          if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
            errors.push({
              field,
              message: rules.patternMessage || `字段 ${field} 格式不正确`
            });
            typeError = true;
          }
        }
        break;
        
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field,
            message: `字段 ${field} 必须是数字类型`
          });
          typeError = true;
        } else {
          // 验证最小值
          if (rules.min !== undefined && value < rules.min) {
            errors.push({
              field,
              message: `字段 ${field} 必须大于等于 ${rules.min}`
            });
            typeError = true;
          }
          // 验证最大值
          if (rules.max !== undefined && value > rules.max) {
            errors.push({
              field,
              message: `字段 ${field} 必须小于等于 ${rules.max}`
            });
            typeError = true;
          }
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field,
            message: `字段 ${field} 必须是布尔类型`
          });
          typeError = true;
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            field,
            message: `字段 ${field} 必须是数组类型`
          });
          typeError = true;
        } else {
          // 验证最小长度
          if (rules.minItems !== undefined && value.length < rules.minItems) {
            errors.push({
              field,
              message: `字段 ${field} 至少需要 ${rules.minItems} 个元素`
            });
            typeError = true;
          }
          // 验证最大长度
          if (rules.maxItems !== undefined && value.length > rules.maxItems) {
            errors.push({
              field,
              message: `字段 ${field} 最多允许 ${rules.maxItems} 个元素`
            });
            typeError = true;
          }
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            field,
            message: `字段 ${field} 必须是对象类型`
          });
          typeError = true;
        }
        break;
        
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push({
            field,
            message: `字段 ${field} 必须是有效的日期格式`
          });
          typeError = true;
        }
        break;
        
      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== 'string' || !emailPattern.test(value)) {
          errors.push({
            field,
            message: `字段 ${field} 必须是有效的邮箱格式`
          });
          typeError = true;
        }
        break;
    }

    // 自定义验证
    if (!typeError && rules.validate && typeof rules.validate === 'function') {
      try {
        const validationResult = rules.validate(value);
        if (validationResult !== true) {
          errors.push({
            field,
            message: validationResult || `字段 ${field} 验证失败`
          });
        }
      } catch (error) {
        errors.push({
          field,
          message: error.message || `字段 ${field} 验证期间发生错误`
        });
      }
    }

    // 如果没有错误，则将值添加到验证后的数据中
    if (!typeError) {
      validatedData[field] = value;
    }
  }

  // 如果有额外字段且不允许
  if (schema.__strict === true) {
    const extraFields = Object.keys(data).filter(field => !schema[field]);
    for (const field of extraFields) {
      errors.push({
        field,
        message: `未定义的字段 ${field}`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
    data: validatedData
  };
}

module.exports = {
  isNotEmpty,
  validateString,
  validateNumber,
  validateArray,
  validateObject,
  validateId,
  validateEmail,
  validateUrl,
  validateRequest
}; 