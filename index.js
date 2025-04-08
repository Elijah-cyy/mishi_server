const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 使用内存计数器
let counter = 0;

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    counter++;
  } else if (action === "clear") {
    counter = 0;
  }
  res.send({
    code: 0,
    data: counter,
  });
});

// 获取计数
app.get("/api/count", async (req, res) => {
  res.send({
    code: 0,
    data: counter,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("启动成功", port);
});
