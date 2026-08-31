import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { Wallet, LogIn, UserPlus, Sparkles, AlertCircle } from "lucide-react";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const { account, connectWallet } = useWeb3();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      const res = await axios.post("/api/auth/login", { email, password });
      if (res.data.success) {
        login(res.data.token, res.data.user);
        const role = res.data.user?.role || "customer";
        if (role === "restaurant") navigate("/restaurant/dashboard");
        else if (role === "driver") navigate("/delivery/dashboard");
        else if (role === "admin") navigate("/admin/dashboard");
        else navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    try {
      setError("");
      setLoading(true);
      const walletAddr = await connectWallet();
      if (!walletAddr) return;

      const message = `BLOCKBITE Auth Nonce: ${Date.now()}`;
      const provider = new (await import("ethers")).BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      const res = await axios.post("/api/auth/metamask-login", {
        walletAddress: walletAddr,
        signature,
        message,
      });

      if (res.data.success) {
        login(res.data.token, res.data.user);
        const role = res.data.user?.role || "customer";
        if (role === "restaurant") navigate("/restaurant/dashboard");
        else if (role === "driver") navigate("/delivery/dashboard");
        else if (role === "admin") navigate("/admin/dashboard");
        else navigate("/");
      }
    } catch (err) {
      console.error("MetaMask login error:", err);
      setError(err.message || "MetaMask signature authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="p-8 glass-card rounded-3xl space-y-6 border border-brand-500/30">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-neon flex items-center justify-center text-2xl mx-auto">
            🍕
          </div>
          <h2 className="text-2xl font-black text-white">Sign In to BLOCKBITE</h2>
          <p className="text-xs text-gray-400">Access your food escrow wallet & reward tokens.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* MetaMask 1-Click Login Button */}
        <button
          onClick={handleMetaMaskLogin}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow flex items-center justify-center gap-2 transition-all"
        >
          <Wallet className="w-4 h-4" /> Sign In with MetaMask Signature
        </button>

        {/* Quick Demo Login Presets */}
        <div className="p-3 bg-dark-bg/80 border border-gray-800 rounded-2xl space-y-2">
          <p className="text-[11px] font-bold text-gray-400 text-center uppercase tracking-wider">
            ⚡ Quick Test Demo Logins
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail("customer@blockbite.com");
                setPassword("password123");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300 font-bold hover:bg-brand-500/20 text-left transition-all truncate"
            >
              🛒 Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("mario@pizzabite.eth");
                setPassword("password123");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold hover:bg-amber-500/20 text-left transition-all truncate"
            >
              🍕 Restaurant
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("driver@blockbite.com");
                setPassword("password123");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 font-bold hover:bg-sky-500/20 text-left transition-all truncate"
            >
              🛵 Delivery Driver
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("admin@blockbite.com");
                setPassword("password123");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold hover:bg-purple-500/20 text-left transition-all truncate"
            >
              🛡️ Admin
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-800 w-full"></div>
          <span className="bg-dark-card px-3 text-[10px] text-gray-500 uppercase font-bold absolute">or email</span>
        </div>

        {/* Standard Email Login */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@blockbite.com"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-800">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-400 font-bold hover:underline">
            Register Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export const Register = () => {
  const [searchParams] = useSearchParams();
  const refParam = searchParams.get("ref") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [referralCode, setReferralCode] = useState(refParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setLoading(true);
      const res = await axios.post("/api/auth/register", {
        name,
        email,
        password,
        role,
        referralCode,
      });

      if (res.data.success) {
        login(res.data.token, res.data.user);
        const role = res.data.user?.role || "customer";
        if (role === "restaurant") navigate("/restaurant/dashboard");
        else if (role === "driver") navigate("/delivery/dashboard");
        else if (role === "admin") navigate("/admin/dashboard");
        else navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="p-8 glass-card rounded-3xl space-y-6 border border-brand-500/30">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white">Create BLOCKBITE Account</h2>
          <p className="text-xs text-gray-400">Join the decentralized food delivery protocol.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Nakamoto"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@blockbite.eth"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Select Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="customer">Customer (Order & Earn Tokens)</option>
              <option value="restaurant">Restaurant Owner (Kitchen Manager)</option>
              <option value="driver">Delivery Partner (Rider)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Referral Code (Optional)</label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. ALICE100"
              className="w-full bg-dark-bg border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-dark-bg font-extrabold text-xs rounded-xl shadow-glow transition-all"
          >
            {loading ? "Creating Account..." : "Register & Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
};
