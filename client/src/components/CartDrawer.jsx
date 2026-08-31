import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import axios from "axios";
import { X, Trash2, ShoppingBag, Plus, Minus, ArrowRight, ShieldCheck, Tag, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

export const CartDrawer = ({ isOpen, onClose }) => {
  const { cart, cartRestaurant, removeFromCart, updateQuantity, clearCart, user } = useAuth();
  const { account, connectWallet, executeCreateOrderContract } = useWeb3();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [deliveryAddress, setDeliveryAddress] = useState("101 Web3 Blvd, Apt 4B");
  const [tipETH, setTipETH] = useState("0.001");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // NEW: Transaction confirmation state
  const [txStep, setTxStep] = useState("idle"); // "idle" | "signing" | "mining" | "confirming" | "success" | "failed"
  const [confirmedTxHash, setConfirmedTxHash] = useState("");
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [txErrorMsg, setTxErrorMsg] = useState("");

  const resetTxState = () => {
    setTxStep("idle");
    setConfirmedTxHash("");
    setConfirmedOrderId("");
    setTxErrorMsg("");
    setError("");
  };

  // Reset transaction state when drawer opens or closes
  useEffect(() => {
    if (!isOpen) {
      resetTxState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const foodTotalETH = cart.reduce((sum, item) => sum + item.priceETH * item.quantity, 0);
  const deliveryFeeETH = cartRestaurant?.deliveryFeeETH || 0.002;
  const tipAmountETH = parseFloat(tipETH) || 0;
  const grandTotalETH = parseFloat((foodTotalETH + deliveryFeeETH + tipAmountETH).toFixed(6));

  const handleClose = () => {
    resetTxState();
    onClose();
  };

  const handleCheckout = async () => {
    try {
      setError("");
      setTxErrorMsg("");
      setTxStep("idle");

      if (!cartRestaurant || !cartRestaurant._id) {
        setError("No restaurant selected. Please add items from a restaurant first.");
        return;
      }

      if (!user) {
        alert("Please sign in to place an order!");
        navigate("/login");
        handleClose();
        return;
      }

      if (!account) {
        const connected = await connectWallet();
        if (!connected) {
          setError("MetaMask wallet connection required to lock escrow payment.");
          return;
        }
      }

      setLoading(true);

      const rawOtpSecret = Math.floor(1000 + Math.random() * 9000).toString();
      const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // ==========================================
      // STEP 1: Sign & Send Transaction via MetaMask
      // ==========================================
      setTxStep("signing");

      let txResult = null;
      try {
        txResult = await executeCreateOrderContract(
          orderId,
          cartRestaurant.walletAddress,
          foodTotalETH.toFixed(6),
          (deliveryFeeETH + tipAmountETH).toFixed(6),
          rawOtpSecret
        );
      } catch (contractErr) {
        console.error("MetaMask contract transaction error:", contractErr);
        const errMsg = contractErr.reason || contractErr.message || "Smart contract transaction failed";

        let friendlyMsg;
        if (errMsg.toLowerCase().includes("reject") || errMsg.toLowerCase().includes("user denied") || errMsg.toLowerCase().includes("action_rejected")) {
          friendlyMsg = "Transaction was REJECTED in MetaMask. Your funds were NOT spent and the order was NOT created.";
        } else if (errMsg.toLowerCase().includes("insufficient funds") || errMsg.toLowerCase().includes("insufficient")) {
          friendlyMsg = "Insufficient ETH balance in your wallet to cover the escrow amount + gas fee.";
        } else {
          friendlyMsg = `Blockchain Error: ${errMsg}`;
        }

        setTxStep("failed");
        setTxErrorMsg(friendlyMsg);
        addToast("Transaction failed or was rejected.", "error");
        setLoading(false);
        return; // HARD STOP — never proceed
      }

      // ==========================================
      // STEP 2: Validate blockchain receipt & Sync with MetaMask UI
      // ==========================================
      if (!txResult || !txResult.success || !txResult.txHash) {
        setTxStep("failed");
        setTxErrorMsg("Blockchain transaction did not return a valid receipt. Order was NOT placed.");
        addToast("Transaction failed on blockchain.", "error");
        setLoading(false);
        return; // HARD STOP — never proceed
      }

      // Transition to Mining phase (allows MetaMask window to finish closing & broadcast)
      setTxStep("mining");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setTxStep("confirming");
      console.log("🧾 Verified Blockchain Tx Result:", txResult);

      // ==========================================
      // STEP 3: Save to backend ONLY after confirmed tx
      // ==========================================
      const orderPayload = {
        orderId,
        restaurantId: cartRestaurant._id,
        items: cart,
        deliveryAddress,
        customerWallet: account || user.walletAddress,
        txHash: txResult.txHash,
        escrowContractAddress: txResult.escrowContractAddress,
        chainId: txResult.chainId,
        blockNumber: txResult.blockNumber,
        tipETH: tipAmountETH,
        otp: rawOtpSecret,
      };

      let serverRes;
      try {
        serverRes = await axios.post("/api/orders", orderPayload);
      } catch (apiErr) {
        console.error("Backend order save error:", apiErr);
        const backendMsg = apiErr.response?.data?.message || apiErr.message || "Server rejected the order.";
        setTxStep("failed");
        setTxErrorMsg(`Blockchain tx succeeded (${txResult.txHash.slice(0, 10)}...) but backend rejected: ${backendMsg}`);
        addToast(backendMsg, "error");
        setLoading(false);
        return; // HARD STOP — don't navigate
      }

      if (!serverRes.data.success) {
        const backendMsg = serverRes.data?.message || "Failed to save order on server.";
        setTxStep("failed");
        setTxErrorMsg(backendMsg);
        addToast(backendMsg, "error");
        setLoading(false);
        return; // HARD STOP
      }

      // ==========================================
      // STEP 4: SUCCESS — Show confirmation, DON'T auto-navigate
      // ==========================================
      setConfirmedTxHash(txResult.txHash);
      setConfirmedOrderId(serverRes.data.order.orderId);
      setTxStep("success");
      clearCart();
      addToast("Order placed successfully! ETH locked in smart contract escrow.", "success");
      setLoading(false);

    } catch (err) {
      console.error("Checkout submission error:", err);
      const backendMsg = err.response?.data?.message || err.message || "Order transaction failed.";
      setTxStep("failed");
      setTxErrorMsg(backendMsg);
      addToast(backendMsg, "error");
      setLoading(false);
    }
  };

  const handleNavigateToOrder = () => {
    const targetOrderId = confirmedOrderId;
    resetTxState();
    onClose();
    if (targetOrderId) {
      navigate(`/customer/orders/${targetOrderId}`);
    }
  };

  const handleRetry = () => {
    resetTxState();
  };

  // ==========================================
  // RENDER: Transaction Status Screens
  // ==========================================

  // SIGNING / MINING / CONFIRMING — Loading overlay
  if (txStep === "signing" || txStep === "mining" || txStep === "confirming") {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-md bg-dark-card border-l border-gray-800 h-full flex flex-col items-center justify-center p-8 shadow-2xl">
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-brand-500/30 animate-ping"></div>
              <div className="relative w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                {txStep === "signing" && "⏳ Waiting for MetaMask..."}
                {txStep === "mining" && "⛏️ Mining Transaction..."}
                {txStep === "confirming" && "🔍 Verifying On-Chain..."}
              </h3>
              <p className="text-sm text-gray-400">
                {txStep === "signing" && "Please confirm the transaction in MetaMask. Do NOT close this window."}
                {txStep === "mining" && "Transaction sent! Waiting for block confirmation..."}
                {txStep === "confirming" && "Verifying order on blockchain and saving to server..."}
              </p>
            </div>
            <div className="px-6 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-400 text-xs font-bold">⚠️ DO NOT close this tab or MetaMask until complete</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FAILED — Transaction error screen
  if (txStep === "failed") {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-md bg-dark-card border-l border-gray-800 h-full flex flex-col items-center justify-center p-8 shadow-2xl">
          <div className="text-center space-y-6 max-w-sm">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">Transaction Failed</h3>
              <p className="text-sm text-gray-400 mb-4">Your order was <span className="text-red-400 font-bold">NOT</span> created and no ETH was spent.</p>
            </div>
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left">
              <p className="text-red-300 text-xs font-mono break-words">{txErrorMsg}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 font-extrabold text-dark-bg text-sm transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => { resetTxState(); onClose(); }}
                className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-bold text-gray-300 text-sm transition-all border border-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS — Confirmed transaction screen (user must click to navigate)
  if (txStep === "success") {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-md bg-dark-card border-l border-gray-800 h-full flex flex-col items-center justify-center p-8 shadow-2xl">
          <div className="text-center space-y-6 max-w-sm">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">✅ Order Confirmed On-Chain!</h3>
              <p className="text-sm text-gray-400">Your ETH is securely locked in the smart contract escrow.</p>
            </div>
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Order ID:</span>
                <span className="text-white font-mono font-bold">{confirmedOrderId}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Tx Hash:</span>
                <span className="text-brand-400 font-mono text-[10px] break-all">{confirmedTxHash}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={handleNavigateToOrder}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 font-extrabold text-white flex items-center justify-center gap-2 shadow-lg transition-all text-sm"
              >
                <span>View Order Tracker</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-800 font-bold text-gray-400 text-xs transition-all border border-gray-700/60"
              >
                Close Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Normal Cart View (txStep === "idle")
  // ==========================================
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-dark-card border-l border-gray-800 h-full flex flex-col p-6 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-500" />
            <h3 className="text-lg font-bold text-white">Your Order Escrow</h3>
          </div>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-white rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
            <p className="text-red-400 text-xs font-bold">⚠️ {error}</p>
          </div>
        )}

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-20 h-20 rounded-full bg-dark-bg border border-gray-800 flex items-center justify-center text-4xl">
              🛒
            </div>
            <p className="text-gray-400 text-sm">Your cart is empty. Add delicious Web3 dishes to get started!</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-6 mt-4">
            {/* Restaurant Info */}
            {cartRestaurant && (
              <div className="p-3 glass-panel rounded-xl flex items-center gap-3">
                <img src={cartRestaurant.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <h4 className="text-sm font-bold text-white">{cartRestaurant.name}</h4>
                  <p className="text-xs text-gray-400">{cartRestaurant.address}</p>
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.menuItemId} className="p-3 bg-dark-bg/60 border border-gray-800/80 rounded-xl flex items-center gap-3">
                  <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h5 className="text-xs font-semibold text-white">{item.title}</h5>
                    <p className="text-xs text-brand-400 font-mono font-bold">{item.priceETH} ETH</p>
                  </div>
                  <div className="flex items-center gap-2 bg-dark-card border border-gray-700 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.menuItemId, -1)} className="p-1 hover:text-brand-500">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.menuItemId, 1)} className="p-1 hover:text-brand-500">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.menuItemId)} className="text-gray-500 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Order Inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Delivery Address</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-500 outline-none"
                  placeholder="Enter full street address"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Rider Tip (ETH)</label>
                  <input
                    type="number"
                    step="0.0005"
                    value={tipETH}
                    onChange={(e) => setTipETH(e.target.value)}
                    className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Referral Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-500 outline-none uppercase"
                      placeholder="e.g. ALICE100"
                    />
                    <Tag className="w-3.5 h-3.5 text-brand-gold absolute right-2.5 top-2.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary breakdown */}
            <div className="p-4 bg-dark-bg border border-gray-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Food Items Subtotal:</span>
                <span className="font-mono text-white">{foodTotalETH.toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Escrow Delivery Fee:</span>
                <span className="font-mono text-white">{deliveryFeeETH} ETH</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Rider Tip:</span>
                <span className="font-mono text-white">{tipAmountETH} ETH</span>
              </div>
              <div className="pt-2 border-t border-gray-800 flex justify-between text-sm font-bold text-white">
                <span>Total Escrow Payment:</span>
                <span className="font-mono text-brand-400">{grandTotalETH} ETH</span>
              </div>
              <div className="pt-1 text-[10px] text-brand-neon flex items-center justify-between">
                <span>⚡ $BITE Cashback Reward:</span>
                <span className="font-extrabold">+10 BITE Tokens</span>
              </div>
            </div>

            {/* Smart Contract Security Note */}
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-[11px] text-gray-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <p>Funds remain securely locked in the Smart Contract Escrow until you provide the OTP upon delivery.</p>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 font-extrabold text-dark-bg flex items-center justify-center gap-2 shadow-glow transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Confirming Smart Contract...</span>
              ) : (
                <>
                  <span>Lock {grandTotalETH} ETH in Escrow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
