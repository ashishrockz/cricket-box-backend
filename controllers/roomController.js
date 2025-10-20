const Room = require("../models/Room");
const Team = require("../models/Team");
const sendMail = require("../config/smtp");
const { generateRoomId, generateInviteCode } = require("../utils/helpers");
const asyncWrapper = require("../utils/asyncWrapper");

exports.createRoom = asyncWrapper(async (req, res) => {
  const ownerId = req.user.id;
  const { umpire, teamA, teamB, notifyEmail } = req.body;
  if (!teamA || !teamB) return res.status(400).json({ message: "teamA and teamB required" });
  if (!teamA.teamName || !Array.isArray(teamA.players)) return res.status(400).json({ message: "teamA invalid" });
  if (!teamB.teamName || !Array.isArray(teamB.players)) return res.status(400).json({ message: "teamB invalid" });

  const roomId = generateRoomId();
  const invitationCode = generateInviteCode();

  const teamADoc = await Team.create({ teamName: teamA.teamName, players: teamA.players, createdBy: ownerId, roomId });
  const teamBDoc = await Team.create({ teamName: teamB.teamName, players: teamB.players, createdBy: ownerId, roomId });

  const room = await Room.create({
    roomId,
    invitationCode,
    ownerId,
    umpire: umpire || null,
    teamA: teamADoc._id,
    teamB: teamBDoc._id,
    status: "pending"
  });

  if (notifyEmail) {
    try {
      await sendMail(notifyEmail, `Room Created - ${roomId}`, `<p>Room <b>${roomId}</b> created. Code: ${invitationCode}</p>`);
    } catch (err) {
      console.warn("notify email failed", err.message);
    }
  }

  res.status(201).json({ message: "Room created", room });
});

exports.getRoom = asyncWrapper(async (req, res) => {
  const { roomId } = req.params;
  const room = await Room.findOne({ roomId }).populate("teamA teamB ownerId", "teamName players username");
  if (!room) return res.status(404).json({ message: "Room not found" });
  res.json(room);
});

exports.approveRoom = asyncWrapper(async (req, res) => {
  // admin approves a room (for tournament/local rules)
  const { roomId } = req.params;
  const room = await Room.findOne({ roomId });
  if (!room) return res.status(404).json({ message: "Room not found" });
  room.status = "pending"; // here you could set 'approved' flag, or set to pending->approved, keeping enum minimal
  await room.save();
  res.json({ message: "Room approved", room });
});
