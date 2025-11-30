const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const friendCtrl = require("../controllers/friendController");

// send request
router.post("/request/send", authenticate, friendCtrl.sendRequest);

// cancel sent request
router.post("/request/cancel", authenticate, friendCtrl.cancelRequest);

// accept request
router.post("/request/accept", authenticate, friendCtrl.acceptRequest);

// reject request
router.post("/request/reject", authenticate, friendCtrl.rejectRequest);

// remove friend
router.post("/remove", authenticate, friendCtrl.removeFriend);

// get lists
router.get("/lists", authenticate, friendCtrl.getRequestsAndFriends);

module.exports = router;
