import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, 
  FiMonitor, FiDisc, FiPhone 
} from "react-icons/fi";
import { useCall } from "../hooks/useCall";

const Call = () => {
  const { userInfo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 📞 WebRTC Logic Hook
  const {
    callStatus,
    partnerInfo,
    incomingCallData,
    localStream,
    remoteStream,
    micOn,
    camOn,
    isRecording,
    isScreenSharing,
    startCall,
    acceptCall,
    endCall,
    toggleMic,
    toggleCam,
    shareScreen,
    startRecording,
    stopRecording,
  } = useCall(userInfo, location.state);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  
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

  // Sync Video Streams to Refs
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle Ringtones based on state
  useEffect(() => {
    if (callStatus === "incoming") ringtoneRef.current.play().catch(() => {});
    else ringtoneRef.current.pause();

    if (callStatus === "calling") ringbackRef.current.play().catch(() => {});
    else ringbackRef.current.pause();
  }, [callStatus]);

  // Handle Initial State from Location
  useEffect(() => {
    if (location.state?.autoCall && callStatus === "idle") {
      startCall(location.state.selectedUser);
    }
  }, [location.state, callStatus, startCall]);

  const isInitializing = (location.state?.selectedUser || location.state?.incomingCallData) && callStatus === "idle";

  if (callStatus === "idle" && !location.state?.selectedUser && !incomingCallData && !isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="text-center glass p-8 md:p-12 rounded-[3rem] md:rounded-[4rem] max-w-md w-full mx-4 tracking-tight">
          <FiVideoOff size={32} className="md:size-40 mx-auto mb-6 md:mb-8 text-gray-400 opacity-50" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">No Active Session</h2>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto">Pick a contact to start a high-quality video swap.</p>
          <button onClick={() => navigate("/chat")} className="btn primary w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20">
            <FiPhone size={20} /> Open Messenger
          </button>
        </div>
      </div>
    );
  }

  const displayName = partnerInfo?.name || location.state?.selectedUser?.name || incomingCallData?.callerName || "Unknown User";

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col overflow-hidden text-white font-display">
      {/* 🎭 Remote Video Background */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover transition-opacity duration-1000 ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/40 via-transparent to-[#020617]/80 pointer-events-none" />
      </div>

      {/* 🏛️ Premium Floating Header (Inspired by screenshot) */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl"
      >
        <div className="glass-premium px-6 py-4 rounded-3xl flex items-center justify-between border border-white/5 mx-auto">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
              <span className="text-xl font-black italic tracking-tighter text-white">S</span>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none flex items-center gap-2">
                Skill<span className="text-purple-400">Swap</span>
                <span className="bg-purple-500/20 text-purple-400 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/20">PRO</span>
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Secure Peer Session</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-gray-300">{displayName}</span>
              <span className="text-[10px] text-gray-500">
                {callStatus === 'connected' ? 'Live Connection' : 
                 callStatus === 'ringing' ? 'Ringing Remote...' :
                 callStatus === 'failed' ? 'Reconnecting...' : 'Handshaking...'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} alt="user" className="w-8 h-8" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 🎥 Local Video Thumbnail (PIP) */}
      <motion.div 
        drag 
        dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }} 
        className="absolute md:bottom-28 bottom-32 md:right-10 right-6 z-50 md:w-56 md:h-40 w-36 h-28 rounded-[2rem] overflow-hidden border border-white/10 shadow-3xl glass-premium cursor-move group"
      >
        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-all duration-500 ${camOn ? 'opacity-100 scale-100' : 'opacity-10 scale-110 blur-sm'}`} />
        {!camOn && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 bg-black/40 backdrop-blur-md">
            <FiVideoOff size={24} className="animate-pulse" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-end">
          <span className="text-[10px] font-black uppercase tracking-widest">Self View</span>
        </div>
      </motion.div>

      {/* 🛰️ Status Overlays */}
      <div className="absolute top-32 left-8 md:left-12 z-50 flex flex-col gap-3">
        {isRecording && (
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-2xl backdrop-blur-xl"
          >
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full pulsate-red shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            <span className="text-[10px] font-black tracking-widest text-red-500 uppercase">Live Recording</span>
          </motion.div>
        )}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-xl border ${
          callStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
          callStatus === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
          'bg-white/5 border-white/10 text-gray-400'}`}>
          <div className={`w-2 h-2 rounded-full ${
            callStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 
            callStatus === 'failed' ? 'bg-red-500 animate-pulse' : 
            'bg-amber-500 animate-bounce'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {callStatus === 'connected' ? 'Ultra HD • Encrypted' : 
             callStatus === 'ringing' ? 'Peer Notified • Ringing' :
             callStatus === 'failed' ? 'Signal Lost • Retrying' : 'Syncing Streams...'}
          </span>
        </div>
      </div>

      {/* 📲 Calling/Ringing State */}
      {(callStatus === 'calling' || callStatus === 'ringing') && (
        <div className="absolute inset-0 z-40 bg-[#020617]/80 backdrop-blur-3xl flex items-center justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 animate-pulse" />
              <div className="md:w-36 md:h-36 w-28 h-28 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2.5rem] md:rounded-[3rem] mx-auto flex items-center justify-center text-4xl md:text-5xl font-black shadow-2xl relative z-10">
                {displayName[0]}
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter italic">
              {callStatus === 'ringing' ? `Ringing ${displayName}` : `Calling ${displayName}`}
            </h2>
            <p className="text-purple-400 font-black text-[11px] uppercase tracking-[0.3em] animate-pulse">
              {callStatus === 'ringing' ? 'Waiting for answer...' : 'Requesting Uplink...'}
            </p>
            <button onClick={endCall} className="mt-12 p-6 bg-red-600 rounded-full hover:scale-110 active:scale-90 transition-all shadow-2xl shadow-red-500/40 border-4 border-[#020617]">
              <FiPhoneOff size={28} />
            </button>
          </motion.div>
        </div>
      )}

      {/* 🔔 Incoming State */}
      {callStatus === 'incoming' && (
        <div className="absolute inset-0 z-[100] bg-[#020617]/90 backdrop-blur-3xl flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-premium p-10 md:p-14 rounded-[3.5rem] border border-white/5 shadow-3xl w-full max-w-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-gradient-x" />
            <div className="md:w-28 md:h-28 w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2.5rem] mx-auto mb-8 flex items-center justify-center text-4xl font-black shadow-2xl animate-bounce">
              {displayName[0]}
            </div>
            <h2 className="text-3xl font-black mb-3 tracking-tighter">Incoming Invite</h2>
            <p className="text-gray-400 mb-10 font-medium">{displayName} wants to swap skills</p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => acceptCall(incomingCallData)} 
                className="btn primary py-5 text-lg rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20 glow-glow border-none"
              >
                Accept Stream
              </button>
              <button onClick={endCall} className="btn outline border-white/5 text-gray-500 py-4 rounded-2xl hover:bg-white/5 transition-colors font-bold uppercase tracking-widest text-[10px]">
                Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🎛️ Floating Floating Control Bar */}
      {(callStatus === 'connected' || callStatus === 'connecting' || callStatus === 'failed') && (
        <motion.div 
          initial={{ y: 100 }} 
          animate={{ y: 0 }} 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-5 glass-premium rounded-[2.5rem] border border-white/5 shadow-3xl"
        >
          <div className="flex items-center gap-2 pr-5 border-r border-white/5">
            <button onClick={toggleMic} className={`p-4 rounded-2xl transition-all duration-300 ${micOn ? 'glass hover:bg-white/5' : 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
              {micOn ? <FiMic size={22} /> : <FiMicOff size={22} />}
            </button>
            <button onClick={toggleCam} className={`p-4 rounded-2xl transition-all duration-300 ${camOn ? 'glass hover:bg-white/5' : 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'}`}>
              {camOn ? <FiVideo size={22} /> : <FiVideoOff size={22} />}
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-2">
            <button onClick={shareScreen} className={`p-4 rounded-2xl transition-all ${isScreenSharing ? 'bg-purple-500/20 text-purple-400' : 'glass hover:bg-white/5'}`} title="Share Screen">
              <FiMonitor size={22} />
            </button>
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all ${isRecording ? 'bg-red-500 text-white pulsate-red' : 'glass hover:bg-white/5'}`}>
              <FiDisc size={22} />
            </button>
          </div>
          
          <div className="pl-5 border-l border-white/5">
            <button onClick={endCall} className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-2xl shadow-red-500/40 transition-all hover:scale-110 active:scale-95 border-2 border-[#020617]">
              <FiPhoneOff size={24} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Call;
