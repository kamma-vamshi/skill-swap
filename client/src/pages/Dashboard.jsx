import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FiClock, FiUsers, FiStar } from "react-icons/fi";
import socket from "../services/socket";
import UserCard from "../components/UserCard";

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

export default Dashboard;
