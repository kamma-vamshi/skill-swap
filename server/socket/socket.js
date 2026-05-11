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
// ⏳ Store signals for users who aren't in their room yet (userId -> signalData)
const pendingCalls = new Map();

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
      console.log(`👤 User Joined: ${userId} (Socket: ${socket.id})`);
      currentUserId = userId;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);

      // 🚀 RESTORATIVE SIGNALING: Push pending calls on join
      if (pendingCalls.has(userId)) {
        const callData = pendingCalls.get(userId);

        // 🔍 VALIDATION: Only push if caller is STILL ONLINE and call is fresh
        const callerSocketId = onlineUsers.get(callData.from);
        const age = Date.now() - callData.sentAt;

        if (callerSocketId && age < 15000) {
          console.log(`📡 Pushing validated pending call to ${userId} (Age: ${age}ms)`);
          io.to(userId).emit("incomingCall", callData);
        } else {
          console.warn(`🗑️ Discarding invalid/stale pending call for ${userId}`);
        }
        pendingCalls.delete(userId);
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // 🔐 SECURE ICE CONFIG: Serve TURN credentials from backend env
    socket.on("getIceConfigs", () => {
      const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ];

      if (process.env.TURN_URL) {
        iceServers.push({
          urls: [
            `turns:${process.env.TURN_URL}:443?transport=tcp`,
            `turn:${process.env.TURN_URL}:443`,
            `turn:${process.env.TURN_URL}:80`,
          ],
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

        let status = "sent";

        if (onlineUsers.has(receiver)) {
          status = "delivered";
        }

        const newMessage = await Message.create({
          sender,
          receiver,
          text,
          image,
          status,
        });

        io.to(receiver).emit("receiveMessage", newMessage);
        io.to(sender).emit("messageStatusUpdate", newMessage);
      } catch (err) {
        console.error("❌ Message Error:", err.message);
      }
    });

    // ===============================
    // ✍️ TYPING
    // ===============================
    socket.on("typing", ({ sender, receiver }) => {
      if (!receiver) return;
      io.to(receiver).emit("typing", sender);
    });

    socket.on("stopTyping", ({ sender, receiver }) => {
      if (!receiver) return;
      io.to(receiver).emit("stopTyping", sender);
    });

    // ===============================
    // 👁️ SEEN
    // ===============================
    socket.on("markSeen", async ({ sender, receiver }) => {
      if (!sender || !receiver) return;

      await Message.updateMany(
        { sender, receiver, status: { $ne: "seen" } },
        { status: "seen" }
      );

      io.to(sender).emit("messagesSeen", { receiver });
    });

    // ===============================
    // 📞 1-TO-1 CALL SIGNALING
    // ===============================
    socket.on("callUser", ({ to, from, callerName, offer, callId }) => {
      if (!to || !callId) return;
      const sentAt = Date.now();
      console.log(`📞 Call Request [${callId}]: ${from} -> ${to}`);

      const recipientRoom = io.sockets.adapter.rooms.get(to);
      const recipientCount = recipientRoom ? recipientRoom.size : 0;

      // 🚨 BUSY CHECK
      if (activeCalls.has(to)) {
        console.log(`🚫 BUSY: ${to}`);
        return io.to(from).emit("callRejected", { callId, reason: "busy" });
      }

      const signalData = { from, callerName, offer, callId, sentAt };

      if (recipientCount === 0) {
        console.warn(`⏳ PARKING: ${to} is offline. Buffering signal...`);
        pendingCalls.set(to, signalData);
        // Inform caller that we're waiting for the peer to "wake up"
        io.to(from).emit("callWaiting", { callId });
      } else {
        // ✅ Direct delivery
        io.to(to).emit("incomingCall", signalData);
        io.to(from).emit("callRinging", { callId });
      }
    });

    socket.on("callAcknowledge", ({ to, callId }) => {
      if (!to || !callId) return;
      console.log(`🔔 ACK RECEIVED [${callId}] by recipient`);
      io.to(to).emit("callRinging", { callId });
    });

    socket.on("acceptCall", ({ to, answer, callId }) => {
      if (!to || !currentUserId || !callId) return;
      console.log(`✅ ACCEPTED [${callId}]: ${currentUserId} -> ${to}`);

      pendingCalls.delete(currentUserId);
      activeCalls.set(currentUserId, { to, callId });
      activeCalls.set(to, { to: currentUserId, callId });

      io.to(to).emit("callAccepted", { answer, callId });
    });

    socket.on("rejectCall", ({ to, callId }) => {
      if (!to || !callId) return;
      console.log(`🚫 REJECTED [${callId}]`);
      io.to(to).emit("callRejected", { callId });
    });

    socket.on("iceCandidate", ({ to, candidate, callId }) => {
      if (!to || !callId) return;
      io.to(to).emit("iceCandidate", { candidate, callId });
    });

    socket.on("endCall", ({ to, callId }) => {
      if (!to || !currentUserId) return;
      console.log(`📞 ENDED [${callId}]`);

      activeCalls.delete(currentUserId);
      activeCalls.delete(to);

      // Cleanup any parked signals regarding these users
      pendingCalls.delete(to);
      pendingCalls.delete(currentUserId);

      io.to(to).emit("callEnded", { callId });
    });

    // ===============================
    // 🧑‍🤝‍🧑 GROUP CALL (ROOM BASED)
    // ===============================
    socket.on("joinRoom", ({ roomId, userId }) => {
      if (!roomId) return;

      socket.join(roomId);

      const room = io.sockets.adapter.rooms.get(roomId) || new Set();
      const users = Array.from(room);

      // Notify others
      socket.to(roomId).emit("userJoined", {
        userId,
        socketId: socket.id,
      });

      // Send existing users to new user
      socket.emit("existingUsers", users);
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
      io.to(to).emit("iceCandidateRoom", {
        candidate,
        from: socket.id,
      });
    });

    // ===============================
    // 🏫 SWAP CLASSROOM EVENTS
    // ===============================
    socket.on("joinClassroom", ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      socket.join(roomId);

      // Track presence
      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Set());
      }
      roomPresence.get(roomId).add(userId);

      // Notify room
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

        const newMessage = await RoomMessage.create({
          roomId,
          senderId,
          message,
          type: type || "text",
          fileUrl,
        });

        const populated = await RoomMessage.findById(newMessage._id)
          .populate("senderId", "name profilePic");

        // Emit to everyone in the room
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
    // ❌ DISCONNECT
    // ===============================
    socket.on("disconnect", () => {
      if (currentUserId) {
        // 🧹 Cleanup active calls on abrupt disconnect
        if (activeCalls.has(currentUserId)) {
          const activeCallData = activeCalls.get(currentUserId);
          const partnerId = activeCallData.to;
          io.to(partnerId).emit("callEnded", { callId: activeCallData.callId });
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
