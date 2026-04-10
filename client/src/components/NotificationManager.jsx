import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiPhoneCall, FiX, FiMessageCircle, FiZap, FiPhone } from "react-icons/fi";

const NotificationManager = ({ children }) => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [incomingCall, setIncomingCall] = useState(null);
  const locationRef = useRef(location);
  
  // Audio Refs
  const ringtoneRef = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_73145465e9.mp3"));
  const pingRef = useRef(new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3"));

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    // Setup Audio
    ringtoneRef.current.loop = true;
    
    if (!userInfo?._id) return;

    // 🚀 STABILIZATION: Join room once on mount/auth
    console.log(`📡 Signaling initialized for user: ${userInfo._id}`);
    socket.emit("join", userInfo._id);

    // 📩 MESSAGE NOTIFICATION
    const handleMessage = (msg) => {
      const isInChat = locationRef.current.pathname === "/chat"; 
      if (!isInChat) {
        pingRef.current.play().catch(() => {});
        toast(`${msg.senderName || "New Message"}: ${msg.text.substring(0, 30)}...`, {
          icon: <FiMessageCircle className="text-purple-500" />,
          onClick: () => navigate("/chat"),
        });
      }
    };

    // 🤝 SWAP REQUEST NOTIFICATION
    const handleSwapRequest = (swap) => {
      pingRef.current.play().catch(() => {});
      toast(`New Swap Request from ${swap.senderName || "someone"}!`, {
        icon: <FiZap className="text-yellow-500" />,
        onClick: () => navigate("/swaps"),
      });
    };

    // 📞 GLOBAL INCOMING CALL
    const handleIncomingCall = (data) => {
      console.log("☎️ SIGNAL RECEIVED: incomingCall", data);
      if (locationRef.current.pathname === "/call") return;

      setIncomingCall(data);
      ringtoneRef.current.play().catch(() => console.warn("Ringtone blocked"));
    };

    const handleCallEnded = () => {
      console.log("☎️ SIGNAL RECEIVED: callEnded");
      setIncomingCall(null);
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    };

    socket.on("receiveMessage", handleMessage);
    socket.on("swap_request", handleSwapRequest);
    socket.on("incomingCall", handleIncomingCall);
    socket.on("callEnded", handleCallEnded);

    return () => {
      console.log("🧹 Cleaning up signaling listeners");
      socket.off("receiveMessage", handleMessage);
      socket.off("swap_request", handleSwapRequest);
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callEnded", handleCallEnded);
    };
  }, [userInfo?._id, navigate]);

  const acceptCall = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    const callData = incomingCall;
    setIncomingCall(null);
    navigate("/call", { 
      state: { 
        incomingCallData: callData,
        selectedUser: { _id: callData.from, name: callData.callerName }
      } 
    });
  };

  const rejectCall = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    socket.emit("rejectCall", { to: incomingCall.from });
    setIncomingCall(null);
  };

  return (
    <>
      {children}

      {/* GLOBAL INCOMING CALL MODAL */}
      <AnimatePresence>
        {incomingCall && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl w-[90%] max-w-sm text-center"
            >
              <div className="relative mb-6 md:mb-8">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl md:rounded-[2rem] mx-auto flex items-center justify-center text-3xl md:text-4xl font-bold text-white shadow-2xl animate-pulse">
                  {incomingCall.callerName?.[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-8 h-8 md:w-10 md:h-10 bg-green-500 rounded-xl md:rounded-2xl flex items-center justify-center border-4 border-[#020617] text-white animate-bounce">
                  <FiPhone size={16} className="md:size-20" />
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-display font-bold mb-1 md:mb-2 text-white">Incoming Call</h2>
              <p className="text-gray-400 mb-8 md:mb-10 font-medium text-sm md:text-base">{incomingCall.callerName} is calling you...</p>

              <div className="flex flex-col gap-3 md:gap-4">
                <button
                  onClick={acceptCall}
                  className="btn primary py-4 text-base md:text-lg w-full flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 rounded-2xl"
                >
                  <FiPhoneCall /> Accept Call
                </button>
                <button
                  onClick={rejectCall}
                  className="btn outline border-white/10 text-red-400 hover:bg-red-500/10 py-4 w-full flex items-center justify-center gap-3 rounded-2xl"
                >
                  <FiX /> Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NotificationManager;
