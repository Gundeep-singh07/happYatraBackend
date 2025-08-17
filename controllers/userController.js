const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

// Get User Profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Upload Profile Picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image provided",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old image if exists
    if (user.profilePicture && user.profilePicture.publicId) {
      await cloudinary.uploader.destroy(user.profilePicture.publicId);
    }

    // Upload new image
    const result = await cloudinary.uploader
      .upload_stream(
        {
          folder: "happyatra/profiles",
          transformation: [{ width: 300, height: 300, crop: "fill" }],
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({
              success: false,
              message: "Image upload failed",
            });
          }

          // Update user profile picture
          user.profilePicture = {
            url: result.secure_url,
            publicId: result.public_id,
          };

          await user.save();

          res.json({
            success: true,
            message: "Profile picture updated successfully",
            profilePicture: user.profilePicture,
          });
        }
      )
      .end(req.file.buffer);
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
};
