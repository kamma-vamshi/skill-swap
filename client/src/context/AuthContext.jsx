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
      try {
        const stored = JSON.parse(localStorage.getItem("userInfo"));

        if (!stored) {
          setLoading(false);
          return;
        }

        // ✅ FIX: use API not api
        const { data } = await API.get("/users/profile");

        // ✅ Merge profile with stored info (to keep token!)
        setUserInfo({ ...stored, ...data });
        
        // 🔐 Ensure socket is aware of the token
        if (stored.token) updateSocketToken(stored.token);
      } catch (error) {
        console.log("❌ Token invalid");

        localStorage.removeItem("userInfo");
        setUserInfo(null);
      } finally {
        setLoading(false);
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
