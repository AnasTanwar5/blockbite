import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Web3Provider } from "./context/Web3Context";
import { ToastProvider, useToast } from "./components/Toast";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";

// Pages
import { Home } from "./pages/Home";
import { RestaurantDetail } from "./pages/RestaurantDetail";
import { OrderTracker } from "./pages/OrderTracker";
import { CustomerDashboard } from "./pages/CustomerDashboard";
import { RestaurantDashboard } from "./pages/RestaurantDashboard";
import { DeliveryDashboard } from "./pages/DeliveryDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Login, Register } from "./pages/AuthPages";
import { DriverProfile } from "./pages/DriverProfile";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "unauthorized") {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 font-extrabold text-base">
          ⚠️ UNAUTHORIZED WALLET ADDRESS
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          The connected wallet address (<code className="text-white">{user.walletAddress}</code>) is not registered in the role registry or database. Customer/Restaurant/Driver privileges are denied.
        </p>
      </div>
    );
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    if (user) {
      if (user.role === "restaurant") {
        navigate("/restaurant/dashboard", { replace: true });
        addToast("Welcome back, Kitchen Manager!", "success");
      } else if (user.role === "driver") {
        navigate("/delivery/dashboard", { replace: true });
        addToast("Ready for deliveries?", "success");
      } else if (user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
        addToast("Admin Control Center loaded", "info");
      }
    }
  }, [user?.id]); // only run once per user

  return null;
};

export function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#090d16] text-gray-100 selection:bg-brand-500 selection:text-white">
        <Navbar onOpenCart={() => setIsCartOpen(true)} />
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/restaurants" element={<Home />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />

            {/* Customer Routes */}
            <Route path="/customer/orders" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/customer/orders/:orderId" element={<ProtectedRoute><OrderTracker /></ProtectedRoute>} />
            <Route path="/customer/dashboard" element={<ProtectedRoute><CustomerDashboard /></ProtectedRoute>} />

            {/* Restaurant Portal */}
            <Route path="/restaurant/dashboard" element={<ProtectedRoute allowedRoles={["restaurant", "admin"]}><RestaurantDashboard /></ProtectedRoute>} />

            {/* Delivery Portal */}
            <Route path="/delivery/dashboard" element={<ProtectedRoute allowedRoles={["driver", "admin"]}><DeliveryDashboard /></ProtectedRoute>} />

            {/* Driver Profile */}
            <Route path="/delivery/profile" element={<ProtectedRoute allowedRoles={["driver", "admin"]}><DriverProfile /></ProtectedRoute>} />

            {/* Admin Portal */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Role-based redirect for root */}
            <Route path="/home" element={<RoleRedirect />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </Web3Provider>
  );
}
