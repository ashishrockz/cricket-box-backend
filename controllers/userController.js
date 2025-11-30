const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");

// get profile (with requests & friends)
exports.getProfile = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("friends.userId", "username")
    .populate("requests.sent.userId", "username")
    .populate("requests.received.userId", "username");

  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

// get all users (for search/friend)
exports.getAllUsers = asyncWrapper(async (req, res) => {
  const q = req.query.q ? { username: new RegExp(req.query.q, "i") } : {};
  const users = await User.find(q).select("username email");
  res.json(users);
});
exports.getUserById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user.id;

  const user = await User.findById(id)
    .select("-password")
    .populate("friends.userId", "username")
    .populate("requests.sent.userId", "username")
    .populate("requests.received.userId", "username");

  if (!user) return res.status(404).json({ message: "User not found" });

  // Relationship check
  const isFriend = user.friends.some(f => f.userId._id.toString() === loggedInUserId);
  const isRequestSent = user.requests.received.some(r => r.userId._id.toString() === loggedInUserId);
  const isRequestReceived = user.requests.sent.some(r => r.userId._id.toString() === loggedInUserId);

  res.json({
    user: {
      id: user._id,
      username: user.username,
      email: user.email,

      careerStats: user.careerStats,

      friends: user.friends.map(f => ({
        id: f.userId._id,
        username: f.userId.username
      })),

      requests: {
        sent: user.requests.sent.map(r => ({
          id: r.userId._id,
          username: r.userId.username
        })),
        received: user.requests.received.map(r => ({
          id: r.userId._id,
          username: r.userId.username
        }))
      }
    },

    relationship: {
      isFriend,
      isRequestSent,
      isRequestReceived
    }
  });
});
exports.getUserFriends = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const q = req.query.q ? req.query.q.trim().toLowerCase() : null;

  const user = await User.findById(id)
    .select("friends")
    .populate("friends.userId", "username email");

  if (!user) return res.status(404).json({ message: "User not found" });

  // Format friend list
  let friends = user.friends
    .filter(f => f.userId) // ensure valid populated user
    .map(f => ({
      id: f.userId._id,
      username: f.userId.username,
      email: f.userId.email
    }));

  // Optional search
  if (q) {
    friends = friends.filter(f => f.username.toLowerCase().includes(q));
  }

  res.json({
    friends,
    count: friends.length
  });
});

