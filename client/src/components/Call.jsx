import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, 
  FiMonitor, FiDisc, FiMaximize, FiMinimize, FiPhone 
} from "react-icons/fi";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
  ],
};

// ⚡ SDP MANGLING FOR HIGH QUALITY (Made safer)
const setMediaBitrates = (sdp) => {
  let newSdp = sdp;
  // Audio: Boost Opus bitrate to 128kbps (high fidelity)
  if (newSdp.includes("a=mid:audio")) {
    newSdp = newSdp.replace(/a=fmtp:111 (.*)/g, "a=fmtp:111 $1;maxaveragebitrate=128000;stereo=1;useinbandfec=1");
  }
  // Video: Force higher bandwidth (2500kbps for HD)
  if (newSdp.includes("m=video") && !newSdp.includes("b=AS:")) {
    newSdp = newSdp.replace(/m=video (.*)\r\n/g, `m=video $1\r\nb=AS:2500\r\n`);
  }
  return newSdp;
};

const Call = () => {
  const { userInfo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 🔥 STATE & PERSISTENCE
  const [selectedUser, setSelectedUserState] = useState(location.state?.selectedUser || JSON.parse(sessionStorage.getItem("call_user")));
  const [incomingCall, setIncomingCall] = useState(location.state?.incomingCallData || JSON.parse(sessionStorage.getItem("incoming_call")) || null);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerConnection = useRef();
  const mediaRecorder = useRef(null);
  const hasCalled = useRef(false);

  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("idle"); // idle, connecting, connected, failed
  
  const iceQueue = useRef([]);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [presenterMode, setPresenterMode] = useState(false);
  const [recording, setRecording] = useState(false);
  
  // 🎵 AUDIO
  const ringtoneRef = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_73145465e9.mp3"));
  const ringbackRef = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c36395e86d.mp3")); 
  
  useEffect(() => {
    const ringtone = ringtoneRef.current;
    const ringback = ringbackRef.current;
    ringtone.loop = true;
    ringback.loop = true;
    return () => {
      ringtone.pause();
      ringback.pause();
    };
  }, []);

  // 💾 PERSIST CALL DATA
  useEffect(() => {
    if (location.state?.selectedUser) {
      sessionStorage.setItem("call_user", JSON.stringify(location.state.selectedUser));
    }
    if (location.state?.incomingCallData) {
      sessionStorage.setItem("incoming_call", JSON.stringify(location.state.incomingCallData));
    }
    if (location.state?.autoCall) {
      sessionStorage.setItem("auto_call", "true");
    }
  }, [location.state]);

  // 🎥 START MEDIA
  const startMedia = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000
        },
      });

      setStream(mediaStream);
      if (localVideo.current) {
        localVideo.current.srcObject = mediaStream;
      }
      return mediaStream;
    } catch (err) {
      console.error("Media error:", err);
      alert("Failed to access camera/microphone. Please check permissions.");
      return null;
    }
  }, []);

  // ❌ END CALL (SAFE)
  const endCall = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;
    
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);

    ringtoneRef.current.pause();
    ringbackRef.current.pause();
    setCallAccepted(false);
    setIncomingCall(null);
    setSelectedUserState(null);
    setConnectionStatus("idle");

    // 🧹 Clear Persistence
    sessionStorage.removeItem("call_user");
    sessionStorage.removeItem("incoming_call");
    sessionStorage.removeItem("auto_call");

    if (selectedUser?._id) {
      socket.emit("endCall", { to: selectedUser._id });
    }
    
    navigate("/chat");
  }, [stream, selectedUser, navigate]);

  // ❄️ ICE HELPER
  const addIceCandidate = async (candidate) => {
    try {
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceQueue.current.push(candidate);
      }
    } catch (e) {
      console.warn("Failed to add ICE candidate", e);
    }
  };

  const flushIceQueue = async () => {
    while (iceQueue.current.length > 0) {
      const cand = iceQueue.current.shift();
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn("Error flushing ICE candidate", e);
      }
    }
  };

  // 📞 CALL USER
  const callUser = useCallback(async () => {
    const media = await startMedia();
    if (!media) return;

    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);
    setConnectionStatus("connecting");

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current.iceConnectionState;
      console.log("ICE Connection State:", state);
      if (state === "connected" || state === "completed") setConnectionStatus("connected");
      if (state === "failed") setConnectionStatus("failed");
    };

    media.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, media);
    });

    peerConnection.current.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", {
          to: selectedUser._id,
          candidate: event.candidate,
        });
      }
    };

    const offer = await peerConnection.current.createOffer();
    const hqOffer = new RTCSessionDescription({
      type: 'offer',
      sdp: setMediaBitrates(offer.sdp)
    });
    await peerConnection.current.setLocalDescription(hqOffer);

    socket.emit("callUser", {
      to: selectedUser._id,
      from: userInfo._id,
      callerName: userInfo.name,
      offer: hqOffer, 
    });
    ringbackRef.current.play().catch(e => console.log("Ringback blocked"));

  }, [startMedia, userInfo?._id, userInfo?.name, selectedUser?._id]);

  // ✅ ACCEPT CALL
  const acceptCall = useCallback(async () => {
    const media = await startMedia();
    if (!media) return;

    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);
    setConnectionStatus("connecting");

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current.iceConnectionState;
      if (state === "connected" || state === "completed") setConnectionStatus("connected");
      if (state === "failed") setConnectionStatus("failed");
    };

    media.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, media);
    });

    peerConnection.current.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", {
          to: incomingCall.from,
          candidate: event.candidate,
        });
      }
    };

    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(incomingCall.offer)
    );

    // Process queued candidates
    await flushIceQueue();

    const answer = await peerConnection.current.createAnswer();
    const hqAnswer = new RTCSessionDescription({
      type: 'answer',
      sdp: setMediaBitrates(answer.sdp)
    });
    await peerConnection.current.setLocalDescription(hqAnswer);

    socket.emit("acceptCall", {
      to: incomingCall.from,
      answer: hqAnswer, 
    });

    ringtoneRef.current.pause();
    
    const acceptedUser = {
      _id: incomingCall.from,
      name: incomingCall.callerName
    };
    setSelectedUserState(acceptedUser);
    sessionStorage.setItem("call_user", JSON.stringify(acceptedUser));

    setCallAccepted(true);
    setIncomingCall(null);
  }, [startMedia, incomingCall]);

  // 🎤 MIC / CAMERA
  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const toggleCam = () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !camOn;
      setCamOn(!camOn);
    }
  };

  // 🖥️ SCREEN SHARE
  const shareScreen = async () => {
    if (!peerConnection.current || !stream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getTracks()[0];
      const videoSender = peerConnection.current.getSenders().find((s) => s.track?.kind === "video");

      if (videoSender) {
        videoSender.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => {
        const camTrack = stream.getVideoTracks()[0];
        if (camTrack && videoSender) {
          videoSender.replaceTrack(camTrack);
        }
      };
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  // 🔴 RECORD
  const startRecording = () => {
    const streamToRecord = remoteVideo.current?.srcObject || stream;
    if (!streamToRecord) return;

    const recorder = new MediaRecorder(streamToRecord);
    mediaRecorder.current = recorder;

    let chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SkillSwap_Call_${new Date().getTime()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  // 📞 SOCKET EVENTS
  useEffect(() => {
    if (!userInfo?._id) return;
    
    socket.emit("join", userInfo._id);

    const handleIncomingCall = ({ from, callerName, offer }) => {
      setIncomingCall({ from, callerName, offer });
      ringtoneRef.current.play().catch(e => console.log("Ringtone blocked"));
    };

    const handleCallAccepted = async ({ answer }) => {
      ringbackRef.current.pause();
      setCallAccepted(true);
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceQueue();
      }
    };

    const handleIceCandidate = ({ candidate }) => {
      addIceCandidate(candidate);
    };

    const handleCallRejected = () => {
      alert("Call was rejected");
      endCall();
    };

    const handleCallEnded = () => {
      endCall();
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);

    // ✨ AUTO-CALL FEATURE
    const shouldAutoCall = location.state?.autoCall || sessionStorage.getItem("auto_call") === "true";
    if (shouldAutoCall && !callAccepted && !incomingCall && !hasCalled.current && selectedUser) {
      hasCalled.current = true;
      callUser();
      sessionStorage.removeItem("auto_call");
    }

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
    };
  }, [userInfo?._id, selectedUser, callUser, endCall, callAccepted, incomingCall, location.state?.autoCall]);

  if (!selectedUser && !incomingCall && !callAccepted) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white font-display overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/10 blur-[120px] rounded-full pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center relative z-10 glass p-12 rounded-[4rem] border border-white/5 shadow-2xl max-w-md w-full mx-4"
        >
          <div className="w-24 h-24 bg-white/5 rounded-3xl mx-auto mb-8 flex items-center justify-center text-gray-400 border border-white/5">
             <FiVideoOff size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">No Active Session</h2>
          <p className="text-gray-400 mb-10 leading-relaxed">
            We couldn't find an active call request. Please start a call from your contacts list.
          </p>
          <button 
            onClick={() => navigate("/chat")}
            className="btn primary w-full py-4 rounded-2xl shadow-purple-500/20 flex items-center justify-center gap-3 group"
          >
            <FiPhone size={20} className="group-hover:rotate-12 transition-transform" />
            Go to Messenger
          </button>
        </motion.div>
      </div>
    );
  }

  const displayName = selectedUser?.name || incomingCall?.callerName || "Unknown";

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col overflow-hidden font-display text-white">
      
      {/* 🔴 REMOTE VIDEO */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={remoteVideo} 
          autoPlay 
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-700 ${callAccepted ? 'opacity-100' : 'opacity-40'}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* 🟢 LOCAL VIDEO */}
      <motion.div 
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute bottom-32 right-8 z-50 w-48 h-36 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl glass-dark cursor-move group"
      >
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity ${camOn ? 'opacity-100' : 'opacity-20'}`}
        />
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 bg-black/40 backdrop-blur-sm">
            <FiVideoOff size={24} />
          </div>
        )}
        <div className="absolute bottom-2 left-2 px-2 py-1 glass rounded-lg text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          You
        </div>
      </motion.div>

      {/* 🛑 INDICATORS */}
      <div className="absolute top-8 left-8 z-50 flex flex-col gap-3">
        <AnimatePresence>
          {recording && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl backdrop-blur-md"
            >
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Rec</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border ${
            connectionStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
            connectionStatus === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-white/5 border-white/10 text-gray-400'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
            connectionStatus === 'failed' ? 'bg-red-500' : 'bg-yellow-500 animate-bounce'
          }`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {connectionStatus === 'connected' ? 'Secure Connected' :
             connectionStatus === 'failed' ? 'Connection Failed' : 'Establishing Link...'}
          </span>
        </motion.div>
      </div>

      {/* ⏳ PRE-CALL OVERLAY */}
      {!callAccepted && !incomingCall && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xl flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="relative mb-8 flex justify-center">
              <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2.5rem] flex items-center justify-center text-5xl font-bold border-4 border-white/10 shadow-2xl animate-pulse">
                {displayName[0]}
              </div>
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-green-500 rounded-2xl border-4 border-[#020617] flex items-center justify-center text-white animate-bounce">
                <FiPhone />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2">Connecting to {displayName}</h2>
            <p className="text-purple-400 font-medium tracking-wide animate-pulse uppercase text-xs">Waiting for carrier response...</p>
          </motion.div>
        </div>
      )}

      {/* 📥 INCOMING OVERLAY */}
      {incomingCall && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-12 rounded-[3.5rem] border border-white/10 shadow-2xl w-full max-w-sm text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2rem] mx-auto mb-8 flex items-center justify-center text-4xl font-bold shadow-2xl animate-pulse">
              {displayName[0]}
            </div>
            <h2 className="text-3xl font-bold mb-2">Incoming Call</h2>
            <p className="text-gray-400 mb-10 font-medium">{displayName} is calling you...</p>
            <div className="flex flex-col gap-4">
              <button onClick={acceptCall} className="btn primary py-5 text-lg rounded-2xl shadow-green-500/20">Accept Call</button>
              <button onClick={endCall} className="btn outline border-red-500/20 text-red-400 hover:bg-red-500/10 py-4 rounded-2xl">Decline</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🎮 FLOATING CONTROL BAR */}
      <motion.div 
        initial={{ y: 100 }} animate={{ y: 0 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 glass rounded-[2.5rem] border border-white/10 shadow-2xl"
      >
        <div className="flex items-center gap-2 pr-4 border-r border-white/10 mr-2">
          <button onClick={toggleMic} className={`p-4 rounded-2xl transition-all ${micOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
            {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
          </button>
          <button onClick={toggleCam} className={`p-4 rounded-2xl transition-all ${camOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
            {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
          </button>
        </div>

        <button onClick={shareScreen} className="p-4 rounded-2xl glass hover:bg-white/10 transition-colors" title="Share Screen"><FiMonitor size={20} /></button>
        <button onClick={() => setPresenterMode(!presenterMode)} className={`p-4 rounded-2xl transition-all ${presenterMode ? 'bg-purple-600 shadow-lg shadow-purple-500/20' : 'glass hover:bg-white/10'}`} title="Presenter Mode">
          {presenterMode ? <FiMinimize size={20} /> : <FiMaximize size={20} />}
        </button>
        <button onClick={recording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all ${recording ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'glass hover:bg-white/10'}`} title="Record Call">
          <FiDisc size={20} className={recording ? 'animate-spin-slow' : ''} />
        </button>

        <div className="pl-4 border-l border-white/10 ml-2">
          <button onClick={endCall} className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-500/20 transition-all hover:scale-110 active:scale-95" title="End Call"><FiPhoneOff size={22} /></button>
        </div>
      </motion.div>
    </div>
  );
};

export default Call;
