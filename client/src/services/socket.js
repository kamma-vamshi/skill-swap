import { io } from "socket.io-client";

const getSocketURL = () => {
    // Priority 1: Direct socket URL
    if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
    
    // Priority 2: Fallback to API URL root (remove /api if present)
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL.replace(/\/api$/, "");
    }

    return "https://skill-swap-vuhy.onrender.com";
};

const socket = io(getSocketURL());

export default socket;
