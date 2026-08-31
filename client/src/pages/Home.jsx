import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Search, Star, Clock, ShieldCheck, Sparkles, Flame, Filter, ChevronRight, Leaf, X } from "lucide-react";

export const Home = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [dietFilter, setDietFilter] = useState("All");
  const [sortBy, setSortBy] = useState("rating");
  const [showFilters, setShowFilters] = useState(false);

  const cuisines = ["All", "Italian", "Japanese", "Pizza", "Sushi", "Ramen", "Fast Food", "Indian", "Chinese", "Mexican"];
  const dietOptions = ["All", "Veg", "Non-Veg", "Vegan"];

  useEffect(() => {
    fetchRestaurants();
  }, [selectedCuisine, dietFilter, sortBy]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCuisine !== "All") params.cuisine = selectedCuisine;
      if (dietFilter !== "All") params.diet = dietFilter;
      if (sortBy === "rating") params.sort = "-rating";
      else if (sortBy === "deliveryFee") params.sort = "deliveryFeeETH";
      else if (sortBy === "time") params.sort = "estimatedDeliveryTime";

      const res = await axios.get("/api/restaurants", { params });
      if (res.data.success) {
        let data = res.data.restaurants;
        if (searchQuery) {
          data = data.filter(
            (r) =>
              r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.description.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        setRestaurants(data);
      }
    } catch (err) {
      console.error("Error fetching restaurants:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-dark-card via-[#0c1322] to-dark-bg border border-gray-800 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-neon text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" /> Decentralized Food Protocol
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Craving Food? Pay with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-neon to-brand-500">ETH Escrow</span> & Earn <span className="text-brand-gold">$BITE Tokens</span>.
          </h1>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
            Zero centralized middleman fees. Funds remain securely locked in Smart Contract Escrow until your food is verified at your door.
          </p>

          {/* Search Box */}
          <div className="relative max-w-lg">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurants, sushi, pizza, ramen..."
              className="w-full bg-dark-bg border border-gray-700/80 focus:border-brand-500 text-white rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none shadow-glow transition-all"
            />
          </div>
        </div>
      </section>

      {/* Feature Badges */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 glass-card rounded-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 text-xl font-bold">
            🔒
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Smart Contract Escrow</h3>
            <p className="text-xs text-gray-400 mt-1">Payment stays locked in the Solidity Escrow until you provide the delivery OTP.</p>
          </div>
        </div>

        <div className="p-6 glass-card rounded-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-xl font-bold">
            🪙
          </div>
          <div>
            <h3 className="font-bold text-white text-base">ERC-20 Token Rewards</h3>
            <p className="text-xs text-gray-400 mt-1">Earn 10 $BITE cashback on orders, +3 for verified IPFS reviews & referral bonuses.</p>
          </div>
        </div>

        <div className="p-6 glass-card rounded-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 text-xl font-bold">
            🌐
          </div>
          <div>
            <h3 className="font-bold text-white text-base">IPFS Review Engine</h3>
            <p className="text-xs text-gray-400 mt-1">Immutable food ratings stored permanently on Pinata IPFS to guarantee authenticity.</p>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-brand-500" /> Featured Web3 Restaurants
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showFilters ? "bg-brand-500 text-dark-bg shadow-glow" : "bg-dark-card border border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
            <span className="text-xs text-gray-400">{restaurants.length} kitchens</span>
          </div>
        </div>

        {/* Cuisine Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCuisine(c)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCuisine === c
                  ? "bg-brand-500 text-dark-bg shadow-glow font-extrabold"
                  : "bg-dark-card border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="p-4 glass-card rounded-2xl border border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Diet Filter */}
              <div className="flex-1">
                <label className="text-xs text-gray-400 block mb-2">Diet Preference</label>
                <div className="flex gap-2">
                  {dietOptions.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDietFilter(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                        dietFilter === d
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

              {/* Sort By */}
              <div>
                <label className="text-xs text-gray-400 block mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-dark-bg border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500"
                >
                  <option value="rating">Highest Rated</option>
                  <option value="deliveryFee">Lowest Delivery Fee</option>
                  <option value="time">Fastest Delivery</option>
                </select>
              </div>
            </div>

            {(dietFilter !== "All" || sortBy !== "rating") && (
              <button
                onClick={() => { setDietFilter("All"); setSortBy("rating"); }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      {/* Restaurant Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 glass-card rounded-2xl animate-pulse bg-dark-card/50"></div>
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-2xl text-gray-400">
          No restaurants match your search or filter. Try clearing filters!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant._id}
              to={`/restaurants/${restaurant._id}`}
              className="group glass-card rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-dark-bg/80 backdrop-blur-md text-brand-neon font-mono font-bold text-xs border border-brand-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Smart Escrow
                </div>
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-dark-bg/80 backdrop-blur-md text-amber-400 font-bold text-xs flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {restaurant.rating}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">
                    {restaurant.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{restaurant.description}</p>
                </div>

                <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-500" /> {restaurant.estimatedDeliveryTime}
                  </span>
                  <span className="font-mono text-brand-400 font-bold">
                    Fee: {restaurant.deliveryFeeETH} ETH
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
