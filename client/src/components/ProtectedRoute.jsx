import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { userInfo, loading } = useAuth();

  if (loading) return <p className="text-white p-5">Checking auth...</p>;

  if (!userInfo?.token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;