import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FiClock, FiUsers, FiStar } from "react-icons/fi";
import socket from "../services/socket";

const Dashboard = () => {
  const { userInfo, loading, setUserInfo } = useAuth();
  const [users, setUsers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  // ================= SOCKET LISTENERS =================
  useEffect(() => {
    if (!userInfo?._id) return;

    socket.emit("join", userInfo._id);

    socket.on("swap_request", (newSwap) => {
      toast.success("New Swap Request! 📥");
    });

    socket.on("swap_update", ({ swap, message }) => {
      toast(message || "Swap updated! ✨", { icon: 'ℹ️' });
    });

    return () => {
      socket.off("swap_request");
      socket.off("swap_update");
    };
  }, [userInfo]);

  useEffect(() => {
    let isMounted = true;
    if (loading) return;
    if (!userInfo?.token) {
      setUsers([]);
      return;
    }

    const fetchData = async () => {
      try {
        const [, usersRes] = await Promise.all([
          API.get("/users/profile"),
          API.get("/users"),
          API.get("/swaps"),
        ]);
        if (!isMounted) return;
        setUsers(usersRes.data.users || []);
      } catch (err) {
        console.log("Dashboard error:", err.message);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [userInfo, loading]);

  const toggleFavorite = (user) => {
    const exists = favorites.find((f) => f._id === user._id);
    if (exists) {
      setFavorites((prev) => prev.filter((f) => f._id !== user._id));
    } else {
      setFavorites((prev) => [...prev, user]);
    }
  };

  const refreshData = async () => {
    try {
      setActionLoading("refreshing");
      const [profileRes] = await Promise.all([
        API.get("/users/profile"),
      ]);
      setUserInfo(prev => ({ ...prev, ...profileRes.data }));
      toast.success("Data refreshed! ✨");
    } catch (err) {
      toast.error("Failed to refresh data");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-12 pb-20 pt-10">
        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">
              Welcome Back, <span className="gradient-text">{userInfo?.name?.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-gray-400">
              Here's what's happening with your skill swaps today.
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={refreshData}
              disabled={actionLoading === "refreshing"}
              className={`glass px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2 hover:bg-white/5 transition-all ${actionLoading === "refreshing" ? 'opacity-50' : ''}`}
            >
              <FiClock className={`${actionLoading === "refreshing" ? 'animate-spin' : 'text-purple-400'}`} />
              <span className="text-sm font-medium">Refresh Sync</span>
            </button>
            <div className="glass px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
              <FiUsers className="text-pink-400" />
              <span className="text-sm font-medium">{users.length} Users</span>
            </div>
          </div>
        </motion.div>

        {/* FAVORITES */}
        {favorites.length > 0 && (
          <Section title="❤️ Favorites" icon={<FiStar className="text-pink-400" />}>
            {favorites.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                toggleFavorite={toggleFavorite}
                favorites={favorites}
              />
            ))}
          </Section>
        )}

        {/* ALL USERS */}
        <Section title="🌐 Community" icon={<FiUsers className="text-blue-400" />}>
          {users.length === 0 ? (
            <Empty text="The community is currently quiet..." />
          ) : (
            users.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                toggleFavorite={toggleFavorite}
                favorites={favorites}
              />
            ))
          )}
        </Section>
      </div>
    </Layout>
  );
};

/* ================= COMPONENTS ================= */

const Section = ({ title, icon, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
  >
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-xl">
        {icon}
      </div>
      <h2 className="text-2xl font-display font-bold tracking-tight">{title}</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </motion.div>
);

const Empty = ({ text }) => (
  <div className="col-span-full py-10 px-6 rounded-2xl border border-dashed border-white/10 flex items-center justify-center">
    <p className="text-gray-500 font-medium">{text}</p>
  </div>
);

const Chip = ({ children, color }) => (
  <span className={`chip ${color}`}>
    {children}
  </span>
);

const UserCard = ({ user, toggleFavorite, favorites }) => {
  const isFav = favorites.some((f) => f._id === user._id);

  return (
    <div className="card flex flex-col items-center text-center group">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4 flex items-center justify-center text-3xl font-bold border border-white/5 group-hover:scale-110 transition-transform duration-500">
        {user.name[0]}
      </div>
      <h3 className="font-display font-bold text-xl mb-1 group-hover:gradient-text transition-all duration-300">
        {user.name}
      </h3>
      <p className="text-gray-400 text-sm mb-2">{user.email}</p>
      
      {/* ⭐ RATING */}
      <div className="flex items-center gap-1.5 mb-4 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
        <FiStar className="text-yellow-500 fill-yellow-500 shadow-glow shadow-yellow-500/50" size={14} />
        <span className="text-xs font-bold text-gray-200">
          {user.averageRating ? user.averageRating.toFixed(1) : "No rating"}
        </span>
        <span className="text-[10px] text-gray-500 font-medium">
          ({user.totalReviews || 0})
        </span>
      </div>

      <div className="mt-auto w-full">
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {user.skillsOffered?.slice(0, 3).map((s, i) => (
            <Chip key={i} color="green">
              {s}
            </Chip>
          ))}
          {user.skillsOffered?.length > 3 && (
            <span className="text-[10px] text-gray-500 font-bold">+{user.skillsOffered.length - 3} MORE</span>
          )}
        </div>

        <button
          onClick={() => toggleFavorite(user)}
          className={`w-full btn ${isFav ? 'red' : 'outline'} py-2 text-sm flex items-center justify-center gap-2`}
        >
          <FiStar className={isFav ? 'fill-current' : ''} />
          {isFav ? "Favorited" : "Add to Favorites"}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;