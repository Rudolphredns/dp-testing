const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mysql = require("mysql");

// สร้าง Express App
const app = express();
const PORT = process.env.PORT || 3000;

// เสิร์ฟไฟล์ static จากโฟลเดอร์ public
app.use(express.static("public"));

// สร้าง HTTP Server
const server = http.createServer(app);

// ตั้งค่า WebSocket Server
const wss = new WebSocket.Server({ server });

// ตั้งค่า MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "test",
});

// เชื่อมต่อกับฐานข้อมูล
db.connect((err) => {
  if (err) {
    console.error("Failed to connect to MySQL:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL database!");
});

// ฟังก์ชันบันทึกข้อความลงฐานข้อมูล
function saveMessageToDB(message) {
  const query = "INSERT INTO messages (message) VALUES (?)";
  db.query(query, [message], (err) => {
    if (err) {
      console.error("Failed to save message:", err);
    } else {
      console.log("Message saved to database.");
    }
  });
}

// WebSocket สำหรับ WebRTC signaling และ Chat messaging
wss.on("connection", (ws) => {
  console.log("New WebSocket connection.");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "chat-message":
        // บันทึกข้อความลงฐานข้อมูล
        saveMessageToDB(data.message);

        // ส่งข้อความให้ผู้ใช้อื่น
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "chat-message", message: data.message }));
          }
        });
        break;

      case "call-offer":
        // ส่ง offer ไปยังผู้ใช้อื่น
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "incoming-call", offer: data.offer }));
          }
        });
        break;

      case "call-answer":
        // ส่ง answer กลับไปยัง initiator
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "call-answered", answer: data.answer }));
          }
        });
        break;

      case "call-rejected":
        // แจ้ง initiator ว่าผู้ใช้ปฏิเสธสาย
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "call-rejected" }));
          }
        });
        break;

      default:
        console.log("Unknown message type:", data.type);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
  });
});

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
