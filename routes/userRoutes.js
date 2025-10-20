const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const userCtrl = require("../controllers/userController");

router.get("/me", authenticate, userCtrl.getProfile);
// admin route to list all users
router.get("/", authenticate, authorize(["admin"]), userCtrl.getAllUsers);

module.exports = router;
