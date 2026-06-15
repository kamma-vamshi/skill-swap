import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

import React, { Suspense } from "react";
import Auth from "./pages/Auth";
import NotificationManager from "./components/NotificationManager";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Marketplace = React.lazy(() => import("./pages/Marketplace"));
const ChatPage = React.lazy(() => import("./pages/ChatPage"));
const SwapRequests = React.lazy(() => import("./pages/SwapRequests"));
const Call = React.lazy(() => import("./components/Call"));
const GroupCall = React.lazy(() => import("./components/GroupCall"));
const SwapRoom = React.lazy(() => import("./pages/SwapRoom"));

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
          <SocketProvider>
            <NotificationManager>
              <Suspense fallback={<div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>}>
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
              </Suspense>
            </NotificationManager>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;