import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useToast } from "../components/Toast";
import { useSocket } from "../hooks/useSocket";
import {
  Bike,
  ShieldCheck,
  MapPin,
  Key,
  DollarSign,
  Coins,
  CheckCircle,
  Package,
  Clock,
  TrendingUp,
  History,
} from "lucide-react";

export const DeliveryDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket, connected, registerListener, unregisterListener } = useSocket();
  const {
    account,
    connectWallet,
    verifyOrderOnChain,
    executeAcceptDeliveryContract,
    executeUpdatePickedUpContract,
    executeConfirmDeliveryContract,
    contractAddresses,
  } = useWeb3();

  const [availableOrders, setAvailableOrders] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [completedHistory, setCompletedHistory] = useState([]);
  const [earnings, setEarnings] = useState({ totalETH: 0, totalBITE: 0, completedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [otpMap, setOtpMap] = useState({});
  const [verifyingOrder, setVerifyingOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [claimingOrderId, setClaimingOrderId] = useState(null);
  const [historyPeriod, setHistoryPeriod] = useState("all");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    fetchDeliveryHubData();
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleOrderUpdate = () => fetchDeliveryHubData();
    const handleOrderDelivered = () => fetchDeliveryHubData();

    registerListener("order:updated", handleOrderUpdate);
    registerListener("order:delivered", handleOrderDelivered);

    return () => {
      unregisterListener("order:updated");
      unregisterListener("order:delivered");
    };
  }, [socket, connected]);

  useEffect(() => {
    setErrorMsg("");
  }, [availableOrders, myDeliveries]);

  const fetchDeliveryHubData = async () => {
    try {
      const availRes = await axios.get("/api/delivery/available");
      if (availRes.data.success) {
        setAvailableOrders(availRes.data.orders);
      }

      const myRes = await axios.get("/api/orders/my-orders");
      if (myRes.data.success) {
        setMyDeliveries(myRes.data.orders);
      }

      const earnRes = await axios.get("/api/delivery/earnings");
      if (earnRes.data.success) {
        setEarnings(earnRes.data);
      }
    } catch (err) {
      console.error("Error fetching delivery hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedHistory = async () => {
    try {
      setHistoryError("");
      const res = await axios.get("/api/delivery/completed", { params: { period: historyPeriod } });
      if (res.data.success) {
        setCompletedHistory(res.data.deliveries);
        setEarnings((prev) => ({
          ...prev,
          totalETH: res.data.earnings.totalETH,
          totalBITE: res.data.earnings.totalBITE,
          completedCount: res.data.count,
        }));
      }
    } catch (err) {
      console.error("Error fetching completed history:", err);
      setHistoryError(err.response?.data?.message || err.message || "Failed to load delivery history.");
    }
  };

  const handleAcceptDelivery = async (ord) => {
    const orderId = typeof ord === "string" ? ord : ord.orderId;
    try {
      setErrorMsg("");
      setClaimingOrderId(orderId);

      if (!account) {
        const connected = await connectWallet();
        if (!connected) {
          setClaimingOrderId(null);
          return;
        }
      }

      const currentEscrow = contractAddresses?.escrow?.toLowerCase();
      const orderEscrow = ord.escrowContractAddress ? ord.escrowContractAddress.toLowerCase() : "";

      if (orderEscrow && currentEscrow && orderEscrow !== currentEscrow) {
        throw new Error(
          `ORDER CREATED ON PREVIOUS DEPLOYMENT (${orderEscrow.slice(0, 10)}...). Active contract is ${currentEscrow.slice(0, 10)}... Please select a fresh order.`
        );
      }

      const chainCheck = await verifyOrderOnChain(orderId, ord._id || orderId);
      if (!chainCheck.exists) {
        throw new Error(
          `Order exists in database but was NOT found on active escrow contract (${currentEscrow || "0x..."}). Reason: ${chainCheck.error || "Order not found"}`
        );
      }

      const txResult = await executeAcceptDeliveryContract(orderId);

      if (!txResult || !txResult.success || !txResult.txHash) {
        setErrorMsg("Blockchain transaction did not complete successfully. Please try again.");
        addToast("Transaction failed. Please try again.", "error");
        return;
      }

      await axios.put(`/api/delivery/${orderId}/accept`, {
        driverWallet: account || user?.walletAddress,
        txHash: txResult.txHash,
      });

      addToast(`Delivery run ${orderId} accepted! Head to restaurant.`, "success");
      fetchDeliveryHubData();
    } catch (err) {
      console.error("Error accepting delivery on-chain:", err);
      let friendlyMsg = err.message || "Failed to accept delivery on blockchain.";
      if (friendlyMsg.toLowerCase().includes("reject") || friendlyMsg.toLowerCase().includes("user denied")) {
        friendlyMsg = "Transaction was rejected in MetaMask. Please approve the transaction to accept this delivery.";
      } else if (friendlyMsg.toLowerCase().includes("insufficient funds")) {
        friendlyMsg = "Insufficient ETH in your wallet to accept this delivery.";
      }
      setErrorMsg(friendlyMsg);
      addToast(friendlyMsg, "error");
    } finally {
      setClaimingOrderId(null);
    }
  };

  const handleUpdateStatus = async (ord, newStatus) => {
    const orderId = typeof ord === "string" ? ord : ord.orderId;
    try {
      setErrorMsg("");
      setVerifyingOrder(orderId);

      let txHash = "";

      if (newStatus === "PickedUp") {
        const txResult = await executeUpdatePickedUpContract(orderId);
        if (!txResult || !txResult.success || !txResult.txHash) {
          setErrorMsg("Blockchain transaction did not complete successfully. Please try again.");
          addToast("Transaction failed. Please try again.", "error");
          return;
        }
        txHash = txResult.txHash;
      }

      await axios.put(`/api/orders/${orderId}/status`, { escrowStatus: newStatus, txHash });

      if (newStatus === "PickedUp") {
        addToast("Food picked up from restaurant!", "success");
      }

      fetchDeliveryHubData();
    } catch (err) {
      console.error("Error updating status on-chain:", err);
      setErrorMsg(err.message || "Blockchain transaction failed.");
      addToast(err.message || "Blockchain transaction failed.", "error");
    } finally {
      setVerifyingOrder(null);
    }
  };

  const handleCompleteDeliveryOTP = async (orderId) => {
    const rawOtp = otpMap[orderId];
    if (!rawOtp) {
      setErrorMsg("Please enter customer's 4-digit secret OTP PIN!");
      return;
    }

    try {
      setErrorMsg("");
      setVerifyingOrder(orderId);

      const txResult = await executeConfirmDeliveryContract(orderId, rawOtp);

      if (!txResult || !txResult.success || !txResult.txHash) {
        setErrorMsg("Blockchain transaction did not complete successfully. Please try again.");
        addToast("Transaction failed. Please try again.", "error");
        return;
      }

      await axios.put(`/api/orders/${orderId}/status`, {
        escrowStatus: "Delivered",
        txHash: txResult.txHash,
        driverWallet: account || user?.walletAddress,
      });

      addToast("Delivery confirmed! ETH released & $BITE rewards minted.", "success");
      fetchDeliveryHubData();
    } catch (err) {
      console.error("Delivery OTP verification error:", err);
      setErrorMsg(err.message || "Invalid OTP PIN or smart contract error!");
      addToast(err.message || "Invalid OTP PIN or smart contract error!", "error");
    } finally {
      setVerifyingOrder(null);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading Delivery Partner Hub...</div>;
  }

  const activeDeliveries = myDeliveries.filter((o) => o.escrowStatus !== "Delivered");

  const filterButtons = [
    { key: "all", label: "All Time" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="space-y-8 pb-16">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.35s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <Bike className="w-8 h-8 text-amber-400" /> Delivery Partner Hub
          </h1>
          <p className="text-xs text-gray-400 mt-1">Accept order runs, verify customer OTPs, and earn ETH + $BITE rewards.</p>
        </div>
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 glass-card rounded-3xl border-l-4 border-amber-400">
          <span className="text-xs text-gray-400 font-bold block">ETH Delivery Earnings</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{earnings.totalETH} ETH</div>
          <span className="text-[10px] text-gray-400">Includes delivery fees + customer tips</span>
        </div>

        <div className="p-6 glass-card rounded-3xl border-l-4 border-brand-500">
          <span className="text-xs text-gray-400 font-bold block">$BITE Token Bonuses</span>
          <div className="text-3xl font-black text-brand-neon font-mono mt-1">+{earnings.totalBITE} BITE</div>
          <span className="text-[10px] text-gray-400">+5 BITE tokens per completed delivery</span>
        </div>

        <div className="p-6 glass-card rounded-3xl border-l-4 border-purple-500">
          <span className="text-xs text-gray-400 font-bold block">Deliveries Completed</span>
          <div className="text-3xl font-black text-white font-mono mt-1">{earnings.completedCount} Runs</div>
          <span className="text-[10px] text-gray-400">100% verified on-chain</span>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
          <p className="text-red-400 text-xs font-bold">⚠️ {errorMsg}</p>
          <button
            onClick={() => setErrorMsg("")}
            className="px-3 py-1.5 bg-dark-card border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 font-semibold text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Available Jobs */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-500" /> Available Deliveries ({availableOrders.length})
        </h2>

        {availableOrders.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">No pending orders awaiting riders. Check back shortly!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableOrders.map((ord) => (
              <div key={ord._id} className="p-4 bg-dark-bg border border-gray-800 rounded-2xl space-y-3 animate-slideIn">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-white">{ord.orderId}</span>
                  <span className="font-mono text-brand-neon font-bold">Payout: {(ord.deliveryFeeETH + (ord.tipETH || 0)).toFixed(4)} ETH</span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="text-gray-300 font-bold">{ord.restaurant?.name}</p>
                  <p className="text-gray-500 text-[11px]">Pickup: {ord.restaurant?.address}</p>
                  <p className="text-gray-500 text-[11px]">Dropoff: {ord.deliveryAddress}</p>
                </div>

                {ord.escrowContractAddress && contractAddresses?.escrow && ord.escrowContractAddress.toLowerCase() !== contractAddresses.escrow.toLowerCase() ? (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-[10px] font-mono font-bold">
                    Legacy Contract Order ({ord.escrowContractAddress.slice(0, 10)}...). Active: {contractAddresses.escrow.slice(0, 10)}...
                  </div>
                ) : (
                  <button
                    onClick={() => handleAcceptDelivery(ord)}
                    disabled={claimingOrderId === ord.orderId}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all disabled:opacity-50"
                  >
                    {claimingOrderId === ord.orderId ? "Confirming on-chain..." : "Accept Delivery Run"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Active Deliveries */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-400" /> My Active Runs ({activeDeliveries.length})
        </h2>

        {activeDeliveries.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">No active deliveries right now. Accept a job above!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeDeliveries.map((ord) => (
              <div key={ord._id} className="p-6 glass-card rounded-3xl space-y-4 border border-amber-500/40">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                    {ord.orderId}
                  </span>
                  <span className="text-xs font-bold text-white uppercase">{ord.escrowStatus}</span>
                </div>

                <div className="p-3 bg-dark-bg border border-gray-800 rounded-xl space-y-2 text-xs">
                  <div>
                    <span className="text-gray-500 block">Pickup Restaurant:</span>
                    <span className="font-bold text-white">{ord.restaurant?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Drop-off Location:</span>
                    <span className="font-bold text-white">{ord.deliveryAddress}</span>
                  </div>
                </div>

                {ord.escrowStatus === "PickedUp" ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                    <label className="text-xs text-amber-400 font-bold flex items-center gap-1">
                      <Key className="w-4 h-4" /> Ask Customer for Delivery OTP PIN
                    </label>
                    {errorMsg && <p className="text-[11px] text-red-400 font-bold">{errorMsg}</p>}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={otpMap[ord.orderId] || ""}
                        onChange={(e) => setOtpMap({ ...otpMap, [ord.orderId]: e.target.value })}
                        placeholder="4-digit OTP"
                        className="bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest outline-none flex-1"
                      />
                      <button
                        onClick={() => handleCompleteDeliveryOTP(ord.orderId)}
                        disabled={verifyingOrder === ord.orderId}
                        className="px-4 py-2 bg-brand-500 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow"
                      >
                        {verifyingOrder === ord.orderId ? "Verifying..." : "Verify & Collect ETH"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus(ord, "PickedUp")}
                    disabled={verifyingOrder === ord.orderId}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all disabled:opacity-50"
                  >
                    {verifyingOrder === ord.orderId ? "Confirming on-chain..." : "Mark Food Picked Up from Restaurant"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed History */}
      <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-brand-500" /> Completed Deliveries ({earnings.completedCount})
          </h2>
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => { setHistoryPeriod(btn.key); fetchCompletedHistory(); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  historyPeriod === btn.key
                    ? "bg-brand-500 text-dark-bg shadow-glow"
                    : "bg-dark-card border border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {historyError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
            <p className="text-red-400 text-xs font-bold">⚠️ {historyError}</p>
            <button
              onClick={fetchCompletedHistory}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-extrabold text-[11px] rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {completedHistory.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">No completed deliveries found for this period.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedHistory.map((ord) => (
              <div key={ord._id} className="p-5 bg-dark-bg border border-gray-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg">
                    {ord.orderId}
                  </span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleString() : new Date(ord.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="text-gray-300 font-bold">From: {ord.restaurant?.name}</p>
                  <p className="text-gray-500 text-[11px]">
                    Delivered on {ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>

                <div className="p-3 bg-dark-card border border-gray-800 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Delivery Fee:</span>
                    <span className="font-mono text-brand-400">{(ord.deliveryFeeETH || 0).toFixed(4)} ETH</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Customer Tip:</span>
                    <span className="font-mono text-brand-400">{(ord.tipETH || 0).toFixed(4)} ETH</span>
                  </div>
                  <div className="pt-2 border-t border-gray-800 flex justify-between font-bold text-white">
                    <span>Your Earnings:</span>
                    <span className="font-mono text-brand-neon">
                      {((ord.deliveryFeeETH || 0) + (ord.tipETH || 0)).toFixed(4)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>$BITE Reward:</span>
                    <span className="font-mono text-brand-gold">+5 BITE</span>
                  </div>
                </div>

                {ord.txHash && (
                  <div className="text-[10px] text-gray-500 font-mono truncate">
                    Tx: {ord.txHash.substring(0, 20)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
