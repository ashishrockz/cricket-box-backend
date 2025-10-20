const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  ball: Number,
  over: Number,
  batsman: String,
  bowler: String,
  run: { type: Number, default: 0 },
  wicket: { type: Boolean, default: false },
  wicketType: { type: String, default: null },
  extras: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const inningsSchema = new mongoose.Schema({
  name: String,
  players: [String],
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  overs: { type: Number, default: 0 },
  events: [eventSchema]
}, { _id: false });

const matchSchema = new mongoose.Schema({
  roomId: { type: String },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", default: null },
  umpire: { type: Object, default: null }, // { name, type, userId? }
  teamA: inningsSchema,
  teamB: inningsSchema,
  toss: { winner: String, choice: String, decidedBy: String, time: Date },
  status: { type: String, enum: ["pending","live","completed"], default: "pending" },
  winner: { type: String, default: null },
  resultSummary: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  endedAt: Date
});

module.exports = mongoose.model("Match", matchSchema);
