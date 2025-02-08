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
  const { room } = router.query; // Get the room ID from the URL
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!room) return;

    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    socket.emit("joinRoom", room);

    socket.on("offer", async (offer) => {
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { answer, room });
    });

    socket.on("answer", async (answer) => {
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("candidate", async (candidate) => {
      if (!peerConnection.current) return;
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.emit("leaveRoom", room);
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [room]);

  const startCall = async () => {
    setConnected(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  
    // Set local video
    localVideoRef.current.srcObject = stream;
  
    // Add local stream tracks to peer connection
    stream.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, stream);
    });
  
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        let [remoteStream] = event.streams;
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };
    
    // Create offer
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", { offer, room });
  
    // Handle ICE candidates
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", { candidate: event.candidate, room });
      }
    };
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
          <video ref={localVideoRef} autoPlay playsInline style={{ width: "45%", marginRight: "10px" }}></video>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "45%" }}></video>
        </div>
      )}
    </Container>
  );
}
