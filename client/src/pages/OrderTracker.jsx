import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useToast } from "../components/Toast";
import { useSocket } from "../hooks/useSocket";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Key,
  Star,
  Copy,
  Check,
  Bike,
  ChefHat,
  Package,
} from "lucide-react";

export const OrderTracker = () => {
  const { orderId } = useParams();
  const { user } = useAuth();
  const { executeConfirmDeliveryContract, executeCancelOrderContract } = useWeb3();
  const { addToast } = useToast();
  const { socket, connected, registerListener, unregisterListener } = useSocket();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [raisingDispute, setRaisingDispute] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canCancel = order && (user?.role === "customer") &&
    order.escrowStatus === "Created" &&
    (Date.now() - new Date(order.createdAt).getTime()) < 5 * 60 * 1000;

  const handleCancelOrder = async (orderId) => {
    try {
      setCancelling(true);
      const txResult = await executeCancelOrderContract(orderId);

      // Strict check: if MetaMask rejected or tx failed, do NOT update backend
      if (!txResult || !txResult.success || !txResult.txHash) {
        addToast("Cancel transaction failed or was rejected in MetaMask.", "error");
        return;
      }

      await axios.put(`/api/orders/${orderId}/status`, {
        escrowStatus: "Cancelled",
        txHash: txResult.txHash,
      });
      addToast("Order cancelled. ETH refunded to your wallet.", "success");
      fetchOrderDetails();
    } catch (err) {
      let msg = err.message || "Failed to cancel order";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("user denied") || msg.toLowerCase().includes("action_rejected")) {
        msg = "Transaction was rejected in MetaMask. Order was NOT cancelled.";
      }
      addToast(msg, "error");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!socket || !connected) return;

    const handleOrderUpdate = () => fetchOrderDetails();
    const handleOrderDelivered = () => fetchOrderDetails();

    registerListener("order:updated", handleOrderUpdate);
    registerListener("order:delivered", handleOrderDelivered);

    return () => {
      unregisterListener("order:updated");
      unregisterListener("order:delivered");
    };
  }, [socket, connected]);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const res = await axios.get(`/api/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.order);
      }
    } catch (err) {
      console.error("Error fetching order:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    try {
      setErrorMsg("");
      if (!otpInput) {
        setErrorMsg("Please enter the 4-digit delivery verification OTP PIN");
        return;
      }

      setConfirming(true);

      const txResult = await executeConfirmDeliveryContract(order.orderId, otpInput);

      // Strict check: if MetaMask rejected or tx failed, do NOT update backend
      if (!txResult || !txResult.success || !txResult.txHash) {
        setErrorMsg("Delivery confirmation transaction failed or was rejected in MetaMask.");
        addToast("Transaction failed. Please try again.", "error");
        return;
      }

      await axios.put(`/api/orders/${order.orderId}/status`, {
        escrowStatus: "Delivered",
        txHash: txResult.txHash,
      });

      addToast("Delivery confirmed! ETH released to restaurant & driver. $BITE rewards minted.", "success");
      fetchOrderDetails();
    } catch (err) {
      console.error("Delivery confirmation error:", err);
      let friendlyMsg = err.message || "Failed to confirm delivery on-chain. Verify OTP PIN!";
      if (friendlyMsg.toLowerCase().includes("reject") || friendlyMsg.toLowerCase().includes("user denied")) {
        friendlyMsg = "Transaction was rejected in MetaMask. Please approve the transaction to confirm delivery.";
      } else if (friendlyMsg.toLowerCase().includes("invalid otp")) {
        friendlyMsg = "Invalid OTP PIN. Please check the 4-digit code and try again.";
      } else if (friendlyMsg.toLowerCase().includes("insufficient funds")) {
        friendlyMsg = "Insufficient ETH in your wallet to complete this transaction.";
      }
      setErrorMsg(friendlyMsg);
      addToast(friendlyMsg, "error");
    } finally {
      setConfirming(false);
    }
  };

  const handleRetryConfirm = () => {
    setErrorMsg("");
    handleConfirmDelivery();
  };

  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    try {
      setRaisingDispute(true);
      await axios.put(`/api/orders/${order.orderId}/dispute`, { reason: disputeReason });
      addToast("Dispute raised. Admin will review shortly.", "warning");
      setShowDisputeForm(false);
      setDisputeReason("");
      fetchOrderDetails();
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to raise dispute", "error");
    } finally {
      setRaisingDispute(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      setReviewing(true);
      const res = await axios.post(`/api/orders/${order.orderId}/review`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      if (res.data.success) {
        setReviewSuccessMsg("🎉 Review stored on IPFS! 3 $BITE Tokens awarded to your wallet.");
        fetchOrderDetails();
      }
    } catch (err) {
      console.error("Review submission error:", err);
      setErrorMsg(err.response?.data?.message || err.message);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        Tracking Escrow Order...
      </div>
    );
  }

  if (!order) {
    return <div className="py-20 text-center text-red-400">Order not found.</div>;
  }

  const statuses = [
    { key: "Created", label: "Payment Escrowed", icon: ShieldCheck },
    { key: "AcceptedByRestaurant", label: "Kitchen Preparing", icon: ChefHat },
    { key: "DriverAssigned", label: "Rider Assigned", icon: Bike },
    { key: "PickedUp", label: "Out for Delivery", icon: Package },
    { key: "Delivered", label: "Delivered & Released", icon: CheckCircle },
  ];

  const currentStatusIndex = statuses.findIndex((s) => s.key === order.escrowStatus);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Order Header */}
      <div className="p-6 sm:p-8 glass-panel rounded-3xl space-y-4 border border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-neon text-xs font-mono font-bold">
                {order.orderId}
              </span>
              <span className="text-xs text-gray-400">
                Placed on {new Date(order.createdAt).toLocaleString()}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-2">
              Order from {order.restaurant?.name || "Partner Restaurant"}
            </h1>
          </div>

          <div className="text-right">
            <span className="text-2xl font-extrabold text-brand-400 font-mono block">
              {order.totalAmountETH} ETH
            </span>
            <span className="text-xs text-gray-400 block">Locked in Escrow</span>
          </div>
        </div>

        {/* Etherscan Tx Hash Card */}
        {order.txHash && (
          <div className="p-3 bg-dark-bg border border-gray-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-500" /> Blockchain Tx Hash:
            </span>
            <a
              href={`https://sepolia.etherscan.io/tx/${order.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-400 hover:text-brand-300 font-mono flex items-center gap-1 font-bold underline"
            >
              {order.txHash.substring(0, 16)}...{order.txHash.substring(order.txHash.length - 8)}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="p-6 sm:p-8 glass-card rounded-3xl space-y-6">
        <h2 className="text-lg font-bold text-white mb-4">Escrow Delivery Timeline</h2>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative">
          {statuses.map((s, idx) => {
            const Icon = s.icon;
            const isDone = idx <= currentStatusIndex || order.escrowStatus === "Delivered";
            const isCurrent = idx === currentStatusIndex;

            return (
              <div
                key={s.key}
                className={`p-4 rounded-2xl border text-center space-y-2 transition-all ${
                  isDone
                    ? "bg-brand-500/10 border-brand-500/40 text-brand-400"
                    : "bg-dark-bg/60 border-gray-800 text-gray-500"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                    isDone ? "bg-brand-500 text-dark-bg font-bold shadow-glow" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold">{s.label}</h4>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Delivery OTP Secret Card */}
      {order.escrowStatus !== "Delivered" && (
        <div className="p-6 bg-gradient-to-r from-amber-500/10 via-dark-card to-brand-500/10 border border-amber-500/30 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Key className="w-4 h-4" /> Secret Delivery OTP Verification Code
            </div>
            <p className="text-xs text-gray-300">
              Provide this secret PIN to the delivery rider upon food arrival to release escrow funds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-black font-mono tracking-widest text-brand-neon bg-dark-bg px-5 py-2 rounded-2xl border border-brand-500/40 shadow-glow">
              {order.deliveryOtp}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(order.deliveryOtp);
                setCopiedOtp(true);
                setTimeout(() => setCopiedOtp(false), 1500);
              }}
              className="p-3 bg-dark-bg border border-gray-800 hover:border-brand-500 rounded-xl text-gray-300 hover:text-white"
            >
              {copiedOtp ? <Check className="w-5 h-5 text-brand-neon" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delivery Input Action (For Driver / Customer) */}
      {(user?.role === "driver" || user?.role === "admin") && order.escrowStatus === "PickedUp" && (
        <div className="p-6 glass-card rounded-3xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-500" /> Complete Delivery & Release Escrow
          </h3>
          <p className="text-xs text-gray-400">
            Enter the customer's 4-digit verification OTP to trigger smart contract ETH payout & mint $BITE reward tokens.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
              <p className="text-xs text-red-400 font-bold">⚠️ {errorMsg}</p>
              <button
                onClick={handleRetryConfirm}
                disabled={confirming}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-extrabold text-[11px] rounded-lg disabled:opacity-50"
              >
                {confirming ? "Retrying..." : "Try Again"}
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              maxLength={4}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="Enter OTP (e.g. 4821)"
              className="bg-dark-bg border border-gray-800 focus:border-brand-500 text-white rounded-xl px-4 py-3 text-sm font-mono tracking-wider outline-none"
            />
            <button
              onClick={handleConfirmDelivery}
              disabled={confirming}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-sm rounded-xl shadow-glow transition-all disabled:opacity-50"
            >
              {confirming ? "Verifying On-Chain..." : "Confirm & Release ETH"}
            </button>
          </div>
        </div>
      )}

      {/* Customer Actions: Cancel (5 min window) + Dispute */}
      {(user?.role === "customer" || user?.role === "admin") && order.escrowStatus === "Created" && (
        <div className="p-6 glass-card rounded-3xl space-y-4 border border-gray-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Order Actions
          </h3>

          {canCancel ? (
            <button
              onClick={() => handleCancelOrder(order.orderId)}
              disabled={cancelling}
              className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Order (Refund)"}
            </button>
          ) : order.escrowStatus === "Created" ? (
            <p className="text-xs text-gray-500">Cancellation window (5 minutes) has expired.</p>
          ) : null}

          {!showDisputeForm ? (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white rounded-xl font-bold text-xs transition-all"
            >
              Raise Dispute
            </button>
          ) : (
            <form onSubmit={handleRaiseDispute} className="space-y-3">
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the issue with this order..."
                required
                className="w-full bg-dark-bg border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={raisingDispute}
                  className="px-4 py-2 bg-amber-500 text-dark-bg font-extrabold text-xs rounded-xl"
                >
                  {raisingDispute ? "Submitting..." : "Submit Dispute"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisputeForm(false)}
                  className="px-4 py-2 bg-dark-card border border-gray-700 text-gray-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* IPFS Review Submission Form (Once Delivered) */}
      {order.escrowStatus === "Delivered" && (
        <div className="p-6 glass-card rounded-3xl space-y-4 border border-brand-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Submit Verified IPFS Food Review
            </h3>
            <span className="text-xs font-mono font-bold text-brand-neon bg-brand-500/20 px-3 py-1 rounded-full border border-brand-500/30">
              Reward: +3 $BITE Tokens
            </span>
          </div>

          {reviewSuccessMsg ? (
            <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-2xl text-brand-neon text-xs font-bold">
              {reviewSuccessMsg}
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`p-2 rounded-xl text-lg transition-transform ${
                        reviewRating >= star ? "text-amber-400 scale-110" : "text-gray-600"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Review Comment</label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="How was your meal? Your review will be pinned on IPFS..."
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-brand-500"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={reviewing}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all"
              >
                {reviewing ? "Pinning Review to IPFS..." : "Publish Review & Claim 3 BITE"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
