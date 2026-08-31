const express = require("express");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Order = require("../models/Order");
const Review = require("../models/Review");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// 1. Get Platform Analytics
router.get("/analytics", verifyToken, requireRole(["admin"]), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const customerCount = await User.countDocuments({ role: "customer" });
    const restaurantCount = await User.countDocuments({ role: "restaurant" });
    const driverCount = await User.countDocuments({ role: "driver" });

    const totalRestaurants = await Restaurant.countDocuments();
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ escrowStatus: "Delivered" });
    const disputedOrders = await Order.countDocuments({ escrowStatus: "Disputed" });

    const allOrders = await Order.find({ escrowStatus: "Delivered" });
    let totalVolumeETH = 0;
    allOrders.forEach((o) => {
      totalVolumeETH += o.totalAmountETH || 0;
    });

    const reviews = await Review.countDocuments();

    // Est total BITE Tokens distributed
    const totalBiteTokensDistributed = completedOrders * 20 + reviews * 3;

    res.json({
      success: true,
      analytics: {
        totalUsers,
        userRoles: { customer: customerCount, restaurant: restaurantCount, driver: driverCount },
        totalRestaurants,
        totalOrders,
        completedOrders,
        disputedOrders,
        totalVolumeETH: parseFloat(totalVolumeETH.toFixed(4)),
        totalBiteTokensDistributed,
        totalReviews: reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Manage Users
router.get("/users", verifyToken, requireRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Approve / Verify Restaurant
router.put("/restaurants/:id/verify", verifyToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { isVerified } = req.body;
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { isVerified },
      { new: true }
    );
    res.json({ success: true, restaurant, message: "Restaurant verification status updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get all orders for Admin Audit / Escrow Management
router.get("/orders", verifyToken, requireRole(["admin"]), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("restaurant", "name walletAddress")
      .populate("customer", "name email walletAddress")
      .populate("driver", "name walletAddress")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
