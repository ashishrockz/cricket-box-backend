// models/Room.js
const mongoose = require("mongoose");
const shortid = require("shortid"); // npm i shortid

const playerRefSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
  },
  { id: false }
);

const teamSchema = new mongoose.Schema(
  {
    captain: { type: playerRefSchema, default: null }, // DB user (optional)
    players: { type: [playerRefSchema], default: [] }, // DB users (optional)

    // NEW: Static manual players
    staticCaptain: { type: String, default: null },
    staticPlayers: { type: [String], default: [] },
  },
  { id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      length: 6,
    },
    name: { type: String, default: "Cricket Room" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // roles
    umpire: { type: playerRefSchema, default: null },
    teamA: { type: teamSchema, default: () => ({}) },
    teamB: { type: teamSchema, default: () => ({}) },

    // settings
    overs: { type: Number, default: 0 }, // set by umpire before start
    maxPlayersPerTeam: { type: Number, default: 11 },

    // state
    status: {
      type: String,
      enum: ["pending", "in_progress", "finished"],
      default: "pending",
    },

    // simple participants list for quick checks (includes umpire and team players)
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    tossWinner: {
      type: String,
      enum: ["A", "B", null],
      default: null,
    },

    tossChoice: {
      type: String,
      enum: ["bat", "ball", null],
      default: null,
    },

    // createdAt/updatedAt
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
