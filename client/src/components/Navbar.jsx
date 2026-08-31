import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useSocket } from "../hooks/useSocket";
import {
  ShoppingBag,
  Wallet,
  Coins,
  User as UserIcon,
  LogOut,
  Sparkles,
  ChefHat,
  Bike,
  ShieldAlert,
  ChevronDown,
  Globe,
  Wifi,
  WifiOff,
} from "lucide-react";

export const Navbar = ({ onOpenCart }) => {
  const { user, logout, cart } = useAuth();
  const { account, ethBalance, biteBalance, connectWallet, isConnecting, networkName, chainId } = useWeb3();
  const { connected: wsConnected } = useSocket();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isCustomer = user?.role === "customer";
  const isRestaurant = user?.role === "restaurant";
  const isDriver = user?.role === "driver";
  const isAdmin = user?.role === "admin";

  const getNetworkColor = () => {
    if (networkName?.toLowerCase().includes("hardhat") || networkName?.toLowerCase().includes("localhost")) return "text-green-400";
    if (networkName?.toLowerCase().includes("sepolia")) return "text-blue-400";
    return "text-red-400";
  };

  const getNetworkDot = () => {
    if (networkName?.toLowerCase().includes("hardhat") || networkName?.toLowerCase().includes("localhost")) return "bg-green-400";
    if (networkName?.toLowerCase().includes("sepolia")) return "bg-blue-400";
    return "bg-red-400";
  };

  const currentPort = typeof window !== "undefined" ? window.location.port : "";
  const instanceTag = 
    currentPort === "3001" ? { label: "PORT 3001 • CUSTOMER", color: "bg-brand-500/20 text-brand-300 border-brand-500/40" } :
    currentPort === "3002" ? { label: "PORT 3002 • RESTAURANT", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" } :
    currentPort === "3003" ? { label: "PORT 3003 • DRIVER HUB", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" } : null;

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to={isCustomer ? "/" : isRestaurant ? "/restaurant/dashboard" : isDriver ? "/delivery/dashboard" : isAdmin ? "/admin/dashboard" : "/"} className="flex items-center gap-3 group">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr p-0.5 shadow-glow group-hover:scale-105 transition-transform ${
              isRestaurant ? "from-amber-600 via-amber-500 to-amber-400" :
              isDriver ? "from-sky-600 via-sky-500 to-sky-400" :
              isAdmin ? "from-purple-600 via-purple-500 to-purple-400" :
              "from-brand-600 via-brand-500 to-brand-neon"
            }`}>
              <div className="w-full h-full bg-dark-bg rounded-[14px] flex items-center justify-center text-xl">
                🍕
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1">
                BLOCK<span className={isRestaurant ? "text-amber-500" : isDriver ? "text-sky-500" : isAdmin ? "text-purple-500" : "text-brand-500"}>BITE</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase font-bold block text-gray-400">
                {isRestaurant ? "Kitchen Manager" : isDriver ? "Delivery Hub" : isAdmin ? "Admin Portal" : "Decentralized Food"}
              </span>
            </div>
          </Link>

          {instanceTag && (
            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black border tracking-wider uppercase ${instanceTag.color}`}>
              {instanceTag.label}
            </span>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {isCustomer && (
            <>
              <Link to="/restaurants" className="hover:text-brand-500 transition-colors">
                Browse Restaurants
              </Link>
              <Link to="/customer/orders" className="hover:text-brand-500 transition-colors">
                My Orders
              </Link>
            </>
          )}

          {isRestaurant && (
            <>
              <Link to="/restaurant/dashboard" className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <ChefHat className="w-4 h-4" /> Kitchen
              </Link>
              <Link to="/restaurant/dashboard" className="hover:text-amber-400 transition-colors text-amber-400/70">
                Menu & Earnings
              </Link>
            </>
          )}

          {isDriver && (
            <>
              <Link to="/delivery/dashboard" className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <Bike className="w-4 h-4" /> Delivery Hub
              </Link>
              <Link to="/delivery/profile" className="hover:text-sky-400 transition-colors text-sky-400/70">
                Profile
              </Link>
            </>
          )}

          {isAdmin && (
            <Link to="/admin/dashboard" className="flex items-center gap-1.5 text-purple-400 font-semibold">
              <ShieldAlert className="w-4 h-4" /> Admin Portal
            </Link>
          )}
        </nav>

        {/* Action Widgets */}
        <div className="flex items-center gap-3">
          {/* Cart Icon - ONLY for customers */}
          {isCustomer && (
            <button
              onClick={onOpenCart}
              className="relative p-2.5 rounded-xl bg-dark-card border border-gray-800 hover:border-brand-500 text-gray-300 hover:text-white transition-all"
              title="View Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-dark-bg font-extrabold text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-glow">
                  {totalCartCount}
                </span>
              )}
            </button>
          )}

          {/* Network Status Badge */}
          {account && (
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dark-card border border-gray-800 text-[10px] font-semibold ${getNetworkColor()}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${getNetworkDot()} animate-pulse`}></span>
              <Globe className="w-3 h-3" />
              <span className="hidden lg:inline">{networkName || `Chain ${chainId}`}</span>
              <span className="lg:hidden">{chainId}</span>
            </div>
          )}

          {/* WebSocket Status */}
          {user && (
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-dark-card border border-gray-800 text-[10px] font-semibold ${
              wsConnected ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"
            }`}>
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{wsConnected ? "Live" : "Offline"}</span>
            </div>
          )}

          {/* Web3 Wallet Connect Button */}
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              account
                ? "bg-dark-card border-gray-700 text-gray-200"
                : "bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 border-transparent text-dark-bg font-bold shadow-glow"
            }`}
          >
            <Wallet className="w-4 h-4" />
            {account ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-300 hidden sm:inline">
                  {account.substring(0, 6)}...{account.substring(account.length - 4)}
                </span>
                <span className="sm:hidden text-gray-300">
                  {account.substring(0, 4)}...
                </span>
              </div>
            ) : (
              <span>{isConnecting ? "Connecting..." : "Connect Wallet"}</span>
            )}
          </button>

          {/* User Profile Auth Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-dark-card border border-gray-800 hover:border-gray-700 transition-all"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  isRestaurant ? "bg-amber-500/20 text-amber-400" :
                  isDriver ? "bg-sky-500/20 text-sky-400" :
                  isAdmin ? "bg-purple-500/20 text-purple-400" :
                  "bg-brand-500/20 text-brand-400"
                }`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-card rounded-2xl p-2 shadow-2xl z-50">
                  <div className="px-3 py-2 border-b border-gray-800 mb-1">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    <span
                      className={`mt-1 inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded ${
                        user.role === "customer"
                          ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                          : user.role === "restaurant"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : user.role === "driver"
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          : user.role === "admin"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30 font-black"
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>

                  {/* Role-specific quick links */}
                  {isCustomer && (
                    <Link
                      to="/customer/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-dark-hover transition-colors"
                    >
                      <Sparkles className="w-4 h-4 text-brand-gold" /> Rewards & Wallet
                    </Link>
                  )}

                  {isRestaurant && (
                    <Link
                      to="/restaurant/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-dark-hover transition-colors text-amber-400"
                    >
                      <ChefHat className="w-4 h-4" /> Kitchen Dashboard
                    </Link>
                  )}

                  {isDriver && (
                    <>
                      <Link
                        to="/delivery/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-dark-hover transition-colors text-sky-400"
                      >
                        <Bike className="w-4 h-4" /> Delivery Hub
                      </Link>
                      <Link
                        to="/delivery/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-dark-hover transition-colors text-sky-400"
                      >
                        <UserIcon className="w-4 h-4" /> My Profile
                      </Link>
                    </>
                  )}

                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-dark-hover transition-colors text-purple-400"
                    >
                      <ShieldAlert className="w-4 h-4" /> Admin Portal
                    </Link>
                  )}

                  <div className="border-t border-gray-800 mt-1 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                        navigate("/login");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-dark-card hover:bg-dark-hover border border-gray-800 rounded-xl transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
