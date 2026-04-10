import { useState, useEffect, useRef, useCallback } from "react";
import socket from "../services/socket";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

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
    iceTransportPolicy: "all",
  };
};

const ICE_SERVERS = getIceServers();

export const useCall = (userInfo, initialData) => {
  const navigate = useNavigate();
  
  // --- Refs ---
  const peerConnection = useRef(null);
  const iceQueue = useRef([]);
  const mediaRecorder = useRef(null);
  const remoteUserId = useRef(null);
  const currentCallId = useRef(initialData?.incomingCallData?.callId || null);

  // --- State ---
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState(
    initialData?.incomingCallData ? "incoming" : 
    (initialData?.selectedUser && initialData?.autoCall) ? "calling" : "idle"
  ); 
  const [incomingCallData, setIncomingCallData] = useState(initialData?.incomingCallData || null);
  const [partnerInfo, setPartnerInfo] = useState(initialData?.selectedUser || null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // --- Cleanup ---
  const cleanup = useCallback(() => {
    console.log(`🧹 Cleaning Session [${currentCallId.current}]`);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }
    iceQueue.current = [];
    currentCallId.current = null;
    setCallStatus("idle");
    setIncomingCallData(null);
    setPartnerInfo(null);
    setIsRecording(false);
    setIsScreenSharing(false);
  }, [localStream, remoteStream]);

  const flushIceQueue = useCallback(async () => {
    if (!peerConnection.current || !peerConnection.current.remoteDescription) return;
    while (iceQueue.current.length > 0) {
      const candidate = iceQueue.current.shift();
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) { console.warn("ICE error", e); }
    }
  }, []);

  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      toast.error("Camera/Mic access denied");
      throw err;
    }
  }, []);

  const initPeerConnection = useCallback(async (targetId) => {
    remoteUserId.current = targetId;
    peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("iceCandidate", { to: targetId, candidate: e.candidate, callId: currentCallId.current });
      }
    };

    peerConnection.current.ontrack = (e) => setRemoteStream(e.streams[0]);

    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current?.connectionState === "failed") {
        toast.error("Connection failed");
        cleanup();
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(t => peerConnection.current.addTrack(t, localStream));
    }

    return peerConnection.current;
  }, [localStream, cleanup]);

  // --- Actions ---
  const startCall = useCallback(async (user) => {
    const callId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    currentCallId.current = callId;
    setPartnerInfo(user);
    setCallStatus("calling");

    try {
      const stream = await getMedia();
      const pc = await initPeerConnection(user._id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("callUser", { to: user._id, from: userInfo._id, callerName: userInfo.name, offer, callId });
    } catch (e) {
      cleanup();
    }
  }, [userInfo, getMedia, initPeerConnection, cleanup]);

  const acceptCall = useCallback(async (data) => {
    currentCallId.current = data.callId;
    setCallStatus("connecting");
    try {
      const stream = await getMedia();
      const pc = await initPeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushIceQueue();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("acceptCall", { to: data.from, answer, callId: data.callId });
      setCallStatus("connected");
    } catch (e) {
      cleanup();
    }
  }, [getMedia, initPeerConnection, flushIceQueue, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUserId.current && currentCallId.current) {
      socket.emit("endCall", { to: remoteUserId.current, callId: currentCallId.current });
    }
    cleanup();
    navigate("/chat");
  }, [cleanup, navigate]);

  const toggleMic = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  // --- Listeners ---
  useEffect(() => {
    if (!userInfo?._id) return;

    const handleCallAccepted = async (data) => {
      if (data.callId !== currentCallId.current) return;
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushIceQueue();
        setCallStatus("connected");
      }
    };

    const handleIceCandidate = async (data) => {
      if (data.callId !== currentCallId.current) return;
      if (peerConnection.current?.remoteDescription) {
        try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){}
      } else {
        iceQueue.current.push(data.candidate);
      }
    };

    const handleCallRejected = (data) => {
      if (data.callId !== currentCallId.current) return;
      toast.error(data.reason === "busy" ? "User is busy" : "Call rejected");
      cleanup();
    };

    const handleCallEnded = (data) => {
      if (data.callId !== currentCallId.current) return;
      toast("Call ended");
      cleanup();
      navigate("/chat");
    };

    const handleCallRinging = (data) => {
      if (data.callId !== currentCallId.current) return;
      setCallStatus("ringing");
    };

    const handleCallWaiting = (data) => {
      if (data.callId !== currentCallId.current) return;
      setCallStatus("connecting");
    };

    socket.on("callAccepted", handleCallAccepted);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEnded);
    socket.on("callRinging", handleCallRinging);
    socket.on("callWaiting", handleCallWaiting);

    return () => {
      socket.off("callAccepted", handleCallAccepted);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEnded);
      socket.off("callRinging", handleCallRinging);
      socket.off("callWaiting", handleCallWaiting);
    };
  }, [userInfo?._id, cleanup, navigate, flushIceQueue]);

  return {
    callStatus, partnerInfo, incomingCallData, localStream, remoteStream,
    micOn, camOn, isRecording, isScreenSharing,
    startCall, acceptCall, endCall,
    toggleMic, toggleCam,
    shareScreen: async () => {
      if (!peerConnection.current || !localStream) return;
      try {
        if (isScreenSharing) {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];
          const sender = peerConnection.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(camTrack);
          setIsScreenSharing(false);
        } else {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          const screenTrack = screenStream.getTracks()[0];
          const sender = peerConnection.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
          screenTrack.onended = () => setIsScreenSharing(false);
          setIsScreenSharing(true);
        }
      } catch (e) { console.error(e); }
    },
    startRecording: async () => {
      if (!localStream) return;
      try {
        const chunks = [];
        const recorder = new MediaRecorder(localStream);
        mediaRecorder.current = recorder;
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Call_${currentCallId.current}.webm`;
          a.click();
        };
        recorder.start();
        setIsRecording(true);
      } catch (e) { console.error(e); }
    },
    stopRecording: () => {
      if (mediaRecorder.current) {
        mediaRecorder.current.stop();
        mediaRecorder.current = null;
        setIsRecording(false);
      }
    }
  };
};
