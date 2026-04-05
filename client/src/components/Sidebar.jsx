import { Link, useLocation } from "react-router-dom";
import { FiHome, FiUser, FiShoppingBag, FiMessageSquare, FiZap } from "react-icons/fi";

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: <FiHome /> },
    { name: "Requests", path: "/swaps", icon: <FiZap /> },
    { name: "Profile", path: "/profile", icon: <FiUser /> },
    { name: "Marketplace", path: "/marketplace", icon: <FiShoppingBag /> },
    { name: "Chat", path: "/chat", icon: <FiMessageSquare /> },
  ];

  return (
    <div className="h-full w-72 glass-dark border-r border-white/5 p-6 pt-24 hidden lg:block overflow-y-auto">
      
      <div className="mb-10 px-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          Navigation
        </h3>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                location.pathname === item.path
                  ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-purple-500/20 shadow-lg shadow-purple-500/5"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={`text-xl transition-transform duration-300 group-hover:scale-110 ${
                location.pathname === item.path ? "text-purple-400" : "text-gray-500 group-hover:text-purple-400"
              }`}>
                {item.icon}
              </span>
              <span className="font-medium tracking-wide">
                {item.name}
              </span>
              {location.pathname === item.path && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-glow" />
              )}
            </Link>
          ))}
        </nav>
      </div>

    </div>
  );
};

export default Sidebar;