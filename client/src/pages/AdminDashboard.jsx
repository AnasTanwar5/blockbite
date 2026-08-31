import React, { useState, useEffect } from "react";
import axios from "axios";
import { ShieldAlert, Users, Store, Activity, Coins, CheckCircle, XCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, usersRes, ordersRes, restRes] = await Promise.all([
        axios.get("/api/admin/analytics"),
        axios.get("/api/admin/users"),
        axios.get("/api/admin/orders"),
        axios.get("/api/restaurants"),
      ]);

      if (analyticsRes.data.success) setAnalytics(analyticsRes.data.analytics);
      if (usersRes.data.success) setUsers(usersRes.data.users);
      if (ordersRes.data.success) setOrders(ordersRes.data.orders);
      if (restRes.data.success) setRestaurants(restRes.data.restaurants);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerification = async (restaurantId, currentStatus) => {
    try {
      await axios.put(`/api/admin/restaurants/${restaurantId}/verify`, {
        isVerified: !currentStatus,
      });
      fetchAdminData();
    } catch (err) {
      console.error("Error toggling verification:", err);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading Admin Control Center...</div>;
  }

  const chartData = [
    { day: "Mon", volume: 0.12, orders: 4 },
    { day: "Tue", volume: 0.28, orders: 9 },
    { day: "Wed", volume: 0.45, orders: 14 },
    { day: "Thu", volume: 0.62, orders: 18 },
    { day: "Fri", volume: 0.89, orders: 25 },
    { day: "Sat", volume: 1.25, orders: 34 },
    { day: "Sun", volume: 1.68, orders: 42 },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-purple-400" /> Admin Control & Protocol Analytics
        </h1>
        <p className="text-xs text-gray-400 mt-1">Platform overview, user management, and smart contract escrow audit.</p>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 glass-card rounded-3xl space-y-1 border-l-4 border-brand-500">
          <span className="text-xs text-gray-400 font-bold">Total Protocol GMV</span>
          <div className="text-3xl font-black text-brand-neon font-mono">
            {analytics?.totalVolumeETH || 0} ETH
          </div>
          <span className="text-[10px] text-gray-400">Total volume locked in escrow</span>
        </div>

        <div className="p-6 glass-card rounded-3xl space-y-1 border-l-4 border-amber-400">
          <span className="text-xs text-gray-400 font-bold">Issued $BITE Tokens</span>
          <div className="text-3xl font-black text-amber-400 font-mono">
            {analytics?.totalBiteTokensDistributed || 0} BITE
          </div>
          <span className="text-[10px] text-gray-400">Distributed via cashbacks & reviews</span>
        </div>

        <div className="p-6 glass-card rounded-3xl space-y-1 border-l-4 border-purple-500">
          <span className="text-xs text-gray-400 font-bold">Total Network Users</span>
          <div className="text-3xl font-black text-white font-mono">{analytics?.totalUsers || 0}</div>
          <span className="text-[10px] text-gray-400">
            {analytics?.userRoles?.customer} Buyers • {analytics?.userRoles?.driver} Drivers
          </span>
        </div>

        <div className="p-6 glass-card rounded-3xl space-y-1 border-l-4 border-blue-500">
          <span className="text-xs text-gray-400 font-bold">Total Orders Processed</span>
          <div className="text-3xl font-black text-white font-mono">{analytics?.totalOrders || 0}</div>
          <span className="text-[10px] text-gray-400">{analytics?.completedOrders} Completed</span>
        </div>
      </div>

      {/* Protocol Growth Recharts Graph */}
      <div className="p-6 glass-panel rounded-3xl border border-gray-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-500" /> Weekly Protocol Volume Growth (ETH)
        </h2>
        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", borderColor: "#1f293d", color: "#fff" }} />
              <Area type="monotone" dataKey="volume" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Restaurant Approvals & Verification Table */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Store className="w-5 h-5 text-brand-gold" /> Restaurant Verifications
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-dark-bg/60 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Restaurant Name</th>
                <th className="p-3">Owner Wallet</th>
                <th className="p-3">Escrow Fee</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {restaurants.map((r) => (
                <tr key={r._id}>
                  <td className="p-3 font-bold text-white">{r.name}</td>
                  <td className="p-3 font-mono text-gray-400">{r.walletAddress?.substring(0, 10)}...</td>
                  <td className="p-3 font-mono text-brand-400">{r.deliveryFeeETH} ETH</td>
                  <td className="p-3">
                    {r.isVerified ? (
                      <span className="text-brand-neon font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleVerification(r._id, r.isVerified)}
                      className="px-3 py-1 bg-dark-card border border-gray-700 hover:border-brand-500 rounded-lg text-white font-semibold text-[11px]"
                    >
                      Toggle Verification
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
