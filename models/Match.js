// models/Match.js
const mongoose = require("mongoose");

const extrasSchema = new mongoose.Schema(
  {
    wide: { type: Number, default: 0 },
    noBall: { type: Number, default: 0 },
    bye: { type: Number, default: 0 },
    legBye: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
  },
  { id: false }
);

const ballSchema = new mongoose.Schema(
  {
    over: { type: Number, required: true }, // 0-indexed over number (0 => first over)
    ballInOver: { type: Number, required: true }, // 1..6 (legal deliveries only). For wides/no-balls, ballInOver stays same.
    timestamp: { type: Date, default: Date.now },

    striker: { type: String, required: true }, // names or userId strings
    nonStriker: { type: String, required: true },
    bowler: { type: String, required: true },

    runs: { type: Number, default: 0 }, // total runs from bat (excluding extras)
    extras: { type: extrasSchema, default: () => ({}) },

    totalRunsThisBall: { type: Number, default: 0 }, // includes extras
    isWicket: { type: Boolean, default: false },
    wicketType: { type: String, default: null }, // bowled, caught, lbw, runout, stumped, etc.
    wicketPlayer: { type: String, default: null }, // dismissed batsman
    wicketBy: { type: String, default: null }, // dismissing fielder or bowler id (if applicable)

    commentary: { type: String, default: "" }
  },
  { id: false }
);

const batsmanStatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  isOut: { type: Boolean, default: false },
  dismissal: { type: String, default: null }
}, { id: false });

const bowlerStatSchema = new mongoose.Schema({
  name: { type: String, required: true },
  balls: { type: Number, default: 0 }, // legal deliveries
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 }
}, { id: false });

const inningsSchema = new mongoose.Schema({
  teamName: { type: String, required: true },

  balls: { type: [ballSchema], default: [] }, // full ball list
  totalRuns: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  legalDeliveries: { type: Number, default: 0 }, // count only legal balls
  oversLimit: { type: Number, default: 0 }, // e.g., 20 for T20

  batsmen: { type: [batsmanStatSchema], default: [] },
  bowlers: { type: [bowlerStatSchema], default: [] },

  fallOfWickets: { type: [{ batsman: String, scoreAtFall: Number, over: String }], default: [] },

  // partnerships: {batA_batB: runs}, and current partnership tracking
  partnerships: { type: Object, default: {} },
  currentPartnership: {
    striker: { type: String, default: null },
    nonStriker: { type: String, default: null },
    runs: { type: Number, default: 0 }
  },

  // innings finished flag
  completed: { type: Boolean, default: false }
}, { id: false });

const matchSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

  matchType: { type: String, enum: ["T20", "ODI", "TEST", "OTHER"], default: "T20" },

  tossWinner: { type: String, enum: ["A", "B", null], default: null },
  tossChoice: { type: String, enum: ["bat", "ball", null], default: null },

  innings: { type: [inningsSchema], default: [] }, // typically 2 innings for limited overs

  currentInningsIndex: { type: Number, default: 0 }, // 0-based
  status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },

  // result summary
  result: {
    winner: { type: String, default: null }, // "A" | "B" | "tie" | "no_result"
    summary: { type: String, default: "" }
  },

  // dls placeholder
  dls: { type: Object, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Match", matchSchema);
