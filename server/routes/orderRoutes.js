const express = require("express");
const crypto = require("crypto");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const Review = require("../models/Review");
const { verifyToken } = require("../middleware/auth");
const { uploadJSONToIPFS } = require("../utils/ipfs");
const { emitOrderCreated, emitOrderUpdated, emitOrderDelivered } = require("../socket");
const { verifyTransaction, verifyOrderOnChain } = require("../utils/blockchain");

const router = express.Router();

// Helper to generate 4-digit numeric OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// 1. Create Order
router.post("/", verifyToken, async (req, res) => {
  try {
    const { orderId, restaurantId, items, deliveryAddress, customerWallet, txHash, tipETH, escrowContractAddress, chainId, blockNumber, otp } = req.body;

    if (!orderId || !restaurantId || !items || !items.length || !deliveryAddress || !customerWallet || !txHash) {
      return res.status(400).json({ success: false, message: "Missing required orderId, order details, or transaction hash" });
    }

    const recentOrder = await Order.findOne({
      customer: req.user.id,
      restaurant: restaurantId,
      escrowStatus: { $nin: ["Cancelled", "RejectedByRestaurant", "Delivered"] },
      createdAt: { $gte: new Date(Date.now() - 30000) },
    });

    if (recentOrder) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending order at this restaurant. Please wait for it to be processed or cancel it before placing a new one.",
      });
    }

    const duplicateTx = await Order.findOne({ txHash });
    if (duplicateTx) {
      return res.status(400).json({
        success: false,
        message: "This transaction has already been used to place an order.",
        order: duplicateTx,
      });
    }

    const duplicateOrderId = await Order.findOne({ orderId });
    if (duplicateOrderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID already exists. Please try again.",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // Calculate total amounts
    let foodAmountETH = 0;
    const itemDetails = items.map((i) => {
      foodAmountETH += i.priceETH * i.quantity;
      return {
        menuItem: i.menuItemId,
        title: i.title,
        quantity: i.quantity,
        priceETH: i.priceETH,
      };
    });

    const deliveryFeeETH = restaurant.deliveryFeeETH || 0.002;
    const addedTip = tipETH || 0;
    const totalAmountETH = parseFloat((foodAmountETH + deliveryFeeETH + addedTip).toFixed(6));

    const finalOtp = otp || generateOTP();

    if (!escrowContractAddress) {
      return res.status(400).json({ success: false, message: "Missing escrow contract address for blockchain verification" });
    }

    try {
      await verifyOrderOnChain(txHash, orderId, escrowContractAddress, chainId);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message || "Blockchain transaction verification failed" });
    }

    const newOrder = new Order({
      orderId,
      customer: req.user.id,
      customerWallet: customerWallet.toLowerCase(),
      restaurant: restaurant._id,
      restaurantWallet: restaurant.walletAddress.toLowerCase(),
      items: itemDetails,
      foodAmountETH: parseFloat(foodAmountETH.toFixed(6)),
      deliveryFeeETH,
      tipETH: addedTip,
      totalAmountETH,
      deliveryOtp: finalOtp,
      deliveryAddress,
      txHash,
      escrowContractAddress: escrowContractAddress ? escrowContractAddress.toLowerCase() : "",
      chainId: chainId || 31337,
      blockNumber: blockNumber || 0,
      escrowStatus: "Created",
    });

    await newOrder.save();

    emitOrderCreated(newOrder);

    res.status(201).json({
      success: true,
      order: newOrder,
      message: "Order placed successfully! Locked in escrow.",
      otp, // Provided to customer for delivery verification
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean stale orders (dev helper to remove legacy test orders from previous deployments)
router.delete("/stale", verifyToken, async (req, res) => {
  try {
    const { activeEscrowAddress } = req.query;
    if (!activeEscrowAddress) {
      const result = await Order.deleteMany({});
      return res.json({ success: true, message: `Cleared all ${result.deletedCount} orders from database.` });
    }
    const result = await Order.deleteMany({
      escrowContractAddress: { $ne: activeEscrowAddress.toLowerCase() },
    });
    res.json({ success: true, message: `Cleared ${result.deletedCount} stale orders from previous deployments.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get User Orders (Customer / Restaurant / Driver)
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "customer") {
      query.customer = req.user.id;
    } else if (req.user.role === "restaurant") {
      const rest = await Restaurant.findOne({ owner: req.user.id });
      if (rest) query.restaurant = rest._id;
    } else if (req.user.role === "driver") {
      query.driver = req.user.id;
    }

    const orders = await Order.find(query)
      .populate("restaurant", "name image address phone")
      .populate(req.user.role === "driver" ? "customer" : "customer", req.user.role === "driver" ? "name" : "name email phone walletAddress")
      .populate("driver", "name phone walletAddress")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get Order by Order ID
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("restaurant", "name image address phone walletAddress")
      .populate("customer", req.user.role === "driver" ? "name" : "name email phone walletAddress")
      .populate("driver", "name phone walletAddress");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update Order Status & Sync Blockchain Transaction
router.put("/:orderId/status", verifyToken, async (req, res) => {
  try {
    const { escrowStatus, txHash, driverWallet, gasUsed } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (txHash && order.escrowContractAddress) {
      try {
        await verifyTransaction(txHash, order.escrowContractAddress);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || "Blockchain transaction verification failed" });
      }
    }

    if (escrowStatus) order.escrowStatus = escrowStatus;
    if (txHash) order.txHash = txHash;
    if (gasUsed) order.gasUsed = gasUsed;

    if (driverWallet && !order.driver) {
      const driverUser = await User.findOne({ walletAddress: driverWallet.toLowerCase() });
      if (driverUser) {
        order.driver = driverUser._id;
        order.driverWallet = driverWallet.toLowerCase();
      }
    }

    if (escrowStatus === "Delivered") {
      order.rewardTokensIssued = 10;
      order.deliveredAt = new Date();
      await User.findByIdAndUpdate(order.customer, { $inc: { rewardTokensEarned: 10 } });
      if (order.driver) {
        await User.findByIdAndUpdate(order.driver, { $inc: { rewardTokensEarned: 5 } });
      }
    }

    await order.save();

    if (escrowStatus === "Delivered") {
      emitOrderDelivered(order);
    } else {
      emitOrderUpdated(order);
    }

    res.json({ success: true, order, message: `Order status updated to ${order.escrowStatus}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Submit Order Review (Pushes to IPFS & records reward)
router.post("/:orderId/review", verifyToken, async (req, res) => {
  try {
    const { rating, comment, txHash } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only customer can submit a review" });
    }

    // Upload Review Metadata to IPFS
    const reviewData = {
      orderId: order.orderId,
      customer: order.customerWallet,
      restaurant: order.restaurantWallet,
      rating,
      comment,
      timestamp: new Date().toISOString(),
    };

    const ipfsResult = await uploadJSONToIPFS(reviewData);

    const review = new Review({
      order: order._id,
      customer: req.user.id,
      restaurant: order.restaurant,
      rating,
      comment,
      ipfsHash: ipfsResult.ipfsHash,
      rewardTxHash: txHash || "",
      rewardTokens: 3,
    });

    await review.save();

    order.reviewIpfsHash = ipfsResult.ipfsHash;
    await order.save();

    // Award +3 BITE tokens for verified review
    await User.findByIdAndUpdate(req.user.id, { $inc: { rewardTokensEarned: 3 } });

    res.status(201).json({
      success: true,
      review,
      ipfsHash: ipfsResult.ipfsHash,
      message: "Review submitted & verified on IPFS! 3 BITE Tokens awarded.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Raise Dispute
router.put("/:orderId/dispute", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.escrowStatus === "Delivered" || order.escrowStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Cannot raise dispute for completed/cancelled order" });
    }

    order.escrowStatus = "Disputed";
    order.disputeReason = reason;
    order.disputedBy = req.user.id;
    order.disputedAt = new Date();
    await order.save();

    res.json({ success: true, order, message: "Dispute raised successfully. Admin will review." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
