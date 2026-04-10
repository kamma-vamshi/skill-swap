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
    <nav className="fixed top-2 md:top-4 left-0 right-0 md:left-1/2 md:-translate-x-1/2 w-full md:w-[95%] max-w-7xl z-50 px-3 md:px-0">
      <div className="glass-dark px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl flex justify-between items-center border border-white/10 shadow-2xl">
        
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => navigate("/dashboard")}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
            S
          </div>
          <h2 className="text-lg md:text-xl font-display font-bold tracking-tight">
            Skill<span className="gradient-text">Swap</span>
          </h2>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <FiUser className="text-purple-400" />
            <span className="text-xs md:text-sm font-medium text-gray-200 truncate max-w-[80px] md:max-w-none">
              {userInfo?.name || "User"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 md:p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 border border-red-500/20"
            title="Logout"
          >
            <FiLogOut className="size-4 md:size-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
