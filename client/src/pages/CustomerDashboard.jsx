import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useToast } from "../components/Toast";
import { useSocket } from "../hooks/useSocket";
import { Wallet, Coins, Share2, Copy, Check, ExternalLink, Clock, Package, DollarSign, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

export const CustomerDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { account, ethBalance, biteBalance, executeCancelOrderContract } = useWeb3();
  const { socket, connected, registerListener, unregisterListener } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [totalSpent, setTotalSpent] = useState({ eth: 0, orders: 0 });
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    if (!socket || !connected) return;

    const handleOrderUpdate = () => fetchUserOrders();
    const handleOrderCreated = () => fetchUserOrders();
    const handleOrderDelivered = () => fetchUserOrders();

    registerListener("order:updated", handleOrderUpdate);
    registerListener("order:created", handleOrderCreated);
    registerListener("order:delivered", handleOrderDelivered);

    return () => {
      unregisterListener("order:updated");
      unregisterListener("order:created");
      unregisterListener("order:delivered");
    };
  }, [socket, connected]);

  useEffect(() => {
    fetchUserOrders();
  }, []);

  const fetchUserOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/orders/my-orders");
      if (res.data.success) {
        const ordersData = res.data.orders;
        setOrders(ordersData);

        const total = ordersData.reduce((acc, ord) => {
          if (ord.escrowStatus !== "Cancelled" && ord.escrowStatus !== "RejectedByRestaurant") {
            acc.eth += ord.totalAmountETH || 0;
            acc.orders += 1;
          }
          return acc;
        }, { eth: 0, orders: 0 });

        setTotalSpent({
          eth: parseFloat(total.eth.toFixed(6)),
          orders: total.orders,
        });
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      setCancelError("");
      setCancellingOrderId(orderId);

      const txResult = await executeCancelOrderContract(orderId);

      await axios.put(`/api/orders/${orderId}/status`, {
        escrowStatus: "Cancelled",
        txHash: txResult.txHash,
      });

      addToast("Order cancelled successfully. ETH refunded to your wallet.", "success");
      fetchUserOrders();
    } catch (err) {
      console.error("Cancel order error:", err);
      setCancelError(err.message || "Failed to cancel order");
      addToast(err.message || "Failed to cancel order", "error");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const referralLink = `${window.location.origin}/register?ref=${user?.referralCode || ""}`;

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Customer Rewards & Orders</h1>
          <p className="text-xs text-gray-400 mt-1">Manage your Web3 balance, token cashbacks, and order history.</p>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 glass-card rounded-3xl space-y-2 border-l-4 border-brand-500">
          <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-brand-gold" /> $BITE Reward Token Balance
          </span>
          <div className="text-3xl font-black text-brand-neon font-mono">
            {user?.rewardTokensEarned || biteBalance || 0} BITE
          </div>
          <span className="text-[10px] text-gray-400 block">Earned via food orders, reviews & referrals</span>
        </div>

        <div className="p-6 glass-card rounded-3xl space-y-2 border-l-4 border-amber-500">
          <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-amber-400" /> ETH Wallet Balance
          </span>
          <div className="text-3xl font-black text-white font-mono">{ethBalance} ETH</div>
          <span className="text-[10px] text-gray-400 block">Connected Address: {account ? `${account.substring(0, 8)}...` : "MetaMask"}</span>
        </div>

        <div className="p-6 glass-card rounded-3xl space-y-2 border-l-4 border-red-500">
          <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-red-400" /> Total Spent on Orders
          </span>
          <div className="text-3xl font-black text-white font-mono">{totalSpent.eth} ETH</div>
          <span className="text-[10px] text-gray-400 block">{totalSpent.orders} orders placed (excluding cancelled)</span>
        </div>
      </div>

      {/* Referral Code */}
      <div className="p-4 glass-card rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Your Referral Code</p>
            <p className="text-sm font-bold text-white font-mono">{user?.referralCode || "BLOCKBITE"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-neon font-bold">Earn 15 BITE per referral</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(referralLink);
              setCopiedReferral(true);
              setTimeout(() => setCopiedReferral(false), 1500);
            }}
            className="px-3 py-1.5 bg-brand-500 text-dark-bg text-xs font-extrabold rounded-xl shadow-glow"
          >
            {copiedReferral ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-500" /> Order History & Escrow Status
        </h2>

        {cancelError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
            <span className="text-red-400 text-xs font-bold">⚠️ {cancelError}</span>
            <button
              onClick={() => setCancelError("")}
              className="px-3 py-1.5 bg-dark-card border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 font-semibold text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center text-gray-400">No orders placed yet. Browse restaurants and place your first order!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-dark-bg/60 text-gray-400 uppercase text-[10px] border-b border-gray-800">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Restaurant</th>
                  <th className="p-3">Total ETH</th>
                  <th className="p-3">Escrow Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-dark-card/50">
                    <td className="p-3 font-mono font-bold text-white">{ord.orderId}</td>
                    <td className="p-3">{ord.restaurant?.name || "Kitchen"}</td>
                    <td className="p-3 font-mono text-brand-400 font-bold">{ord.totalAmountETH} ETH</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ord.escrowStatus === "Delivered"
                          ? "bg-brand-500/20 text-brand-neon border border-brand-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {ord.escrowStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/customer/orders/${ord.orderId}`}
                          className="px-3 py-1 bg-dark-card border border-gray-700 hover:border-brand-500 rounded-lg text-white font-semibold inline-flex items-center gap-1"
                        >
                          Track <ExternalLink className="w-3 h-3" />
                        </Link>
                        {ord.escrowStatus === "Created" && (
                          <button
                            onClick={() => handleCancelOrder(ord.orderId)}
                            disabled={cancellingOrderId === ord.orderId}
                            className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            {cancellingOrderId === ord.orderId ? "Cancelling..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
