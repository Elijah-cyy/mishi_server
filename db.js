const { Sequelize, DataTypes } = require("sequelize");

// 从环境变量中读取数据库配置，如果环境变量不存在则使用本地配置
const MYSQL_USERNAME = process.env.MYSQL_USERNAME || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '123456';
const MYSQL_ADDRESS = process.env.MYSQL_ADDRESS || 'localhost:3306';

const [host, port] = MYSQL_ADDRESS.split(":");

const sequelize = new Sequelize("nodejs_demo", MYSQL_USERNAME, MYSQL_PASSWORD, {
  host,
  port,
  dialect: "mysql",
  // 添加本地开发配置
  define: {
    timestamps: true,
    freezeTableName: true
  },
  // 添加连接池配置
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// 定义数据模型
const Counter = sequelize.define("Counter", {
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
});

// 数据库初始化方法
async function init() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    await Counter.sync({ alter: true });
    console.log('数据库表同步成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 导出初始化方法和模型
module.exports = {
  init,
  Counter,
};
