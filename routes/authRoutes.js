const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const authCtrl = require("../controllers/authController");
/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *               email: { type: string }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     username: { type: string }
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 */

const validateSignup = [
  body("username").isString().trim().notEmpty(),
  body("password").isString().isLength({ min: 6 }),
  body("email").optional().isEmail(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    next();
  },
];

router.post("/signup", validateSignup, authCtrl.signup);
router.post(
  "/login",
  [
    body("username").isString().notEmpty(),
    body("password").isString().notEmpty(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res
          .status(400)
          .json({ message: "Validation failed", errors: errors.array() });
      next();
    },
  ],
  authCtrl.login
);

module.exports = router;
