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

  if (callStatus === "idle" && !location.state?.selectedUser && !incomingCallData) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
        <div className="text-center glass p-12 rounded-[4rem] max-w-md w-full mx-4">
          <FiVideoOff size={40} className="mx-auto mb-8 text-gray-400" />
          <h2 className="text-3xl font-bold mb-4">No Active Session</h2>
          <button onClick={() => navigate("/chat")} className="btn primary w-full py-4 rounded-2xl flex items-center justify-center gap-3">
            <FiPhone size={20} /> Go to Messenger
          </button>
        </div>
      </div>
    );
  }

  const displayName = partnerInfo?.name || location.state?.selectedUser?.name || incomingCallData?.callerName || "Unknown User";

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col overflow-hidden text-white font-display">
      {/* Remote Video Background */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover transition-opacity duration-700 ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}`} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* Local Video Thumbnail (PIP) */}
      <motion.div drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} className="absolute bottom-32 right-8 z-50 w-48 h-36 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl glass-dark cursor-move group">
        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-opacity ${camOn ? 'opacity-100' : 'opacity-20'}`} />
        {!camOn && <div className="absolute inset-0 flex items-center justify-center text-white/50 bg-black/40 backdrop-blur-sm"><FiVideoOff size={24} /></div>}
        <div className="absolute bottom-2 left-2 px-2 py-1 glass rounded-lg text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">You</div>
      </motion.div>

      {/* Overlay: Call Status / Recording Indicator */}
      <div className="absolute top-8 left-8 z-50 flex flex-col gap-3">
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <span className="text-[10px] font-black tracking-widest text-red-500 uppercase">Recording</span>
          </div>
        )}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border ${callStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
          <div className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {callStatus === 'connected' ? 'Secure Linked' : callStatus === 'calling' ? 'Calling User...' : 'Establishing Link...'}
          </span>
        </div>
      </div>

      {/* Calling Screen */}
      {callStatus === 'calling' && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xl flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2.5rem] mx-auto mb-8 flex items-center justify-center text-5xl font-bold shadow-2xl animate-pulse">
              {displayName[0]}
            </div>
            <h2 className="text-3xl font-bold mb-2">Calling {displayName}</h2>
            <p className="text-purple-400 font-medium animate-pulse text-xs uppercase tracking-widest">Waiting for response...</p>
            <button onClick={endCall} className="mt-12 p-6 bg-red-600 rounded-full hover:scale-110 transition-transform shadow-xl shadow-red-500/20"><FiPhoneOff size={28} /></button>
          </motion.div>
        </div>
      )}

      {/* Incoming Call Screen */}
      {callStatus === 'incoming' && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-12 rounded-[3.5rem] border border-white/10 shadow-2xl w-full max-w-sm text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-[2rem] mx-auto mb-8 flex items-center justify-center text-4xl font-bold animate-bounce shadow-2xl">
              {displayName[0]}
            </div>
            <h2 className="text-3xl font-bold mb-2">Incoming Call</h2>
            <p className="text-gray-400 mb-10">{displayName} is inviting you...</p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => acceptCall(incomingCallData)} 
                className="btn primary py-5 text-lg rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 border-none shadow-lg shadow-green-500/20"
              >
                Accept Call
              </button>
              <button onClick={endCall} className="btn outline border-red-500/20 text-red-400 py-4 rounded-2xl hover:bg-red-500/10 transition-colors">
                Decline
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Control Bar */}
      {(callStatus === 'connected' || callStatus === 'connecting' || callStatus === 'failed') && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 glass rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 pr-4 border-r border-white/10 mr-2">
            <button onClick={toggleMic} className={`p-4 rounded-2xl transition-all ${micOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500'}`}>
              {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
            </button>
            <button onClick={toggleCam} className={`p-4 rounded-2xl transition-all ${camOn ? 'glass hover:bg-white/10' : 'bg-red-500/20 text-red-500'}`}>
              {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
            </button>
          </div>
          
          <button onClick={shareScreen} className="p-4 rounded-2xl glass hover:bg-white/10 transition-colors" title="Share Screen"><FiMonitor size={20} /></button>
          <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-2xl transition-all ${isRecording ? 'bg-red-500/20 text-red-500' : 'glass hover:bg-white/10'}`}>
            <FiDisc size={20} className={isRecording ? 'animate-spin-slow' : ''} />
          </button>
          
          <div className="pl-4 border-l border-white/10 ml-2">
            <button onClick={endCall} className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-500/20 transition-all hover:scale-110 active:scale-95">
              <FiPhoneOff size={22} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Call;
