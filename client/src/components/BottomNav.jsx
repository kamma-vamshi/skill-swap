import { Link, useLocation } from "react-router-dom";
import { FiHome, FiUser, FiShoppingBag, FiMessageSquare, FiZap } from "react-icons/fi";

const BottomNav = () => {
  const location = useLocation();

  const menuItems = [
    { name: "Home", path: "/dashboard", icon: <FiHome /> },
    { name: "Swaps", path: "/swaps", icon: <FiZap /> },
    { name: "Market", path: "/marketplace", icon: <FiShoppingBag /> },
    { name: "Chat", path: "/chat", icon: <FiMessageSquare /> },
    { name: "Profile", path: "/profile", icon: <FiUser /> },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#020617]/80 backdrop-blur-xl border-t border-white/5 px-4 pb-6 pt-3 shadow-[0_-10px_20px_rgba(0,0,0,0.4)]">
      <nav className="flex justify-between items-center max-w-md mx-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                isActive ? "text-purple-400 scale-110" : "text-gray-500 hover:text-white"
              }`}
            >
              <span className={`text-2xl ${isActive ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" : ""}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? "opacity-100" : "opacity-60"}`}>
                {item.name}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-purple-500 mt-0.5 shadow-[0_0_8px_rgb(168,85,247)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
