const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const auth = require("../controllers/authController");

// validations
const validateSignup = [
  body("username").isString().trim().notEmpty(),
  body("password").isString().isLength({ min: 6 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    next();
  }
];

router.post("/signup", validateSignup, auth.signup);
router.post("/login", [
  body("username").isString().notEmpty(),
  body("password").isString().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    next();
  }
], auth.login);

module.exports = router;
