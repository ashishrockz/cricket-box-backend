// server.js
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  }
});

// Middleware
app.use(express.json());

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// Store active rooms and users
const activeRooms = new Map(); // roomId -> Set of socket IDs
const userSockets = new Map(); // userId -> socket ID

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);
  
  // Store user socket mapping
  userSockets.set(socket.userId, socket.id);

  // ==================== ROOM EVENTS ====================
  
  // Join a room
  socket.on("room:join", async (roomId) => {
    try {
      socket.join(roomId);
      
      // Track active users in room
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      // Notify others in room
      socket.to(roomId).emit("room:user-joined", {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date()
      });

      // Send current room state to joining user
      const Room = require("./models/Room");
      const room = await Room.findById(roomId)
        .populate("participants", "username");
      
      socket.emit("room:state", room);

      console.log(`${socket.username} joined room: ${roomId}`);
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
      timestamp: new Date()
    });

    console.log(`${socket.username} left room: ${roomId}`);
  });

  // Player selection update
  socket.on("room:player-selected", (data) => {
    const { roomId, team, player, asCaptain } = data;
    
    io.to(roomId).emit("room:player-updated", {
      action: "added",
      team,
      player,
      asCaptain,
      timestamp: new Date()
    });
  });

  // Player removal update
  socket.on("room:player-removed", (data) => {
    const { roomId, team, playerId } = data;
    
    io.to(roomId).emit("room:player-updated", {
      action: "removed",
      team,
      playerId,
      timestamp: new Date()
    });
  });

  // Settings update
  socket.on("room:settings-changed", (data) => {
    const { roomId, overs, maxPlayersPerTeam } = data;
    
    io.to(roomId).emit("room:settings-updated", {
      overs,
      maxPlayersPerTeam,
      timestamp: new Date()
    });
  });

  // Game start
  socket.on("room:game-started", (roomId) => {
    io.to(roomId).emit("room:status-changed", {
      status: "in_progress",
      message: "Game has started!",
      timestamp: new Date()
    });
  });

  // ==================== TOSS EVENTS ====================
  
  socket.on("toss:completed", (data) => {
    const { roomId, winner } = data;
    
    io.to(roomId).emit("toss:result", {
      winner,
      message: `Team ${winner} won the toss!`,
      timestamp: new Date()
    });
  });

  socket.on("toss:choice-made", (data) => {
    const { roomId, choice, team } = data;
    
    io.to(roomId).emit("toss:choice-announced", {
      team,
      choice,
      message: `Team ${team} chose to ${choice}`,
      timestamp: new Date()
    });
  });

  // ==================== MATCH EVENTS ====================
  
  // Ball update
  socket.on("match:ball-added", async (data) => {
    const { matchId, roomId, ballData } = data;
    
    try {
      const Match = require("./models/Match");
      const match = await Match.findById(matchId).lean();
      
      const currentInnings = match.innings[match.currentInningsIndex];
      
      io.to(roomId).emit("match:ball-update", {
        ballData,
        scoreboard: {
          runs: currentInnings.totalRuns,
          wickets: currentInnings.wickets,
          overs: `${Math.floor(currentInnings.legalDeliveries / 6)}.${currentInnings.legalDeliveries % 6}`
        },
        timestamp: new Date()
      });
    } catch (err) {
      console.error("Error broadcasting ball update:", err);
    }
  });

  // Innings end
  socket.on("match:innings-ended", (data) => {
    const { roomId, inningsNumber, reason } = data;
    
    io.to(roomId).emit("match:innings-complete", {
      inningsNumber,
      reason,
      message: `Innings ${inningsNumber} completed: ${reason}`,
      timestamp: new Date()
    });
  });

  // Match end
  socket.on("match:completed", (data) => {
    const { roomId, result } = data;
    
    io.to(roomId).emit("match:finished", {
      result,
      message: result.summary,
      timestamp: new Date()
    });
  });

  // Scoreboard request
  socket.on("match:get-scoreboard", async (matchId) => {
    try {
      const Match = require("./models/Match");
      const match = await Match.findById(matchId).populate("roomId").lean();
      
      socket.emit("match:scoreboard-data", {
        matchId,
        innings: match.innings,
        currentInningsIndex: match.currentInningsIndex,
        status: match.status,
        result: match.result
      });
    } catch (err) {
      socket.emit("error", { message: "Failed to fetch scoreboard" });
    }
  });

  // New batsman selected
  socket.on("match:batsman-selected", (data) => {
    const { roomId, name, position } = data;
    
    io.to(roomId).emit("match:batsman-announced", {
      name,
      position, // "striker" or "nonStriker"
      timestamp: new Date()
    });
  });

  // New bowler selected
  socket.on("match:bowler-selected", (data) => {
    const { roomId, bowler } = data;
    
    io.to(roomId).emit("match:bowler-announced", {
      bowler,
      timestamp: new Date()
    });
  });

  // ==================== CHAT EVENTS ====================
  
  socket.on("chat:message", (data) => {
    const { roomId, message } = data;
    
    io.to(roomId).emit("chat:new-message", {
      userId: socket.userId,
      username: socket.username,
      message,
      timestamp: new Date()
    });
  });

  // ==================== DISCONNECT ====================
  
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.username}`);
    
    // Remove from user sockets
    userSockets.delete(socket.userId);
    
    // Remove from all active rooms
    activeRooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        
        io.to(roomId).emit("room:user-disconnected", {
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date()
        });
      }
    });
  });
});

// Make io accessible to routes
app.set("io", io);

// Your existing routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const friendRoutes = require("./routes/friendRoutes");
const roomRoutes = require("./routes/roomRoutes");
const matchRoutes = require("./routes/matchRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/matches", matchRoutes);
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swagger");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };