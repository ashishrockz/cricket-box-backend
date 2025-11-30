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
 *         description: Current user profile
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users (search by q query param)
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: search term
 *     responses:
 *       200:
 *         description: list of users
 */
 
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id (with relationship info)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: user details
 */

router.get("/me", authenticate, userCtrl.getProfile);
router.get("/:id", authenticate, userCtrl.getUserById);
router.get("/:id/friends", authenticate, userCtrl.getUserFriends);
router.get("/", authenticate, userCtrl.getAllUsers);



module.exports = router;
