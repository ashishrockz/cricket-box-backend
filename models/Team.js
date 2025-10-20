const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  players: [String], // store usernames or guest names
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  roomId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Team", teamSchema);
