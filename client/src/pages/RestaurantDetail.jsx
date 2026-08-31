import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Star, Clock, MapPin, Plus, Check, Leaf, ShieldCheck, Flame } from "lucide-react";

export const RestaurantDetail = () => {
  const { id } = useParams();
  const { addToCart } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDiet, setSelectedDiet] = useState("All");
  const [addedItemMap, setAddedItemMap] = useState({});

  useEffect(() => {
    fetchRestaurantDetail();
  }, [id]);

  const fetchRestaurantDetail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/restaurants/${id}`);
      if (res.data.success) {
        setRestaurant(res.data.restaurant);
        setMenuItems(res.data.menuItems);
      }
    } catch (err) {
      console.error("Error fetching restaurant detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        Loading Web3 Kitchen...
      </div>
    );
  }

  if (!restaurant) {
    return <div className="py-20 text-center text-red-400">Restaurant not found.</div>;
  }

  const categories = ["All", ...new Set(menuItems.map((item) => item.category))];
  const diets = ["All", "Veg", "Non-Veg", "Vegan"];

  const filteredItems = menuItems.filter((item) => {
    const categoryMatch = selectedCategory === "All" || item.category === selectedCategory;
    const dietMatch = selectedDiet === "All" || item.diet === selectedDiet;
    return categoryMatch && dietMatch;
  });

  const handleAdd = (item) => {
    const success = addToCart(item, restaurant);
    if (success) {
      setAddedItemMap((prev) => ({ ...prev, [item._id]: true }));
      setTimeout(() => {
        setAddedItemMap((prev) => ({ ...prev, [item._id]: false }));
      }, 1500);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Restaurant Header Card */}
      <div className="relative glass-panel rounded-3xl overflow-hidden border border-gray-800">
        <div className="h-64 sm:h-80 w-full relative">
          <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent"></div>
        </div>

        <div className="p-6 sm:p-8 -mt-24 relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-neon text-xs font-bold border border-brand-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Escrow Verified Kitchen
                </span>
                {restaurant.cuisine.map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded-md bg-dark-card text-gray-300 text-xs font-semibold">
                    {c}
                  </span>
                ))}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white">{restaurant.name}</h1>
              <p className="text-gray-300 text-sm mt-1 max-w-2xl">{restaurant.description}</p>
            </div>

            <div className="glass-card p-4 rounded-2xl flex items-center gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-amber-400 font-bold text-lg">
                  <Star className="w-5 h-5 fill-amber-400" /> {restaurant.rating}
                </div>
                <span className="text-[10px] text-gray-400">({restaurant.reviewCount} Reviews)</span>
              </div>
              <div className="h-8 w-px bg-gray-800"></div>
              <div>
                <div className="text-white font-mono font-bold text-sm">{restaurant.deliveryFeeETH} ETH</div>
                <span className="text-[10px] text-gray-400">Escrow Delivery Fee</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-800">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-brand-500" /> {restaurant.address}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-brand-gold" /> {restaurant.estimatedDeliveryTime}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Categories & Diet Filters */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-brand-500" /> Digital Menu
        </h2>

        <div className="space-y-3">
          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-brand-500 text-dark-bg font-extrabold shadow-glow"
                    : "bg-dark-card border border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Diet Filters */}
          <div className="flex items-center gap-2">
            {diets.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDiet(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  selectedDiet === d
                    ? "bg-brand-500 text-dark-bg shadow-glow"
                    : "bg-dark-bg border border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {d === "Veg" && <Leaf className="w-3 h-3" />}
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-8 text-center text-gray-400 text-sm">
            No items match your filters. Try selecting a different category or diet.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item._id} className="p-5 glass-card rounded-2xl flex items-center gap-4">
              <img src={item.image} alt={item.title} className="w-24 h-24 rounded-xl object-cover shrink-0" />

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">{item.title}</h3>
                  {item.diet === "Veg" || item.diet === "Vegan" ? (
                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold flex items-center gap-1 border border-green-500/20">
                      <Leaf className="w-3 h-3" /> {item.diet}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                      Non-Veg
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>

                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-brand-400 font-mono block">
                      {item.priceETH} ETH
                    </span>
                    <span className="text-[10px] text-brand-gold block font-mono">
                      or {item.priceBITE} BITE Tokens
                    </span>
                  </div>

                  <button
                    onClick={() => handleAdd(item)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                      addedItemMap[item._id]
                        ? "bg-brand-neon text-dark-bg"
                        : "bg-brand-500/20 hover:bg-brand-500 text-brand-400 hover:text-dark-bg border border-brand-500/30"
                    }`}
                  >
                    {addedItemMap[item._id] ? (
                      <>
                        <Check className="w-4 h-4" /> Added!
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Add to Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
