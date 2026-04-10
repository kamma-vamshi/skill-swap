import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FiSearch, FiRefreshCw, FiUser, FiCode, FiZap } from "react-icons/fi";

const Marketplace = () => {
  const { userInfo } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const { data } = await API.get("/users");
        setUsers(data.users || []);
      } catch (err) {
        console.error("Marketplace error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!userInfo || users.length === 0) return;
    const myWanted = userInfo.skillsWanted || [];
    const myOffered = userInfo.skillsOffered || [];

    const matches = users.map((user) => {
      // Ensure we don't match ourselves
      const isMe = user._id?.toString() === userInfo?._id?.toString();
      if (isMe) return null;

      const isPerfect = 
        user.skillsOffered?.some((skill) => myWanted.includes(skill)) &&
        user.skillsWanted?.some((skill) => myOffered.includes(skill));
      
      const isPartial = user.skillsOffered?.some((skill) => myWanted.includes(skill));
      
      return { ...user, isPerfect, isPartial };
    }).filter(user => user && (user.isPartial || user.isPerfect))
      .sort((a, b) => b.isPerfect - a.isPerfect);

    setFilteredUsers(matches);
  }, [users, userInfo]);

  const sendRequest = async (user) => {
    try {
      if (!userInfo) return;
      setSendingId(user._id);
      const myOffered = userInfo.skillsOffered || [];
      const myWanted = userInfo.skillsWanted || [];
      const offeredSkill = myOffered[0] || "General";
      const requestedSkill = user.skillsOffered?.find((skill) => myWanted.includes(skill)) || user.skillsOffered?.[0] || "General";

      await API.post("/swaps", {
        receiverId: user._id,
        skillOffered: offeredSkill,
        skillRequested: requestedSkill,
      });
      toast.success("Swap Request Sent 🔥");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed ❌");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-10 pb-20 pt-10">
        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div className="max-w-2xl">
            <h1 className="text-4xl font-display font-bold mb-3 tracking-tight">
              🌐 Skill <span className="gradient-text">Marketplace</span>
            </h1>
            <p className="text-gray-400 text-lg">
              Discover people who have the skills you're looking for. Based on your profile interests.
            </p>
          </div>
          
          <div className="relative group w-full md:w-80">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search skills..." 
              className="input !pl-12 bg-white/5 border-white/10 w-full"
            />
          </div>
        </motion.div>

        {/* CONTENT */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-gray-500 font-medium animate-pulse">Scanning the network...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center glass rounded-3xl border-dashed border-white/10"
          >
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-600 text-4xl">
              <FiZap />
            </div>
            <h3 className="text-xl font-bold mb-2">No direct matches found</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-8">
              We couldn't find anyone offering the skills you want. Try updating your profile or explore everyone.
            </p>
            <button className="btn primary px-8">Update My Skills</button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredUsers.map((user, idx) => (
              <motion.div
                key={user._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`card group hover:shadow-purple-500/5 ${user.isPerfect ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : ''}`}
              >
                <div className="flex items-start gap-4 mb-6 relative">
                  {user.isPerfect && (
                    <div className="absolute -top-3 -right-3 px-2 py-0.5 bg-purple-600 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg">
                      Perfect Match
                    </div>
                  )}
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl flex items-center justify-center text-2xl font-bold text-white border border-white/5 group-hover:scale-110 transition-transform duration-500">
                    {user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-display font-bold truncate group-hover:gradient-text transition-all">
                      {user.name}
                    </h2>
                    <p className="text-gray-500 text-sm truncate flex items-center gap-1">
                       <FiUser className="inline" size={12} /> {user.email}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <FiCode /> Expertise
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user.skillsOffered?.map((skill, i) => (
                        <span key={i} className="chip green uppercase">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2">
                      Seeking
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user.skillsWanted?.map((skill, i) => (
                        <span key={i} className="chip yellow uppercase">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => sendRequest(user)}
                  disabled={sendingId === user._id}
                  className="w-full btn primary py-3.5 group"
                >
                  {sendingId === user._id ? (
                    <FiRefreshCw className="animate-spin" />
                  ) : (
                    <>
                      <FiRefreshCw className="group-hover:rotate-180 transition-transform duration-500" />
                      <span>Request Swap</span>
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Marketplace;
