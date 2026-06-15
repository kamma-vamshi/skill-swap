import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api"; // ✅ correct import
import { updateSocketToken } from "../services/socket"; // 🔐 Correct import

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ================= INIT AUTH =================
  useEffect(() => {
    const initAuth = async () => {
      console.log("🚀 [AUTH_INIT] Checking session...");
      const authTimeout = setTimeout(() => {
        console.warn("⚠️ [AUTH_TIMEOUT] Profile request taking too long, forcing loading to false");
        setLoading(false);
      }, 10000);

      try {
        const stored = JSON.parse(localStorage.getItem("userInfo"));

        if (!stored) {
          console.log("ℹ️ [AUTH_INIT] No stored session found");
          setLoading(false);
          clearTimeout(authTimeout);
          return;
        }

        console.log("📡 [AUTH_INIT] Verifying token with backend...");
        const { data } = await API.get("/users/profile");

        console.log("✅ [AUTH_INIT] Session verified for:", data.name);
        setUserInfo({ ...stored, ...data });
        if (stored.token) updateSocketToken(stored.token);
      } catch (error) {
        console.error("❌ [AUTH_INIT] Session verification failed:", error.message);
        localStorage.removeItem("userInfo");
        setUserInfo(null);
      } finally {
        setLoading(false);
        clearTimeout(authTimeout);
      }
    };

    initAuth();
  }, []);

  // ================= LOGIN =================
  const login = useCallback((data) => {
    localStorage.setItem("userInfo", JSON.stringify(data));
    setUserInfo(data);
    
    // 🔐 🚀 Update socket token for immediate secure connection
    if (data.token) {
      updateSocketToken(data.token);
    }
  }, []);

  // ================= LOGOUT =================
  const logout = useCallback(() => {
    console.log("🚪 Logging out");

    localStorage.removeItem("userInfo");
    setUserInfo(null);
    navigate("/login");
  }, [navigate]);

  const authValue = useMemo(() => ({
    userInfo, 
    setUserInfo, 
    login, 
    logout, 
    loading 
  }), [userInfo, loading, login, logout]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);