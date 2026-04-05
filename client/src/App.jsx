import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Marketplace from "./pages/Marketplace";
import ChatPage from "./pages/ChatPage";
import SwapRequests from "./pages/SwapRequests";

// 🔥 NEW IMPORTS (CALL FEATURES)
import Call from "./components/Call";
import GroupCall from "./components/GroupCall";
import NotificationManager from "./components/NotificationManager";
import SwapRoom from "./pages/SwapRoom";

// ================= PRIVATE ROUTE =================
const PrivateRoute = ({ children }) => {
  const { userInfo, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return userInfo ? children : <Navigate to="/login" replace />;
};

// ================= PUBLIC ROUTE =================
const PublicRoute = ({ children }) => {
  const { userInfo, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return !userInfo ? children : <Navigate to="/dashboard" replace />;
};

// ================= APP =================
function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Router>
        <AuthProvider>
          <NotificationManager>
            <Routes>
              {/* ================= AUTH ================= */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                }
              />

              {/* ================= PROTECTED ROUTES ================= */}

              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />

              <Route
                path="/marketplace"
                element={
                  <PrivateRoute>
                    <Marketplace />
                  </PrivateRoute>
                }
              />

              {/* ================= SWAPS ================= */}
              <Route
                path="/swaps"
                element={
                  <PrivateRoute>
                    <SwapRequests />
                  </PrivateRoute>
                }
              />

              {/* ================= CHAT ================= */}
              <Route
                path="/chat"
                element={
                  <PrivateRoute>
                    <ChatPage />
                  </PrivateRoute>
                }
              />

              {/* ================= 🔥 VIDEO CALL ================= */}
              <Route
                path="/call"
                element={
                  <PrivateRoute>
                    <Call />
                  </PrivateRoute>
                }
              />

              {/* ================= 🔥 GROUP CALL ================= */}
              <Route
                path="/group-call"
                element={
                  <PrivateRoute>
                    <GroupCall roomId="skillswap-room" />
                  </PrivateRoute>
                }
              />

              {/* ================= 🏫 SWAP CLASSROOM ================= */}
              <Route
                path="/swap-room/:id"
                element={
                  <PrivateRoute>
                    <SwapRoom />
                  </PrivateRoute>
                }
              />

              {/* ================= DEFAULT ================= */}
              <Route path="*" element={<Navigate to="/login" />} />

            </Routes>
          </NotificationManager>
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;