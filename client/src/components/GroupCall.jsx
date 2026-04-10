import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, 
  FiMaximize2, FiUsers 
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const getIceServers = () => {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun.l.google.com:19305" },
    { urls: "stun:stun.services.mozilla.com" },
  ];

  if (process.env.REACT_APP_TURN_URL) {
    servers.push({
      urls: process.env.REACT_APP_TURN_URL,
      username: process.env.REACT_APP_TURN_USERNAME,
      credential: process.env.REACT_APP_TURN_PASSWORD,
    });
  }

  return { 
    iceServers: servers,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all"
  };
};

const ICE_SERVERS = getIceServers();

const GroupCall = ({ roomId }) => {
  const { userInfo } = useAuth();
  const navigate = useNavigate();

  const localVideo = useRef();
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const iceQueuesRef = useRef({});

  const [streams, setStreams] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const flushIceQueue = useCallback(async (socketId) => {
    const peer = peersRef.current[socketId];
    const queue = iceQueuesRef.current[socketId];
    if (peer && peer.remoteDescription && queue) {
      console.log(`❄️ Flushing ICE queue for ${socketId}:`, queue.length);
      while (queue.length > 0) {
        const candidate = queue.shift();
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { console.warn(e); }
      }
    }
  }, []);

  const createPeer = useCallback((socketId, stream, initiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      setStreams((prev) => {
        const exists = prev.find((s) => s.id === socketId);
        if (exists) return prev;
        return [...prev, { id: socketId, socketId, stream: event.streams[0] }];
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      if (state === "failed") {
        console.warn(`ICE failed for ${socketId}, attempting restart...`);
        peer.restartIce();
      }
    };

    // 🚀 Mesh Optimization: Bitrate Capping (800kbps)
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        const senders = peer.getSenders();
        const videoSender = senders.find(s => s.track?.kind === "video");
        if (videoSender) {
          const params = videoSender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 800000; 
          videoSender.setParameters(params).catch(e => console.warn("Failed to cap bitrate", e));
        }
      }
    };

    if (initiator) {
      peer.createOffer().then(async (offer) => {
        await peer.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, offer });
        flushIceQueue(socketId);
      });
    }

    // 🕒 Peer Connection Watchdog (30s)
    setTimeout(() => {
      if (peer.iceConnectionState !== "connected" && peer.iceConnectionState !== "completed") {
        console.warn(`🕒 Handshake timed out for ${socketId}. Attempting one-time recovery...`);
        peer.restartIce();
      }
    }, 30000);

    peersRef.current[socketId] = peer;
    return peer;
  }, [flushIceQueue]);

  const startMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { max: 640 }, // 📉 Lower resolution for mesh efficiency
        height: { max: 480 },
        frameRate: { max: 24 },
      },
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });

    localVideo.current.srcObject = stream;
    localStreamRef.current = stream;
    return stream;
  }, []);

  useEffect(() => {
    if (!roomId || !userInfo?._id) return;

    let localStream;

    const init = async () => {
      localStream = await startMedia();

      socket.emit("joinRoom", {
        roomId,
        userId: userInfo._id,
      });

      socket.on("existingUsers", (users) => {
        users.forEach((socketId) => {
          if (socketId === socket.id) return;
          if (peersRef.current[socketId]) return;
          createPeer(socketId, localStream, true);
        });
      });

      socket.on("userJoined", ({ socketId }) => {
        if (socketId === socket.id) return;
        if (peersRef.current[socketId]) return;
        createPeer(socketId, localStream, false);
      });

      socket.on("offer", async ({ from, offer }) => {
        if (peersRef.current[from]) return;
        const peer = createPeer(from, localStream, false);
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer });
        flushIceQueue(from);
      });

      socket.on("answer", async ({ from, answer }) => {
        const peer = peersRef.current[from];
        if (peer) {
          await peer.setRemoteDescription(answer);
          flushIceQueue(from);
        }
      });

      socket.on("iceCandidate", async ({ from, candidate }) => {
        const peer = peersRef.current[from];
        if (peer && peer.remoteDescription) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) { console.error("Error adding ICE candidate", e); }
        } else {
          if (!iceQueuesRef.current[from]) iceQueuesRef.current[from] = [];
          iceQueuesRef.current[from].push(candidate);
        }
      });

      socket.on("userLeft", ({ socketId }) => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
          delete peersRef.current[socketId];
          setStreams((prev) => prev.filter((s) => s.id !== socketId));
        }
      });
    };

    init();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.close());
      peersRef.current = {};
      iceQueuesRef.current = {};

      socket.off("existingUsers");
      socket.off("userJoined");
      socket.off("offer");
      socket.off("answer");
      socket.off("iceCandidate");
      socket.off("userLeft");
    };
  }, [roomId, userInfo, startMedia, createPeer, flushIceQueue]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks()[0].enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks()[0].enabled = !camOn;
      setCamOn(!camOn);
    }
  };

  const leaveRoom = () => {
    navigate("/chat");
    window.location.reload(); 
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col overflow-hidden text-white font-display">
      {/* 🏛️ Group Header */}
      <div className="z-10 bg-gradient-to-b from-black/60 to-transparent p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-purple-500 rounded-xl glow-glow">
            <FiUsers size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Swap Room</h1>
            <p className="text-[10px] text-purple-400 font-bold tracking-widest uppercase opacity-70">
              Room ID: {roomId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-full border border-white/5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">{streams.length + 1} Active</span>
        </div>
      </div>

      {/* 🎥 Participant Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className={`grid gap-6 h-full ${
          streams.length === 0 ? 'grid-cols-1' : 
          streams.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 
          streams.length <= 3 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
        }`}>
          
          <motion.div 
            layout
            className="relative rounded-[2.5rem] overflow-hidden glass-premium border border-white/5 shadow-2xl group min-h-[300px]"
          >
            <video 
              ref={localVideo} 
              autoPlay 
              muted 
              playsInline 
              className={`w-full h-full object-cover transition-all duration-700 ${camOn ? 'opacity-100 scale-100' : 'opacity-10 scale-110 blur-xl'}`} 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            <div className="absolute bottom-6 left-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-black">
                {userInfo?.name?.[0] || 'U'}
              </div>
              <div>
                <p className="text-sm font-black truncate max-w-[150px] italic">You</p>
                <div className="flex gap-1 mt-1">
                  {!micOn && <FiMicOff size={12} className="text-red-500" />}
                  {!camOn && <FiVideoOff size={12} className="text-red-500" />}
                </div>
              </div>
            </div>

            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <FiVideoOff size={40} className="text-white/20" />
                </div>
              </div>
            )}
          </motion.div>

          <AnimatePresence mode="popLayout">
            {streams.map((s) => (
              <RemoteVideo key={s.id} stream={s.stream} socketId={s.socketId} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* 🎛️ Group Controls */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-8 py-5 glass-premium rounded-[3rem] border border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
      >
        <button onClick={toggleMic} className={`p-5 rounded-2xl transition-all duration-300 ${micOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'}`}>
          {micOn ? <FiMic size={24} /> : <FiMicOff size={24} />}
        </button>
        <button onClick={toggleCam} className={`p-5 rounded-2xl transition-all duration-300 ${camOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'}`}>
          {camOn ? <FiVideo size={24} /> : <FiVideoOff size={24} />}
        </button>
        
        <div className="w-px h-10 bg-white/10 mx-2" />
        
        <button onClick={leaveRoom} className="p-5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-2xl shadow-red-500/40 transition-all hover:scale-110 active:scale-90 border-4 border-[#020617]">
          <FiPhoneOff size={28} />
        </button>
      </motion.div>
    </div>
  );
};

const RemoteVideo = ({ stream, socketId }) => {
  const ref = useRef();

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative rounded-[2.5rem] overflow-hidden glass-premium border border-white/5 shadow-2xl min-h-[300px]"
    >
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      
      <div className="absolute bottom-6 left-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${socketId}`} alt="peer" className="w-8 h-8" />
        </div>
        <p className="text-sm font-black truncate max-w-[150px] italic">Peer_{socketId.slice(0, 4)}</p>
      </div>

      <button className="absolute top-6 right-6 p-3 glass rounded-xl opacity-0 hover:opacity-100 transition-opacity">
        <FiMaximize2 size={16} />
      </button>
    </motion.div>
  );
};

export default GroupCall;
