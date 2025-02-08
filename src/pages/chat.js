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
        { urls: "stun:stun.l.google.com:19302" }, // STUN (gets public IP)
        {
          urls: "turn:relay1.expressturn.com:3478", // Free public TURN server
          username: "efreeze",
          credential: "efreezeturn",
        },
        {
          urls: "turn:turn.anyfirewall.com:443?transport=tcp", // Alternative TURN
          credential: "webrtc",
          username: "webrtc",
        },
      ],
    });
    
    // When a remote track is received, update remote stream
    peerConnection.current.ontrack = (event) => {
      console.log("🔵 Remote track received!", event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("📤 Sending ICE Candidate:", event.candidate);
        socket.emit("candidate", { candidate: event.candidate, room });
      }
    };
    
    socket.on("candidate", async ({ candidate }) => {
      console.log("📥 Received ICE Candidate:", candidate);
      if (candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("⚠️ Error adding ICE Candidate:", error);
        }
      }
    });
    
    

    // Join the chat room
    socket.emit("joinRoom", room);

    // Handle incoming offer
    socket.on("offer", async ({ offer }) => {
      console.log("📩 Received Offer:", offer);
      if (!peerConnection.current) return;
      
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      socket.emit("answer", { answer, room });
    });

    // Handle incoming answer
    socket.on("answer", async ({ answer }) => {
      console.log("📩 Received Answer:", answer);
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // Handle incoming ICE candidates
    socket.on("candidate", async ({ candidate }) => {
      console.log("📥 Received ICE candidate:", candidate);
      if (!peerConnection.current) return;
      
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("⚠️ Error adding ICE candidate:", error);
      }
    });

    // Cleanup on unmount
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
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const startCall = async () => {
    setConnected(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
    // Set local video stream
    localVideoRef.current.srcObject = stream;
  
    // Add tracks before creating an offer
    stream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, stream);
    });
  
    // Ensure stream is added on remote side too
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  
    // Create and send offer
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", { offer, room });
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
