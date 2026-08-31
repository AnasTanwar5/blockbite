const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const Order = require("./models/Order");
const Review = require("./models/Review");
const Restaurant = require("./models/Restaurant");
const MenuItem = require("./models/MenuItem");

async function clearTestData() {
  try {
    const connStr = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/blockbite";
    await mongoose.connect(connStr, { serverSelectionTimeoutMS: 5000 });
    console.log("✓ Connected to MongoDB");

    const orderResult = await Order.deleteMany({});
    console.log(`✓ Cleared ${orderResult.deletedCount} orders`);

    const reviewResult = await Review.deleteMany({});
    console.log(`✓ Cleared ${reviewResult.deletedCount} reviews`);

    const restResult = await Restaurant.deleteMany({});
    console.log(`✓ Cleared ${restResult.deletedCount} restaurants`);

    const menuResult = await MenuItem.deleteMany({});
    console.log(`✓ Cleared ${menuResult.deletedCount} menu items`);

    console.log("✓ All test data cleared. Run 'npm run seed' to restore demo data.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing test data:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

clearTestData();
