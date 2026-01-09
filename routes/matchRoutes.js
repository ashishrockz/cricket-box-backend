// routes/matchRoutes.js
const express = require("express");
const router = express.Router();
const matchCtrl = require("../controllers/matchController");
const authenticate = require("../middlewares/authenticate"); // use your existing auth

router.use(authenticate);
/**
 * @swagger
 * tags:
 *   - name: Matches
 *     description: Match lifecycle — create, start innings, add ball, end innings, scoreboard, details
 */

/**
 * @swagger
 * /api/matches:
 *   post:
 *     tags: [Matches]
 *     summary: Create a match from a room (after toss)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               roomId: { type: string }
 *               matchType: { type: string }
 *               oversPerInnings: { type: integer }
 *     responses:
 *       201:
 *         description: match created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */

/**
 * @swagger
 * /api/matches/{id}/start-innings:
 *   post:
 *     tags: [Matches]
 *     summary: Initialize innings — set openers & bowler (umpire only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               striker: { type: string }
 *               nonStriker: { type: string }
 *               bowler: { type: string }
 */

/**
 * @swagger
 * /api/matches/{id}/ball:
 *   post:
 *     tags: [Matches]
 *     summary: Add a ball (umpire-only). Supports extras & wickets.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               runs: { type: integer }
 *               extras:
 *                 type: object
 *                 properties:
 *                   wide: { type: integer }
 *                   noBall: { type: integer }
 *                   bye: { type: integer }
 *                   legBye: { type: integer }
 *                   penalty: { type: integer }
 *               isWicket: { type: boolean }
 *               wicketType: { type: string }
 *               wicketPlayer: { type: string }
 *               bowler: { type: string }
 *               commentary: { type: string }
 */

/**
 * @swagger
 * /api/matches/{id}/next-batsman:
 *   post:
 *     tags: [Matches]
 *     summary: Set next batsman after wicket (umpire only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               name: { type: string }
 */

/**
 * @swagger
 * /api/matches/{id}/next-bowler:
 *   post:
 *     tags: [Matches]
 *     summary: Validate/select next bowler after over completion (umpire only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               bowler: { type: string }
 */

/**
 * @swagger
 * /api/matches/{id}/end-innings:
 *   post:
 *     tags: [Matches]
 *     summary: End innings manually (umpire only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               reason: { type: string }
 */

/**
 * @swagger
 * /api/matches/{id}/scoreboard:
 *   get:
 *     tags: [Matches]
 *     summary: Get scoreboard for match
 *     parameters:
 *       - in: path
 *         name: id
 *     responses:
 *       200:
 *         description: scoreboard
 */

/**
 * @swagger
 * /api/matches/{id}/details:
 *   get:
 *     tags: [Matches]
 *     summary: Get full match details and summary
 *     parameters:
 *       - in: path
 *         name: id
 */

// create match from room (after toss)
router.post("/create", matchCtrl.createMatch);

// initialize innings (set openers & bowler)
router.post("/:id/start-innings", matchCtrl.startInnings);

// add ball (umpire only)
router.post("/:id/ball", matchCtrl.addBall);

// end innings manually
router.post("/:id/end-innings", matchCtrl.endInnings);

// scoreboard
router.get("/:id/scoreboard", matchCtrl.getScoreboard);
router.post("/:id/next-batsman", matchCtrl.selectNextBatsman);
router.post("/:id/next-bowler", matchCtrl.selectNextBowler);
router.get("/:id/details", matchCtrl.getMatchDetails);
router.get("/all", matchCtrl.getAllMatches);
router.get("/user/:userId", matchCtrl.getUserMatches);
router.get("/my-matches", matchCtrl.getMyMatches);

module.exports = router;
