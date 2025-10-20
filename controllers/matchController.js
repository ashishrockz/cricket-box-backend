const Match = require("../models/Match");
const Room = require("../models/Room");
const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");

exports.createMatchFromRoom = asyncWrapper(async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ message: "roomId required" });

  const room = await Room.findOne({ roomId }).populate("teamA teamB");
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (room.matchId) {
    const existingMatch = await require("../models/Match").findById(room.matchId);
    if (existingMatch && existingMatch.status === "live") {
      return res.status(400).json({ message: "A live match already exists for this room" });
    }
  }

  const match = await Match.create({
    roomId,
    umpire: room.umpire || null,
    teamA: { name: room.teamA.teamName, players: room.teamA.players },
    teamB: { name: room.teamB.teamName, players: room.teamB.players },
    status: "live",
    startedAt: new Date()
  });

  room.matchId = match._id;
  room.status = "ongoing";
  await room.save();

  res.status(201).json({ message: "Match started", match });
});

exports.addBallEvent = asyncWrapper(async (req, res) => {
  const { matchId } = req.params;
  const { innings, event } = req.body;
  if (!matchId || !innings || !event) return res.status(400).json({ message: "matchId, innings and event required" });
  if (!["teamA", "teamB"].includes(innings)) return res.status(400).json({ message: "innings must be 'teamA' or 'teamB'" });

  const match = await Match.findById(matchId);
  if (!match) return res.status(404).json({ message: "Match not found" });
  if (match.status !== "live") return res.status(400).json({ message: "Match is not live" });

  // update events and aggregates
  match[innings].events.push(event);
  match[innings].runs = (match[innings].runs || 0) + Number(event.run || 0) + Number(event.extras || 0);
  if (event.wicket) match[innings].wickets = (match[innings].wickets || 0) + 1;

  // optionally update overs based on incoming event.over
  if (typeof event.over === "number") match[innings].overs = Math.max(match[innings].overs, event.over);

  await match.save();

  // Broadcast via socket (server-side socket emission handled elsewhere)
  res.json({ message: "Event added", match });
});

exports.endMatch = asyncWrapper(async (req, res) => {
  const { matchId } = req.params;
  const { winner, resultSummary, isTournament } = req.body;

  const match = await Match.findById(matchId);
  if (!match) return res.status(404).json({ message: "Match not found" });

  match.status = "completed";
  match.winner = winner || match.winner;
  match.resultSummary = resultSummary || match.resultSummary;
  match.endedAt = new Date();
  await match.save();

  // update room status
  const room = await Room.findOne({ roomId: match.roomId });
  if (room) { room.status = "completed"; await room.save(); }

  // update user stats for registered players
  const updateStatsForPlayers = async (players, runs, wickets, isTournamentFlag) => {
    for (const username of players) {
      const user = await User.findOne({ username });
      if (!user) continue;
      const target = isTournamentFlag ? user.stats.tournamentMatches : user.stats.localMatches;
      target.matchesPlayed = (target.matchesPlayed || 0) + 1;
      user.totalStats.matchesPlayed = (user.totalStats.matchesPlayed || 0) + 1;
      user.totalStats.runs = (user.totalStats.runs || 0) + (runs || 0);
      user.totalStats.wickets = (user.totalStats.wickets || 0) + (wickets || 0);
      await user.save();
    }
  };

  if (match.teamA && match.teamA.players) {
    await updateStatsForPlayers(match.teamA.players, match.teamA.runs, match.teamA.wickets, !!isTournament);
  }
  if (match.teamB && match.teamB.players) {
    await updateStatsForPlayers(match.teamB.players, match.teamB.runs, match.teamB.wickets, !!isTournament);
  }

  res.json({ message: "Match ended and stats updated", match });
});
