import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useWeb3 } from "./Web3Context";
import { resolveWalletRole } from "../utils/roleResolver";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { account } = useWeb3();

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("blockbite_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("blockbite_token") || "");
  const [loading, setLoading] = useState(true);

  // Single Authoritative Role Resolution
  const resolvedIdentity = useMemo(() => {
    return resolveWalletRole(account, user);
  }, [account, user]);

  const activeUser = useMemo(() => {
    if (!account && !user) return null;
    if (account) {
      return {
        id: user?.id || `wallet-${account.toLowerCase()}`,
        name: resolvedIdentity.name || user?.name || `Wallet (${account.slice(0, 6)}...)`,
        email: resolvedIdentity.email || user?.email || `${account.slice(0, 8)}@blockbite.eth`,
        role: resolvedIdentity.role,
        walletAddress: account.toLowerCase(),
        rewardTokensEarned: user?.rewardTokensEarned || 0,
      };
    }
    return user;
  }, [account, user, resolvedIdentity]);

  // Cart State
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("blockbite_cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [cartRestaurant, setCartRestaurant] = useState(() => {
    const savedRest = localStorage.getItem("blockbite_cart_rest");
    return savedRest ? JSON.parse(savedRest) : null;
  });

  // Save cart to localstorage
  useEffect(() => {
    localStorage.setItem("blockbite_cart", JSON.stringify(cart));
    localStorage.setItem("blockbite_cart_rest", JSON.stringify(cartRestaurant));
  }, [cart, cartRestaurant]);

  // Sync JWT token with backend when connected wallet changes
  useEffect(() => {
    const syncWalletSession = async () => {
      if (account && !user) {
        try {
          const res = await axios.post("/api/auth/wallet-session", { walletAddress: account });
          if (res.data.success) {
            setToken(res.data.token);
            setUser(res.data.user);
            axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
            localStorage.setItem("blockbite_token", res.data.token);
            localStorage.setItem("blockbite_user", JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn("Wallet session sync failed:", err.response?.data?.message || err.message);
        }
      }
    };
    syncWalletSession();
  }, [account, user?.id]);

  // Set default axios header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("blockbite_token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("blockbite_token");
    }
  }, [token]);

  // Fetch current user details on initial mount
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await axios.get("/api/auth/me");
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem("blockbite_user", JSON.stringify(res.data.user));
          }
        } catch (error) {
          console.error("Token verification failed:", error.message);
          logout();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const login = (tokenData, userData) => {
    setToken(tokenData);
    setUser(userData);
    localStorage.setItem("blockbite_token", tokenData);
    localStorage.setItem("blockbite_user", JSON.stringify(userData));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("blockbite_token");
    localStorage.removeItem("blockbite_user");
  };

  const addToCart = (item, restaurant) => {
    if (cartRestaurant && cartRestaurant._id !== restaurant._id) {
      if (!window.confirm("Adding items from a new restaurant will clear your current cart. Continue?")) {
        return false;
      }
      setCart([]);
    }
    setCartRestaurant(restaurant);

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.menuItemId === item._id);
      if (existing) {
        return prevCart.map((i) =>
          i.menuItemId === item._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prevCart,
        {
          menuItemId: item._id,
          title: item.title,
          priceETH: item.priceETH,
          priceBITE: item.priceBITE,
          image: item.image,
          quantity: 1,
        },
      ];
    });
    return true;
  };

  const removeFromCart = (menuItemId) => {
    setCart((prev) => {
      const updated = prev.filter((i) => i.menuItemId !== menuItemId);
      if (updated.length === 0) setCartRestaurant(null);
      return updated;
    });
  };

  const updateQuantity = (menuItemId, delta) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean);
    });
  };

  const clearCart = () => {
    setCart([]);
    setCartRestaurant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        activeRole: resolvedIdentity.role,
        isUnauthorizedRole: resolvedIdentity.role === "unauthorized",
        token,
        loading,
        login,
        logout,
        cart,
        cartRestaurant,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
