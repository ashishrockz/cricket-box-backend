// controllers/matchController.js
const Match = require("../models/Match");
const Room = require("../models/Room");
const asyncWrapper = require("../utils/asyncWrapper");
const mongoose = require("mongoose");

/**
 * Helpers
 */

// format over display from legalDeliveries (integer)
function formatOversFromBalls(legalDeliveries) {
  const overs = Math.floor(legalDeliveries / 6);
  const balls = legalDeliveries % 6;
  return `${overs}.${balls}`;
}

// find or create batsman stat record within innings
function ensureBatsman(innings, name) {
  let b = innings.batsmen.find((x) => x.name === name);
  if (!b) {
    b = {
      name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissal: null,
    };
    innings.batsmen.push(b);
  }
  return b;
}

// find or create bowler stat record
function ensureBowler(innings, name) {
  let b = innings.bowlers.find((x) => x.name === name);
  if (!b) {
    b = { name, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
    innings.bowlers.push(b);
  }
  return b;
}

// check if bowler bowled previous over (prevent consecutive overs)
function bowledPreviousOver(innings, bowlerName) {
  // find last completed over experienced in innings.balls, get bowler of last legal ball of that over.
  if (!innings.balls || innings.balls.length === 0) return false;

  // compute last completed over index
  // count legal deliveries per over: we track ball.over and ball.ballInOver for legal deliveries
  const legalDeliveries = innings.balls.filter((b) => b.ballInOver > 0);
  if (legalDeliveries.length === 0) return false;

  // determine last completed over number:
  const lastLegal = legalDeliveries[legalDeliveries.length - 1];
  const lastOverIndex = lastLegal.over;

  // gather balls in that over
  const ballsInLastOver = innings.balls.filter(
    (b) => b.over === lastOverIndex && b.ballInOver > 0
  );
  if (!ballsInLastOver || ballsInLastOver.length === 0) return false;

  // bowler for that over must be the bowler of ANY legal delivery in that over (should be same)
  const overBowler = ballsInLastOver[0].bowler;
  return overBowler === bowlerName;
}

// recompute some derived stats
function recomputeBowlingEconomy(bowler) {
  const overs = Math.floor(bowler.balls / 6) + (bowler.balls % 6) / 6;
  if (bowler.balls === 0) return 0;
  return parseFloat((bowler.runs / overs).toFixed(2));
}
function isMatchAdmin(match, userId) {
  return (
    match.createdBy?.toString() === userId ||
    match.roomId.createdBy?.toString() === userId ||
    match.roomId.umpire?.userId?.toString() === userId
  );
}
// switch strike utility
function swapStrike(innings) {
  const cur = innings.currentPartnership;
  if (!cur) return;
  const tmp = cur.striker;
  cur.striker = cur.nonStriker;
  cur.nonStriker = tmp;
}

/**
 * Create Match from room (after toss and choice)
 * body: { roomId, matchType, oversPerInnings }
 */
exports.startInnings = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { striker, nonStriker, bowler } = req.body;

  if (!striker || !nonStriker || !bowler)
    return res
      .status(400)
      .json({ message: "striker, nonStriker and bowler required" });

  const match = await Match.findById(id).populate("roomId");
  if (!match) return res.status(404).json({ message: "Match not found" });

  const isUmpire =
    match.roomId.umpire &&
    match.roomId.umpire.userId.toString() === userId;

  const isMatchCreator = match.createdBy.toString() === userId;

  if (!isUmpire && !isMatchCreator) {
    return res.status(403).json({
      message: "Only umpire or match creator can start innings",
    });
  }

  const idx = match.currentInningsIndex;
  const innings = match.innings[idx];

  innings.currentPartnership = { striker, nonStriker, runs: 0 };

  ensureBatsman(innings, striker);
  ensureBatsman(innings, nonStriker);
  ensureBowler(innings, bowler);

  await match.save();
  res.json({ message: "Innings initialized", match });
});


/**
 * Add a ball (umpire only)
 * POST /match/:id/ball
 * body: {
 *   runs, // runs off bat (integer)
 *   extras: { wide, noBall, bye, legBye, penalty } // numbers
 *   isWicket: boolean,
 *   wicketType: string, // 'bowled','caught','runout', etc
 *   wicketPlayer: string // dismissed batsman name
 *   bowler: string,
 *   commentary: string
 * }
 */
exports.addBall = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const payload = req.body;

  const match = await Match.findById(id).populate("roomId");
  if (!match) return res.status(404).json({ message: "Match not found" });

  // only umpire can add ball
  if (!isMatchAdmin(match, req.user.id)) {
    return res.status(403).json({ message: "Only umpire can update ball" });
  }

  if (match.status !== "in_progress")
    return res.status(400).json({ message: "Match not in progress" });

  const idx = match.currentInningsIndex;
  const innings = match.innings[idx];

  if (innings.completed)
    return res.status(400).json({ message: "Innings already completed" });

  // Validate bowler cannot bowl consecutive overs
  const bowlerName = payload.bowler;
  if (!bowlerName)
    return res.status(400).json({ message: "bowler is required" });

  // compute current over index and ballInOver
  const legalDeliveriesSoFar = innings.legalDeliveries; // integer
  const currentOverIndex = Math.floor(legalDeliveriesSoFar / 6);
  let ballInOver = (legalDeliveriesSoFar % 6) + 1; // next legal delivery number if delivery will be legal

  // check if payload contains extras that make this an illegal delivery (wide or noBall)
  const extras = payload.extras || {};
  const isWide = extras.wide > 0;
  const isNoBall = extras.noBall > 0;

  const isLegalDelivery = !(isWide || isNoBall);

  // If bowler bowls but previous over was by same bowler and previous over is completed,
  // disallow consecutive overs (but allow within same over)
  if (
    bowledPreviousOver(innings, bowlerName) &&
    isLegalDelivery &&
    Math.floor(legalDeliveriesSoFar / 6) !==
      Math.floor((legalDeliveriesSoFar - 1) / 6)
  ) {
    // The check above is conservative; simpler approach:
    // if last completed over's bowler === bowlerName -> disallow to bowl next over
    // Implement simple check:
    const lastCompletedOverIndex = currentOverIndex - 1;
    if (lastCompletedOverIndex >= 0) {
      const ballsInLastCompletedOver = innings.balls.filter(
        (b) => b.over === lastCompletedOverIndex && b.ballInOver > 0
      );
      if (ballsInLastCompletedOver.length > 0) {
        const overBowler = ballsInLastCompletedOver[0].bowler;
        if (overBowler === bowlerName) {
          return res
            .status(400)
            .json({ message: "Bowler cannot bowl consecutive overs" });
        }
      }
    }
  }

  // Construct ball record
  const striker = innings.currentPartnership.striker;
  const nonStriker = innings.currentPartnership.nonStriker;
  if (!striker || !nonStriker)
    return res
      .status(400)
      .json({ message: "Both striker and nonStriker must be set" });

  // Determine total runs this ball = runs + extras sum
  const runs = Number(payload.runs || 0);
  const extrasTotal =
    (extras.wide || 0) +
    (extras.noBall || 0) +
    (extras.bye || 0) +
    (extras.legBye || 0) +
    (extras.penalty || 0);
  const totalRunsThisBall = runs + extrasTotal;

  // If wide/noBall -> ballInOver should NOT increment (not a legal delivery)
  const ballRecord = {
    over: currentOverIndex,
    ballInOver: isLegalDelivery ? ballInOver : 0,
    striker,
    nonStriker,
    bowler: bowlerName,
    runs,
    extras: {
      wide: extras.wide || 0,
      noBall: extras.noBall || 0,
      bye: extras.bye || 0,
      legBye: extras.legBye || 0,
      penalty: extras.penalty || 0,
    },
    totalRunsThisBall,
    isWicket: !!payload.isWicket,
    wicketType: payload.wicketType || null,
    wicketPlayer: payload.wicketPlayer || null,
    wicketBy: payload.wicketBy || null,
    commentary: payload.commentary || "",
  };

  // push ball
  innings.balls.push(ballRecord);

  // update innings totals and stats
  innings.totalRuns += totalRunsThisBall;

  // update bowler stats
  const bowlerStat = ensureBowler(innings, bowlerName);
  bowlerStat.runs += totalRunsThisBall;
  bowlerStat.wides += extras.wide || 0;
  bowlerStat.noBalls += extras.noBall || 0;

  // If delivery is legal, increment legalDeliveries and bowler.balls
  if (isLegalDelivery) {
    innings.legalDeliveries += 1;
    bowlerStat.balls += 1;
    // update batsman ball faced and runs
    const strikerStat = ensureBatsman(innings, striker);
    strikerStat.balls += 1;
    strikerStat.runs += runs;
    if (runs === 4) strikerStat.fours += 1;
    if (runs === 6) strikerStat.sixes += 1;
  } else {
    // extras like wides/no-balls: batsman runs may also include noBall runs off bat (we added runs to striker in runs variable)
    // if there are runs off bat in a noBall, they are added to batsman runs but ball is not legal
    if (isNoBall && runs > 0) {
      const strikerStat = ensureBatsman(innings, striker);
      strikerStat.runs += runs;
      if (runs === 4) strikerStat.fours += 1;
      if (runs === 6) strikerStat.sixes += 1;
    }
  }

  // extras like bye/legBye: not credited to batsman
  // update bowler wicket & batsman out if applicable
  if (ballRecord.isWicket) {
    innings.wickets += 1;

    // if runout, usually bowler not credited with wicket
    const wt = (ballRecord.wicketType || "").toLowerCase();
    if (wt !== "runout" && wt !== "obstructingthefield" && wt !== "retired") {
      // bowler gets the wicket
      bowlerStat.wickets += 1;
    }

    // mark batsman as out
    if (ballRecord.wicketPlayer) {
      const bStat = ensureBatsman(innings, ballRecord.wicketPlayer);
      bStat.isOut = true;
      bStat.dismissal = ballRecord.wicketType || "out";
      innings.fallOfWickets.push({
        batsman: ballRecord.wicketPlayer,
        scoreAtFall: innings.totalRuns,
        over: formatOversFromBalls(innings.legalDeliveries),
      });

      // reset partnership: partnership between striker and non-striker ends
      const curPart = innings.currentPartnership;
      if (curPart && curPart.striker && curPart.nonStriker) {
        // store partnership using sorted key to be consistent
        const key = `${curPart.striker}___${curPart.nonStriker}`;
        innings.partnerships[key] =
          (innings.partnerships[key] || 0) + curPart.runs;
      }
      // start new partnership: surviving batsman becomes striker or nonStriker depending on wicketPlayer
      if (ballRecord.wicketPlayer === innings.currentPartnership.striker) {
        // striker out => new batsman will come as striker
        innings.currentPartnership.striker = null;
        innings.currentPartnership.runs = 0;
      } else if (
        ballRecord.wicketPlayer === innings.currentPartnership.nonStriker
      ) {
        innings.currentPartnership.nonStriker = null;
        innings.currentPartnership.runs = 0;
      } else {
        // if wicketPlayer is a static name not in partnership, still reset partnership
        innings.currentPartnership.striker = innings.currentPartnership.striker;
        innings.currentPartnership.nonStriker =
          innings.currentPartnership.nonStriker;
        innings.currentPartnership.runs = 0;
      }
    }
  } else {
    // no wicket -> update partnership runs and maybe strike rotation
    innings.currentPartnership.runs += totalRunsThisBall;

    // if runs (off bat + bye/legbye) is odd -> swap strike
    const runsForStrikeDecision =
      runs + (extras.bye || 0) + (extras.legBye || 0);
    if (runsForStrikeDecision % 2 === 1) {
      swapStrike(innings);
    }
  }

  // Update bowler totals and recalc economy (we store balls & runs; compute economy on retrieval)
  // Update batsman totals (if no wicket, nothing else to do)
  // If it's a legal delivery and it's the last ball of the over -> end over logic
  if (isLegalDelivery) {
    // if over completed
    if (innings.legalDeliveries % 6 === 0) {
      // over completed: swap striker and nonStriker
      swapStrike(innings);

      // mark last over bowler check is handled on next over start when bowler chosen
    }
  }

  // Check over limit reached — if yes, end innings
  const completedOvers = Math.floor(innings.legalDeliveries / 6);
  if (innings.oversLimit && completedOvers >= innings.oversLimit) {
    innings.completed = true;
  }

  // advance to next innings if innings completed and this was innings 0
  if (innings.completed) {
    // if this was first innings and second innings exists, set second innings teamName if not set
    if (match.currentInningsIndex === 0) {
      // set second innings team name
      const second = match.innings[1];
      if (!second.teamName) {
        // opponent team
        second.teamName = innings.teamName === "A" ? "B" : "A";
      }
      // move to second innings
      match.currentInningsIndex = 1;
    } else {
      // second innings completed -> finalize match result
      match.status = "completed";

      // determine winner
      const firstTotal = match.innings[0].totalRuns;
      const secondTotal = match.innings[1].totalRuns;
      if (secondTotal > firstTotal) {
        match.result.winner = match.innings[1].teamName;
        match.result.summary = `${match.result.winner} won by ${
          match.innings[1].totalRuns - match.innings[0].totalRuns
        } runs`;
      } else if (secondTotal < firstTotal) {
        // if first > second -> first won by (runs)
        match.result.winner = match.innings[0].teamName;
        match.result.summary = `${match.result.winner} won`;
      } else {
        match.result.winner = "tie";
        match.result.summary = "Match tied";
      }
    }
  }

  await match.save();
  // Emit real-time update
  const io = req.app.get("io");
  const roomId = match.roomId.id.toString();

  io.to(roomId).emit("match:ball-update", {
    ballData: ballRecord,
    scoreboard: {
      runs: innings.totalRuns,
      wickets: innings.wickets,
      overs: formatOversFromBalls(innings.legalDeliveries),
      currentPartnership: innings.currentPartnership,
    },
    timestamp: new Date(),
  });

  // If innings completed, emit that too
  if (innings.completed) {
    io.to(roomId).emit("match:innings-complete", {
      inningsNumber: match.currentInningsIndex,
      totalRuns: innings.totalRuns,
      wickets: innings.wickets,
      timestamp: new Date(),
    });
  }

  // If match completed, emit result
  if (match.status === "completed") {
    io.to(roomId).emit("match:finished", {
      result: match.result,
      message: match.result.summary,
      timestamp: new Date(),
    });
  }

  res.json({ message: "Ball recorded", match });
});

/**
 * End innings manually (umpire only) - sometimes used to declare or all out
 * POST /match/:id/end-innings
 * body: { reason: "declared" | "allout" }
 */
exports.endInnings = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { reason } = req.body;

  const match = await Match.findById(id).populate("roomId");
  if (!match) return res.status(404).json({ message: "Match not found" });

  if (!isMatchAdmin(match, req.user.id)){
    return res.status(403).json({ message: "Only umpire can end innings" });
  }

  const idx = match.currentInningsIndex;
  const innings = match.innings[idx];
  innings.completed = true;

  // if first innings ended => move to second innings
  if (match.currentInningsIndex === 0) {
    if (!match.innings[1].teamName) {
      match.innings[1].teamName = innings.teamName === "A" ? "B" : "A";
    }
    match.currentInningsIndex = 1;
  } else {
    // second innings finished => finalize match
    match.status = "completed";
    const firstTotal = match.innings[0].totalRuns;
    const secondTotal = match.innings[1].totalRuns;
    if (secondTotal > firstTotal) {
      match.result.winner = match.innings[1].teamName;
      match.result.summary = `${match.result.winner} won by ${
        match.innings[1].totalRuns - match.innings[0].totalRuns
      } runs`;
    } else if (secondTotal < firstTotal) {
      match.result.winner = match.innings[0].teamName;
      match.result.summary = `${match.result.winner} won`;
    } else {
      match.result.winner = "tie";
      match.result.summary = "Match tied";
    }
  }

  await match.save();
  res.json({ message: `Innings ended: ${reason || "finished"}`, match });
});

/**
 * Scoreboard API
 * GET /match/:id/scoreboard
 */
exports.getScoreboard = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const match = await Match.findById(id).populate("roomId").lean();
  if (!match) return res.status(404).json({ message: "Match not found" });

  const idx = match.currentInningsIndex;
  const innings = match.innings[idx] || null;
  const otherInnings = match.innings[idx === 0 ? 1 : 0] || null;

  // compute overs display
  if (innings) {
    innings.overs = formatOversFromBalls(innings.legalDeliveries);
  }
  if (otherInnings) {
    otherInnings.overs = formatOversFromBalls(otherInnings.legalDeliveries);
  }

  // compute bowling economy for each bowler
  if (innings && innings.bowlers) {
    innings.bowlers = innings.bowlers.map((b) => {
      const overs = Math.floor(b.balls / 6) + (b.balls % 6) / 6;
      const economy =
        b.balls === 0 ? 0 : parseFloat((b.runs / overs).toFixed(2));
      return { ...b, overs: formatOversFromBalls(b.balls), economy };
    });
  }

  // required rate for chasing team (if second innings)
  let requiredRate = null;
  if (match.currentInningsIndex === 1 && match.innings[0]) {
    const target = match.innings[0].totalRuns + 1;
    const second = match.innings[1];
    const ballsLeft = second.oversLimit * 6 - second.legalDeliveries;
    const runsLeft = Math.max(0, target - second.totalRuns);
    requiredRate =
      ballsLeft === 0
        ? null
        : parseFloat(((runsLeft * 6) / ballsLeft).toFixed(2));
  }

  res.json({
    matchId: match.id,
    status: match.status,
    currentInningsIndex: match.currentInningsIndex,
    innings,
    otherInnings,
    result: match.result,
    requiredRate,
  });
});
exports.selectNextBatsman = asyncWrapper(async (req, res) => {
  const umpireId = req.user.id;
  const { id } = req.params; // matchId
  const { name } = req.body; // new batsman name

  if (!name) return res.status(400).json({ message: "Batsman name required" });

  const match = await Match.findById(id).populate("roomId");
  if (!match) return res.status(404).json({ message: "Match not found" });

  // Permission → only Umpire
  if (!isMatchAdmin(match, req.user.id)){
    return res
      .status(403)
      .json({ message: "Only umpire can select next batsman" });
  }

  const innings = match.innings[match.currentInningsIndex];

  if (!innings) return res.status(400).json({ message: "Innings not active" });

  // Ensure batsman stat exists
  ensureBatsman(innings, name);

  if (!innings.currentPartnership.striker) {
    innings.currentPartnership.striker = name;
  } else if (!innings.currentPartnership.nonStriker) {
    innings.currentPartnership.nonStriker = name;
  } else {
    return res
      .status(400)
      .json({ message: "No wicket waiting for a new batsman" });
  }
  io.to(roomId).emit("match:batsman-announced", {
    name,
    position: !innings.currentPartnership.striker ? "striker" : "nonStriker",
    timestamp: new Date(),
  });

  res.json({
    message: "Next batsman added",
    partnership: innings.currentPartnership,
    match,
  });
});

exports.selectNextBowler = asyncWrapper(async (req, res) => {
  const umpireId = req.user.id;
  const { id } = req.params; // matchId
  const { bowler } = req.body;

  if (!bowler) return res.status(400).json({ message: "Bowler name required" });

  const match = await Match.findById(id).populate("roomId");
  if (!match) return res.status(404).json({ message: "Match not found" });

  // Only umpire can choose bowler
  if (!isMatchAdmin(match, req.user.id)) {
    return res
      .status(403)
      .json({ message: "Only umpire can select next bowler" });
  }

  const innings = match.innings[match.currentInningsIndex];
  if (!innings) return res.status(400).json({ message: "Innings not active" });

  const legalBalls = innings.legalDeliveries;

  if (legalBalls === 0) {
    // start of innings: okay
  } else if (legalBalls % 6 !== 0) {
    return res.status(400).json({ message: "Over not completed yet" });
  }

  // Prevent same bowler bowling consecutive overs
  const lastCompletedOver = Math.floor((legalBalls - 1) / 6);

  const ballsInLastOver = innings.balls.filter(
    (b) => b.over === lastCompletedOver && b.ballInOver > 0
  );

  if (ballsInLastOver.length > 0) {
    const prevBowler = ballsInLastOver[0].bowler;
    if (prevBowler === bowler) {
      return res.status(400).json({
        message: "Bowler cannot bowl consecutive overs",
      });
    }
  }

  // Ensure bowler stat exists
  ensureBowler(innings, bowler);

  // No state to store here — bowler is passed to addBall() on next ball
  // We only confirm it is valid bowler
   const io = req.app.get("io");
  const roomId = match.roomId.id.toString();
  
  io.to(roomId).emit("match:bowler-announced", {
    bowler,
    timestamp: new Date()
  });
  
  res.json({ message: "Next bowler validated — ready to bowl", bowler, match });
});

exports.getMatchDetails = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const match = await Match.findById(id).populate("roomId").lean();

  if (!match) return res.status(404).json({ message: "Match not found" });

  const room = match.roomId;

  // Format innings with overs and bowler economy
  const formattedInnings = match.innings.map((inn, idx) => {
    const overs = Math.floor(inn.legalDeliveries / 6);
    const balls = inn.legalDeliveries % 6;
    const oversDisplay = `${overs}.${balls}`;

    // compute run rate
    const runRate =
      inn.legalDeliveries === 0
        ? 0
        : parseFloat(((inn.totalRuns * 6) / inn.legalDeliveries).toFixed(2));

    // format bowlers
    const bowlers = inn.bowlers.map((b) => {
      const o = Math.floor(b.balls / 6);
      const bl = b.balls % 6;
      const econ =
        b.balls === 0 ? 0 : parseFloat(((b.runs * 6) / b.balls).toFixed(2));

      return {
        name: b.name,
        overs: `${o}.${bl}`,
        runs: b.runs,
        wickets: b.wickets,
        wides: b.wides,
        noBalls: b.noBalls,
        economy: econ,
      };
    });

    return {
      index: idx + 1,
      team: inn.teamName,
      score: `${inn.totalRuns}/${inn.wickets}`,
      overs: oversDisplay,
      runRate,
      wickets: inn.wickets,
      totalRuns: inn.totalRuns,
      fallOfWickets: inn.fallOfWickets,
      partnerships: inn.partnerships,

      batsmen: inn.batsmen.map((b) => ({
        name: b.name,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        strikeRate:
          b.balls === 0 ? 0 : parseFloat(((b.runs * 100) / b.balls).toFixed(2)),
        isOut: b.isOut,
        dismissal: b.dismissal,
      })),

      bowlers,

      completed: inn.completed,
      balls: inn.balls, // FULL ball-by-ball record
    };
  });

  // REQUIRED RATE calculation
  let requiredRate = null;
  if (match.status !== "not_started" && match.currentInningsIndex === 1) {
    const first = match.innings[0];
    const second = match.innings[1];

    const target = first.totalRuns + 1;
    const runsLeft = target - second.totalRuns;
    const ballsLeft = second.oversLimit * 6 - second.legalDeliveries;

    if (ballsLeft > 0 && runsLeft > 0) {
      requiredRate = parseFloat(((runsLeft * 6) / ballsLeft).toFixed(2));
    } else {
      requiredRate = null;
    }
  }

  // BUILD FINAL RESPONSE
  const response = {
    matchId: match.id,
    status: match.status,
    result: match.result,
    toss: {
      winner: match.tossWinner,
      choice: match.tossChoice,
    },
    oversLimit: match.innings?.[0]?.oversLimit || room.overs,

    room: {
      id: room.id,
      teamA: room.teamA,
      teamB: room.teamB,
      umpire: room.umpire,
      participants: room.participants,
    },

    scoreboard: formattedInnings,
    requiredRate,
    currentInnings: match.currentInningsIndex + 1,
  };

  res.json(response);
});

exports.getAllMatches = asyncWrapper(async (req, res) => {
  const matches = await Match.find({})
    .populate("roomId")
    .sort({ createdAt: -1 })
    .lean();

  const mapped = matches.map((m) => ({
    matchId: m.id,
    status: m.status,
    result: m.result,
    tossWinner: m.tossWinner,
    tossChoice: m.tossChoice,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    room: {
      id: m.roomId?.id,
      name: m.roomId?.name,
      teamA: m.roomId?.teamA,
      teamB: m.roomId?.teamB,
      umpire: m.roomId?.umpire,
      createdBy: m.roomId?.createdBy,
    },
  }));

  res.json({ count: mapped.length, matches: mapped });
});

exports.getUserMatches = asyncWrapper(async (req, res) => {
  const { userId } = req.params;

  const matches = await Match.find({})
    .populate("roomId")
    .sort({ createdAt: -1 })
    .lean();

  const played = [];

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    const uid = userId.toString();

    const isTeamAPlayer =
      room.teamA.players.some((p) => p.userId?.toString() === uid) ||
      (room.teamA.captain && room.teamA.captain.userId?.toString() === uid);

    const isTeamBPlayer =
      room.teamB.players.some((p) => p.userId?.toString() === uid) ||
      (room.teamB.captain && room.teamB.captain.userId?.toString() === uid);

    const isStaticPlayer =
      room.teamA.staticPlayers.includes(uid) ||
      room.teamB.staticPlayers.includes(uid);

    const isUmpire = room.umpire && room.umpire.userId?.toString() === uid;

    const isCreator = room.createdBy?.toString() === uid;

    const isParticipant = room.participants.some((p) => p?.toString() === uid);

    if (
      isTeamAPlayer ||
      isTeamBPlayer ||
      isStaticPlayer ||
      isUmpire ||
      isCreator ||
      isParticipant
    ) {
      played.push({
        matchId: match.id,
        status: match.status,
        result: match.result,
        tossWinner: match.tossWinner,
        tossChoice: match.tossChoice,
        createdAt: match.createdAt,
        room: {
          id: room.id,
          name: room.name,
          teamA: room.teamA,
          teamB: room.teamB,
          umpire: room.umpire,
        },
      });
    }
  }

  res.json({ count: played.length, matches: played });
});
exports.getMyMatches = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  // reuse previous logic
  req.params.userId = userId;
  return exports.getUserMatches(req, res);
});
