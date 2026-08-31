const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "restaurant", "driver", "admin"],
      default: "customer",
    },
    walletAddress: { type: String, default: "" },
    referralCode: { type: String, unique: true },
    referredBy: { type: String, default: "" },
    rewardTokensEarned: { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    isVerified: { type: Boolean, default: true },
    vehicleType: { type: String, default: "bike", enum: ["bike", "scooter", "car", "bicycle"] },
    availability: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
