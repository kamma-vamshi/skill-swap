import { useEffect, useState, useRef } from "react";
import socket from "../../services/socket";
import { useAuth } from "../../context/AuthContext";
import { FiSend } from "react-icons/fi";
import { motion } from "framer-motion";

const ChatSection = ({ roomId, initialMessages }) => {
  const { userInfo } = useAuth();
  const [messages, setMessages] = useState(initialMessages || []);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState(null);
  const bottomRef = useRef();

  useEffect(() => {
    if (!roomId) return;

    socket.emit("joinClassroom", { roomId, userId: userInfo._id });

    socket.on("receiveRoomMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("roomTyping", ({ userName }) => {
      setTypingUser(userName);
    });

    socket.on("roomStopTyping", () => {
      setTypingUser(null);
    });

    return () => {
      socket.off("receiveRoomMessage");
      socket.off("roomTyping");
      socket.off("roomStopTyping");
    };
  }, [roomId, userInfo._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    socket.emit("sendRoomMessage", {
      roomId,
      senderId: userInfo._id,
      message: text,
      type: "text",
    });

    setText("");
    socket.emit("roomStopTyping", { roomId });
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (e.target.value.length > 0) {
      socket.emit("roomTyping", { roomId, userName: userInfo.name });
    } else {
      socket.emit("roomStopTyping", { roomId });
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* 🟢 HEADER */}
      <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h3 className="font-display font-bold text-lg tracking-tight">Classroom Chat</h3>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
           <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Live</span>
        </div>
      </div>

      {/* 💬 MESSAGES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => {
          const isMe = msg.senderId?._id === userInfo._id || msg.senderId === userInfo._id;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  isMe
                    ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg"
                    : "glass border border-white/10 text-gray-100"
                }`}
              >
                {!isMe && msg.senderId?.name && (
                  <p className="text-[10px] font-black uppercase tracking-tighter opacity-50 mb-1">
                    {msg.senderId.name}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{msg.message}</p>
                <p className="text-[10px] opacity-40 mt-2 text-right">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          );
        })}
        
        {typingUser && (
          <div className="flex justify-start">
             <div className="glass px-4 py-2 rounded-full text-[10px] text-purple-400 font-bold animate-pulse">
                {typingUser} is typing...
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ⌨️ INPUT */}
      <form onSubmit={handleSend} className="p-6 bg-black/20 border-t border-white/5 flex gap-3">
        <input
          type="text"
          value={text}
          onChange={handleTyping}
          placeholder="Discuss your goals..."
          className="flex-1 glass bg-white/5 border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl shadow-lg transition-all active:scale-90"
        >
          <FiSend size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatSection;
