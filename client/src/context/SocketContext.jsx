import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import socket from "../services/socket";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { userInfo } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Audio refs for consistent ringtone management
  const ringtoneRef = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_73145465e9.mp3"));

  useEffect(() => {
    ringtoneRef.current.loop = true;
  }, []);

  useEffect(() => {
    if (!userInfo?._id) {
      console.log("🚪 User logged out, skipping socket initialization");
      return;
    }

    console.log("🔌 [SOCKET_INIT] Global Listeners for:", userInfo.name);

    const handleConnect = () => {
      console.log("🟢 [SOCKET_CONNECT] Connected to server");
      setIsConnected(true);
      socket.emit("join", userInfo._id);
    };

    const handleDisconnect = () => {
      console.log("🔴 [SOCKET_DISCONNECT] Server connection lost");
      setIsConnected(false);
    };

    const handleIncomingCall = (data) => {
      console.log(`📞 [SIGNAL_INCOMING] Call ${data.callId} from ${data.callerName}`);
      
      // Auto-acknowledge to the server that we received it
      socket.emit("callAcknowledge", { to: data.from, callId: data.callId });

      setIncomingCall(data);
      ringtoneRef.current.play().catch(e => console.warn("🔊 Ringtone blocked by browser (User must interact with page first)"));
    };

    const handleCallEnded = () => {
      console.log("🏁 [SIGNAL_ENDED] Clearing active call UI");
      setIncomingCall(null);
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    };

    const handleOnlineUsers = (users) => {
      console.log("👥 [STATUS_UPDATE] Online Users:", users.length);
      setOnlineUsers(users);
    };

    const handleCallRejected = (data) => {
      console.log(`🚫 [SIGNAL_REJECTED] Call rejected: ${data.reason}`);
      // Usually useCall handles this, but we clean up global ringtone if needed
      if (incomingCall?.callId === data.callId) {
        setIncomingCall(null);
        ringtoneRef.current.pause();
      }
    };

    // Prevent duplicate listeners in React Strict Mode or fast re-renders
    socket.removeAllListeners("connect");
    socket.removeAllListeners("disconnect");
    socket.removeAllListeners("incomingCall");
    socket.removeAllListeners("callEnded");
    socket.removeAllListeners("onlineUsers");
    socket.removeAllListeners("callRejected");

    // Initialize
    if (socket.connected) handleConnect();

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("incomingCall", handleIncomingCall);
    socket.on("callEnded", handleCallEnded);
    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("callRejected", handleCallRejected);

    return () => {
      console.log("🧹 [SOCKET_CLEANUP] Removing Global Listeners");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callEnded", handleCallEnded);
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("callRejected", handleCallRejected);
    };
  }, [userInfo?._id, incomingCall?.callId]);

  const value = {
    socket,
    incomingCall,
    setIncomingCall,
    onlineUsers,
    isConnected,
    ringtone: ringtoneRef.current
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
