const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const matchCtrl = require("../controllers/matchController");

// ✅ Start match from room
router.post("/start", authenticate, matchCtrl.createMatchFromRoom);

// ✅ Add ball event
router.post("/:matchId/event", authenticate, matchCtrl.addBallEvent);

// ✅ End match
router.post("/:matchId/end", authenticate, matchCtrl.endMatch);

module.exports = router;
