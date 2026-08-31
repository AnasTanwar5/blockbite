const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const User = require("../models/User");
const { verifyToken, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Helper to generate referral code
const generateReferralCode = (name) => {
  const prefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${rand}`;
};

// 1. Register User
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, walletAddress, referralCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userReferralCode = generateReferralCode(name);

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "customer",
      walletAddress: walletAddress || "",
      referralCode: userReferralCode,
      referredBy: referralCode || "",
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role, walletAddress: newUser.walletAddress },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        walletAddress: newUser.walletAddress,
        referralCode: newUser.referralCode,
        rewardTokensEarned: newUser.rewardTokensEarned,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        referralCode: user.referralCode,
        rewardTokensEarned: user.rewardTokensEarned,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Load central roles configuration
let rolesConfig = { devMappings: {} };
try {
  rolesConfig = require("../config/roles.json");
} catch (e) {
  console.warn("Could not load server/config/roles.json in authRoutes");
}

// 3. Wallet Session Sync (issues JWT token for active connected wallet)
router.post("/wallet-session", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: "Wallet address is required" });
    }

    const normAddress = walletAddress.toLowerCase();
    let user = await User.findOne({ walletAddress: normAddress });

    // Sync role from central dev role registry if registered
    if (rolesConfig.devMappings && rolesConfig.devMappings[normAddress]) {
      const reg = rolesConfig.devMappings[normAddress];
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(normAddress, salt);

        user = new User({
          name: reg.name,
          email: reg.email,
          password: hashedPassword,
          role: reg.role,
          walletAddress: normAddress,
          referralCode: generateReferralCode(reg.name),
        });
      } else if (user.role !== reg.role) {
        user.role = reg.role;
        user.name = reg.name;
      }
      await user.save();
    } else if (!user) {
      // Unregistered wallet
      return res.status(404).json({
        success: false,
        message: "Wallet is not registered in central role registry or database.",
        role: "unauthorized",
      });
    }

    // Issue JWT token with authentic role
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        referralCode: user.referralCode,
        rewardTokensEarned: user.rewardTokensEarned,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. MetaMask Signature Authentication / Login
router.post("/metamask-login", async (req, res) => {
  try {
    const { walletAddress, signature, message, role } = req.body;
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ success: false, message: "Missing wallet verification details" });
    }

    // Verify EVM Signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ success: false, message: "Invalid cryptographic signature" });
    }

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      // Auto-register wallet user
      const userReferralCode = generateReferralCode(`WEB3-${walletAddress.substring(2, 6)}`);
      user = new User({
        name: `Wallet User (${walletAddress.substring(0, 6)}...)`,
        email: `${walletAddress.toLowerCase()}@blockbite.eth`,
        password: await bcrypt.hash(walletAddress, 10),
        role: role || "customer",
        walletAddress: walletAddress.toLowerCase(),
        referralCode: userReferralCode,
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        referralCode: user.referralCode,
        rewardTokensEarned: user.rewardTokensEarned,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Get Current User Profile
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Link / Update Wallet Address
router.put("/update-wallet", verifyToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: "Wallet address is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true }
    ).select("-password");

    res.json({ success: true, user, message: "Wallet address linked successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
