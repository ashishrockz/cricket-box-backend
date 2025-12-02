// routes/roomRoutes.js
const express = require("express");
const router = express.Router();
const roomCtrl = require("../controllers/roomController");
const authenticate = require("../middlewares/authenticate"); // assumes you have this
/**
 * @swagger
 * tags:
 *   - name: Rooms
 *     description: Room creation, join, player selection, toss, and start
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     tags: [Rooms]
 *     summary: Create a new room
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Room created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 */

/**
 * @swagger
 * /api/rooms/join:
 *   post:
 *     tags: [Rooms]
 *     summary: Join room by roomCode
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               roomCode: { type: string }
 */

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     tags: [Rooms]
 *     summary: Get room by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Room object
 */

/**
 * @swagger
 * /api/rooms/{id}/assign-umpire:
 *   post:
 *     tags: [Rooms]
 *     summary: Assign umpire for the room
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               userId: { type: string }
 */

/**
 * @swagger
 * /api/rooms/{id}/set-settings:
 *   post:
 *     tags: [Rooms]
 *     summary: Set overs and max players (umpire only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               overs: { type: integer }
 *               maxPlayersPerTeam: { type: integer }
 */

/**
 * @swagger
 * /api/rooms/{id}/select-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Add a registered user to a team or set as captain
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               team: { type: string, enum: ["A","B"] }
 *               userId: { type: string }
 *               asCaptain: { type: boolean }
 */

/**
 * @swagger
 * /api/rooms/{id}/add-static-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Add static player by name to a team
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
 *               team: { type: string, enum: ["A","B"] }
 *               name: { type: string }
 *               asCaptain: { type: boolean }
 */

/**
 * @swagger
 * /api/rooms/{id}/remove-static-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Remove static player by name
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               team: { type: string, enum: ["A","B"] }
 *               name: { type: string }
 */

/**
 * @swagger
 * /api/rooms/{id}/start:
 *   post:
 *     tags: [Rooms]
 *     summary: Start game (umpire only)
 *     security:
 *       - BearerAuth: []
 */

router.use(authenticate);

// create a room
router.post("/", roomCtrl.createRoom);

// join by roomCode
router.post("/join", roomCtrl.joinRoomByCode);

// get room by id
router.get("/:id", roomCtrl.getRoom);

// assign umpire
router.post("/:id/assign-umpire", roomCtrl.assignUmpire);

// set overs / maxPlayersPerTeam (only umpire)
router.post("/:id/set-settings", roomCtrl.setSettings);

// select a player (add to team or set captain)
router.post("/:id/select-player", roomCtrl.selectPlayer);

// remove player
router.post("/:id/remove-player", roomCtrl.removePlayer);

// start the game (umpire only)
router.post("/:id/start", roomCtrl.startGame);

// leave room
router.post("/:id/leave", roomCtrl.leaveRoom);
router.post("/:id/add-static-player", roomCtrl.addStaticPlayer);
router.post("/:id/remove-static-player", roomCtrl.removeStaticPlayer);
router.post("/:id/toss", roomCtrl.doToss);
router.post("/:id/toss-choice", roomCtrl.chooseTossOption);
router.get("/my-rooms", authenticate, roomCtrl.getMyCreatedRooms);

module.exports = router;
