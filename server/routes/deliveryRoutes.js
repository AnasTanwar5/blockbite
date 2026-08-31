const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User");
const { verifyToken, requireRole } = require("../middleware/auth");
const { emitOrderUpdated, emitOrderDelivered } = require("../socket");
const { verifyTransaction } = require("../utils/blockchain");

const router = express.Router();

// 1. Get available orders ready for delivery pickup
router.get("/available", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const availableOrders = await Order.find({
      escrowStatus: "AcceptedByRestaurant",
      driver: null,
    })
      .populate("restaurant", "name image address phone walletAddress")
      .populate("customer", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: availableOrders.length, orders: availableOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Accept Delivery Job
router.put("/:orderId/accept", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const { driverWallet, txHash } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.driver) {
      return res.status(400).json({ success: false, message: "Delivery already claimed by another partner" });
    }

    if (txHash && order.escrowContractAddress) {
      try {
        await verifyTransaction(txHash, order.escrowContractAddress);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || "Blockchain transaction verification failed" });
      }
    }

    order.driver = req.user.id;
    order.driverWallet = (driverWallet || req.user.walletAddress || "").toLowerCase();
    order.escrowStatus = "DriverAssigned";
    if (txHash) order.txHash = txHash;

    await order.save();

    emitOrderUpdated(order);

    res.json({ success: true, order, message: "Delivery job accepted! Navigate to restaurant for pickup." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get Driver Completed Deliveries with optional period filter
router.get("/completed", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const { period } = req.query;
    const driverId = req.user.id;

    let dateFilter = {};
    const now = new Date();

    if (period === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === "week") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === "month") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: start } };
    }

    const completedDeliveries = await Order.find({
      driver: driverId,
      escrowStatus: "Delivered",
      ...dateFilter,
    })
      .populate("restaurant", "name image address walletAddress")
      .sort({ createdAt: -1 });

    const earnings = completedDeliveries.reduce(
      (acc, ord) => {
        acc.totalETH += (ord.deliveryFeeETH || 0) + (ord.tipETH || 0);
        acc.totalBITE += 5;
        return acc;
      },
      { totalETH: 0, totalBITE: 0 }
    );

    res.json({
      success: true,
      count: completedDeliveries.length,
      earnings: {
        totalETH: parseFloat(earnings.totalETH.toFixed(6)),
        totalBITE: earnings.totalBITE,
      },
      deliveries: completedDeliveries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get Driver Earnings & Lifetime Analytics
router.get("/earnings", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const completedDeliveries = await Order.find({
      driver: req.user.id,
      escrowStatus: "Delivered",
    });

    let totalETH = 0;
    let totalBITE = completedDeliveries.length * 5;

    completedDeliveries.forEach((ord) => {
      totalETH += (ord.deliveryFeeETH || 0) + (ord.tipETH || 0);
    });

    res.json({
      success: true,
      completedCount: completedDeliveries.length,
      totalETH: parseFloat(totalETH.toFixed(6)),
      totalBITE,
      deliveries: completedDeliveries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Get / Update Driver Profile
router.get("/profile", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "Driver profile not found" });
    }
    res.json({ success: true, profile: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/profile", verifyToken, requireRole(["driver", "admin"]), async (req, res) => {
  try {
    const { name, phone, vehicleType, availability } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, vehicleType, availability },
      { new: true }
    ).select("-password");

    res.json({ success: true, profile: updated, message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
