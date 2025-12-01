const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");

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
  receiver.requests.received.push({ userId: sender._id, username: sender.username });
  sender.requests.sent.push({ userId: receiver._id, username: receiver.username });

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
 * req.body: { senderId } // the user who sent request
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
    user.friends.push({ userId: sender._id, username: sender.username });
  }
  if (!sender.friends.some(f => f.userId.toString() === userId)) {
    sender.friends.push({ userId: user._id, username: user.username });
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
 * Returns requests with id field (not _id) for frontend consistency
 */
exports.getRequestsAndFriends = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("friends requests")
    .populate("friends.userId", "username avatar")
    .populate("requests.sent.userId", "username avatar")
    .populate("requests.received.userId", "username avatar");

  if (!user) return res.status(404).json({ message: "User not found" });

  // Transform _id to id for frontend
  const transformRequests = (requests) =>
    requests.map(r => ({
      id: r.userId._id.toString(),
      username: r.userId.username,
      avatar: r.userId.avatar || null
    }));

  res.json({
    friends: user.friends.map(f => ({
      id: f.userId._id.toString(),
      username: f.userId.username,
      avatar: f.userId.avatar || null
    })),
    requests: {
      sent: transformRequests(user.requests.sent),
      received: transformRequests(user.requests.received)
    }
  });
});