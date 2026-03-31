const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let esp32Client = null;

// Zone database
let zones = {
  zone_a: { id: "zone_a", status: false }
};

// 🔹 Broadcast zones to all dashboard clients
function broadcastZones() {
  const message = JSON.stringify({
    type: "zones_update",
    zones: zones
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 🔹 WebSocket Handling
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (message) => {
    const msg = message.toString();
    console.log("Received:", msg);

    // Register ESP32
    if (msg === "ESP32 Connected") {
      esp32Client = ws;
      console.log("ESP32 Registered");
    }

    // Optional: If ESP32 sends status back
    if (msg === "ON" || msg === "OFF") {
      zones.zone_a.status = (msg === "ON");
      broadcastZones();
    }
  });

  ws.on("close", () => {
    if (ws === esp32Client) {
      esp32Client = null;
      console.log("ESP32 Disconnected");
    }
  });

  // Send current zone status to new client
  broadcastZones();
});

// 🔹 API to control zone
app.post("/control", (req, res) => {
  const { zoneId } = req.body;

  if (!zones[zoneId]) {
    return res.status(400).json({ error: "Invalid zone" });
  }

  // Toggle state
  zones[zoneId].status = !zones[zoneId].status;

  const command = zones[zoneId].status ? "ON" : "OFF";

  // Send command to ESP32
  if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
    esp32Client.send(command);
    console.log("Sent to ESP32:", command);
  } else {
    console.log("ESP32 not connected");
  }

  broadcastZones();

  res.json({
    success: true,
    status: zones[zoneId].status
  });
});

// 🔹 Health check route
app.get("/", (req, res) => {
  res.send("ZoneFlow Server Running 🚀");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
