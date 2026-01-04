// controllers/roomController.js
const Room = require("../models/Room");
const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");
const mongoose = require("mongoose");

/** ==============================================
 *  HELPER FUNCTIONS
 * ============================================== */

/**
 * Check if a user is friends with another user
 */
const isFriend = (user, candidateId) => {
  if (!user || !user.friends) return false;
  return user.friends.some(
    (f) => f.userId.toString() === candidateId.toString()
  );
};

/**
 * Generate a unique 6-character room code
 */
const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if user is already a participant in the room
 */
const userInRoom = (room, userId) => {
  return room.participants.some((p) => p.toString() === userId.toString());
};

/**
 * Check if user has any role in the room (captain, player, or umpire)
 */
const userHasRole = (room, userId) => {
  const userIdStr = userId.toString();
  
  // Check if umpire
  if (room.umpire && room.umpire.userId.toString() === userIdStr) {
    return { hasRole: true, role: 'umpire', team: null };
  }
  
  // Check Team A
  if (room.teamA.captain && room.teamA.captain.userId.toString() === userIdStr) {
    return { hasRole: true, role: 'captain', team: 'A' };
  }
  if (room.teamA.players.some(p => p.userId.toString() === userIdStr)) {
    return { hasRole: true, role: 'player', team: 'A' };
  }
  
  // Check Team B
  if (room.teamB.captain && room.teamB.captain.userId.toString() === userIdStr) {
    return { hasRole: true, role: 'captain', team: 'B' };
  }
  if (room.teamB.players.some(p => p.userId.toString() === userIdStr)) {
    return { hasRole: true, role: 'player', team: 'B' };
  }
  
  return { hasRole: false, role: null, team: null };
};

/**
 * Remove player from all teams and umpire role
 */
const removePlayerFromTeams = (room, userIdStr) => {
  const removeFrom = (team) => {
    team.players = team.players.filter(
      (p) => p.userId.toString() !== userIdStr
    );
    if (team.captain && team.captain.userId.toString() === userIdStr) {
      team.captain = null;
    }
  };
  
  removeFrom(room.teamA);
  removeFrom(room.teamB);
  
  if (room.umpire && room.umpire.userId.toString() === userIdStr) {
    room.umpire = null;
  }
  
  room.participants = room.participants.filter(
    (p) => p.toString() !== userIdStr
  );
};

/**
 * AUTO-ASSIGN ROLES BASED ON ROOM STATE
 * This is the core logic for intelligent role assignment
 */
const autoAssignRole = async (room, user) => {
  const userId = user._id || user.id;
  const username = user.username;
  
  // Check if user already has a role
  const roleStatus = userHasRole(room, userId);
  if (roleStatus.hasRole) {
    return {
      assigned: false,
      reason: `Already assigned as ${roleStatus.role} in Team ${roleStatus.team || 'N/A'}`,
      currentRole: roleStatus
    };
  }
  
  // Count current participants with roles
  const teamACount = (room.teamA.captain ? 1 : 0) + room.teamA.players.length;
  const teamBCount = (room.teamB.captain ? 1 : 0) + room.teamB.players.length;
  const hasUmpire = !!room.umpire;
  
  // RULE 1: If only creator exists, new joiner becomes Team B captain
  if (room.participants.length === 1) {
    room.teamB.captain = { userId, username };
    return {
      assigned: true,
      role: 'captain',
      team: 'B',
      reason: 'First joiner - Auto-assigned as Team B Captain'
    };
  }
  
  // RULE 2: If no umpire assigned yet, suggest umpire role (but don't force)
  if (!hasUmpire && room.participants.length === 2) {
    // Don't auto-assign umpire, just notify
    return {
      assigned: false,
      role: 'pending',
      team: null,
      reason: 'Waiting for manual role assignment. Umpire role available.',
      suggestion: 'umpire'
    };
  }
  
  // RULE 3: Balance teams - assign to team with fewer players
  if (teamACount < teamBCount) {
    // Assign to Team A
    if (!room.teamA.captain) {
      room.teamA.captain = { userId, username };
      return {
        assigned: true,
        role: 'captain',
        team: 'A',
        reason: 'Auto-assigned as Team A Captain (team balancing)'
      };
    } else {
      room.teamA.players.push({ userId, username });
      return {
        assigned: true,
        role: 'player',
        team: 'A',
        reason: 'Auto-assigned as Team A Player (team balancing)'
      };
    }
  } else if (teamBCount < teamACount) {
    // Assign to Team B
    if (!room.teamB.captain) {
      room.teamB.captain = { userId, username };
      return {
        assigned: true,
        role: 'captain',
        team: 'B',
        reason: 'Auto-assigned as Team B Captain (team balancing)'
      };
    } else {
      room.teamB.players.push({ userId, username });
      return {
        assigned: true,
        role: 'player',
        team: 'B',
        reason: 'Auto-assigned as Team B Player (team balancing)'
      };
    }
  } else {
    // Teams are equal, assign to Team A by default
    if (!room.teamA.captain) {
      room.teamA.captain = { userId, username };
      return {
        assigned: true,
        role: 'captain',
        team: 'A',
        reason: 'Auto-assigned as Team A Captain'
      };
    } else if (teamACount < room.maxPlayersPerTeam) {
      room.teamA.players.push({ userId, username });
      return {
        assigned: true,
        role: 'player',
        team: 'A',
        reason: 'Auto-assigned as Team A Player'
      };
    } else if (!room.teamB.captain) {
      room.teamB.captain = { userId, username };
      return {
        assigned: true,
        role: 'captain',
        team: 'B',
        reason: 'Auto-assigned as Team B Captain'
      };
    } else if (teamBCount < room.maxPlayersPerTeam) {
      room.teamB.players.push({ userId, username });
      return {
        assigned: true,
        role: 'player',
        team: 'B',
        reason: 'Auto-assigned as Team B Player'
      };
    }
  }
  
  // If we reach here, room is full
  return {
    assigned: false,
    role: 'spectator',
    team: null,
    reason: 'Room is full - joined as spectator'
  };
};

/**
 * Emit real-time notification to all room participants
 */
const emitRoomNotification = (io, roomId, event, data) => {
  io.to(roomId).emit(event, {
    ...data,
    timestamp: new Date(),
    roomId
  });
};

/** ==============================================
 *  ROOM MANAGEMENT ENDPOINTS
 * ============================================== */

/**
 * CREATE ROOM
 * POST /rooms
 * body: { name }
 */
exports.createRoom = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  let roomCode;
  let isUnique = false;

  // Generate unique room code
  while (!isUnique) {
    roomCode = generateRoomCode();
    const existingRoom = await Room.findOne({ roomCode });
    if (!existingRoom) isUnique = true;
  }

  const room = await Room.create({
    name: name || `${req.user.username}'s Room`,
    roomCode,
    createdBy: userId,
    participants: [userId],
  });

  res.status(201).json({
    message: "Room created successfully",
    room,
    info: "You are the room creator. Share the room code with others to join."
  });
});

/**
 * JOIN ROOM BY CODE WITH AUTO ROLE ASSIGNMENT
 * POST /rooms/join
 * body: { roomCode }
 */
exports.joinRoomByCode = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { roomCode } = req.body;
  
  if (!roomCode) {
    return res.status(400).json({ message: "roomCode is required" });
  }

  const room = await Room.findOne({ roomCode });
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot join: game already started or finished" 
    });
  }

  // Get user details
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check if already in room
  if (userInRoom(room, userId)) {
    return res.status(400).json({ 
      message: "You are already in this room",
      room 
    });
  }

  // Add to participants
  room.participants.push(userId);

  // AUTO-ASSIGN ROLE
  const assignmentResult = await autoAssignRole(room, user);
  
  await room.save();

  // Get Socket.IO instance
  const io = req.app.get("io");

  // EMIT TO ALL ROOM MEMBERS: New user joined
  emitRoomNotification(io, room._id.toString(), "room:user-joined", {
    user: {
      userId: user._id,
      username: user.username
    },
    assignment: assignmentResult,
    totalParticipants: room.participants.length,
    message: `${user.username} joined the room`
  });

  // EMIT ROLE ASSIGNMENT if auto-assigned
  if (assignmentResult.assigned) {
    emitRoomNotification(io, room._id.toString(), "room:role-assigned", {
      user: {
        userId: user._id,
        username: user.username
      },
      role: assignmentResult.role,
      team: assignmentResult.team,
      reason: assignmentResult.reason,
      message: `${user.username} assigned as ${assignmentResult.role}${assignmentResult.team ? ` in Team ${assignmentResult.team}` : ''}`
    });
  }

  res.json({ 
    message: "Joined room successfully", 
    room,
    assignment: assignmentResult
  });
});

/**
 * GET ROOM DETAILS
 * GET /rooms/:id
 */
exports.getRoom = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  
  const room = await Room.findById(id)
    .populate("participants", "username email")
    .lean();
    
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }
  
  // Add computed fields for client
  const roomWithMetadata = {
    ...room,
    teamACount: (room.teamA.captain ? 1 : 0) + room.teamA.players.length,
    teamBCount: (room.teamB.captain ? 1 : 0) + room.teamB.players.length,
    hasUmpire: !!room.umpire,
    isReady: room.overs > 0 && room.umpire && room.teamA.captain && room.teamB.captain
  };
  
  res.json(roomWithMetadata);
});

/**
 * ASSIGN UMPIRE
 * POST /rooms/:id/assign-umpire
 * body: { userId }
 */
exports.assignUmpire = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }
  
  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot change umpire after game started" 
    });
  }

  // Permission: only creator or existing umpire
  const isCreator = room.createdBy.toString() === callerId;
  const isCurrentUmpire = room.umpire && room.umpire.userId.toString() === callerId;
  
  if (!isCreator && !isCurrentUmpire) {
    return res.status(403).json({ 
      message: "Only room creator or current umpire can assign umpire" 
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Remove user from any team roles
  removePlayerFromTeams(room, userId.toString());

  // Assign as umpire
  room.umpire = { userId: user.id, username: user.username };
  
  if (!userInRoom(room, user.id)) {
    room.participants.push(user.id);
  }

  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:umpire-assigned", {
    umpire: room.umpire,
    message: `${user.username} is now the umpire`
  });

  res.json({ 
    message: "Umpire assigned successfully", 
    umpire: room.umpire, 
    room 
  });
});

/**
 * SET GAME SETTINGS
 * POST /rooms/:id/set-settings
 * body: { overs, maxPlayersPerTeam }
 */
exports.setSettings = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { overs, maxPlayersPerTeam } = req.body;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Only umpire can set settings
  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ 
      message: "Only umpire can modify game settings" 
    });
  }

  // Validate and update overs
  if (typeof overs !== "undefined") {
    const n = Number(overs);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return res.status(400).json({ 
        message: "Overs must be between 1 and 50" 
      });
    }
    room.overs = n;
  }
  
  // Validate and update max players per team
  if (typeof maxPlayersPerTeam !== "undefined") {
    const m = Number(maxPlayersPerTeam);
    if (!Number.isInteger(m) || m < 1 || m > 11) {
      return res.status(400).json({ 
        message: "maxPlayersPerTeam must be between 1 and 11" 
      });
    }
    room.maxPlayersPerTeam = m;
  }

  await room.save();

  // Emit settings update to all participants
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:settings-updated", {
    overs: room.overs,
    maxPlayersPerTeam: room.maxPlayersPerTeam,
    message: "Game settings updated"
  });

  res.json({ 
    message: "Settings updated successfully", 
    room 
  });
});

/**
 * SELECT/ADD PLAYER TO TEAM
 * POST /rooms/:id/select-player
 * body: { team: "A"|"B", userId, asCaptain: boolean }
 */
exports.selectPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, userId, asCaptain } = req.body;
  
  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({ message: "team must be 'A' or 'B'" });
  }
  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }
  
  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot select players after game started" 
    });
  }

  // Must be participant
  if (!userInRoom(room, selectorId)) {
    return res.status(403).json({ 
      message: "You must join the room first" 
    });
  }

  // Permission check
  const teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain = teamObj.captain && teamObj.captain.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;
  
  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only team captain or room creator can select players",
    });
  }

  // Get candidate user
  const candidate = await User.findById(userId);
  if (!candidate) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check friendship
  const selectorUser = await User.findById(selectorId);
  if (!isFriend(selectorUser, candidate.id)) {
    return res.status(400).json({ 
      message: "You can only select players from your friends list" 
    });
  }

  // Check if already has a role
  const roleStatus = userHasRole(room, candidate.id);
  if (roleStatus.hasRole) {
    return res.status(400).json({ 
      message: `User is already ${roleStatus.role} in Team ${roleStatus.team || 'N/A'}` 
    });
  }

  // Handle captain assignment
  if (asCaptain) {
    teamObj.captain = { userId: candidate.id, username: candidate.username };
    if (!userInRoom(room, candidate.id)) {
      room.participants.push(candidate.id);
    }
    await room.save();

    // Emit event
    const io = req.app.get("io");
    emitRoomNotification(io, id, "room:captain-assigned", {
      team,
      captain: { userId: candidate.id, username: candidate.username },
      message: `${candidate.username} is now captain of Team ${team}`
    });

    return res.json({ 
      message: `Captain set for Team ${team}`, 
      room 
    });
  }

  // Check team size limit
  const currentCount = teamObj.players.length + (teamObj.captain ? 1 : 0);
  if (currentCount >= room.maxPlayersPerTeam) {
    return res.status(400).json({ 
      message: `Team ${team} already has maximum players (${room.maxPlayersPerTeam})` 
    });
  }

  // Add as regular player
  teamObj.players.push({ userId: candidate.id, username: candidate.username });
  if (!userInRoom(room, candidate.id)) {
    room.participants.push(candidate.id);
  }

  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:player-added", {
    team,
    player: { userId: candidate.id, username: candidate.username },
    message: `${candidate.username} added to Team ${team}`
  });

  res.json({ 
    message: `Player added to Team ${team}`, 
    room 
  });
});

/**
 * REMOVE PLAYER FROM TEAM
 * POST /rooms/:id/remove-player
 * body: { team: "A"|"B", userId }
 */
exports.removePlayer = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { team, userId } = req.body;
  
  if (!team || !["A", "B"].includes(team) || !userId) {
    return res.status(400).json({ 
      message: "team and userId required" 
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }
  
  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot remove players after game started" 
    });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain = teamObj.captain && teamObj.captain.userId.toString() === callerId;
  const isCreator = room.createdBy.toString() === callerId;
  
  if (!isCaptain && !isCreator) {
    return res.status(403).json({ 
      message: "Only team captain or room creator can remove players" 
    });
  }

  const uid = userId.toString();
  
  // Get username before removal
  let removedUsername = null;
  const playerToRemove = teamObj.players.find(p => p.userId.toString() === uid);
  if (playerToRemove) {
    removedUsername = playerToRemove.username;
  } else if (teamObj.captain && teamObj.captain.userId.toString() === uid) {
    removedUsername = teamObj.captain.username;
  }

  // Remove from team
  teamObj.players = teamObj.players.filter((p) => p.userId.toString() !== uid);
  if (teamObj.captain && teamObj.captain.userId.toString() === uid) {
    teamObj.captain = null;
  }

  // Remove from participants
  room.participants = room.participants.filter((p) => p.toString() !== uid);
  
  await room.save();

  // Emit socket event
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:player-removed", {
    team,
    userId,
    username: removedUsername,
    message: `${removedUsername || 'Player'} removed from Team ${team}`
  });

  res.json({ 
    message: "Player removed successfully", 
    room 
  });
});

/**
 * ADD STATIC PLAYER (non-user)
 * POST /rooms/:id/add-static-player
 * body: { team: "A"|"B", name, asCaptain: boolean }
 */
exports.addStaticPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, name, asCaptain } = req.body;

  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({ message: "team must be A or B" });
  }
  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Player name required" });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot add players after game started" 
    });
  }

  // Permission check
  const teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain = teamObj.captain?.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only team captain or room creator can add static players",
    });
  }

  // Add as static captain
  if (asCaptain) {
    teamObj.staticCaptain = name;
    await room.save();

    const io = req.app.get("io");
    emitRoomNotification(io, id, "room:static-captain-added", {
      team,
      name,
      message: `${name} added as static captain of Team ${team}`
    });

    return res.json({ 
      message: "Static captain added", 
      room 
    });
  }

  // Add as static player
  teamObj.staticPlayers.push(name);
  await room.save();

  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:static-player-added", {
    team,
    name,
    message: `${name} added as static player to Team ${team}`
  });

  res.json({
    message: "Static player added",
    room,
  });
});

/**
 * REMOVE STATIC PLAYER
 * POST /rooms/:id/remove-static-player
 * body: { team: "A"|"B", name }
 */
exports.removeStaticPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, name } = req.body;

  if (!team || !["A", "B"].includes(team)) {
    return res.status(400).json({ message: "team must be A or B" });
  }

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "Player name required" });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (room.status !== "pending") {
    return res.status(400).json({ 
      message: "Cannot remove players after game started" 
    });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;

  // Permission check
  const isCaptain = teamObj.captain && teamObj.captain.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({ 
      message: "Only team captain or room creator can remove static players" 
    });
  }

  // Remove static captain
  if (teamObj.staticCaptain && teamObj.staticCaptain === name) {
    teamObj.staticCaptain = null;
  }

  // Remove static player from list
  teamObj.staticPlayers = teamObj.staticPlayers.filter(
    (playerName) => playerName !== name
  );

  await room.save();

  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:static-player-removed", {
    team,
    name,
    message: `${name} removed from Team ${team}`
  });

  res.json({
    message: "Static player removed",
    room,
  });
});

/**
 * START GAME
 * POST /rooms/:id/start
 */
exports.startGame = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Only umpire can start
  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ 
      message: "Only umpire can start the game" 
    });
  }

  // Validate overs
  if (!Number.isInteger(room.overs) || room.overs < 1) {
    return res.status(400).json({ 
      message: "Please set valid overs (minimum 1)" 
    });
  }

  // Validate team sizes
  const countTeamA = (room.teamA.captain ? 1 : 0) + room.teamA.players.length + room.teamA.staticPlayers.length + (room.teamA.staticCaptain ? 1 : 0);
  const countTeamB = (room.teamB.captain ? 1 : 0) + room.teamB.players.length + room.teamB.staticPlayers.length + (room.teamB.staticCaptain ? 1 : 0);
  
  if (countTeamA < 1 || countTeamA > room.maxPlayersPerTeam) {
    return res.status(400).json({
      message: `Team A must have 1-${room.maxPlayersPerTeam} players (currently ${countTeamA})`,
    });
  }
  if (countTeamB < 1 || countTeamB > room.maxPlayersPerTeam) {
    return res.status(400).json({
      message: `Team B must have 1-${room.maxPlayersPerTeam} players (currently ${countTeamB})`,
    });
  }

  // Check for duplicate user assignments
  const setIds = new Set();
  const addIf = (p) => {
    if (!p) return true;
    const idStr = p.userId ? p.userId.toString() : p.toString();
    if (setIds.has(idStr)) return false;
    setIds.add(idStr);
    return true;
  };

  if (room.umpire && !addIf(room.umpire)) {
    return res.status(400).json({ 
      message: "Conflict: User assigned to multiple roles" 
    });
  }

  for (const p of room.teamA.players || []) {
    if (!addIf(p)) {
      return res.status(400).json({ 
        message: "Conflict: User assigned to multiple roles" 
      });
    }
  }
  if (room.teamA.captain && !addIf(room.teamA.captain)) {
    return res.status(400).json({ 
      message: "Conflict: User assigned to multiple roles" 
    });
  }

  for (const p of room.teamB.players || []) {
    if (!addIf(p)) {
      return res.status(400).json({ 
        message: "Conflict: User assigned to multiple roles" 
      });
    }
  }
  if (room.teamB.captain && !addIf(room.teamB.captain)) {
    return res.status(400).json({ 
      message: "Conflict: User assigned to multiple roles" 
    });
  }

  // All validations passed - start game
  room.status = "in_progress";
  await room.save();

  // Emit to all participants
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:game-started", {
    status: "in_progress",
    message: "🏏 Game has started!",
    teamA: {
      count: countTeamA,
      captain: room.teamA.captain?.username || room.teamA.staticCaptain
    },
    teamB: {
      count: countTeamB,
      captain: room.teamB.captain?.username || room.teamB.staticCaptain
    }
  });

  res.json({ 
    message: "Game started successfully", 
    room 
  });
});

/**
 * DO TOSS
 * POST /rooms/:id/toss
 */
exports.doToss = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Only umpire can do toss
  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ 
      message: "Only umpire can start the toss" 
    });
  }

  if (room.status !== "in_progress") {
    return res.status(400).json({ 
      message: "Game must be started before toss" 
    });
  }

  if (room.tossWinner) {
    return res.status(400).json({ 
      message: "Toss already completed" 
    });
  }

  // Random toss
  const winner = Math.random() < 0.5 ? "A" : "B";
  room.tossWinner = winner;
  await room.save();

  // Emit toss result
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:toss-result", {
    winner,
    message: `🪙 Team ${winner} won the toss!`
  });

  res.json({
    message: `Team ${winner} won the toss`,
    tossWinner: winner,
    room,
  });
});

/**
 * CHOOSE TOSS OPTION (bat/ball)
 * POST /rooms/:id/toss-choice
 * body: { choice: "bat"|"ball" }
 */
exports.chooseTossOption = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { choice } = req.body;

  if (!["bat", "ball"].includes(choice)) {
    return res.status(400).json({ 
      message: "choice must be 'bat' or 'ball'" 
    });
  }

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (!room.tossWinner) {
    return res.status(400).json({ 
      message: "Toss not done yet" 
    });
  }

  // Only winning team's captain or creator can choose
  const winningTeamObj = room.tossWinner === "A" ? room.teamA : room.teamB;
  const isCaptain = winningTeamObj.captain && winningTeamObj.captain.userId.toString() === callerId;
  const isCreator = room.createdBy.toString() === callerId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only winning team's captain or room creator can choose",
    });
  }

  room.tossChoice = choice;
  await room.save();
  
  // Emit toss choice
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:toss-choice", {
    team: room.tossWinner,
    choice,
    message: `Team ${room.tossWinner} chose to ${choice} first`
  });
  
  res.json({ 
    message: `Team ${room.tossWinner} chose to ${choice}`, 
    tossChoice: choice, 
    room 
  });
});

/**
 * LEAVE ROOM
 * POST /rooms/:id/leave
 */
exports.leaveRoom = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Get user info before removal
  const user = await User.findById(callerId);
  const username = user ? user.username : "User";

  // Remove from all roles
  removePlayerFromTeams(room, callerId);

  await room.save();

  // Emit leave event
  const io = req.app.get("io");
  emitRoomNotification(io, id, "room:user-left", {
    userId: callerId,
    username,
    message: `${username} left the room`,
    remainingParticipants: room.participants.length
  });

  res.json({ 
    message: "Left room successfully", 
    room 
  });
});

/**
 * GET MY CREATED ROOMS
 * GET /rooms/my-created-rooms
 */
exports.getMyCreatedRooms = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  const rooms = await Room.find({ createdBy: userId })
    .populate("participants", "username email")
    .sort({ createdAt: -1 });

  res.json({
    message: "My created rooms",
    count: rooms.length,
    rooms,
  });
});

module.exports = exports;