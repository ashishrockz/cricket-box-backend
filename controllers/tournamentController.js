const Tournament = require("../models/Tournament");
const asyncWrapper = require("../utils/asyncWrapper");

exports.createTournament = asyncWrapper(async (req, res) => {
  const payload = req.body;
  if (!payload.name) return res.status(400).json({ message: "Tournament name required" });
  const tournament = await Tournament.create({ ...payload, createdBy: req.user.id });
  res.status(201).json({ message: "Tournament created", tournament });
});

exports.getTournaments = asyncWrapper(async (req, res) => {
  const tournaments = await Tournament.find().populate("teams matches");
  res.json(tournaments);
});

exports.getTournament = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const t = await Tournament.findById(id).populate("teams matches");
  if (!t) return res.status(404).json({ message: "Tournament not found" });
  res.json(t);
});
