import { Server } from "socket.io";
import Message from "../models/Message.js";
import RoomMessage from "../models/RoomMessage.js";
import SwapRoom from "../models/SwapRoom.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

let io;

// 🟢 Track online users
const onlineUsers = new Map();
// 🏫 Track classroom presence (roomId -> Set of userIds)
const roomPresence = new Map();
// 📞 Track active calls (userId -> partnerUserId)
const activeCalls = new Map();
// ❄️ Buffer ICE candidates until the receiver is ready (callId -> Array<{candidate, to}>)
const pendingIceCandidates = new Map();
// ✅ Track calls where the receiver has signaled readiness
const readyCalls = new Set();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // 🚀 Force WebSocket for better performance
  });

  // 🔐 Authentication Middleware (Loosened to allow initial connection)
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    // If no token, allow connection but without .user property
    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET || "secret_key", (err, decoded) => {
      if (err) {
        console.warn("⚠️ Socket Auth Failed:", err.message);
        return next(); // Still allow connection, just unauthenticated
      }
      socket.user = decoded; // Attach user info to socket
      next();
    });
  });

  io.on("connection", (socket) => {
    let currentUserId = null;

    // ===============================
    // 🔗 JOIN (GLOBAL USER JOIN)
    // ===============================
    socket.on("join", (userId) => {
      if (!userId) return;
      console.log(`👤 User Online: ${userId} (Socket: ${socket.id})`);
      currentUserId = userId;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);

      // Notify others of online status
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // 🔐 SECURE ICE CONFIG
    socket.on("getIceConfigs", () => {
      const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ];
      if (process.env.TURN_URL) {
        iceServers.push({
          urls: [`turns:${process.env.TURN_URL}:443?transport=tcp`, `turn:${process.env.TURN_URL}:443`],
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_PASSWORD,
        });
      }
      socket.emit("iceConfigs", { iceServers });
    });

    // ===============================
    // 🔥 SWAP EVENTS
    // ===============================
    socket.on("swap_request", ({ receiverId, swap }) => {
      if (!receiverId) return;
      io.to(receiverId).emit("swap_request", swap);
    });

    socket.on("swap_update", ({ senderId, swap, message }) => {
      if (!senderId) return;
      io.to(senderId).emit("swap_update", { swap, message });
    });

    // ===============================
    // 💬 SEND MESSAGE
    // ===============================
    socket.on("sendMessage", async (data) => {
      try {
        const { sender, receiver, text, image } = data;
        if (!sender || !receiver || (!text && !image)) return;
        let status = onlineUsers.has(receiver) ? "delivered" : "sent";
        const newMessage = await Message.create({ sender, receiver, text, image, status });
        io.to(receiver).emit("receiveMessage", newMessage);
        io.to(sender).emit("messageStatusUpdate", newMessage);
      } catch (err) {
        console.error("❌ Message Error:", err.message);
      }
    });

    socket.on("typing", ({ sender, receiver }) => {
      if (!receiver) return;
      io.to(receiver).emit("typing", sender);
    });

    socket.on("stopTyping", ({ sender, receiver }) => {
      if (!receiver) return;
      io.to(receiver).emit("stopTyping", sender);
    });

    socket.on("markSeen", async ({ sender, receiver }) => {
      if (!sender || !receiver) return;
      await Message.updateMany({ sender, receiver, status: { $ne: "seen" } }, { status: "seen" });
      io.to(sender).emit("messagesSeen", { receiver });
    });

    // ===============================
    // 🧑‍🤝‍🧑 GROUP CALL (ROOM BASED)
    // ===============================
    socket.on("joinRoom", ({ roomId, userId }) => {
      if (!roomId) return;
      socket.join(roomId);
      const room = io.sockets.adapter.rooms.get(roomId) || new Set();
      socket.to(roomId).emit("userJoined", { userId, socketId: socket.id });
      socket.emit("existingUsers", Array.from(room));
    });

    socket.on("offer", ({ to, offer }) => {
      if (!to) return;
      io.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ to, answer }) => {
      if (!to) return;
      io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("iceCandidateRoom", ({ to, candidate }) => {
      if (!to) return;
      io.to(to).emit("iceCandidateRoom", { candidate, from: socket.id });
    });

    // ===============================
    // 🏫 SWAP CLASSROOM EVENTS
    // ===============================
    socket.on("joinClassroom", ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      socket.join(roomId);
      if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Set());
      roomPresence.get(roomId).add(userId);
      io.to(roomId).emit("presenceUpdate", Array.from(roomPresence.get(roomId)));
    });

    socket.on("leaveClassroom", ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      socket.leave(roomId);
      if (roomPresence.has(roomId)) {
        roomPresence.get(roomId).delete(userId);
        io.to(roomId).emit("presenceUpdate", Array.from(roomPresence.get(roomId)));
      }
    });

    socket.on("sendRoomMessage", async (data) => {
      try {
        const { roomId, senderId, message, type, fileUrl } = data;
        if (!roomId || !senderId || !message) return;
        const newMessage = await RoomMessage.create({ roomId, senderId, message, type: type || "text", fileUrl });
        const populated = await RoomMessage.findById(newMessage._id).populate("senderId", "name profilePic");
        io.to(roomId).emit("receiveRoomMessage", populated);
      } catch (err) {
        console.error("❌ Room Message Error:", err.message);
      }
    });

    socket.on("roomTyping", ({ roomId, userName }) => {
      if (!roomId) return;
      socket.to(roomId).emit("roomTyping", { userName });
    });

    socket.on("roomStopTyping", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("roomStopTyping");
    });

    // ===============================
    // 📞 1-TO-1 CALL SIGNALING (Overhauled)
    // ===============================
    socket.on("callUser", ({ to, from, callerName, offer, callId }) => {
      if (!to || !callId) return;
      
      console.log(`\n📞 [CALL_INIT] ${callId}: ${from} -> ${to}`);

      // 1. Check if recipient is in their private room
      const recipientRoom = io.sockets.adapter.rooms.get(to);
      const isOnline = recipientRoom && recipientRoom.size > 0;

      if (!isOnline) {
        console.log(`❌ [CALL_FAILED] Recipient ${to} is offline`);
        return io.to(socket.id).emit("callRejected", { callId, reason: "offline" });
      }

      // 2. Check if recipient is busy
      if (activeCalls.has(to)) {
        console.log(`🚫 [CALL_FAILED] Recipient ${to} is busy`);
        return io.to(socket.id).emit("callRejected", { callId, reason: "busy" });
      }

      // 3. Initialize ICE candidate buffer for this call
      pendingIceCandidates.set(callId, []);
      readyCalls.delete(callId); // Ensure clean state
      console.log(`❄️ [ICE_BUFFER] Initialized buffer for call ${callId}`);

      // 4. Dispatch Instant Signal
      console.log(`🚀 [CALL_DISPATCH] Sending incomingCall to ${to}`);
      io.to(to).emit("incomingCall", { from, callerName, offer, callId, sentAt: Date.now() });
      
      // Notify caller that we are trying to reach them
      io.to(socket.id).emit("callWaiting", { callId });
    });

    socket.on("callAcknowledge", ({ to, callId }) => {
      if (!to || !callId) return;
      console.log(`🔔 [CALL_ACK] ${callId} acknowledged by recipient`);
      io.to(to).emit("callRinging", { callId });
    });

    socket.on("acceptCall", ({ to, answer, callId }) => {
      if (!to || !callId) return;
      console.log(`✅ [CALL_ACCEPT] ${callId}: User accepted`);

      activeCalls.set(currentUserId, { to, callId });
      activeCalls.set(to, { to: currentUserId, callId });

      io.to(to).emit("callAccepted", { answer, callId });
    });

    // 📞 Receiver signals they are ready to receive ICE candidates
    socket.on("callReady", ({ callId, to }) => {
      if (!callId) return;
      console.log(`🟢 [CALL_READY] ${callId}: Receiver is ready, flushing ICE buffer`);

      // Mark this call as ready so future candidates forward directly
      readyCalls.add(callId);

      // Flush all buffered ICE candidates to the receiver
      const buffered = pendingIceCandidates.get(callId) || [];
      console.log(`❄️ [ICE_FLUSH] Sending ${buffered.length} buffered candidates for ${callId}`);
      for (const entry of buffered) {
        io.to(entry.to).emit("iceCandidate", { candidate: entry.candidate, callId });
      }
      pendingIceCandidates.delete(callId);

      // Also notify the caller so they know receiver is processing
      if (to) {
        io.to(to).emit("callReady", { callId });
      }
    });

    socket.on("rejectCall", ({ to, callId }) => {
      if (!to || !callId) return;
      console.log(`🚫 [CALL_REJECT] ${callId}`);
      // Clean up ICE buffers
      pendingIceCandidates.delete(callId);
      readyCalls.delete(callId);
      io.to(to).emit("callRejected", { callId, reason: "rejected" });
    });

    socket.on("iceCandidate", ({ to, candidate, callId }) => {
      if (!to || !callId) return;

      // If receiver has signaled ready OR buffer doesn't exist, forward directly
      if (readyCalls.has(callId) || !pendingIceCandidates.has(callId)) {
        console.log(`❄️ [ICE_FORWARD] Forwarding candidate for ${callId} to ${to}`);
        io.to(to).emit("iceCandidate", { candidate, callId });
      } else {
        // Buffer the candidate until the receiver is ready
        pendingIceCandidates.get(callId).push({ candidate, to });
        console.log(`❄️ [ICE_BUFFER] Buffered candidate for ${callId} (total: ${pendingIceCandidates.get(callId).length})`);
      }
    });

    socket.on("endCall", ({ to, callId }) => {
      if (!to) return;
      console.log(`🏁 [CALL_END] ${callId}`);

      activeCalls.delete(currentUserId);
      activeCalls.delete(to);

      // Clean up ICE buffers
      if (callId) {
        pendingIceCandidates.delete(callId);
        readyCalls.delete(callId);
      }

      io.to(to).emit("callEnded", { callId });
    });



    // ===============================
    // ❌ DISCONNECT
    // ===============================
    socket.on("disconnect", () => {
      if (currentUserId) {
        // 🧹 Cleanup active calls on abrupt disconnect
        if (activeCalls.has(currentUserId)) {
          const activeCallData = activeCalls.get(currentUserId);
          const partnerId = activeCallData.to;
          io.to(partnerId).emit("callEnded", { callId: activeCallData.callId });

          // Clean up ICE buffers for this call
          pendingIceCandidates.delete(activeCallData.callId);
          readyCalls.delete(activeCallData.callId);

          activeCalls.delete(partnerId);
          activeCalls.delete(currentUserId);
        }

        // 🗑️ Cleanup pending calls where this user was the CALLER
        for (let [recipientId, signalData] of pendingCalls.entries()) {
          if (signalData.from === currentUserId) {
            console.log(`🗑️ Removing pending signal to ${recipientId} (Caller disconnected)`);
            pendingCalls.delete(recipientId);
          }
        }

        onlineUsers.delete(currentUserId);

        // Remove from all rooms
        for (let [roomId, presence] of roomPresence.entries()) {
          if (presence.has(currentUserId)) {
            presence.delete(currentUserId);
            io.to(roomId).emit("presenceUpdate", Array.from(presence));
          }
        }
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });
  });
};

// ===============================
// 🔥 EXPORT HELPERS
// ===============================
export const emitSwapRequest = (senderId, receiverId, swap) => {
  if (io) {
    if (receiverId) io.to(receiverId).emit("swap_request", swap);
    if (senderId) io.to(senderId).emit("swap_request", swap);
  }
};

export const emitSwapUpdate = (senderId, swap, message) => {
  if (io && senderId) {
    io.to(senderId).emit("swap_update", { swap, message });
  }
};

export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};
