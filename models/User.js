const mongoose = require("mongoose");

// Batting Schema
const battingSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    innings: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    highest: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },

    notOut: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    ducks: { type: Number, default: 0 },

    fifties: { type: Number, default: 0 },
    hundreds: { type: Number, default: 0 },
    doubleHundreds: { type: Number, default: 0 },
    tripleHundreds: { type: Number, default: 0 },
    quadrupleHundreds: { type: Number, default: 0 },
  },
  { _id: false }
);

// Bowling Schema
const bowlingSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    innings: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },

    average: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },

    bestInnings: { type: String, default: "0/0" },
    bestMatch: { type: String, default: "0/0" },

    fourWickets: { type: Number, default: 0 },
    fiveWickets: { type: Number, default: 0 },
    tenWickets: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null }, // URL to avatar image
    // careerStats
    careerStats: {
      local: {
        batting: { type: battingSchema, default: () => ({}) },
        bowling: { type: bowlingSchema, default: () => ({}) },
      },
      tournament: {
        T20: {
          batting: { type: battingSchema, default: () => ({}) },
          bowling: { type: bowlingSchema, default: () => ({}) },
        },
        ODI: {
          batting: { type: battingSchema, default: () => ({}) },
          bowling: { type: bowlingSchema, default: () => ({}) },
        },
      },
    },

    // Friends (mutual)
    friends: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
      },
    ],

    // Friend Requests
    requests: {
      sent: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: String,
        },
      ],
      received: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: String,
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
