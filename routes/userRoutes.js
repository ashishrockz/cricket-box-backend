const express = require("express");
const router = express.Router();
const authenticate = require("../middlewares/authenticate");
const userCtrl = require("../controllers/userController");

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile and search
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user's profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile with friends and requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 email:
 *                   type: string
 *                 careerStats:
 *                   type: object
 *                 friends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                 requests:
 *                   type: object
 *                   properties:
 *                     sent:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                     received:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users with relationship info
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users (excluding current user) with relationship status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   username:
 *                     type: string
 *                   avatar:
 *                     type: string
 *                     nullable: true
 *                   relationship:
 *                     type: object
 *                     properties:
 *                       isFriend:
 *                         type: boolean
 *                       isRequestSent:
 *                         type: boolean
 *                       isRequestReceived:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID with relationship info
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User details with relationship status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 email:
 *                   type: string
 *                 careerStats:
 *                   type: object
 *                 friends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                 relationship:
 *                   type: object
 *                   properties:
 *                     isFriend:
 *                       type: boolean
 *                     isRequestSent:
 *                       type: boolean
 *                     isRequestReceived:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /api/users/{id}/friends:
 *   get:
 *     tags: [Users]
 *     summary: Get user's friends list
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Optional search term to filter friends by username
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's friends with optional search filter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 friends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                         nullable: true
 *                       email:
 *                         type: string
 *                 count:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */

// Routes - Order matters! Specific routes before parameterized ones
router.get("/me", authenticate, userCtrl.getProfile);
router.get("/:id/friends", authenticate, userCtrl.getUserFriends);
router.get("/:id", authenticate, userCtrl.getUserById);
router.get("/", authenticate, userCtrl.getAllUsers);

module.exports = router;