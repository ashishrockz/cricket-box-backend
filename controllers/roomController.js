// controllers/roomController.js
const Room = require("../models/Room");
const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");
const mongoose = require("mongoose");


const isFriendWith = (user, candidateId) => {
  if (!user?.friends) return false;
  return user.friends.some(
    (friend) => friend.userId.toString() === candidateId.toString()
  );
};


const generateUniqueRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if user is a participant in the room
 */
const isParticipant = (room, userId) => {
  return room.participants.some((p) => p.toString() === userId.toString());
};

/**
 * Remove user from all teams and roles
 */
const removeUserFromAllRoles = (room, userId) => {
  const userIdStr = userId.toString();

  // Remove from Team A
  room.teamA.players = room.teamA.players.filter(
    (p) => p.userId.toString() !== userIdStr
  );
  if (room.teamA.captain?.userId.toString() === userIdStr) {
    room.teamA.captain = null;
  }

  // Remove from Team B
  room.teamB.players = room.teamB.players.filter(
    (p) => p.userId.toString() !== userIdStr
  );
  if (room.teamB.captain?.userId.toString() === userIdStr) {
    room.teamB.captain = null;
  }

  // Remove from umpire
  if (room.umpire?.userId.toString() === userIdStr) {
    room.umpire = null;
  }

  // Remove from participants
  room.participants = room.participants.filter(
    (p) => p.toString() !== userIdStr
  );
};

/**
 * Check if user has permission to manage team
 */
const canManageTeam = (room, teamObj, userId) => {
  const isCreator = room.createdBy.toString() === userId.toString();
  const isCaptain = teamObj.captain?.userId.toString() === userId.toString();
  return isCreator || isCaptain;
};

/**
 * Get team count including captain
 */
const getTeamPlayerCount = (teamObj) => {
  return (
    (teamObj.captain ? 1 : 0) +
    teamObj.players.length +
    teamObj.staticPlayers.length
  );
};

/**
 * Check if user exists in any team
 */
const isUserInAnyTeam = (room, userId) => {
  const userIdStr = userId.toString();

  const inTeamA =
    room.teamA.players.some((p) => p.userId.toString() === userIdStr) ||
    room.teamA.captain?.userId.toString() === userIdStr;

  const inTeamB =
    room.teamB.players.some((p) => p.userId.toString() === userIdStr) ||
    room.teamB.captain?.userId.toString() === userIdStr;

  return inTeamA || inTeamB;
};

/** ============================================
 *  ROOM CREATION & JOINING
 *  ============================================ */

/**
 * Create a new room
 * POST /rooms
 * Body: { name? }
 */
exports.createRoom = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  // Generate unique room code
  let roomCode;
  let isUnique = false;
  while (!isUnique) {
    roomCode = generateUniqueRoomCode();
    const existing = await Room.findOne({ roomCode });
    if (!existing) isUnique = true;
  }

  // Create room
  const room = await Room.create({
    name: name || `${req.user.username}'s Room`,
    roomCode,
    createdBy: userId,
    participants: [userId],
    teamA: {
      captain: {
        userId,
        username: req.user.username,
      },
      players: [],
      staticCaptain: null,
      staticPlayers: [],
    },
  });

  res.status(201).json({
    success: true,
    message:
      "Room created successfully. You've been assigned as Team A captain.",
    data: room,
  });
});

/**
 * Join room by code
 * POST /rooms/join
 * Body: { roomCode }
 */
exports.joinRoomByCode = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { roomCode } = req.body;

  if (!roomCode) {
    return res.status(400).json({
      success: false,
      message: "Room code is required",
    });
  }

  const room = await Room.findOne({ roomCode });

  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found. Please check the room code.",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot join room. Game has already started or finished.",
    });
  }

  // Add to participants if not already present
  if (!isParticipant(room, userId)) {
    room.participants.push(userId);
    await room.save();
  }

  res.json({
    success: true,
    message: "Successfully joined the room",
    data: room,
  });
});

/**
 * Get room details
 * GET /rooms/:id
 */
exports.getRoom = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const room = await Room.findById(id)
    .populate("participants", "username")
    .lean();

  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  res.json({
    success: true,
    data: room,
  });
});

/**
 * Get user's created rooms
 * GET /rooms/my-created-rooms
 */
exports.getMyCreatedRooms = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  const rooms = await Room.find({ createdBy: userId })
    .populate("participants", "username")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: rooms,
  });
});

/** ============================================
 *  ROOM ROLES & SETTINGS
 *  ============================================ */

/**
 * Assign umpire
 * POST /rooms/:id/assign-umpire
 * Body: { userId }
 */
exports.assignUmpire = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot modify umpire after game has started",
    });
  }

  // Permission check
  const isCreator = room.createdBy.toString() === callerId;
  const isCurrentUmpire = room.umpire?.userId.toString() === callerId;

  if (!isCreator && !isCurrentUmpire) {
    return res.status(403).json({
      success: false,
      message: "Only room creator or current umpire can assign umpire role",
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Remove user from teams (umpire cannot be in teams)
  removeUserFromAllRoles(room, userId);

  // Assign umpire
  room.umpire = { userId: user._id, username: user.username };

  // Add to participants if not present
  if (!isParticipant(room, user._id)) {
    room.participants.push(user._id);
  }

  await room.save();

  res.json({
    success: true,
    message: `${user.username} has been assigned as umpire`,
    data: { umpire: room.umpire, room },
  });
});

/**
 * Update room settings
 * POST /rooms/:id/set-settings
 * Body: { overs?, maxPlayersPerTeam? }
 */
exports.setSettings = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { overs, maxPlayersPerTeam } = req.body;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  // Only umpire can modify settings
  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({
      success: false,
      message: "Only the umpire can modify game settings",
    });
  }

  // Update overs
  if (typeof overs !== "undefined") {
    const oversNum = Number(overs);
    if (!Number.isInteger(oversNum) || oversNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Overs must be a positive integer",
      });
    }
    room.overs = oversNum;
  }

  // Update max players
  if (typeof maxPlayersPerTeam !== "undefined") {
    const maxPlayers = Number(maxPlayersPerTeam);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 11) {
      return res.status(400).json({
        success: false,
        message: "Max players per team must be between 1 and 11",
      });
    }
    room.maxPlayersPerTeam = maxPlayers;
  }

  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("room:settings-updated", {
    overs: room.overs,
    maxPlayersPerTeam: room.maxPlayersPerTeam,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: "Settings updated successfully",
    data: { overs: room.overs, maxPlayersPerTeam: room.maxPlayersPerTeam },
  });
});

/** ============================================
 *  TEAM PLAYER MANAGEMENT
 *  ============================================ */

/**
 * Select player for team
 * POST /rooms/:id/select-player
 * Body: { team: "A"|"B", userId, asCaptain? }
 */
exports.selectPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, userId, asCaptain } = req.body;

  // Validation
  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({
      success: false,
      message: "Team must be 'A' or 'B'",
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot modify teams after game has started",
    });
  }

  // Must be participant
  if (!isParticipant(room, selectorId)) {
    return res.status(403).json({
      success: false,
      message: "You must join the room first",
    });
  }

  // Permission check
  const teamObj = team === "A" ? room.teamA : room.teamB;
  if (!canManageTeam(room, teamObj, selectorId)) {
    return res.status(403).json({
      success: false,
      message: "Only team captain or room creator can select players",
    });
  }

  // Verify candidate exists
  const candidate = await User.findById(userId);
  if (!candidate) {
    return res.status(404).json({
      success: false,
      message: "Selected user not found",
    });
  }

  // Friendship check
  const selector = await User.findById(selectorId);
  if (!isFriendWith(selector, candidate._id)) {
    return res.status(400).json({
      success: false,
      message: "You can only select players from your friends list",
    });
  }

  // Check if user is umpire
  if (room.umpire?.userId.toString() === candidate._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "Selected user is the umpire and cannot join a team",
    });
  }

  // Check if already in a team
  if (isUserInAnyTeam(room, candidate._id)) {
    return res.status(400).json({
      success: false,
      message: "User is already assigned to a team",
    });
  }

  // Handle captain assignment
  if (asCaptain) {
    teamObj.captain = { userId: candidate._id, username: candidate.username };
    if (!isParticipant(room, candidate._id)) {
      room.participants.push(candidate._id);
    }
    await room.save();

    return res.json({
      success: true,
      message: `${candidate.username} assigned as Team ${team} captain`,
      data: room,
    });
  }

  // Check team size limit
  if (getTeamPlayerCount(teamObj) >= room.maxPlayersPerTeam) {
    return res.status(400).json({
      success: false,
      message: `Team ${team} has reached maximum player limit`,
    });
  }

  // Add player
  teamObj.players.push({
    userId: candidate._id,
    username: candidate.username,
  });

  if (!isParticipant(room, candidate._id)) {
    room.participants.push(candidate._id);
  }

  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("room:player-updated", {
    action: "added",
    team,
    player: { userId: candidate._id, username: candidate.username },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: `${candidate.username} added to Team ${team}`,
    data: room,
  });
});

/**
 * Remove player from team
 * POST /rooms/:id/remove-player
 * Body: { team: "A"|"B", userId }
 */
exports.removePlayer = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { team, userId } = req.body;

  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({
      success: false,
      message: "Team must be 'A' or 'B'",
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot remove players after game has started",
    });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;

  // Permission check
  if (!canManageTeam(room, teamObj, callerId)) {
    return res.status(403).json({
      success: false,
      message: "Only team captain or room creator can remove players",
    });
  }

  const userIdStr = userId.toString();

  // Remove from players array
  teamObj.players = teamObj.players.filter(
    (p) => p.userId.toString() !== userIdStr
  );

  // Remove captain if applicable
  if (teamObj.captain?.userId.toString() === userIdStr) {
    teamObj.captain = null;
  }

  // Remove from participants
  room.participants = room.participants.filter(
    (p) => p.toString() !== userIdStr
  );

  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("room:player-updated", {
    action: "removed",
    team,
    playerId: userId,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: "Player removed successfully",
    data: room,
  });
});

/** ============================================
 *  STATIC/GUEST PLAYER MANAGEMENT
 *  ============================================ */

/**
 * Add static/guest player
 * POST /rooms/:id/add-static-player
 * Body: { team: "A"|"B", name, asCaptain? }
 */
exports.addStaticPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, name, asCaptain } = req.body;

  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({
      success: false,
      message: "Team must be 'A' or 'B'",
    });
  }

  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Player name is required",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot add players after game has started",
    });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;

  // Permission check
  if (!canManageTeam(room, teamObj, selectorId)) {
    return res.status(403).json({
      success: false,
      message: "Only team captain or room creator can add guest players",
    });
  }

  // Add as static captain
  if (asCaptain) {
    teamObj.staticCaptain = name.trim();
    await room.save();

    return res.json({
      success: true,
      message: `${name} added as Team ${team} guest captain`,
      data: room,
    });
  }

  // Check team size
  if (getTeamPlayerCount(teamObj) >= room.maxPlayersPerTeam) {
    return res.status(400).json({
      success: false,
      message: `Team ${team} has reached maximum player limit`,
    });
  }

  // Add static player
  teamObj.staticPlayers.push(name.trim());
  await room.save();

  res.json({
    success: true,
    message: `Guest player ${name} added to Team ${team}`,
    data: room,
  });
});

/**
 * Remove static/guest player
 * POST /rooms/:id/remove-static-player
 * Body: { team: "A"|"B", name }
 */
exports.removeStaticPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, name } = req.body;

  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({
      success: false,
      message: "Team must be 'A' or 'B'",
    });
  }

  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Player name is required",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (room.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Cannot remove players after game has started",
    });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;

  // Permission check
  if (!canManageTeam(room, teamObj, selectorId)) {
    return res.status(403).json({
      success: false,
      message: "Only team captain or room creator can remove guest players",
    });
  }

  // Remove static captain
  if (teamObj.staticCaptain === name.trim()) {
    teamObj.staticCaptain = null;
  }

  // Remove from static players
  teamObj.staticPlayers = teamObj.staticPlayers.filter(
    (playerName) => playerName !== name.trim()
  );

  await room.save();

  res.json({
    success: true,
    message: `Guest player ${name} removed from Team ${team}`,
    data: room,
  });
});

/** ============================================
 *  GAME CONTROL
 *  ============================================ */

/**
 * Start game
 * POST /rooms/:id/start
 */
exports.startGame = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  // Only umpire can start
  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({
      success: false,
      message: "Only the umpire can start the game",
    });
  }

  // Validate overs
  if (!room.overs || room.overs < 1) {
    return res.status(400).json({
      success: false,
      message: "Please set the number of overs before starting",
    });
  }

  // Validate team sizes
  const teamACount = getTeamPlayerCount(room.teamA);
  const teamBCount = getTeamPlayerCount(room.teamB);

  if (teamACount === 0 || teamBCount === 0) {
    return res.status(400).json({
      success: false,
      message: "Both teams must have at least one player",
    });
  }

  if (
    teamACount > room.maxPlayersPerTeam ||
    teamBCount > room.maxPlayersPerTeam
  ) {
    return res.status(400).json({
      success: false,
      message: `Teams cannot exceed ${room.maxPlayersPerTeam} players`,
    });
  }

  // Validate no duplicate user assignments
  const userIds = new Set();
  const addUserId = (playerObj) => {
    if (!playerObj?.userId) return true;
    const id = playerObj.userId.toString();
    if (userIds.has(id)) return false;
    userIds.add(id);
    return true;
  };

  // Check umpire
  if (room.umpire && !addUserId(room.umpire)) {
    return res.status(400).json({
      success: false,
      message: "User cannot have multiple roles",
    });
  }

  // Check Team A
  if (room.teamA.captain && !addUserId(room.teamA.captain)) {
    return res.status(400).json({
      success: false,
      message: "User cannot have multiple roles",
    });
  }
  for (const player of room.teamA.players) {
    if (!addUserId(player)) {
      return res.status(400).json({
        success: false,
        message: "User cannot have multiple roles",
      });
    }
  }

  // Check Team B
  if (room.teamB.captain && !addUserId(room.teamB.captain)) {
    return res.status(400).json({
      success: false,
      message: "User cannot have multiple roles",
    });
  }
  for (const player of room.teamB.players) {
    if (!addUserId(player)) {
      return res.status(400).json({
        success: false,
        message: "User cannot have multiple roles",
      });
    }
  }

  // Start game
  room.status = "in_progress";
  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("room:status-changed", {
    status: "in_progress",
    message: "Game has started!",
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: "Game started successfully",
    data: room,
  });
});

/**
 * Perform toss
 * POST /rooms/:id/toss
 */
exports.doToss = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({
      success: false,
      message: "Only the umpire can perform the toss",
    });
  }

  if (room.status !== "in_progress") {
    return res.status(400).json({
      success: false,
      message: "Game must be started before performing toss",
    });
  }

  if (room.tossWinner) {
    return res.status(400).json({
      success: false,
      message: "Toss has already been completed",
    });
  }

  // Perform automatic toss
  const winner = Math.random() < 0.5 ? "A" : "B";
  room.tossWinner = winner;
  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("toss:result", {
    winner,
    message: `Team ${winner} won the toss!`,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: `Team ${winner} won the toss`,
    data: { tossWinner: winner, room },
  });
});

/**
 * Choose toss option (bat/ball)
 * POST /rooms/:id/toss-choice
 * Body: { choice: "bat"|"ball" }
 */
exports.chooseTossOption = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { choice } = req.body;

  if (!["bat", "ball"].includes(choice)) {
    return res.status(400).json({
      success: false,
      message: "Choice must be 'bat' or 'ball'",
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  if (!room.tossWinner) {
    return res.status(400).json({
      success: false,
      message: "Toss must be performed first",
    });
  }

  // Determine winning team
  const winningTeam = room.tossWinner === "A" ? room.teamA : room.teamB;
  const isCaptain = winningTeam.captain?.userId.toString() === callerId;
  const isCreator = room.createdBy.toString() === callerId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      success: false,
      message: "Only the winning team's captain or room creator can choose",
    });
  }

  room.tossChoice = choice;
  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("toss:choice-announced", {
    team: room.tossWinner,
    choice,
    message: `Team ${room.tossWinner} chose to ${choice}`,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: `Team ${room.tossWinner} chose to ${choice}`,
    data: { tossChoice: choice, room },
  });
});

/**
 * Leave room
 * POST /rooms/:id/leave
 */
exports.leaveRoom = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: "Room not found",
    });
  }

  removeUserFromAllRoles(room, callerId);
  await room.save();

  res.json({
    success: true,
    message: "Successfully left the room",
    data: room,
  });
});
