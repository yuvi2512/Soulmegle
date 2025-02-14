import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import { Button, Container, Typography } from "@mui/material";

const socket = io("https://server-1-fkui.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"],
});

export default function ChatRoom() {
  const router = useRouter();
  const { room } = router.query;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    if (!room) return;

    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "efreeze",
          credential: "efreezeturn",
        },
        {
          urls: "turn:turn.anyfirewall.com:443?transport=tcp",
          credential: "webrtc",
          username: "webrtc",
        },
      ],
    });

    // Handle remote track
    peerConnection.current.ontrack = (event) => {
      console.log("🔵 Remote track received!", event.streams[0]);
      if (event.streams[0]) {
        console.log("🟢 Remote tracks:", event.streams[0].getTracks());
        setRemoteStream(event.streams[0]);
      } else {
        console.error("⚠️ No remote stream found in event:", event);
      }
    };

    // Handle ICE candidates
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📤 Sending ICE Candidate:", event.candidate);
        socket.emit("candidate", { candidate: event.candidate, room });
      } else {
        console.log("✅ All ICE candidates have been sent.");
      }
    };

    // Log PeerConnection state changes
    peerConnection.current.onconnectionstatechange = () => {
      console.log("🟢 PeerConnection state:", peerConnection.current.connectionState);
    };

    // Log ICE connection state changes
    peerConnection.current.oniceconnectionstatechange = () => {
      console.log("🟢 ICE connection state:", peerConnection.current.iceConnectionState);
      if (peerConnection.current.iceConnectionState === "failed") {
        console.error("⚠️ ICE connection failed!");
      }
    };

    // Join room
    socket.emit("joinRoom", room);

    // Handle offer
    socket.on("offer", async ({ offer }) => {
      console.log("📩 Received Offer:", offer);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { answer, room });
    });

    // Handle answer
    socket.on("answer", async ({ answer }) => {
      console.log("📩 Received Answer:", answer);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Handle ICE candidate
    socket.on("candidate", async ({ candidate }) => {
      console.log("📥 Received ICE Candidate:", candidate);
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("⚠️ Error adding ICE Candidate:", error);
      }
    });

    // Cleanup
    return () => {
      console.log("❌ Leaving room:", room);
      socket.emit("leaveRoom", room);
      socket.disconnect();
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [room]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log("🟢 Updating remote video element with stream:", remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const startCall = async () => {
    setConnected(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("🟢 Local stream obtained:", stream);
      localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => {
        console.log("🟢 Adding track to peer connection:", track);
        peerConnection.current.addTrack(track, stream);
      });
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", { offer, room });
    } catch (error) {
      console.error("⚠️ Error accessing media devices:", error);
    }
  };

  return (
    <Container maxWidth="sm" style={{ textAlign: "center", marginTop: "50px" }}>
      <Typography variant="h4" gutterBottom>
        Chat Room: {room}
      </Typography>
      {!connected ? (
        <Button variant="contained" color="primary" onClick={startCall}>
          Start Video Chat
        </Button>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "45%", marginRight: "10px", backgroundColor: "black" }}
          ></video>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: "45%", backgroundColor: "black" }}
          ></video>
        </div>
      )}
    </Container>
  );
}