// controllers/friendController.js

const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * @desc    Get user's friends, sent requests, received requests, and suggestions
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

    // ROBUST DATA HANDLING
    // Filter out any null values that can occur if a referenced user was deleted.
    const validFriends = user.friends
      ? user.friends.filter((f) => f !== null)
      : [];
    const validSentRequests = user.friendRequestsSent
      ? user.friendRequestsSent.filter((r) => r !== null)
      : [];
    const validReceivedRequests = user.friendRequestsReceived
      ? user.friendRequestsReceived.filter((r) => r !== null)
      : [];

    // Suggestion logic: Find users who are not friends and have no pending requests between them
    const existingConnections = [
      ...validFriends.map((f) => f._id),
      ...validSentRequests.map((r) => r._id),
      ...validReceivedRequests.map((r) => r._id),
      // ++ THE FIX IS HERE: Added the 'new' keyword ++
      new mongoose.Types.ObjectId(req.user.userId), // Exclude self
    ];

    const suggestions = await User.find({ _id: { $nin: existingConnections } })
      .select("fullName profilePicture")
      .limit(10);

    res.json({
      success: true,
      data: {
        friends: validFriends,
        sentRequests: validSentRequests,
        receivedRequests: validReceivedRequests,
        suggestions,
      },
    });
  } catch (error) {
    console.error("Get Connections Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Search for users by name or email
 * @route   GET /api/user/friends/search?q=...
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required" });
    }

    const searchRegex = new RegExp(q, "i");

    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [{ fullName: searchRegex }, { email: searchRegex }],
    })
      .select("fullName profilePicture")
      .limit(20);

    res.json({ success: true, data: { users } });
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Send a friend request to a user
 * @route   POST /api/user/friends/request/:userId
 * @access  Private
 */
const sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { userId: recipientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid recipient user ID format." });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        message: "You cannot add yourself as a friend.",
      });
    }

    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId),
    ]);

    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, message: "Recipient user not found." });
    }

    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sender (current user) not found." });
    }

    if (sender.friends.includes(recipientId)) {
      return res
        .status(400)
        .json({ success: false, message: "You are already friends." });
    }
    if (sender.friendRequestsSent.includes(recipientId)) {
      return res
        .status(400)
        .json({ success: false, message: "Friend request already sent." });
    }
    if (sender.friendRequestsReceived.includes(recipientId)) {
      sender.friendRequestsReceived.pull(recipientId);
      sender.friends.addToSet(recipientId);
      recipient.friendRequestsSent.pull(senderId);
      recipient.friends.addToSet(senderId);
      await Promise.all([sender.save(), recipient.save()]);
      return res.json({ success: true, message: "Friend request accepted." });
    }

    sender.friendRequestsSent.addToSet(recipientId);
    recipient.friendRequestsReceived.addToSet(senderId);
    await Promise.all([sender.save(), recipient.save()]);

    res.status(200).json({ success: true, message: "Friend request sent." });
  } catch (error) {
    console.error("Send Friend Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Accept a friend request
 * @route   POST /api/user/friends/accept/:userId
 * @access  Private
 */
const acceptFriendRequest = async (req, res) => {
  try {
    const recipientId = req.user.userId;
    const { userId: senderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sender user ID format." });
    }

    const [recipient, sender] = await Promise.all([
      User.findById(recipientId),
      User.findById(senderId),
    ]);

    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sending user not found." });
    }
    if (!recipient) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Recipient (current user) not found.",
        });
    }
    if (!recipient.friendRequestsReceived.includes(senderId)) {
      return res.status(400).json({
        success: false,
        message: "No friend request found from this user.",
      });
    }

    recipient.friendRequestsReceived.pull(senderId);
    recipient.friends.addToSet(senderId);
    sender.friendRequestsSent.pull(recipientId);
    sender.friends.addToSet(senderId);
    await Promise.all([recipient.save(), sender.save()]);

    res.json({ success: true, message: "Friend request accepted." });
  } catch (error) {
    console.error("Accept Friend Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Decline a received request or cancel a sent request
 * @route   DELETE /api/user/friends/decline/:userId
 * @access  Private
 */
const declineFriendRequest = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { userId: otherUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID format." });
    }

    const [currentUser, otherUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(otherUserId),
    ]);

    if (!otherUser || !currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    currentUser.friendRequestsReceived.pull(otherUserId);
    currentUser.friendRequestsSent.pull(otherUserId);
    otherUser.friendRequestsSent.pull(currentUserId);
    otherUser.friendRequestsReceived.pull(currentUserId);
    await Promise.all([currentUser.save(), otherUser.save()]);

    res.json({
      success: true,
      message: "Friend request declined or cancelled.",
    });
  } catch (error) {
    console.error("Decline Friend Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Remove an existing friend
 * @route   DELETE /api/user/friends/remove/:userId
 * @access  Private
 */
const removeFriend = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { userId: friendId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid friend ID format." });
    }

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
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
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
