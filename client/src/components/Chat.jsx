import { useEffect, useState, useRef } from "react";
import socket from "../services/socket";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiVideo, FiPaperclip, FiSend, FiCheck, FiCheckCircle, FiArrowLeft } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const Chat = ({ selectedUser, onBack }) => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const fileInputRef = useRef();
  const bottomRef = useRef();

  // ================= SOCKET =================
  useEffect(() => {
    if (!userInfo) return;
    socket.emit("join", userInfo._id);
    socket.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("messageStatusUpdate", (msg) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    });
    socket.on("typing", () => setTyping(true));
    socket.on("stopTyping", () => setTyping(false));
    socket.on("onlineUsers", setOnlineUsers);
    socket.on("messagesSeen", ({ receiver }) => {
      setMessages((prev) =>
        prev.map((m) => m.receiver === receiver ? { ...m, status: "seen" } : m)
      );
    });
    return () => socket.off();
  }, [userInfo]);

  // ================= FETCH =================
  useEffect(() => {
    if (!selectedUser || !userInfo) return;
    const fetchMessages = async () => {
      const res = await API.get(`/chat/${selectedUser._id}`);
      setMessages(res.data);
      socket.emit("markSeen", {
        sender: selectedUser._id,
        receiver: userInfo._id,
      });
    };
    fetchMessages();
  }, [selectedUser, userInfo]);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("sendMessage", {
      sender: userInfo._id,
      receiver: selectedUser._id,
      text,
    });
    setMessages((prev) => [
      ...prev,
      { text, sender: userInfo._id, status: "sent", createdAt: new Date() },
    ]);
    setText("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await API.post("/upload", formData);
    socket.emit("sendMessage", {
      sender: userInfo._id,
      receiver: selectedUser._id,
      image: res.data.image,
    });
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", {
      sender: userInfo._id,
      receiver: selectedUser._id,
    });
    setTimeout(() => {
      socket.emit("stopTyping", {
        sender: userInfo._id,
        receiver: selectedUser._id,
      });
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* HEADER */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile Back Button */}
          <button 
            onClick={onBack}
            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <FiArrowLeft size={24} />
          </button>

          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg border border-white/10">
            {selectedUser.name[0]}
          </div>
          <div>
            <p className="font-display font-bold text-base md:text-lg text-white truncate max-w-[120px] md:max-w-none">
              {selectedUser.name}
            </p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${onlineUsers.includes(selectedUser._id) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate("/call", { state: { selectedUser, autoCall: true } })}
          className="btn outline p-3 rounded-xl hover:bg-purple-500 hover:text-white border-white/10 text-purple-400 group"
        >
          <FiVideo size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const isMe = m.sender === userInfo._id;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] space-y-1`}>
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-xl ${
                      isMe
                        ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-tr-none"
                        : "glass text-white rounded-tl-none border-white/10"
                    }`}
                  >
                    {m.text && <p className="text-sm leading-relaxed">{m.text}</p>}
                    {m.image && (
                      <img
                        src={m.image}
                        alt="chat media"
                        className="w-64 rounded-xl mt-2 border border-white/10 shadow-lg cursor-zoom-in"
                      />
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-tighter ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span>
                      {new Date(m.createdAt || Date.now()).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMe && (
                      <span className="flex items-center gap-0.5">
                        {m.status === "seen" ? (
                          <FiCheckCircle className="text-pink-400" />
                        ) : (
                          <FiCheck />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-center text-gray-500">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{selectedUser.name} is typing</span>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-white/[0.02] border-t border-white/5 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => fileInputRef.current.click()}
            className="p-3 text-gray-500 hover:text-white transition-colors"
          >
            <FiPaperclip size={20} />
          </button>
          
          <div className="relative flex-1 group">
            <input
              value={text}
              onChange={handleTyping}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="input pr-12"
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                text.trim() ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <FiSend size={18} />
            </button>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            hidden
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
