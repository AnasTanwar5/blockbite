const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerWallet: { type: String, required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    restaurantWallet: { type: String, required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    driverWallet: { type: String, default: "" },
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
        title: String,
        quantity: Number,
        priceETH: Number,
      },
    ],
    foodAmountETH: { type: Number, required: true },
    deliveryFeeETH: { type: Number, required: true },
    tipETH: { type: Number, default: 0 },
    totalAmountETH: { type: Number, required: true },
    escrowStatus: {
      type: String,
      enum: [
        "Created",
        "AcceptedByRestaurant",
        "RejectedByRestaurant",
        "DriverAssigned",
        "PickedUp",
        "Delivered",
        "Cancelled",
        "Disputed",
      ],
      default: "Created",
    },
    txHash: { type: String, default: "" },
    escrowContractAddress: { type: String, default: "" },
    chainId: { type: Number, default: 31337 },
    blockNumber: { type: Number, default: 0 },
    deliveryOtp: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    reviewIpfsHash: { type: String, default: "" },
    rewardTokensIssued: { type: Number, default: 0 },
    gasUsed: { type: String, default: "21000" },
    disputeReason: { type: String, default: "" },
    disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    disputedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ orderId: 1 });
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ driver: 1, escrowStatus: 1 });
OrderSchema.index({ escrowStatus: 1, createdAt: -1 });
OrderSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model("Order", OrderSchema);
