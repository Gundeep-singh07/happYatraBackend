const AdminNotification = require("../models/AdminNotification.model");

// Get all notifications (Admin only)
const getAllNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      priority,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Add filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
      populate: {
        path: "createdBy",
        select: "fullName email",
      },
    };

    const notifications = await AdminNotification.paginate(query, options);

    res.status(200).json({
      success: true,
      data: notifications,
      message: "Notifications fetched successfully",
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Get notification by ID
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await AdminNotification.findById(id).populate({
      path: "createdBy",
      select: "fullName email",
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
      message: "Notification fetched successfully",
    });
  } catch (error) {
    console.error("Get notification by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification",
      error: error.message,
    });
  }
};

// Create new notification
const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      priority = "medium",
      location,
      expiresAt,
    } = req.body;

    // Validation
    if (!title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and type are required",
      });
    }

    const notificationData = {
      title: title.trim(),
      message: message.trim(),
      type,
      priority,
      createdBy: req.user.id, // Assuming auth middleware sets req.user
      status: "draft",
    };

    // Add location if provided
    if (location && location.latitude && location.longitude) {
      notificationData.location = {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        address: location.address || "",
      };
    }

    // Add expiration date if provided
    if (expiresAt) {
      notificationData.expiresAt = new Date(expiresAt);
    }

    const notification = new AdminNotification(notificationData);
    await notification.save();

    await notification.populate({
      path: "createdBy",
      select: "fullName email",
    });

    res.status(201).json({
      success: true,
      data: notification,
      message: "Notification created successfully",
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

// Update notification
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated directly
    delete updateData.createdBy;
    delete updateData.sentAt;
    delete updateData.readBy;

    const notification = await AdminNotification.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate({
      path: "createdBy",
      select: "fullName email",
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
      message: "Notification updated successfully",
    });
  } catch (error) {
    console.error("Update notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await AdminNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

// Send notification (change status to 'sent')
const sendNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await AdminNotification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (notification.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Notification has already been sent",
      });
    }

    notification.status = "active";
    notification.sentAt = new Date();

    // In a real application, you would implement the actual sending logic here
    // For example: send push notifications, emails, etc.
    // For now, we'll just update the recipient count with a mock value
    notification.recipients = Math.floor(Math.random() * 1000) + 100;

    await notification.save();

    await notification.populate({
      path: "createdBy",
      select: "fullName email",
    });

    res.status(200).json({
      success: true,
      data: notification,
      message: "Notification sent successfully",
    });
  } catch (error) {
    console.error("Send notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    });
  }
};

// Get notification statistics
const getNotificationStats = async (req, res) => {
  try {
    const stats = await AdminNotification.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const typeStats = await AdminNotification.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalRecipients = await AdminNotification.aggregate([
      {
        $match: { status: "active" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$recipients" },
        },
      },
    ]);

    const recentNotifications = await AdminNotification.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("createdBy", "fullName email");

    res.status(200).json({
      success: true,
      data: {
        statusStats: stats,
        typeStats: typeStats,
        totalRecipients: totalRecipients[0]?.total || 0,
        recentNotifications,
      },
      message: "Statistics fetched successfully",
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  sendNotification,
  getNotificationStats,
};
