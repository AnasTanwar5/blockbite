const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    ipfsHash: { type: String, required: true },
    rewardTxHash: { type: String, default: "" },
    rewardTokens: { type: Number, default: 3 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", ReviewSchema);
