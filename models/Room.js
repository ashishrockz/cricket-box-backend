const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true },
  invitationCode: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  umpire: { type: Object, default: null }, // { name, type: 'guest'|'registered', userId? }
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
  status: { type: String, enum: ["pending","ongoing","completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Room", roomSchema);
