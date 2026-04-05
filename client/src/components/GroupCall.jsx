import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const GroupCall = ({ roomId }) => {
  const { userInfo } = useAuth();

  const localVideo = useRef();
  const peersRef = useRef({});

  const [streams, setStreams] = useState([]);

  // 🎥 START MEDIA
  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });

    localVideo.current.srcObject = stream;
    return stream;
  };

  useEffect(() => {
    if (!roomId || !userInfo?._id) return;

    let localStream;

    const init = async () => {
      localStream = await startMedia();

      socket.emit("joinRoom", {
        roomId,
        userId: userInfo._id,
      });

      // ================= EXISTING USERS =================
      socket.on("existingUsers", (users) => {
        users.forEach((socketId) => {
          if (socketId === socket.id) return;
          if (peersRef.current[socketId]) return;

          createPeer(socketId, localStream, true);
        });
      });

      // ================= NEW USER =================
      socket.on("userJoined", ({ socketId }) => {
        if (socketId === socket.id) return;
        if (peersRef.current[socketId]) return;

        createPeer(socketId, localStream, false);
      });

      // ================= OFFER =================
      socket.on("offer", async ({ from, offer }) => {
        if (peersRef.current[from]) return;

        const peer = createPeer(from, localStream, false);

        await peer.setRemoteDescription(offer);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer", { to: from, answer });
      });

      // ================= ANSWER =================
      socket.on("answer", async ({ from, answer }) => {
        const peer = peersRef.current[from];
        if (peer) {
          await peer.setRemoteDescription(answer);
        }
      });

      // ================= ICE =================
      socket.on("iceCandidate", ({ from, candidate }) => {
        const peer = peersRef.current[from];
        if (peer) {
          peer.addIceCandidate(candidate);
        }
      });

      // ================= USER LEFT =================
      socket.on("userLeft", ({ socketId }) => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
          delete peersRef.current[socketId];

          setStreams((prev) =>
            prev.filter((s) => s.id !== socketId)
          );
        }
      });
    };

    init();

    // ================= CLEANUP =================
    return () => {
      Object.values(peersRef.current).forEach((peer) =>
        peer.close()
      );
      peersRef.current = {};

      socket.off("existingUsers");
      socket.off("userJoined");
      socket.off("offer");
      socket.off("answer");
      socket.off("iceCandidate");
      socket.off("userLeft");
    };
  }, [roomId, userInfo]);

  // 🔥 CREATE PEER (IMPROVED)
  const createPeer = (socketId, stream, initiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      setStreams((prev) => {
        const exists = prev.find((s) => s.id === socketId);
        if (exists) return prev;

        return [...prev, { id: socketId, stream: event.streams[0] }];
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

    if (initiator) {
      peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, offer });
      });
    }

    peersRef.current[socketId] = peer;
    return peer;
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-wrap gap-2 p-4">

      {/* LOCAL VIDEO */}
      <video
        ref={localVideo}
        autoPlay
        muted
        className="w-1/4 border rounded-lg"
      />

      {/* REMOTE USERS */}
      {streams.map((s) => (
        <Video key={s.id} stream={s.stream} />
      ))}
    </div>
  );
};

// 🎥 VIDEO COMPONENT
const Video = ({ stream }) => {
  const ref = useRef();

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      className="w-1/4 border rounded-lg"
    />
  );
};

export default GroupCall;