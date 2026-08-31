import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { User, Phone, Bike, Wallet, Coins, TrendingUp, Save, CheckCircle } from "lucide-react";

export const DriverProfile = () => {
  const { user, token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ completed: 0, totalETH: 0, totalBITE: 0 });

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    vehicleType: user?.vehicleType || "bike",
    availability: user?.availability ?? true,
  });

  useEffect(() => {
    fetchStats();
  }, [user?.id]);

  const fetchStats = async () => {
    try {
      const res = await axios.get("/api/delivery/earnings");
      if (res.data.success) {
        setStats({
          completed: res.data.completedCount,
          totalETH: res.data.totalETH,
          totalBITE: res.data.totalBITE,
        });
      }
    } catch (err) {
      console.error("Error fetching driver stats:", err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage("");
      await axios.put("/api/drivers/profile", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <Bike className="w-8 h-8 text-sky-400" /> Driver Profile
          </h1>
          <p className="text-xs text-gray-400 mt-1">Manage your delivery partner profile and preferences.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 glass-card rounded-2xl border-l-4 border-sky-400">
          <span className="text-xs text-gray-400 font-bold block">Completed Deliveries</span>
          <div className="text-2xl font-black text-white font-mono mt-1">{stats.completed}</div>
        </div>
        <div className="p-4 glass-card rounded-2xl border-l-4 border-amber-400">
          <span className="text-xs text-gray-400 font-bold block">Total ETH Earned</span>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">{stats.totalETH.toFixed(4)}</div>
        </div>
        <div className="p-4 glass-card rounded-2xl border-l-4 border-brand-500">
          <span className="text-xs text-gray-400 font-bold block">$BITE Rewards</span>
          <div className="text-2xl font-black text-brand-neon font-mono mt-1">+{stats.totalBITE}</div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="p-6 glass-card rounded-3xl space-y-6 border border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-sky-400" /> Personal Information
        </h2>

        {message && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.includes("success") ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}>
            {message.includes("success") ? <CheckCircle className="w-4 h-4" /> : <User className="w-4 h-4" />}
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Vehicle Type</label>
            <select
              value={form.vehicleType}
              onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500"
            >
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="car">Car</option>
              <option value="bicycle">Bicycle</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Availability Status</label>
            <select
              value={form.availability ? "online" : "offline"}
              onChange={(e) => setForm({ ...form, availability: e.target.value === "online" })}
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-sky-500"
            >
              <option value="online">Online - Accepting Deliveries</option>
              <option value="offline">Offline - Not Available</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>

      {/* Wallet Info */}
      {user?.walletAddress && (
        <div className="p-6 glass-card rounded-3xl border border-gray-800 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-500" /> Payout Wallet
          </h2>
          <div className="p-4 bg-dark-bg border border-gray-800 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Connected Wallet Address</p>
              <p className="text-sm font-mono text-white font-bold">{user.walletAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">ETH Balance</p>
              <p className="text-sm font-mono text-brand-400 font-bold">{ethBalance || 0} ETH</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
