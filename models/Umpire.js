const mongoose = require("mongoose");

const umpireSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["registered", "guest"], default: "guest" },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  assignedMatches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }]
});

module.exports = mongoose.model("Umpire", umpireSchema);
