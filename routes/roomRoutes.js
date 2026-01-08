// routes/roomRoutes.js
const express = require("express");
const router = express.Router();
const roomCtrl = require("../controllers/roomController");
const authenticate = require("../middlewares/authenticate");

/**
 * @swagger
 * tags:
 *   - name: Rooms
 *     description: Room creation, joining, player management, game settings, toss, and match operations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PlayerRef:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: User's unique identifier
 *           example: "507f1f77bcf86cd799439011"
 *         username:
 *           type: string
 *           description: Username of the player
 *           example: "virat_kohli"
 *
 *     TeamData:
 *       type: object
 *       properties:
 *         captain:
 *           $ref: '#/components/schemas/PlayerRef'
 *         players:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PlayerRef'
 *           description: List of registered players in the team
 *         staticCaptain:
 *           type: string
 *           nullable: true
 *           description: Name of static (non-registered) captain
 *           example: "MS Dhoni"
 *         staticPlayers:
 *           type: array
 *           items:
 *             type: string
 *           description: List of static (non-registered) player names
 *           example: ["Sachin Tendulkar", "Rahul Dravid"]
 *
 *     Room:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique room identifier
 *           example: "507f1f77bcf86cd799439011"
 *         roomCode:
 *           type: string
 *           description: 6-character unique room code for joining
 *           example: "ABC123"
 *         name:
 *           type: string
 *           description: Room name
 *           example: "IPL Finals 2024"
 *         createdBy:
 *           type: string
 *           description: User ID of the room creator
 *           example: "507f1f77bcf86cd799439011"
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *           description: List of all participant user IDs
 *         umpire:
 *           $ref: '#/components/schemas/PlayerRef'
 *         teamA:
 *           $ref: '#/components/schemas/TeamData'
 *         teamB:
 *           $ref: '#/components/schemas/TeamData'
 *         overs:
 *           type: integer
 *           description: Number of overs for the match (1-50)
 *           default: 20
 *           example: 20
 *         maxPlayersPerTeam:
 *           type: integer
 *           description: Maximum players allowed per team (1-11)
 *           default: 11
 *           example: 11
 *         status:
 *           type: string
 *           enum: [pending, in_progress, finished]
 *           description: Current status of the room/match
 *           example: "pending"
 *         tossWinner:
 *           type: string
 *           enum: [A, B]
 *           nullable: true
 *           description: Team that won the toss
 *           example: "A"
 *         tossChoice:
 *           type: string
 *           enum: [bat, ball]
 *           nullable: true
 *           description: Choice made by toss winner
 *           example: "bat"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Room creation timestamp
 *
 *     RoleAssignment:
 *       type: object
 *       properties:
 *         assigned:
 *           type: boolean
 *           description: Whether role was automatically assigned
 *           example: true
 *         role:
 *           type: string
 *           description: The assigned role
 *           example: "captain"
 *         team:
 *           type: string
 *           nullable: true
 *           description: Team assigned to (A or B)
 *           example: "B"
 *         reason:
 *           type: string
 *           description: Reason for the assignment
 *           example: "Auto-assigned as Team B Captain"
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     tags: [Rooms]
 *     summary: Create a new room
 *     description: |
 *       Creates a new cricket match room with a unique 6-character room code.
 *       The creator is automatically added as a participant.
 *       Default settings: 20 overs, 11 players per team.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Custom room name (defaults to "{username}'s Room")
 *                 example: "IPL Finals 2024"
 *           examples:
 *             withName:
 *               value:
 *                 name: "IPL Finals 2024"
 *             withoutName:
 *               value: {}
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Room created successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *                 info:
 *                   type: string
 *                   example: "You are the room creator. Share the room code with others to join."
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 */

/**
 * @swagger
 * /api/rooms/join:
 *   post:
 *     tags: [Rooms]
 *     summary: Join a room using room code
 *     description: |
 *       Join an existing room by providing the 6-character room code.
 *       Automatically assigns roles based on room state:
 *       - First joiner becomes Team B captain
 *       - Subsequent joiners are balanced across teams
 *       - Cannot join if game already started or finished
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomCode
 *             properties:
 *               roomCode:
 *                 type: string
 *                 description: The 6-character room code
 *                 example: "ABC123"
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: Successfully joined the room
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Joined room successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *                 assignment:
 *                   $ref: '#/components/schemas/RoleAssignment'
 *       400:
 *         description: Bad request - Invalid room code, already in room, or game already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missingCode:
 *                 value:
 *                   message: "roomCode is required"
 *               alreadyInRoom:
 *                 value:
 *                   message: "You are already in this room"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot join: game already started or finished"
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Room not found"
 */

/**
 * @swagger
 * /api/rooms/{id}:
 *   get:
 *     tags: [Rooms]
 *     summary: Get room details by ID
 *     description: |
 *       Retrieves complete room information including teams, participants, settings, and computed metadata.
 *       Populates participant details (username, email).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room's unique identifier
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Room details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Room'
 *                 - type: object
 *                   properties:
 *                     teamACount:
 *                       type: integer
 *                       description: Total players in Team A
 *                       example: 5
 *                     teamBCount:
 *                       type: integer
 *                       description: Total players in Team B
 *                       example: 4
 *                     hasUmpire:
 *                       type: boolean
 *                       description: Whether umpire is assigned
 *                       example: true
 *                     isReady:
 *                       type: boolean
 *                       description: Whether room is ready to start (has overs, umpire, and both captains)
 *                       example: false
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Room not found"
 */

/**
 * @swagger
 * /api/rooms/{id}/assign-umpire:
 *   post:
 *     tags: [Rooms]
 *     summary: Assign or change the umpire
 *     description: |
 *       Assigns a user as the umpire for the room.
 *       - Only room creator or current umpire can assign
 *       - User is removed from any team roles if assigned
 *       - Cannot change umpire after game starts
 *       - If user not in room, they are added to participants
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of user to assign as umpire
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Umpire assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Umpire assigned successfully"
 *                 umpire:
 *                   $ref: '#/components/schemas/PlayerRef'
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Missing userId or game already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missingUserId:
 *                 value:
 *                   message: "userId required"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot change umpire after game started"
 *       403:
 *         description: Forbidden - Only creator or current umpire can assign
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only room creator or current umpire can assign umpire"
 *       404:
 *         description: Room or user not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               roomNotFound:
 *                 value:
 *                   message: "Room not found"
 *               userNotFound:
 *                 value:
 *                   message: "User not found"
 */

/**
 * @swagger
 * /api/rooms/{id}/set-settings:
 *   post:
 *     tags: [Rooms]
 *     summary: Set game settings (overs and max players)
 *     description: |
 *       Configure match settings for the room.
 *       **Permission Rules:**
 *       - If umpire is assigned: Only the umpire can modify settings
 *       - If NO umpire is assigned: Only the room creator can modify settings (creator acts as umpire)
 *       - If creator is the ONLY participant: Creator can modify settings even if umpire is assigned
 *
 *       **Validation:**
 *       - Overs: 1-50
 *       - Max players per team: 1-11
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               overs:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 description: Number of overs for the match
 *                 example: 20
 *               maxPlayersPerTeam:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 11
 *                 description: Maximum players allowed per team
 *                 example: 11
 *           examples:
 *             setBoth:
 *               value:
 *                 overs: 20
 *                 maxPlayersPerTeam: 11
 *             setOversOnly:
 *               value:
 *                 overs: 10
 *             setMaxPlayersOnly:
 *               value:
 *                 maxPlayersPerTeam: 7
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Settings updated successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Validation error - Invalid overs or maxPlayersPerTeam
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalidOvers:
 *                 value:
 *                   message: "Overs must be between 1 and 50"
 *               invalidMaxPlayers:
 *                 value:
 *                   message: "maxPlayersPerTeam must be between 1 and 11"
 *       403:
 *         description: Forbidden - Only umpire or room creator (when no umpire) can modify settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               umpireOnly:
 *                 value:
 *                   message: "Only umpire can modify game settings"
 *               creatorOnlyNoUmpire:
 *                 value:
 *                   message: "Only room creator can modify game settings when no umpire is assigned"
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Room not found"
 */

/**
 * @swagger
 * /api/rooms/{id}/select-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Select a registered user as player or captain
 *     description: |
 *       Add a registered user to a team as either a player or captain.
 *
 *       **Permissions:**
 *       - Team captain or room creator can select players
 *
 *       **Requirements:**
 *       - Target user must be in your friends list
 *       - User cannot already have a role in the room
 *       - Team must not be full (respects maxPlayersPerTeam)
 *       - Game must be in pending status
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *               - userId
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B]
 *                 description: Team to add player to
 *                 example: "A"
 *               userId:
 *                 type: string
 *                 description: ID of user to add
 *                 example: "507f1f77bcf86cd799439012"
 *               asCaptain:
 *                 type: boolean
 *                 description: Whether to assign as captain (default false)
 *                 default: false
 *                 example: false
 *           examples:
 *             addPlayer:
 *               value:
 *                 team: "A"
 *                 userId: "507f1f77bcf86cd799439012"
 *                 asCaptain: false
 *             addCaptain:
 *               value:
 *                 team: "B"
 *                 userId: "507f1f77bcf86cd799439013"
 *                 asCaptain: true
 *     responses:
 *       200:
 *         description: Player selected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *             examples:
 *               playerAdded:
 *                 value:
 *                   message: "Player added to Team A"
 *               captainSet:
 *                 value:
 *                   message: "Captain set for Team B"
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalidTeam:
 *                 value:
 *                   message: "team must be 'A' or 'B'"
 *               missingUserId:
 *                 value:
 *                   message: "userId required"
 *               notFriend:
 *                 value:
 *                   message: "You can only select players from your friends list"
 *               alreadyHasRole:
 *                 value:
 *                   message: "User is already captain in Team A"
 *               teamFull:
 *                 value:
 *                   message: "Team A already has maximum players (11)"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot select players after game started"
 *       403:
 *         description: Forbidden - Only team captain or room creator can select
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               notAuthorized:
 *                 value:
 *                   message: "Only team captain or room creator can select players"
 *               mustJoinFirst:
 *                 value:
 *                   message: "You must join the room first"
 *       404:
 *         description: Room or user not found
 */

/**
 * @swagger
 * /api/rooms/{id}/remove-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Remove a player from a team
 *     description: |
 *       Remove a registered user from a team (player or captain).
 *       User is also removed from room participants.
 *
 *       **Permissions:**
 *       - Team captain or room creator can remove players
 *       - Cannot remove after game started
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *               - userId
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B]
 *                 description: Team to remove player from
 *                 example: "A"
 *               userId:
 *                 type: string
 *                 description: ID of user to remove
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Player removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Player removed successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Missing parameters or game already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               missingParams:
 *                 value:
 *                   message: "team and userId required"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot remove players after game started"
 *       403:
 *         description: Forbidden - Only team captain or room creator can remove
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only team captain or room creator can remove players"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/add-static-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Add a non-registered player by name
 *     description: |
 *       Add a static player (non-registered user) to a team by providing their name.
 *       Useful for including players who don't have accounts.
 *
 *       **Permissions:**
 *       - Team captain or room creator can add static players
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *               - name
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B]
 *                 description: Team to add player to
 *                 example: "A"
 *               name:
 *                 type: string
 *                 description: Name of the player
 *                 example: "Sachin Tendulkar"
 *               asCaptain:
 *                 type: boolean
 *                 description: Whether to set as static captain
 *                 default: false
 *                 example: false
 *           examples:
 *             addStaticPlayer:
 *               value:
 *                 team: "A"
 *                 name: "Sachin Tendulkar"
 *                 asCaptain: false
 *             addStaticCaptain:
 *               value:
 *                 team: "B"
 *                 name: "MS Dhoni"
 *                 asCaptain: true
 *     responses:
 *       200:
 *         description: Static player added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *             examples:
 *               playerAdded:
 *                 value:
 *                   message: "Static player added"
 *               captainAdded:
 *                 value:
 *                   message: "Static captain added"
 *       400:
 *         description: Bad request - Missing parameters or game already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalidTeam:
 *                 value:
 *                   message: "team must be A or B"
 *               missingName:
 *                 value:
 *                   message: "Player name required"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot add players after game started"
 *       403:
 *         description: Forbidden - Only team captain or room creator can add
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only team captain or room creator can add static players"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/remove-static-player:
 *   post:
 *     tags: [Rooms]
 *     summary: Remove a static player by name
 *     description: |
 *       Remove a static (non-registered) player from a team.
 *       Works for both static players and static captains.
 *
 *       **Permissions:**
 *       - Team captain or room creator can remove static players
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *               - name
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B]
 *                 description: Team to remove player from
 *                 example: "A"
 *               name:
 *                 type: string
 *                 description: Name of the player to remove
 *                 example: "Sachin Tendulkar"
 *     responses:
 *       200:
 *         description: Static player removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Static player removed"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Missing parameters or game already started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalidTeam:
 *                 value:
 *                   message: "team must be A or B"
 *               missingName:
 *                 value:
 *                   message: "Player name required"
 *               gameStarted:
 *                 value:
 *                   message: "Cannot remove players after game started"
 *       403:
 *         description: Forbidden - Only team captain or room creator can remove
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only team captain or room creator can remove static players"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/start:
 *   post:
 *     tags: [Rooms]
 *     summary: Start the game
 *     description: |
 *       Start the match and change room status to 'in_progress'.
 *
 *       **Permission Rules:**
 *       - If umpire is assigned: Only the umpire can start the game
 *       - If NO umpire is assigned: Only the room creator can start the game (creator acts as umpire)
 *       - If creator is the ONLY participant: Creator can start the game even if umpire is assigned
 *
 *       **Validation Requirements:**
 *       - Overs must be set (minimum 1)
 *       - Both teams must have 1-maxPlayersPerTeam players (including static players)
 *       - No user can be assigned to multiple roles
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Game started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Game started successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               noOvers:
 *                 value:
 *                   message: "Please set valid overs (minimum 1)"
 *               teamTooSmall:
 *                 value:
 *                   message: "Team A must have 1-11 players (currently 0)"
 *               teamTooBig:
 *                 value:
 *                   message: "Team B must have 1-11 players (currently 12)"
 *               duplicateRole:
 *                 value:
 *                   message: "Conflict: User assigned to multiple roles"
 *       403:
 *         description: Forbidden - Only umpire or room creator (when no umpire) can start
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               umpireOnly:
 *                 value:
 *                   message: "Only umpire can start the game"
 *               creatorOnlyNoUmpire:
 *                 value:
 *                   message: "Only room creator can start the game when no umpire is assigned"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/toss:
 *   post:
 *     tags: [Rooms]
 *     summary: Perform the toss
 *     description: |
 *       Randomly determine which team wins the toss.
 *
 *       **Permission Rules:**
 *       - If umpire is assigned: Only the umpire can perform the toss
 *       - If NO umpire is assigned: Only the room creator can perform the toss (creator acts as umpire)
 *       - If creator is the ONLY participant: Creator can perform the toss even if umpire is assigned
 *
 *       **Requirements:**
 *       - Game must be started (status: in_progress)
 *       - Toss can only be done once
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Toss completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Team A won the toss"
 *                 tossWinner:
 *                   type: string
 *                   enum: [A, B]
 *                   example: "A"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Game not started or toss already done
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               gameNotStarted:
 *                 value:
 *                   message: "Game must be started before toss"
 *               tossAlreadyDone:
 *                 value:
 *                   message: "Toss already completed"
 *       403:
 *         description: Forbidden - Only umpire or room creator (when no umpire) can perform toss
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               umpireOnly:
 *                 value:
 *                   message: "Only umpire can start the toss"
 *               creatorOnlyNoUmpire:
 *                 value:
 *                   message: "Only room creator can start the toss when no umpire is assigned"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/toss-choice:
 *   post:
 *     tags: [Rooms]
 *     summary: Make toss decision (bat or ball)
 *     description: |
 *       The team that won the toss chooses whether to bat or bowl first.
 *
 *       **Permissions:**
 *       - Winning team's captain or room creator can make the choice
 *
 *       **Requirements:**
 *       - Toss must be completed first
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - choice
 *             properties:
 *               choice:
 *                 type: string
 *                 enum: [bat, ball]
 *                 description: Whether to bat or bowl first
 *                 example: "bat"
 *     responses:
 *       200:
 *         description: Toss choice recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Team A chose to bat"
 *                 tossChoice:
 *                   type: string
 *                   enum: [bat, ball]
 *                   example: "bat"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Bad request - Invalid choice or toss not done
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               invalidChoice:
 *                 value:
 *                   message: "choice must be 'bat' or 'ball'"
 *               tossNotDone:
 *                 value:
 *                   message: "Toss not done yet"
 *       403:
 *         description: Forbidden - Only winning team's captain or creator can choose
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Only winning team's captain or room creator can choose"
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/{id}/leave:
 *   post:
 *     tags: [Rooms]
 *     summary: Leave the room
 *     description: |
 *       Remove yourself from the room.
 *       You are removed from all roles (captain, player, umpire) and from participants list.
 *       Emits a real-time notification to other room members.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Left room successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Left room successfully"
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 */

/**
 * @swagger
 * /api/rooms/my-rooms:
 *   get:
 *     tags: [Rooms]
 *     summary: Get rooms created by the logged-in user
 *     description: |
 *       Retrieves all rooms created by the authenticated user, sorted by creation date (newest first).
 *       Includes populated participant details.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's created rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "My created rooms"
 *                 count:
 *                   type: integer
 *                   description: Number of rooms created
 *                   example: 5
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 */

router.use(authenticate);

// Create a room
router.post("/", roomCtrl.createRoom);

// Join by roomCode
router.post("/join", roomCtrl.joinRoomByCode);

// Get my created rooms
router.get("/my-rooms", roomCtrl.getMyCreatedRooms);

// Get room by id
router.get("/:id", roomCtrl.getRoom);

// Assign umpire
router.post("/:id/assign-umpire", roomCtrl.assignUmpire);

// Set overs / maxPlayersPerTeam (umpire or creator when no umpire)
router.post("/:id/set-settings", roomCtrl.setSettings);

// Select a player (add to team or set captain)
router.post("/:id/select-player", roomCtrl.selectPlayer);

// Remove player
router.post("/:id/remove-player", roomCtrl.removePlayer);

// Add static player
router.post("/:id/add-static-player", roomCtrl.addStaticPlayer);

// Remove static player
router.post("/:id/remove-static-player", roomCtrl.removeStaticPlayer);

// Start the game (umpire or creator when no umpire)
router.post("/:id/start", roomCtrl.startGame);

// Perform toss (umpire or creator when no umpire)
router.post("/:id/toss", roomCtrl.doToss);

// Choose toss option
router.post("/:id/toss-choice", roomCtrl.chooseTossOption);

// Leave room
router.post("/:id/leave", roomCtrl.leaveRoom);

module.exports = router;
