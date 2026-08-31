const express = require("express");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
const { emitToRole } = require("../socket");

// 1. Get all restaurants with search & filters
router.get("/", async (req, res) => {
  try {
    const { search, cuisine, isOpen, diet, sort } = req.query;
    let query = { isVerified: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { cuisine: { $regex: search, $options: "i" } },
      ];
    }

    if (cuisine) {
      query.cuisine = { $in: [cuisine] };
    }

    if (isOpen !== undefined) {
      query.isOpen = isOpen === "true";
    }

    let restaurants = await Restaurant.find(query).populate("owner", "name email walletAddress");

    if (diet) {
      const matchedRestaurantIds = await MenuItem.find({ diet: diet, isAvailable: true })
        .distinct("restaurant");
      restaurants = restaurants.filter((r) => matchedRestaurantIds.includes(r._id.toString()));
    }

    if (sort === "deliveryFeeETH") {
      restaurants.sort((a, b) => a.deliveryFeeETH - b.deliveryFeeETH);
    } else if (sort === "-rating") {
      restaurants.sort((a, b) => b.rating - a.rating);
    } else if (sort === "estimatedDeliveryTime") {
      restaurants.sort((a, b) => {
        const getTime = (t) => parseInt(t.split("-")[0]) || 999;
        return getTime(a.estimatedDeliveryTime) - getTime(b.estimatedDeliveryTime);
      });
    }

    res.json({ success: true, count: restaurants.length, restaurants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get single restaurant details + menu items
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate("owner", "name email walletAddress");
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const menuItems = await MenuItem.find({ restaurant: restaurant._id, isAvailable: true });
    res.json({ success: true, restaurant, menuItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Create Restaurant (Restaurant owner only)
router.post("/", verifyToken, requireRole(["restaurant", "admin"]), async (req, res) => {
  try {
    const { name, description, cuisine, image, address, walletAddress, deliveryFeeETH, ipfsHash } = req.body;

    if (!name || !description || !image || !address || !walletAddress) {
      return res.status(400).json({ success: false, message: "Missing required restaurant information" });
    }

    const existing = await Restaurant.findOne({ owner: req.user.id });
    if (existing && req.user.role !== "admin") {
      return res.status(400).json({ success: false, message: "You already own a registered restaurant" });
    }

    const restaurant = new Restaurant({
      owner: req.user.id,
      name,
      description,
      cuisine: Array.isArray(cuisine) ? cuisine : [cuisine || "General"],
      image,
      address,
      walletAddress: walletAddress.toLowerCase(),
      deliveryFeeETH: deliveryFeeETH || 0.002,
      ipfsHash: ipfsHash || "",
    });

    await restaurant.save();
    res.status(201).json({ success: true, restaurant, message: "Restaurant created successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Add Menu Item to Restaurant
router.post("/:id/menu", verifyToken, requireRole(["restaurant", "admin"]), async (req, res) => {
  try {
    const { title, description, priceETH, priceBITE, category, diet, image, ipfsHash } = req.body;

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized to modify this restaurant" });
    }

    const newItem = new MenuItem({
      restaurant: restaurant._id,
      title,
      description,
      priceETH,
      priceBITE: priceBITE || priceETH * 1000,
      category: category || "Main Course",
      diet: diet || "Non-Veg",
      image,
      ipfsHash: ipfsHash || "",
    });

    await newItem.save();
    res.status(201).json({ success: true, menuItem: newItem, message: "Menu item added successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Update Menu Item
router.put("/menu/:itemId", verifyToken, requireRole(["restaurant", "admin"]), async (req, res) => {
  try {
    const updated = await MenuItem.findByIdAndUpdate(req.params.itemId, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Menu item not found" });

    res.json({ success: true, menuItem: updated, message: "Menu item updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Delete Menu Item
router.delete("/menu/:itemId", verifyToken, requireRole(["restaurant", "admin"]), async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.itemId);
    res.json({ success: true, message: "Menu item deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Update restaurant status (open/closed)
router.put("/:id/status", verifyToken, requireRole(["restaurant", "admin"]), async (req, res) => {
  try {
    const { isOpen } = req.body;
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    if (restaurant.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    restaurant.isOpen = isOpen;
    await restaurant.save();

    emitToRole("customer", "restaurant:statusUpdated", { restaurantId: restaurant._id, isOpen });

    res.json({ success: true, restaurant, message: `Restaurant is now ${isOpen ? "open" : "closed"}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
