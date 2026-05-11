import { useState, useEffect, useRef, useCallback } from "react";
import socket from "../services/socket";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

// Securely fetch from backend
const DEFAULT_STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export const useCall = (userInfo, initialData) => {
  const navigate = useNavigate();
  
  // --- Refs ---
  const peerConnection = useRef(null);
  const iceServersRef = useRef(DEFAULT_STUN);
  const iceQueue = useRef([]);
  const mediaRecorder = useRef(null);
  const remoteUserId = useRef(null);
  const currentCallId = useRef(initialData?.incomingCallData?.callId || null);
  const callTimeoutRef = useRef(null);

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
    peerConnection.current = new RTCPeerConnection(iceServersRef.current);

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("iceCandidate", { to: targetId, candidate: e.candidate, callId: currentCallId.current });
      }
    };

    peerConnection.current.ontrack = (e) => setRemoteStream(e.streams[0]);

    peerConnection.current.onconnectionstatechange = () => {
      console.log(`📡 Peer Connection State: ${peerConnection.current.connectionState}`);
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
  const endCall = useCallback(() => {
    if (remoteUserId.current && currentCallId.current) {
      socket.emit("endCall", { to: remoteUserId.current, callId: currentCallId.current });
    }
    cleanup();
    navigate("/chat");
  }, [cleanup, navigate]);

  const startCall = useCallback(async (user) => {
    const callId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    currentCallId.current = callId;
    setPartnerInfo(user);
    setCallStatus("calling");

    try {
      await getMedia();
      if (currentCallId.current !== callId) return;

      const pc = await initPeerConnection(user._id);
      if (currentCallId.current !== callId) return;

      const offer = await pc.createOffer();
      if (currentCallId.current !== callId) return;

      // 🔥 EMIT FIRST: Don't let setLocalDescription block the network signal!
      socket.emit("callUser", { to: user._id, from: userInfo._id, callerName: userInfo.name, offer, callId });

      await pc.setLocalDescription(offer);
      if (currentCallId.current !== callId) return;

      // 🕒 HANDSHAKE TIMEOUT: Fail if no ringing/accept within 10s
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === "calling" || callStatus === "connecting") {
          toast.error("Contact is busy or unavailable (Timeout)");
          endCall();
        }
      }, 10000);

    } catch (e) {
      cleanup();
    }
  }, [userInfo, getMedia, initPeerConnection, cleanup, callStatus, endCall]);

  const acceptCall = useCallback(async (data) => {
    currentCallId.current = data.callId;
    setCallStatus("connecting");
    try {
      await getMedia();
      if (currentCallId.current !== data.callId) return;

      const pc = await initPeerConnection(data.from);
      if (currentCallId.current !== data.callId) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushIceQueue();
      if (currentCallId.current !== data.callId) return;

      const answer = await pc.createAnswer();
      if (currentCallId.current !== data.callId) return;

      await pc.setLocalDescription(answer);
      if (currentCallId.current !== data.callId) return;

      socket.emit("acceptCall", { to: data.from, answer, callId: data.callId });
      setCallStatus("connected");
    } catch (e) {
      cleanup();
    }
  }, [getMedia, initPeerConnection, flushIceQueue, cleanup]);


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

    // 🔐 FETCH SECURE ICE CONFIG
    socket.emit("getIceConfigs");
    socket.on("iceConfigs", (data) => {
      console.log("🔒 Secure ICE Servers Received");
      iceServersRef.current = {
        ...data,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: "all"
      };
    });

    const handleCallAccepted = async (data) => {
      if (data.callId !== currentCallId.current) return;
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
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
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      toast.error(data.reason === "busy" ? "User is busy" : "Call rejected");
      cleanup();
    };

    const handleCallEnded = (data) => {
      if (data.callId !== currentCallId.current) return;
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      toast("Call ended");
      cleanup();
      navigate("/chat");
    };

    const handleCallRinging = (data) => {
      if (data.callId !== currentCallId.current) return;
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
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
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      socket.off("iceConfigs");
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
