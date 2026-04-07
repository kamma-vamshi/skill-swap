import { io } from "socket.io-client";

const getSocketURL = () => {
  // Priority 1: Direct socket URL
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;

  // Priority 2: Fallback to API URL root (remove /api if present)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/api$/, "");
  }

  // Fallback for development
  return window.location.hostname === "localhost" 
    ? "http://localhost:5000" 
    : "https://skill-swap-vuhy.onrender.com";
};

const getToken = () => {
  const userInfo = localStorage.getItem("userInfo");
  if (!userInfo) return null;
  try {
    const parsed = JSON.parse(userInfo);
    return parsed.token || null;
  } catch (e) {
    return null;
  }
};

const socket = io(getSocketURL(), {
  transports: ["websocket"], // 🚀 Use WebSocket for faster, higher-quality signalling
  autoConnect: true,
  auth: {
    // 🔐 Send JWT token for secure handshake
    token: getToken(), 
  },
});

// Update token on login (if the socket is already created)
export const updateSocketToken = (token) => {
  if (socket) {
    socket.auth.token = token;
    socket.disconnect().connect();
  }
};

export default socket;
