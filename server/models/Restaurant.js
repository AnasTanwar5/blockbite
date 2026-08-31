const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    walletAddress: { type: String, default: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
    name: { type: String, required: true },
    description: { type: String, required: true },
    cuisine: [{ type: String }],
    image: { type: String, required: true },
    address: { type: String, required: true },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 2.99 },
    deliveryFeeETH: { type: Number, default: 0.0015 },
    deliveryTime: { type: String, default: "25-35 min" },
    estimatedDeliveryTime: { type: String, default: "25-35 min" },
    coordinates: {
      lat: { type: Number, default: 28.6139 },
      lng: { type: Number, default: 77.2090 },
    },
    isOpen: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    ownerName: { type: String, default: "Store Manager" },
    phone: { type: String, default: "+1 800-555-0199" },
    ipfsHash: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Restaurant", RestaurantSchema);

