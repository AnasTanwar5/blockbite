import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useToast } from "../components/Toast";
import { useSocket } from "../hooks/useSocket";
import { ChefHat, Plus, Check, X, Flame, Clock, DollarSign, Edit3, Trash2, ShieldCheck, ExternalLink } from "lucide-react";

export const RestaurantDashboard = () => {
  const { user } = useAuth();
  const { account, connectWallet, verifyOrderOnChain, checkRestaurantVerified, executeAcceptOrderContract, executeRejectOrderContract, contractAddresses } = useWeb3();
  const { addToast } = useToast();
  const { socket, connected, registerListener, unregisterListener } = useSocket();
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [totalEarnings, setTotalEarnings] = useState({ eth: 0, orders: 0 });
  const [isOpen, setIsOpen] = useState(true);
  const prevOrderIdsRef = useRef(new Set());

  // Restaurant Action Modal State
  const [actionTxStep, setActionTxStep] = useState("idle"); // "idle" | "signing" | "confirming" | "failed" | "success"
  const [actionTxHash, setActionTxHash] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // New Menu Item Form State
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("0.005");
  const [newItemCategory, setNewItemCategory] = useState("Main Course");
  const [newItemDiet, setNewItemDiet] = useState("Non-Veg");
  const [newItemImage, setNewItemImage] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    fetchRestaurantData();
    const onFocus = () => fetchRestaurantData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewOrder = () => fetchRestaurantData();
    const handleOrderUpdate = () => fetchRestaurantData();
    const handleOrderDelivered = () => fetchRestaurantData();

    registerListener("order:new", handleNewOrder);
    registerListener("order:updated", handleOrderUpdate);
    registerListener("order:delivered", handleOrderDelivered);

    return () => {
      unregisterListener("order:new");
      unregisterListener("order:updated");
      unregisterListener("order:delivered");
    };
  }, [socket, connected]);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      const ordersRes = await axios.get("/api/orders/my-orders");
      if (ordersRes.data.success) {
        const ordersData = ordersRes.data.orders.map((o) => ({
          ...o,
          isNew: !prevOrderIdsRef.current.has(o._id),
        }));
        prevOrderIdsRef.current = new Set(ordersData.map((o) => o._id));
        setOrders(ordersData);

        const delivered = ordersData.filter((o) => o.escrowStatus === "Delivered");
        const totalETH = delivered.reduce((sum, o) => sum + (o.foodAmountETH || 0), 0);
        setTotalEarnings({
          eth: parseFloat(totalETH.toFixed(6)),
          orders: delivered.length,
        });
      }

      const restRes = await axios.get("/api/restaurants");
      if (restRes.data.success && restRes.data.restaurants.length > 0) {
        const myRest = restRes.data.restaurants.find((r) => r.owner?._id === user?.id) || restRes.data.restaurants[0];
        setRestaurant(myRest);
        if (myRest) {
          setIsOpen(myRest.isOpen ?? true);
        }

        if (myRest) {
          const detailRes = await axios.get(`/api/restaurants/${myRest._id}`);
          if (detailRes.data.success) {
            setMenuItems(detailRes.data.menuItems);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching kitchen data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRestaurantStatus = async () => {
    if (!restaurant?._id) return;
    try {
      const newStatus = !isOpen;
      await axios.put(`/api/restaurants/${restaurant._id}/status`, { isOpen: newStatus });
      setIsOpen(newStatus);
      addToast(newStatus ? "Restaurant is now OPEN for orders" : "Restaurant is now CLOSED", newStatus ? "success" : "warning");
    } catch (err) {
      addToast("Failed to update restaurant status", "error");
    }
  };

  const resetActionModal = () => {
    setActionTxStep("idle");
    setActionTxHash("");
    setActionError("");
    setActionSuccessMsg("");
    setProcessingOrderId(null);
  };

  const handleUpdateOrderStatus = async (ord, newStatus) => {
    const orderId = typeof ord === "string" ? ord : ord.orderId;
    try {
      setActionError("");
      setActionTxHash("");
      setActionSuccessMsg("");
      setProcessingOrderId(orderId);
      setActionTxStep("signing");

      let currentAccount = account;
      if (!currentAccount) {
        currentAccount = await connectWallet();
        if (!currentAccount) {
          setActionTxStep("failed");
          setActionError("MetaMask wallet connection required to interact with smart contract escrow.");
          setProcessingOrderId(null);
          return;
        }
      }

      const currentEscrow = contractAddresses?.escrow?.toLowerCase();
      const orderEscrow = ord.escrowContractAddress ? ord.escrowContractAddress.toLowerCase() : "";

      if (orderEscrow && currentEscrow && orderEscrow !== currentEscrow) {
        throw new Error(
          `ORDER CREATED ON PREVIOUS DEPLOYMENT (${orderEscrow.slice(0, 10)}...). Current active contract is ${currentEscrow.slice(0, 10)}... Please create a new order on active contract.`
        );
      }

      // Pre-flight check: Verify restaurant wallet is authorized on smart contract (only required when accepting)
      if (newStatus === "AcceptedByRestaurant" && checkRestaurantVerified) {
        const isVerifiedOnChain = await checkRestaurantVerified(currentAccount);
        if (!isVerifiedOnChain) {
          throw new Error(
            `Restaurant wallet (${currentAccount.slice(0, 8)}...) is not verified on the active Escrow contract (${currentEscrow?.slice(0, 8)}...). Please contact Admin to verify your restaurant wallet.`
          );
        }
      }

      const chainCheck = await verifyOrderOnChain(orderId, ord._id || orderId);
      if (!chainCheck.exists) {
        throw new Error(
          `Order exists in database but was NOT found on active escrow contract (${currentEscrow || "0x..."}). Reason: ${chainCheck.error || "Order not found on-chain"}`
        );
      }

      let txResult = null;
      if (newStatus === "AcceptedByRestaurant") {
        txResult = await executeAcceptOrderContract(orderId);
      } else if (newStatus === "RejectedByRestaurant") {
        txResult = await executeRejectOrderContract(orderId, "Rejected by restaurant");
      }

      // Strict validation: Stop if tx failed or was rejected
      if (!txResult || !txResult.success || !txResult.txHash) {
        setActionTxStep("failed");
        setActionError("Blockchain transaction did not return a valid confirmed receipt.");
        addToast("Transaction failed. Please try again.", "error");
        setProcessingOrderId(null);
        return; // HARD STOP — do NOT call backend API
      }

      setActionTxStep("confirming");

      // Save status update to database ONLY after verified mined tx
      await axios.put(`/api/orders/${orderId}/status`, {
        escrowStatus: newStatus,
        txHash: txResult.txHash,
      });

      setActionTxHash(txResult.txHash);
      setActionTxStep("success");
      const msg = newStatus === "AcceptedByRestaurant" ? `Order ${orderId} accepted! Kitchen is preparing.` : `Order ${orderId} rejected.`;
      setActionSuccessMsg(msg);
      addToast(msg, newStatus === "AcceptedByRestaurant" ? "success" : "warning");

      fetchRestaurantData();
    } catch (err) {
      console.error("Error updating order status:", err);
      let friendlyMsg = err.message || "Blockchain transaction failed or was rejected in MetaMask.";
      if (friendlyMsg.toLowerCase().includes("reject") || friendlyMsg.toLowerCase().includes("user denied") || friendlyMsg.toLowerCase().includes("action_rejected")) {
        friendlyMsg = "Transaction was REJECTED in MetaMask. Order status was NOT changed.";
      } else if (friendlyMsg.toLowerCase().includes("insufficient funds")) {
        friendlyMsg = "Insufficient ETH balance in your wallet to cover gas fees.";
      }
      setActionTxStep("failed");
      setActionError(friendlyMsg);
      addToast(friendlyMsg, "error");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRetryAction = async (ord, newStatus) => {
    resetActionModal();
    await handleUpdateOrderStatus(ord, newStatus);
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!restaurant) return;
    try {
      setAddingItem(true);
      const res = await axios.post(`/api/restaurants/${restaurant._id}/menu`, {
        title: newItemTitle,
        description: newItemDesc,
        priceETH: parseFloat(newItemPrice),
        category: newItemCategory,
        diet: newItemDiet,
        image: newItemImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
      });

      if (res.data.success) {
        setNewItemTitle("");
        setNewItemDesc("");
        setNewItemImage("");
        fetchRestaurantData();
      }
    } catch (err) {
      console.error("Error adding menu item:", err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    try {
      await axios.delete(`/api/restaurants/menu/${itemId}`);
      fetchRestaurantData();
    } catch (err) {
      console.error("Error deleting menu item:", err);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading Kitchen Manager...</div>;
  }

  return (
    <div className="space-y-8 pb-16">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.4s ease-out;
        }
      `}</style>

      {/* Action Status Modal Overlay */}
      {(actionTxStep === "signing" || actionTxStep === "confirming") && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-card border border-gray-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-brand-500/30 animate-ping"></div>
              <div className="relative w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500 flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-brand-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                {actionTxStep === "signing" ? "⏳ Waiting for MetaMask..." : "🔍 Verifying On-Chain..."}
              </h3>
              <p className="text-sm text-gray-400">
                {actionTxStep === "signing"
                  ? "Please confirm the transaction in your MetaMask wallet to update order status on-chain."
                  : "Transaction mined! Saving status update to server database..."}
              </p>
            </div>
            <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-amber-400 text-xs font-bold">⚠️ DO NOT close or refresh this tab while transaction completes</p>
            </div>
          </div>
        </div>
      )}

      {actionTxStep === "failed" && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-card border border-red-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <X className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">Action Failed</h3>
              <p className="text-sm text-gray-400">Order status was <span className="text-red-400 font-bold">NOT</span> updated on the blockchain.</p>
            </div>
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left">
              <p className="text-red-300 text-xs font-mono break-words">{actionError}</p>
            </div>
            <button
              onClick={resetActionModal}
              className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-bold text-white text-sm transition-all border border-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {actionTxStep === "success" && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-card border border-green-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">✅ Order Status Updated!</h3>
              <p className="text-sm text-gray-400">{actionSuccessMsg}</p>
            </div>
            {actionTxHash && (
              <div className="p-3 bg-dark-bg border border-gray-800 rounded-xl text-left font-mono text-xs">
                <span className="text-gray-400 block mb-1">Tx Hash:</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${actionTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-400 underline font-bold break-all flex items-center gap-1"
                >
                  {actionTxHash}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}
            <button
              onClick={resetActionModal}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 font-extrabold text-white text-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-brand-500" /> {restaurant?.name || "Kitchen Dashboard"}
          </h1>
          <p className="text-xs text-gray-400 mt-1">Manage kitchen orders, dishes, and escrow earnings.</p>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 glass-card rounded-2xl border-l-4 border-brand-500">
            <span className="text-xs text-gray-400 font-bold block">Total ETH Earned (Delivered Orders)</span>
            <div className="text-2xl font-black text-brand-neon font-mono mt-1">{totalEarnings.eth} ETH</div>
            <span className="text-[10px] text-gray-400">From {totalEarnings.orders} completed orders</span>
          </div>
          <div className="p-4 glass-card rounded-2xl border-l-4 border-amber-400">
            <span className="text-xs text-gray-400 font-bold block">Pending Orders</span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {orders.filter((o) => o.escrowStatus !== "Delivered" && o.escrowStatus !== "RejectedByRestaurant" && o.escrowStatus !== "Cancelled").length}
            </div>
            <span className="text-[10px] text-gray-400">Awaiting preparation or pickup</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "orders" ? "bg-brand-500 text-dark-bg shadow-glow" : "bg-dark-card border border-gray-800 text-gray-400"
            }`}
          >
            Live Orders Queue ({orders.filter((o) => o.escrowStatus !== "Delivered").length})
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "menu" ? "bg-brand-500 text-dark-bg shadow-glow" : "bg-dark-card border border-gray-800 text-gray-400"
            }`}
          >
            Manage Digital Menu ({menuItems.length})
          </button>
        </div>

        {/* Restaurant Status Toggle */}
        <button
          onClick={toggleRestaurantStatus}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            isOpen
              ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white"
              : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-green-400" : "bg-red-400"}`}></div>
          {isOpen ? "Open for Orders" : "Closed"}
        </button>
      </div>

      {activeTab === "orders" ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Active Escrow Orders</h2>

          {actionError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
              <p className="text-red-400 text-xs font-bold">⚠️ {actionError}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setActionError("")}
                  className="px-3 py-1.5 bg-dark-card border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 font-semibold text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="p-8 glass-panel rounded-3xl text-center text-gray-400">No active incoming orders yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {orders
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((ord) => (
                  <div
                    key={ord._id}
                    className={`p-6 glass-card rounded-3xl space-y-4 ${ord.isNew ? "animate-slideIn" : ""}`}
                    onAnimationEnd={() => {
                      if (ord.isNew) {
                        setOrders((prev) => prev.map((o) => (o._id === ord._id ? { ...o, isNew: false } : o)));
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg">
                        {ord.orderId}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(ord.createdAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">Customer Address:</p>
                    <p className="text-xs font-mono text-white truncate">{ord.deliveryAddress}</p>
                  </div>

                  <div className="p-3 bg-dark-bg border border-gray-800 rounded-xl space-y-2 text-xs">
                    {ord.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-gray-300">
                        <span>{i.quantity}x {i.title}</span>
                        <span className="font-mono text-brand-400">{i.priceETH} ETH</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-800 flex justify-between font-bold text-white">
                      <span>Food Amount:</span>
                      <span className="font-mono text-brand-neon">{ord.foodAmountETH} ETH</span>
                    </div>
                    {ord.escrowStatus === "Delivered" && (
                      <div className="pt-2 border-t border-green-500/30 flex justify-between font-bold text-green-400">
                        <span>Earned:</span>
                        <span className="font-mono">+{ord.foodAmountETH} ETH</span>
                      </div>
                    )}
                  </div>

                  {ord.txHash && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono p-2 bg-dark-bg/40 rounded-lg border border-gray-800/60">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span className="shrink-0">On-Chain Tx:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${ord.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-400 hover:text-brand-300 underline font-bold truncate flex items-center gap-1"
                      >
                        {ord.txHash.substring(0, 10)}...{ord.txHash.substring(ord.txHash.length - 6)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {ord.escrowContractAddress && contractAddresses?.escrow && ord.escrowContractAddress.toLowerCase() !== contractAddresses.escrow.toLowerCase() ? (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-[10px] font-mono font-bold mt-2">
                      ⚠️ Legacy Contract Order ({ord.escrowContractAddress.slice(0, 10)}...). Create a fresh order on current deployment ({contractAddresses.escrow.slice(0, 10)}...).
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-400">Status: <strong className="text-amber-400">{ord.escrowStatus}</strong></span>

                      {ord.escrowStatus === "Created" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateOrderStatus(ord, "AcceptedByRestaurant")}
                            disabled={processingOrderId === ord.orderId}
                            className="px-3 py-1.5 bg-brand-500 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {processingOrderId === ord.orderId ? "Confirming on-chain..." : "Accept Order"}
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(ord, "RejectedByRestaurant")}
                            disabled={processingOrderId === ord.orderId}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add New Item Form */}
          <form onSubmit={handleAddMenuItem} className="p-6 glass-card rounded-3xl space-y-4 border border-brand-500/30">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-500" /> Add New Dish to Menu
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Dish Title</label>
                <input
                  type="text"
                  required
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="e.g. Solidity Supreme Pizza"
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Price (ETH)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Category</label>
                <input
                  type="text"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Diet Preference</label>
                <select
                  value={newItemDiet}
                  onChange={(e) => setNewItemDiet(e.target.value)}
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                >
                  <option value="Non-Veg">Non-Veg</option>
                  <option value="Veg">Veg</option>
                  <option value="Vegan">Vegan</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Short description of ingredients..."
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Image URL</label>
                <input
                  type="text"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingItem}
              className="px-6 py-2.5 bg-brand-500 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all"
            >
              {addingItem ? "Saving..." : "Add Item to Menu"}
            </button>
          </form>

          {/* Menu Items List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menuItems.map((item) => (
              <div key={item._id} className="p-4 bg-dark-bg/60 border border-gray-800 rounded-2xl flex items-center justify-between gap-4">
                <img src={item.image} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <h4 className="font-bold text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-brand-400 font-mono font-bold">{item.priceETH} ETH</p>
                  <span className="text-[10px] text-gray-500 uppercase">{item.category} • {item.diet}</span>
                </div>
                <button
                  onClick={() => handleDeleteMenuItem(item._id)}
                  className="p-2 text-gray-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
