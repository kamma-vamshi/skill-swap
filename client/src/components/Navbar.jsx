import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiLogOut, FiUser } from "react-icons/fi";

const Navbar = () => {
  const navigate = useNavigate();
  const { logout, userInfo } = useAuth();

  const handleLogout = () => {
    logout();
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 50);
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50">
      <div className="glass-dark px-6 py-3 rounded-2xl flex justify-between items-center border border-white/10 shadow-2xl">
        
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => navigate("/dashboard")}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
            S
          </div>
          <h2 className="text-xl font-display font-bold tracking-tight">
            Skill<span className="gradient-text">Swap</span>
          </h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <FiUser className="text-purple-400" />
            <span className="text-sm font-medium text-gray-200">
              {userInfo?.name || "User"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 border border-red-500/20"
            title="Logout"
          >
            <FiLogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;