import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import Chat from "../components/Chat";
import { motion } from "framer-motion";
import { FiUsers, FiMessageCircle } from "react-icons/fi";

const ChatPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await API.get("/users");
        setUsers(data.users || []);
      } catch (err) {
        console.error("Chat fetch error:", err);
      }
    };
    fetchUsers();
  }, []);

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] md:h-[calc(100vh-120px)] mt-4 md:mt-6 gap-4 md:gap-6 px-4 md:px-0 overflow-hidden">
        {/* LEFT USERS - Hidden on mobile if a user is selected */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`w-full lg:w-80 glass rounded-[2rem] md:rounded-3xl border border-white/5 flex flex-col overflow-hidden ${
            selectedUser ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="p-5 md:p-6 border-b border-white/5 bg-white/[0.02]">
            <h2 className="text-lg md:text-xl font-display font-bold flex items-center gap-2 text-white">
              <FiUsers className="text-purple-500" />
              Contacts
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {users.length > 0 ? users.map((u) => (
              <button
                key={u._id}
                onClick={() => setSelectedUser(u)}
                className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-2xl transition-all duration-300 ${
                  selectedUser?._id === u._id 
                    ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/10 shadow-lg" 
                    : "hover:bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
                  selectedUser?._id === u._id ? "bg-purple-600" : "bg-white/5"
                }`}>
                  {u.name[0]}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="font-bold truncate text-sm md:text-base">{u.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Active</p>
                </div>
              </button>
            )) : (
              <div className="p-4 text-center text-gray-500 text-sm">No contacts found</div>
            )}
          </div>
        </motion.div>

        {/* RIGHT CHAT - Shown on mobile only if a user is selected */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex-1 glass rounded-[2rem] md:rounded-3xl border border-white/5 overflow-hidden flex flex-col relative ${
            !selectedUser ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedUser ? (
            <Chat selectedUser={selectedUser} onBack={() => setSelectedUser(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-gray-700 text-3xl md:text-4xl">
                <FiMessageCircle />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-2 text-white">Select a Conversation</h3>
              <p className="text-gray-500 max-w-xs text-sm md:text-base">
                Pick a contact from the left list to start a real-time conversation.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default ChatPage;
