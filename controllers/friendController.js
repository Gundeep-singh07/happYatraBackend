// controllers/friendController.js

const User = require("../models/User");
const mongoose = require("mongoose");

// --- HELPER FUNCTION: VALIDATE MONGOOSE ID ---
const isValidObjectId = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res
      .status(400)
      .json({ success: false, message: "Invalid user ID format." });
    return false;
  }
  return true;
};

/**
 * @desc    Get user's connections (friends, requests, suggestions)
 * @route   GET /api/user/friends/connections
 * @access  Private
 */
const getConnections = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate("friends", "fullName profilePicture")
      .populate("friendRequestsSent", "fullName profilePicture")
      .populate("friendRequestsReceived", "fullName profilePicture")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const validFriends = user.friends ? user.friends.filter(Boolean) : [];
    const validSent = user.friendRequestsSent
      ? user.friendRequestsSent.filter(Boolean)
      : [];
    const validReceived = user.friendRequestsReceived
      ? user.friendRequestsReceived.filter(Boolean)
      : [];

    const existingConnections = [
      ...validFriends.map((f) => f._id),
      ...validSent.map((r) => r._id),
      ...validReceived.map((r) => r._id),
      new mongoose.Types.ObjectId(req.user.userId),
    ];

    const suggestions = await User.find({ _id: { $nin: existingConnections } })
      .select("fullName profilePicture")
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        friends: validFriends,
        sentRequests: validSent,
        receivedRequests: validReceived,
        suggestions,
      },
    });
  } catch (error) {
    console.error("Get Connections Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Search for users
 * @route   GET /api/user/friends/search?q=...
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Search query required." });
    }
    const searchRegex = new RegExp(q, "i");
    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [{ fullName: searchRegex }, { email: searchRegex }],
    })
      .select("fullName profilePicture")
      .limit(20)
      .lean();
    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Send a friend request
 * @route   POST /api/user/friends/request/:userId
 * @access  Private
 */
const sendFriendRequest = async (req, res) => {
  // In this context:
  // 'sender' is the currently logged-in user initiating the request.
  // 'recipient' is the user whose ID is in the URL parameter.
  const senderId = req.user.userId;
  const { userId: recipientId } = req.params;

  if (!isValidObjectId(recipientId, res)) return;
  if (senderId === recipientId) {
    return res
      .status(400)
      .json({ success: false, message: "You cannot add yourself." });
  }

  try {
    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId),
    ]);

    if (!recipient || !sender) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (sender.friends.includes(recipientId)) {
      return res
        .status(400)
        .json({ success: false, message: "You are already friends." });
    }
    if (sender.friendRequestsSent.includes(recipientId)) {
      return res
        .status(400)
        .json({ success: false, message: "Request already sent." });
    }

    // *** STRONG LOGIC REFACTOR ***
    // If the sender has already received a request from the recipient,
    // don't re-implement the logic. Instead, treat this action as ACCEPTING
    // the existing request. We call the master `acceptFriendRequest` function.
    if (sender.friendRequestsReceived.includes(recipientId)) {
      // We must construct a new `req` object for `acceptFriendRequest` because
      // the roles are swapped. Here, the current user (sender) is ACCEPTING.
      const virtualReq = {
        user: { userId: senderId }, // The user accepting is the current sender
        params: { userId: recipientId }, // The user who sent the original request is the recipient
      };
      return acceptFriendRequest(virtualReq, res);
    }

    // Standard flow: Add request to the respective arrays
    sender.friendRequestsSent.addToSet(recipientId);
    recipient.friendRequestsReceived.addToSet(senderId);
    await Promise.all([sender.save(), recipient.save()]);

    res.status(200).json({ success: true, message: "Friend request sent." });
  } catch (error) {
    console.error("Send Friend Request Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Accept a friend request
 * @route   POST /api/user/friends/accept/:userId
 * @access  Private
 */
const acceptFriendRequest = async (req, res) => {
  // In this context:
  // 'recipient' is the currently logged-in user who is ACCEPTING the request.
  // 'sender' is the user who INITIATED the request (their ID is in the URL).
  const recipientId = req.user.userId;
  const { userId: senderId } = req.params;

  if (!isValidObjectId(senderId, res)) return;

  try {
    const [recipient, sender] = await Promise.all([
      User.findById(recipientId),
      User.findById(senderId),
    ]);

    if (!sender || !recipient) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (!recipient.friendRequestsReceived.includes(senderId)) {
      return res
        .status(400)
        .json({ success: false, message: "No request found." });
    }

    // --- THIS IS THE SINGLE SOURCE OF TRUTH FOR CREATING A FRIENDSHIP ---

    // 1. Recipient updates their lists
    recipient.friendRequestsReceived.pull(senderId);
    recipient.friends.addToSet(senderId);

    // 2. Sender updates their lists
    sender.friendRequestsSent.pull(recipientId);

    // *** THE CRITICAL FIX IS HERE ***
    // The SENDER adds the RECIPIENT to their friends list.
    sender.friends.addToSet(recipientId); // NOT senderId

    await Promise.all([recipient.save(), sender.save()]);

    res.json({ success: true, message: "Friend request accepted." });
  } catch (error) {
    console.error("Accept Friend Request Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Decline a request or Cancel a sent request
 * @route   DELETE /api/user/friends/decline/:userId
 * @access  Private
 */
const declineFriendRequest = async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId: otherUserId } = req.params;

  if (!isValidObjectId(otherUserId, res)) return;

  try {
    const [currentUser, otherUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(otherUserId),
    ]);
    if (!otherUser || !currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Clean up from all possible states
    currentUser.friendRequestsReceived.pull(otherUserId);
    currentUser.friendRequestsSent.pull(otherUserId);
    otherUser.friendRequestsSent.pull(currentUserId);
    otherUser.friendRequestsReceived.pull(currentUserId);
    await Promise.all([currentUser.save(), otherUser.save()]);

    res.json({ success: true, message: "Request declined or cancelled." });
  } catch (error) {
    console.error("Decline/Cancel Request Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Remove an existing friend
 * @route   DELETE /api/user/friends/remove/:userId
 * @access  Private
 */
const removeFriend = async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId: friendId } = req.params;

  if (!isValidObjectId(friendId, res)) return;

  try {
    const [currentUser, friend] = await Promise.all([
      User.findById(currentUserId),
      User.findById(friendId),
    ]);
    if (!friend || !currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    currentUser.friends.pull(friendId);
    friend.friends.pull(currentUserId);
    await Promise.all([currentUser.save(), friend.save()]);

    res.json({ success: true, message: "Friend removed." });
  } catch (error) {
    console.error("Remove Friend Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  getConnections,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
};
