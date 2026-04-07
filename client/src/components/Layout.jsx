import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const { userInfo } = useAuth();

  useEffect(() => {
    if (!userInfo?._id) return;

    const handleIncomingCall = ({ from, callerName, offer }) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-3">
            <p className="font-bold text-gray-800">
              📞 Incoming video call from <span className="text-purple-600">{callerName || "Unknown"}</span>...
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  socket.emit("rejectCall", { to: from });
                }}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors font-medium border-0"
              >
                Decline
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate("/call", {
                    state: {
                      selectedUser: { _id: from, name: callerName || "Unknown" },
                      incomingCallData: { from, callerName, offer },
                    },
                  });
                }}
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors font-medium shadow-lg shadow-green-500/30 border-0"
              >
                Answer
              </button>
            </div>
          </div>
        ),
        { duration: 30000, id: `call-${from}` }
      );
    };

    socket.on("incomingCall", handleIncomingCall);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
    };
  }, [userInfo, navigate]);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      
      {/* SIDEBAR */}
      <Sidebar />

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* NAVBAR */}
        <Navbar />

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-24 pb-28 lg:pb-6 custom-scrollbar">
          {children}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <BottomNav />

      </div>
    </div>
  );
};

export default Layout;
