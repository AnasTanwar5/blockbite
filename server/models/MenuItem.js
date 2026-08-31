const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String },
    title: { type: String },
    description: { type: String, required: true },
    price: { type: Number },
    priceETH: { type: Number },
    priceBITE: { type: Number, default: 10 },
    category: { type: String, default: "Main Course" },
    diet: { type: String, enum: ["Veg", "Non-Veg", "Vegan"], default: "Non-Veg" },
    isVeg: { type: Boolean, default: false },
    preparationTime: { type: String, default: "15-20 min" },
    image: { type: String, required: true },
    ipfsHash: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

MenuItemSchema.pre("save", function (next) {
  if (this.name && !this.title) this.title = this.name;
  if (this.title && !this.name) this.name = this.title;
  if (this.isVeg !== undefined && !this.diet) {
    this.diet = this.isVeg ? "Veg" : "Non-Veg";
  }
  if (this.priceETH === undefined && this.price !== undefined) {
    this.priceETH = parseFloat((this.price / 3000).toFixed(4)) || 0.003;
  }
  if (this.price === undefined && this.priceETH !== undefined) {
    this.price = Math.round(this.priceETH * 3000 * 100) / 100;
  }
  next();
});

module.exports = mongoose.model("MenuItem", MenuItemSchema);

