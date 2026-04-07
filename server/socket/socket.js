import { Server } from "socket.io";
import Message from "../models/Message.js";
import RoomMessage from "../models/RoomMessage.js";
import SwapRoom from "../models/SwapRoom.js";

let io;

// 🟢 Track online users
const onlineUsers = new Map();
// 🏫 Track classroom presence (roomId -> Set of userIds)
const roomPresence = new Map();
// 📞 Track active calls (userId -> partnerUserId)
const activeCalls = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    let currentUserId = null;

    // ===============================
    // 🔗 JOIN (GLOBAL USER JOIN)
    // ===============================
    socket.on("join", (userId) => {
      if (!userId) return;
      currentUserId = userId;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
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
    socket.on("callUser", ({ to, from, callerName, offer }) => {
      if (!to) return;
      
      // 🚨 BUSY CHECK
      if (activeCalls.has(to)) {
        return io.to(from).emit("callRejected", { reason: "busy" });
      }

      io.to(to).emit("incomingCall", { from, callerName, offer });
    });

    socket.on("acceptCall", ({ to, answer }) => {
      if (!to || !currentUserId) return;
      
      // 🤝 Establish active call mapping
      activeCalls.set(currentUserId, to);
      activeCalls.set(to, currentUserId);

      io.to(to).emit("callAccepted", { answer });
    });

    socket.on("rejectCall", ({ to }) => {
      if (!to) return;
      io.to(to).emit("callRejected");
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      if (!to) return;
      io.to(to).emit("iceCandidate", { candidate });
    });

    socket.on("endCall", ({ to }) => {
      if (!to || !currentUserId) return;
      
      activeCalls.delete(currentUserId);
      activeCalls.delete(to);

      io.to(to).emit("callEnded");
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
          const partnerId = activeCalls.get(currentUserId);
          io.to(partnerId).emit("callEnded");
          activeCalls.delete(partnerId);
          activeCalls.delete(currentUserId);
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