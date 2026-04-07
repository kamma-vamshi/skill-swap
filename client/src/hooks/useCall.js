import { useState, useEffect, useRef, useCallback } from "react";
import socket from "../services/socket";
import { useNavigate } from "react-router-dom";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

export const useCall = (userInfo, initialData) => {
  const navigate = useNavigate();
  
  // --- Refs ---
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const iceQueue = useRef([]);
  const mediaRecorder = useRef(null);
  const remoteUserId = useRef(null);

  // --- State ---
  const [callStatus, setCallStatus] = useState(initialData?.incomingCallData ? "incoming" : "idle"); 
  const [incomingCallData, setIncomingCallData] = useState(initialData?.incomingCallData || null);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // --- Helpers ---
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up WebRTC session...");
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
    iceQueue.current = [];
    setCallStatus("idle");
    setIncomingCallData(null);
    setPartnerInfo(null);
    setIsRecording(false);
    setIsScreenSharing(false);
  }, []);

  const flushIceQueue = async () => {
    if (!peerConnection.current || !peerConnection.current.remoteDescription) return;
    console.log("❄️ Flushing ICE queue:", iceQueue.current.length);
    while (iceQueue.current.length > 0) {
      const candidate = iceQueue.current.shift();
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add queued ICE candidate", e);
      }
    }
  };

  const initPeerConnection = useCallback(async (targetUserId) => {
    console.log("🏗️ Initializing PeerConnection for:", targetUserId);
    remoteUserId.current = targetUserId;
    
    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("iceCandidate", { to: targetUserId, candidate: event.candidate });
      }
    };

    peerConnection.current.ontrack = (event) => {
      console.log("📺 Received remote track");
      if (remoteStream.current) {
        event.streams[0].getTracks().forEach(track => remoteStream.current.addTrack(track));
      } else {
        remoteStream.current = event.streams[0];
      }
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current.iceConnectionState;
      console.log("🌐 ICE State Change:", state);
      if (state === "connected" || state === "completed") setCallStatus("connected");
      if (state === "failed" || state === "disconnected") setCallStatus("failed");
    };

    peerConnection.current.onconnectionstatechange = () => {
      console.log("🔌 Connection State Change:", peerConnection.current.connectionState);
      if (peerConnection.current.connectionState === "connected") setCallStatus("connected");
    };

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });
    }

    return peerConnection.current;
  }, []);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStream.current = stream;
      return stream;
    } catch (err) {
      console.error("❌ Media access denied", err);
      throw err;
    }
  };

  // --- Actions ---
  const startCall = useCallback(async (user) => {
    setCallStatus("calling");
    setPartnerInfo(user);
    try {
      await getMedia();
      const pc = await initPeerConnection(user._id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", {
        to: user._id,
        from: userInfo._id,
        callerName: userInfo.name,
        offer,
      });
    } catch (err) {
      console.error("Call initialization failed", err);
      cleanup();
    }
  }, [userInfo, initPeerConnection, cleanup]);

  const acceptCall = useCallback(async (data) => {
    setCallStatus("connecting");
    setPartnerInfo({ _id: data.from, name: data.callerName });
    try {
      await getMedia();
      const pc = await initPeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      await flushIceQueue();
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("acceptCall", { to: data.from, answer });
      setCallStatus("connected");
    } catch (err) {
      console.error("Failed to accept call", err);
      cleanup();
    }
  }, [initPeerConnection, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUserId.current) {
      socket.emit("endCall", { to: remoteUserId.current });
    }
    cleanup();
    navigate("/chat");
  }, [cleanup, navigate]);

  const toggleMic = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  const shareScreen = async () => {
    if (!peerConnection.current || !localStream.current) return;
    try {
      if (isScreenSharing) {
        // Switch back to camera
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        const sender = peerConnection.current.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(camTrack);
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getTracks()[0];
        const sender = peerConnection.current.getSenders().find(s => s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
        
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          toggleCam(); // Fallback to cam
        };
        setIsScreenSharing(true);
      }
    } catch (err) { console.error(err); }
  };

  const startRecording = () => {
    const streamToRecord = remoteStream.current || localStream.current;
    if (!streamToRecord) return;
    
    const recorder = new MediaRecorder(streamToRecord);
    mediaRecorder.current = recorder;
    let chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `SkillSwap_${new Date().getTime()}.webm`; a.click();
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  // --- Socket Listeners ---
  useEffect(() => {
    if (!userInfo?._id) return;

    const handleIncomingCall = (data) => {
      console.log("📩 Incoming Call from:", data.callerName);
      if (callStatus !== "idle") {
        // Busy logic handled by server, but safety check here
        return;
      }
      setIncomingCallData(data);
      setCallStatus("incoming");
    };

    const handleCallAccepted = async ({ answer }) => {
      console.log("✅ Call Accepted");
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceQueue();
        setCallStatus("connected");
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerConnection.current?.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { console.warn(e); }
      } else {
        iceQueue.current.push(candidate);
      }
    };

    const handleCallRejected = ({ reason }) => {
      if (reason === "busy") alert("User is currently in another call.");
      else alert("Call rejected.");
      cleanup();
    };

    const handleCallEnded = () => {
      console.log("📞 Call ended by remote user");
      cleanup();
      alert("The call has ended.");
      navigate("/chat");
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
    };
  }, [userInfo?._id, callStatus, cleanup, navigate]);

  return {
    callStatus,
    partnerInfo,
    incomingCallData,
    localStream: localStream.current,
    remoteStream: remoteStream.current,
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
  };
};
