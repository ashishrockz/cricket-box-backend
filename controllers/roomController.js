// controllers/roomController.js
const Room = require("../models/Room");
const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");
const mongoose = require("mongoose");

/** Helpers */
const isFriend = (user, candidateId) => {
  if (!user || !user.friends) return false;
  return user.friends.some(
    (f) => f.userId.toString() === candidateId.toString()
  );
};

const userInRoom = (room, userId) => {
  return room.participants.some((p) => p.toString() === userId.toString());
};
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
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (room.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Cannot add players after game started" });
  }

  // check permission: only team captain or creator
  const teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain = teamObj.captain?.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only team captain or room creator can add static players",
    });
  }

  // Captain?
  if (asCaptain) {
    teamObj.staticCaptain = name;
    await room.save();
    return res.json({ message: "Static captain added", room });
  }

  // Add static player
  teamObj.staticPlayers.push(name);

  await room.save();

  res.json({
    message: "Static player added",
    room,
  });
});

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
  if (room.umpire && room.umpire.userId.toString() === userIdStr)
    room.umpire = null;
  room.participants = room.participants.filter(
    (p) => p.toString() !== userIdStr
  );
};
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
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (room.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Cannot remove players after game started" });
  }

  const teamObj = team === "A" ? room.teamA : room.teamB;

  // Permission: captain or creator only
  const isCaptain =
    teamObj.captain && teamObj.captain.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({ message: "Not allowed" });
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

  res.json({
    message: "Static player removed",
    room,
  });
});

/** Create room
 * POST /rooms
 * body: { name }
 */
exports.createRoom = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  const room = await Room.create({
    name: name || `${req.user.username}'s Room`,
    createdBy: userId,
    participants: [userId],
  });

  // set creator as default umpire optionally — keeping null is fine. Here we keep null so caller can assign.
  res.status(201).json({ message: "Room created", room });
});

/** Join room by roomCode
 * POST /rooms/join
 * body: { roomCode }
 */
exports.joinRoomByCode = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { roomCode } = req.body;
  if (!roomCode)
    return res.status(400).json({ message: "roomCode is required" });

  const room = await Room.findOne({ roomCode });
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (room.status !== "pending")
    return res
      .status(400)
      .json({ message: "Cannot join: game already started or finished" });

  if (!userInRoom(room, userId)) {
    room.participants.push(userId);
    await room.save();
  }

  res.json({ message: "Joined room", room });
});

/** Get room
 * GET /rooms/:id
 */
exports.getRoom = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const room = await Room.findById(id)
    .populate("participants", "username")
    .lean();
  if (!room) return res.status(404).json({ message: "Room not found" });
  res.json(room);
});

/** Assign umpire
 * POST /rooms/:id/assign-umpire
 * body: { userId } // the chosen umpire
 * Only creator or current umpire can set? We'll allow creator or current umpire.
 */
exports.assignUmpire = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.status !== "pending")
    return res
      .status(400)
      .json({ message: "Cannot change umpire after start" });

  // permission: only creator or existing umpire can set umpire
  if (
    room.createdBy.toString() !== callerId &&
    !(room.umpire && room.umpire.userId.toString() === callerId)
  ) {
    return res.status(403).json({ message: "Not allowed to assign umpire" });
  }

  // user must be participant OR invite them by adding to participants
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  // remove if user is in either team (can't be both a team player and umpire)
  removePlayerFromTeams(room, userId.toString());

  room.umpire = { userId: user._id, username: user.username };
  if (!userInRoom(room, user._id)) room.participants.push(user._id);

  await room.save();
  res.json({ message: "Umpire assigned", umpire: room.umpire, room });
});

/** Set settings (overs, maxPlayersPerTeam)
 * POST /rooms/:id/set-settings
 * body: { overs, maxPlayersPerTeam }
 * only umpire can set
 */
exports.setSettings = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { overs, maxPlayersPerTeam } = req.body;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ message: "Only umpire can set settings" });
  }

  if (typeof overs !== "undefined") {
    const n = Number(overs);
    if (!Number.isInteger(n) || n < 0)
      return res.status(400).json({ message: "Invalid overs" });
    room.overs = n;
  }
  if (typeof maxPlayersPerTeam !== "undefined") {
    const m = Number(maxPlayersPerTeam);
    if (!Number.isInteger(m) || m < 0 || m > 11)
      return res
        .status(400)
        .json({ message: "maxPlayersPerTeam must be 0..11" });
    room.maxPlayersPerTeam = m;
  }

  await room.save();
  const io = req.app.get("io");
  io.to(id).emit("room:settings-updated", {
    overs: room.overs,
    maxPlayersPerTeam: room.maxPlayersPerTeam,
    timestamp: new Date(),
  });
  res.json({ message: "Settings updated", room });
});

/** Select/add player to a team or set captain
 * POST /rooms/:id/select-player
 * body: { team: "A"|"B", userId, asCaptain: boolean }
 * selection must be made by the team captain or by the room creator? You said "team selects from their friends list" — we'll require that the selector (req.user) is captain of that team or room creator.
 */
exports.selectPlayer = asyncWrapper(async (req, res) => {
  const selectorId = req.user.id;
  const { id } = req.params;
  const { team, userId, asCaptain } = req.body;
  if (!team || !["A", "B"].includes(team))
    return res.status(400).json({ message: "team must be 'A' or 'B'" });
  if (!userId) return res.status(400).json({ message: "userId required" });

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.status !== "pending")
    return res
      .status(400)
      .json({ message: "Cannot select players after game started" });

  // must be participant
  if (!userInRoom(room, selectorId))
    return res
      .status(403)
      .json({ message: "Join the room first to select players" });

  // check permission: selector must be captain of that team OR room creator OR (optionally) the umpire - choose captain or creator
  let teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain =
    teamObj.captain && teamObj.captain.userId.toString() === selectorId;
  const isCreator = room.createdBy.toString() === selectorId;
  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only team captain or room creator can select players",
    });
  }

  // ensure selected user exists and is friend of the selector
  const candidate = await User.findById(userId);
  if (!candidate)
    return res.status(404).json({ message: "User to select not found" });

  const selectorUser = await User.findById(selectorId);
  if (!isFriend(selectorUser, candidate._id)) {
    return res
      .status(400)
      .json({ message: "You can only select players from your friends list" });
  }

  // ensure not in both teams or umpire
  if (
    room.umpire &&
    room.umpire.userId.toString() === candidate._id.toString()
  ) {
    return res.status(400).json({ message: "Selected user is the umpire" });
  }
  const candidateIdStr = candidate._id.toString();
  const inTeamA =
    room.teamA.players.some((p) => p.userId.toString() === candidateIdStr) ||
    (room.teamA.captain &&
      room.teamA.captain.userId.toString() === candidateIdStr);
  const inTeamB =
    room.teamB.players.some((p) => p.userId.toString() === candidateIdStr) ||
    (room.teamB.captain &&
      room.teamB.captain.userId.toString() === candidateIdStr);
  if (inTeamA || inTeamB)
    return res.status(400).json({ message: "User already in a team" });

  // handle as captain assignment
  if (asCaptain) {
    teamObj.captain = { userId: candidate._id, username: candidate.username };
    if (!userInRoom(room, candidate._id)) room.participants.push(candidate._id);
    await room.save();
    return res.json({ message: `Captain set for Team ${team}`, room });
  }

  // check team size limit
  const currentCount = teamObj.players.length + (teamObj.captain ? 1 : 0);
  if (currentCount >= room.maxPlayersPerTeam) {
    return res
      .status(400)
      .json({ message: `Team ${team} already has maximum players` });
  }

  teamObj.players.push({ userId: candidate._id, username: candidate.username });
  if (!userInRoom(room, candidate._id)) room.participants.push(candidate._id);

  await room.save();
  // Emit socket event
  const io = req.app.get("io");
  io.to(id).emit("room:player-updated", {
    action: "added",
    team,
    player: { userId: candidate._id, username: candidate.username },
    asCaptain,
    timestamp: new Date(),
  });

  res.json({ message: `Player added to Team ${team}`, room });
});

/** Remove player from team
 * POST /rooms/:id/remove-player
 * body: { team: "A"|"B", userId }
 * allowed by team captain or room creator
 */
exports.removePlayer = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { team, userId } = req.body;
  if (!team || !["A", "B"].includes(team) || !userId)
    return res.status(400).json({ message: "team and userId required" });

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.status !== "pending")
    return res
      .status(400)
      .json({ message: "Cannot remove players after game started" });

  const teamObj = team === "A" ? room.teamA : room.teamB;
  const isCaptain =
    teamObj.captain && teamObj.captain.userId.toString() === callerId;
  const isCreator = room.createdBy.toString() === callerId;
  if (!isCaptain && !isCreator)
    return res.status(403).json({ message: "Not allowed" });

  const uid = userId.toString();
  teamObj.players = teamObj.players.filter((p) => p.userId.toString() !== uid);
  if (teamObj.captain && teamObj.captain.userId.toString() === uid)
    teamObj.captain = null;

  room.participants = room.participants.filter((p) => p.toString() !== uid);
  await room.save();
  const io = req.app.get("io");
  io.to(id).emit("room:player-updated", {
    action: "removed",
    team,
    playerId: userId,
    timestamp: new Date(),
  });
  res.json({ message: "Player removed", room });
});

/** Start game
 * POST /rooms/:id/start
 * only umpire can start; enforce overs and players validations
 */
exports.startGame = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ message: "Only umpire can start the game" });
  }

  // validate overs
  if (!Number.isInteger(room.overs) || room.overs < 0)
    return res.status(400).json({ message: "Overs not set or invalid" });

  // validate each team's players count between 0 and maxPlayersPerTeam
  const countTeamA = (room.teamA.captain ? 1 : 0) + room.teamA.players.length;
  const countTeamB = (room.teamB.captain ? 1 : 0) + room.teamB.players.length;
  if (countTeamA < 0 || countTeamA > room.maxPlayersPerTeam)
    return res.status(400).json({
      message: `Team A players must be between 0 and ${room.maxPlayersPerTeam}`,
    });
  if (countTeamB < 0 || countTeamB > room.maxPlayersPerTeam)
    return res.status(400).json({
      message: `Team B players must be between 0 and ${room.maxPlayersPerTeam}`,
    });

  // ensure no user is in both teams or umpire simultaneously
  const setIds = new Set();
  const addIf = (p) => {
    if (!p) return true;
    const idStr = p.userId ? p.userId.toString() : p.toString();
    if (setIds.has(idStr)) return false;
    setIds.add(idStr);
    return true;
  };

  if (room.umpire && !addIf(room.umpire))
    return res
      .status(400)
      .json({ message: "Conflict: user in multiple roles" });

  for (const p of room.teamA.players || [])
    if (!addIf(p))
      return res
        .status(400)
        .json({ message: "Conflict: a user is assigned multiple roles" });
  if (room.teamA.captain && !addIf(room.teamA.captain))
    return res
      .status(400)
      .json({ message: "Conflict: a user is assigned multiple roles" });

  for (const p of room.teamB.players || [])
    if (!addIf(p))
      return res
        .status(400)
        .json({ message: "Conflict: a user is assigned multiple roles" });
  if (room.teamB.captain && !addIf(room.teamB.captain))
    return res
      .status(400)
      .json({ message: "Conflict: a user is assigned multiple roles" });

  room.status = "in_progress";
  await room.save();
  const io = req.app.get("io");
  io.to(id).emit("room:status-changed", {
    status: "in_progress",
    message: "Game has started!",
    timestamp: new Date(),
  });
  res.json({ message: "Game started", room });
});

/** Leave room
 * POST /rooms/:id/leave
 * body: {}
 */
exports.leaveRoom = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  removePlayerFromTeams(room, callerId);

  // if no participants remain, optionally delete room - here we keep room but you can delete.
  await room.save();
  res.json({ message: "Left room", room });
});

exports.doToss = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (!room.umpire || room.umpire.userId.toString() !== callerId) {
    return res.status(403).json({ message: "Only umpire can start the toss" });
  }

  if (room.status !== "in_progress") {
    return res
      .status(400)
      .json({ message: "Game must be started before toss" });
  }

  if (room.tossWinner) {
    return res.status(400).json({ message: "Toss already completed" });
  }

  // AUTO TOSS
  const winner = Math.random() < 0.5 ? "A" : "B";
  room.tossWinner = winner;
  await room.save();

  const io = req.app.get("io");
  io.to(id).emit("toss:result", {
    winner,
    message: `Team ${winner} won the toss!`,
    timestamp: new Date(),
  });

  res.json({
    message: `Team ${winner} won the toss`,
    tossWinner: winner,
    room,
  });
});

exports.chooseTossOption = asyncWrapper(async (req, res) => {
  const callerId = req.user.id;
  const { id } = req.params;
  const { choice } = req.body; // "bat" or "ball"

  if (!["bat", "ball"].includes(choice)) {
    return res.status(400).json({ message: "choice must be 'bat' or 'ball'" });
  }

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (!room.tossWinner) {
    return res.status(400).json({ message: "Toss not done yet" });
  }

  // Determine which team won
  const winningTeamObj = room.tossWinner === "A" ? room.teamA : room.teamB;

  const isCaptain =
    winningTeamObj.captain &&
    winningTeamObj.captain.userId.toString() === callerId;

  const isCreator = room.createdBy.toString() === callerId;

  if (!isCaptain && !isCreator) {
    return res.status(403).json({
      message: "Only winning team's captain or room creator can choose",
    });
  }

  room.tossChoice = choice;
  await room.save();
  
  const io = req.app.get("io");
  io.to(id).emit("toss:choice-announced", {
    team: room.tossWinner,
    choice,
    message: `Team ${room.tossWinner} chose to ${choice}`,
    timestamp: new Date()
  });
  
  res.json({ message: `Team ${room.tossWinner} chose to ${choice}`, tossChoice: choice, room });
});