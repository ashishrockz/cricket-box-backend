const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const roomCtrl = require("../controllers/roomController");

// create room (any authenticated user)
router.post("/", authenticate, roomCtrl.createRoom);

// get room details (authenticated)
router.get("/:roomId", authenticate, roomCtrl.getRoom);

// admin can approve rooms (requires admin)
router.post("/:roomId/approve", authenticate, authorize(["admin"]), roomCtrl.approveRoom);

module.exports = router;
