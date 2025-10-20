const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const tourCtrl = require("../controllers/tournamentController");

// create (admins or super users) - allow admin for now
router.post("/", authenticate, authorize(["admin"]), tourCtrl.createTournament);
router.get("/", authenticate, tourCtrl.getTournaments);
router.get("/:id", authenticate, tourCtrl.getTournament);

module.exports = router;
