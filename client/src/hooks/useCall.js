import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useSocket } from "../context/SocketContext";

const DEFAULT_STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export const useCall = (userInfo, initialData) => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  // --- Refs ---
  const peerConnection = useRef(null);
  const iceServersRef = useRef(DEFAULT_STUN);
  const iceQueue = useRef([]);
  const mediaRecorder = useRef(null);
  const remoteUserId = useRef(null);
  const currentCallId = useRef(initialData?.incomingCallData?.callId || null);
  const callTimeoutRef = useRef(null);
  // Ref mirror of localStream so cleanup() doesn't need it as a dep
  const localStreamRef = useRef(null);

  // Status ref to prevent stale state bugs in timeouts/listeners
  // NOTE: For autoCall, we intentionally start as "idle" so Call.jsx's useEffect
  // (which guards on callStatus === "idle") can trigger startCall() on mount.
  // Pre-setting to "calling" here would cause startCall to fire AFTER endCall()
  // resets the status back to "idle", not when the call button is clicked.
  const statusRef = useRef(
    (initialData?.incomingCallData && !initialData?.autoAccept) ? "incoming" : "idle"
  );

  // --- State ---
  const [localStream, _setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, _setCallStatus] = useState(statusRef.current); 

  // Always keep the ref in sync so cleanup() can stop tracks without a dep on state
  const setLocalStream = (stream) => {
    localStreamRef.current = stream;
    _setLocalStream(stream);
  };

  const setCallStatus = (status) => {
    statusRef.current = status;
    _setCallStatus(status);
  };

  const [incomingCallData, setIncomingCallData] = useState(initialData?.incomingCallData || null);
  const [partnerInfo, setPartnerInfo] = useState(initialData?.selectedUser || null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // --- Cleanup ---
  // NOTE: Uses localStreamRef (not localStream state) so this function is stable
  // and doesn't cause startCall/endCall to be recreated every time a stream is set.
  const cleanup = useCallback(() => {
    const cid = currentCallId.current;
    console.log(`🧹 [CLEANUP] Session ${cid}`);

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    iceQueue.current = [];
    currentCallId.current = null;
    setCallStatus("idle");
    setIncomingCallData(null);
    setPartnerInfo(null);
    
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
  }, []); // stable — no deps needed since we use refs

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
    console.log("🏗️ [CALL_FLOW] Initializing RTCPeerConnection for partner user:", targetId);
    remoteUserId.current = targetId;
    peerConnection.current = new RTCPeerConnection(iceServersRef.current);

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate && currentCallId.current) {
        console.log(`❄️ [CALL_FLOW] Local ICE candidate generated for call ${currentCallId.current}:`, e.candidate);
        socket.emit("iceCandidate", { to: targetId, candidate: e.candidate, callId: currentCallId.current });
      }
    };

    peerConnection.current.ontrack = (e) => {
      console.log("📺 [CALL_FLOW] Remote video/audio track received from peer. Synced streams.");
      setRemoteStream(e.streams[0]);
    };

    peerConnection.current.onconnectionstatechange = () => {
      console.log(`📡 [CALL_FLOW] WebRTC Connection State Changed: ${peerConnection.current?.connectionState}`);
      if (peerConnection.current?.connectionState === "failed") {
        toast.error("Connection failed");
        cleanup();
      }
    };

    return peerConnection.current;
  }, [socket, cleanup]);

  // --- Actions ---
  const endCall = useCallback(() => {
    if (remoteUserId.current && currentCallId.current) {
      socket.emit("endCall", { to: remoteUserId.current, callId: currentCallId.current });
    }
    cleanup();
    navigate("/chat");
  }, [socket, cleanup, navigate]);

  const startCall = useCallback(async (user) => {
    const callId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    console.log(`🚀 [CALL_FLOW] Starting Call ${callId} to ${user.name} (${user._id})`);
    
    currentCallId.current = callId;
    setPartnerInfo(user);
    setCallStatus("calling");

    try {
      console.log("📷 [CALL_FLOW] Requesting local camera/mic stream...");
      const stream = await getMedia();
      if (currentCallId.current !== callId) return;

      const pc = await initPeerConnection(user._id);
      stream.getTracks().forEach(t => {
        console.log(`🎙️ [CALL_FLOW] Adding track to PeerConnection: ${t.kind}`);
        pc.addTrack(t, stream);
      });

      console.log("📡 [CALL_FLOW] Creating local SessionDescription Offer...");
      const offer = await pc.createOffer();
      if (currentCallId.current !== callId) return;

      await pc.setLocalDescription(offer);
      console.log("📡 [CALL_FLOW] Local Description set. Emitting callUser event via Socket...");

      // Final check before emission
      if (currentCallId.current !== callId) return;
      socket.emit("callUser", { 
        to: user._id, 
        from: userInfo._id, 
        callerName: userInfo.name, 
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }, 
        callId 
      });

      // 🕒 HANDSHAKE TIMEOUT
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === "calling" || statusRef.current === "connecting") {
          console.warn("🕒 [CALL_FLOW] Handshake timeout (30s). Peer did not answer.");
          toast.error("No answer from contact");
          endCall();
        }
      }, 30000);

    } catch (e) {
      console.error("❌ [CALL_FLOW] Call Start Error:", e);
      cleanup();
    }
  }, [userInfo, getMedia, initPeerConnection, cleanup, endCall, socket]);

  const acceptCall = useCallback(async (data) => {
    console.log("✅ [CALL_FLOW] Accepting Call:", data.callId, "from", data.callerName);
    currentCallId.current = data.callId;
    setCallStatus("connecting");
    
    try {
      console.log("📷 [CALL_FLOW] Requesting local camera/mic stream for recipient...");
      const stream = await getMedia();
      if (currentCallId.current !== data.callId) return;

      const pc = await initPeerConnection(data.from);
      stream.getTracks().forEach(t => {
        console.log(`🎙️ [CALL_FLOW] Adding track to PeerConnection for recipient: ${t.kind}`);
        pc.addTrack(t, stream);
      });

      console.log("📡 [CALL_FLOW] Setting Remote Description Offer from caller...");
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushIceQueue();

      // Signal the server that we're ready to receive ICE candidates
      console.log("🟢 [CALL_FLOW] Emitting callReady to flush server ICE buffer...");
      socket.emit("callReady", { callId: data.callId, to: data.from });

      console.log("📡 [CALL_FLOW] Creating local SessionDescription Answer...");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📡 [CALL_FLOW] Emitting acceptCall event via Socket...");
      socket.emit("acceptCall", { 
        to: data.from, 
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }, 
        callId: data.callId 
      });
      setCallStatus("connected");
    } catch (e) {
      console.error("❌ [CALL_FLOW] Accept Call Error:", e);
      cleanup();
    }
  }, [getMedia, initPeerConnection, flushIceQueue, cleanup, socket]);

  const toggleMic = useCallback(() => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  }, [localStream, micOn]);

  const toggleCam = useCallback(() => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  }, [localStream, camOn]);

  // --- Listeners ---
  useEffect(() => {
    if (!userInfo?._id) return;

    socket.emit("getIceConfigs");
    
    const handleIceConfigs = (data) => {
      console.log("🔒 ICE Servers Updated");
      iceServersRef.current = { ...data, iceCandidatePoolSize: 10 };
    };

    const handleCallAccepted = async (data) => {
      if (data.callId !== currentCallId.current) return;
      console.log("🤝 Call Accepted by Peer");
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
      toast.error(data.reason === "busy" ? "User is busy" : "Call rejected");
      cleanup();
    };

    const handleCallEndedSignal = (data) => {
      if (data.callId !== currentCallId.current) return;
      toast("Call ended");
      cleanup();
      navigate("/chat");
    };

    const handleCallRinging = (data) => {
      if (data.callId !== currentCallId.current) return;
      console.log("🔔 Peer is ringing...");
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      setCallStatus("ringing");
    };

    const handleCallWaiting = (data) => {
      if (data.callId !== currentCallId.current) return;
      setCallStatus("connecting");
    };

    socket.on("iceConfigs", handleIceConfigs);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("callRejected", handleCallRejected);
    socket.on("callEnded", handleCallEndedSignal);
    socket.on("callRinging", handleCallRinging);
    socket.on("callWaiting", handleCallWaiting);

    return () => {
      socket.off("iceConfigs", handleIceConfigs);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("iceCandidate", handleIceCandidate);
      socket.off("callRejected", handleCallRejected);
      socket.off("callEnded", handleCallEndedSignal);
      socket.off("callRinging", handleCallRinging);
      socket.off("callWaiting", handleCallWaiting);
    };
  }, [userInfo?._id, cleanup, navigate, flushIceQueue, socket]);

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
