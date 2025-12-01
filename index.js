// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");
const cors = require("cors");

// ================= DATABASE =================
connectDB();

// ================= SERVER & APP =============
const app = express();
const server = http.createServer(app);

// ================= CORS FIX (IMPORTANT) =======
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// app.options("/*", cors()); // Preflight support

app.use(express.json());

// ================= SOCKET.IO =================
const io = socketIO(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  },
});

// Socket Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) return next(new Error("Authentication error"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// Active Rooms
const activeRooms = new Map();
const userSockets = new Map();

// ================= SOCKET EVENTS =================
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);
  userSockets.set(socket.userId, socket.id);

  // Join room
  socket.on("room:join", async (roomId) => {
    try {
      socket.join(roomId);

      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      socket.to(roomId).emit("room:user-joined", {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date(),
      });

      const Room = require("./models/Room");
      const room = await Room.findById(roomId).populate(
        "participants",
        "username"
      );

      socket.emit("room:state", room);
    } catch (err) {
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Leave room
  socket.on("room:leave", (roomId) => {
    socket.leave(roomId);

    if (activeRooms.has(roomId)) {
      activeRooms.get(roomId).delete(socket.id);
    }

    socket.to(roomId).emit("room:user-left", {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date(),
    });
  });

  // Broadcast updates
  socket.on("room:player-selected", (data) =>
    io.to(data.roomId).emit("room:player-updated", data)
  );
  socket.on("room:player-removed", (data) =>
    io.to(data.roomId).emit("room:player-updated", data)
  );
  socket.on("room:settings-changed", (data) =>
    io.to(data.roomId).emit("room:settings-updated", data)
  );
  socket.on("room:game-started", (roomId) =>
    io.to(roomId).emit("room:status-changed", { status: "in_progress" })
  );

  socket.on("toss:completed", (data) =>
    io.to(data.roomId).emit("toss:result", data)
  );
  socket.on("toss:choice-made", (data) =>
    io.to(data.roomId).emit("toss:choice-announced", data)
  );

  // Ball update
  socket.on("match:ball-added", async (data) => {
    try {
      const Match = require("./models/Match");
      const match = await Match.findById(data.matchId).lean();
      const innings = match.innings[match.currentInningsIndex];

      io.to(data.roomId).emit("match:ball-update", {
        ballData: data.ballData,
        scoreboard: {
          runs: innings.totalRuns,
          wickets: innings.wickets,
          overs: `${Math.floor(innings.legalDeliveries / 6)}.${
            innings.legalDeliveries % 6
          }`,
        },
      });
    } catch (err) {
      console.log("Score update error", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.username}`);

    userSockets.delete(socket.userId);

    activeRooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        io.to(roomId).emit("room:user-disconnected", {
          userId: socket.userId,
          username: socket.username,
        });
      }
    });
  });
});

// Make io available to routes
app.set("io", io);

// ================= ROUTES =================
app.get("/", (req, res) => res.json({ status: "Cricket Box Backend Running" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/friends", require("./routes/friendRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));
app.use("/api/matches", require("./routes/matchRoutes"));

// ================= SWAGGER =================
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ================= START SERVER =============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = { app, io };
