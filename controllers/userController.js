const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");

// ============= USERS ENDPOINTS =============

/**
 * Get all users with relationship info
 * Returns users with relationship status relative to logged-in user
 */
exports.getAllUsers = asyncWrapper(async (req, res) => {
  const loggedInUserId = req.user.id;
  
  // Get all users except the logged-in user
  const users = await User.find({ id: { $ne: loggedInUserId } })
    .select("id username avatar")
    .populate("friends.userId", "id username")
    .populate("requests.sent.userId", "id username")
    .populate("requests.received.userId", "id username");

  // Map users with relationship info
  const usersWithRelationship = users.map(user => ({
    id: user.id,
    username: user.username,
    avatar: user.avatar || null,
    relationship: {
      isFriend: user.friends.some(f => f.userId.id.toString() === loggedInUserId),
      isRequestSent: user.requests.received.some(r => r.userId.id.toString() === loggedInUserId),
      isRequestReceived: user.requests.sent.some(r => r.userId.id.toString() === loggedInUserId)
    }
  }));

  res.json(usersWithRelationship);
});

/**
 * Get user by ID with relationship info
 * req.params: { id }
 */
exports.getUserById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user.id;

  if (id === loggedInUserId) {
    return exports.getProfile(arguments[0], arguments[1]);
  }

  const user = await User.findById(id)
    .select("-password")
    .populate("friends.userId", "id username avatar")
    .populate("requests.sent.userId", "id username")
    .populate("requests.received.userId", "id username");

  if (!user) return res.status(404).json({ message: "User not found" });

  const relationship = {
    isFriend: user.friends.some(f => f.userId.id.toString() === loggedInUserId),
    isRequestSent: user.requests.received.some(r => r.userId.id.toString() === loggedInUserId),
    isRequestReceived: user.requests.sent.some(r => r.userId.id.toString() === loggedInUserId)
  };

  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar || null,
    email: user.email,
    careerStats: user.careerStats,
    friends: user.friends.map(f => ({
      id: f.userId.id,
      username: f.userId.username
    })),
    relationship
  });
});

/**
 * Get current user profile
 */
exports.getProfile = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate("friends.userId", "id username avatar")
    .populate("requests.sent.userId", "id username")
    .populate("requests.received.userId", "id username");

  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar || null,
    email: user.email,
    careerStats: user.careerStats,
    friends: user.friends.map(f => ({
      id: f.userId.id,
      username: f.userId.username
    })),
    requests: {
      sent: user.requests.sent.map(r => ({
        id: r.userId.id,
        username: r.userId.username
      })),
      received: user.requests.received.map(r => ({
        id: r.userId.id,
        username: r.userId.username
      }))
    }
  });
});

/**
 * Get user's friends list
 * req.params: { id }
 * req.query: { q } (optional search)
 */
exports.getUserFriends = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const q = req.query.q ? req.query.q.trim().toLowerCase() : null;

  const user = await User.findById(id)
    .select("friends")
    .populate("friends.userId", "id username avatar email");

  if (!user) return res.status(404).json({ message: "User not found" });

  let friends = user.friends
    .filter(f => f.userId)
    .map(f => ({
      id: f.userId.id,
      username: f.userId.username,
      avatar: f.userId.avatar || null,
      email: f.userId.email
    }));

  if (q) {
    friends = friends.filter(f => f.username.toLowerCase().includes(q));
  }

  res.json({
    friends,
    count: friends.length
  });
});

// ============= FRIENDS ENDPOINTS =============

/**
 * Send friend request
 * req.body: { receiverId }
 */
exports.sendRequest = asyncWrapper(async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;

  if (!receiverId) return res.status(400).json({ message: "receiverId is required" });
  if (senderId === receiverId) return res.status(400).json({ message: "Cannot send request to yourself" });

  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);
  if (!receiver) return res.status(404).json({ message: "Receiver not found" });

  // Already friends?
  if (receiver.friends.some(f => f.userId.toString() === senderId)) {
    return res.status(400).json({ message: "Already friends" });
  }

  // Already sent?
  if (receiver.requests.received.some(r => r.userId.toString() === senderId)) {
    return res.status(400).json({ message: "Request already sent" });
  }

  // Add incoming to receiver and outgoing to sender
  receiver.requests.received.push({ userId: sender.id, username: sender.username });
  sender.requests.sent.push({ userId: receiver.id, username: receiver.username });

  await receiver.save();
  await sender.save();

  res.json({ message: "Friend request sent" });
});

/**
 * Cancel sent request
 * req.body: { receiverId }
 */
exports.cancelRequest = asyncWrapper(async (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ message: "receiverId required" });

  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);
  if (!receiver) return res.status(404).json({ message: "Receiver not found" });

  sender.requests.sent = sender.requests.sent.filter(r => r.userId.toString() !== receiverId);
  receiver.requests.received = receiver.requests.received.filter(r => r.userId.toString() !== senderId);

  await sender.save();
  await receiver.save();

  res.json({ message: "Friend request cancelled" });
});

/**
 * Accept friend request
 * req.body: { senderId }
 */
exports.acceptRequest = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ message: "senderId required" });

  const user = await User.findById(userId);
  const sender = await User.findById(senderId);
  if (!sender) return res.status(404).json({ message: "Sender not found" });

  // Remove request entries
  user.requests.received = user.requests.received.filter(r => r.userId.toString() !== senderId);
  sender.requests.sent = sender.requests.sent.filter(r => r.userId.toString() !== userId);

  // Add to friends if not already
  if (!user.friends.some(f => f.userId.toString() === senderId)) {
    user.friends.push({ userId: sender.id, username: sender.username });
  }
  if (!sender.friends.some(f => f.userId.toString() === userId)) {
    sender.friends.push({ userId: user.id, username: user.username });
  }

  await user.save();
  await sender.save();

  res.json({ message: "Friend request accepted" });
});

/**
 * Reject friend request
 * req.body: { senderId }
 */
exports.rejectRequest = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { senderId } = req.body;
  if (!senderId) return res.status(400).json({ message: "senderId required" });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.requests.received = user.requests.received.filter(r => r.userId.toString() !== senderId);
  await user.save();

  // Also remove sender.sent entry if it exists
  const sender = await User.findById(senderId);
  if (sender) {
    sender.requests.sent = sender.requests.sent.filter(r => r.userId.toString() !== userId);
    await sender.save();
  }

  res.json({ message: "Friend request rejected" });
});

/**
 * Remove friend
 * req.body: { friendId }
 */
exports.removeFriend = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ message: "friendId required" });

  const user = await User.findById(userId);
  const friend = await User.findById(friendId);
  if (!friend) return res.status(404).json({ message: "Friend not found" });

  user.friends = user.friends.filter(f => f.userId.toString() !== friendId);
  friend.friends = friend.friends.filter(f => f.userId.toString() !== userId);

  await user.save();
  await friend.save();

  res.json({ message: "Friend removed" });
});

/**
 * Get incoming/outgoing requests & friends
 */
exports.getRequestsAndFriends = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("friends requests")
    .populate("friends.userId", "username avatar")
    .populate("requests.sent.userId", "username")
    .populate("requests.received.userId", "username");

  if (!user) return res.status(404).json({ message: "User not found" });
  
  res.json({
    friends: user.friends.map(f => ({
      id: f.userId.id,
      username: f.userId.username,
      avatar: f.userId.avatar || null
    })),
    requests: {
      sent: user.requests.sent.map(r => ({
        id: r.userId.id,
        username: r.userId.username
      })),
      received: user.requests.received.map(r => ({
        id: r.userId.id,
        username: r.userId.username
      }))
    }
  });
});