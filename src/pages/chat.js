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

  useEffect(() => {
    if (!room) return;

    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "efvsd",
          credential: "randompassword",
        },
      ],
    });

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      console.log("📡 ICE Candidate Generated:", event.candidate);
      if (event.candidate) {
        socket.emit("candidate", { candidate: event.candidate, room });
      }
    };

    socket.emit("joinRoom", room);

    socket.on("offer", async ({ offer }) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoRef.current.srcObject = stream;
      stream
        .getTracks()
        .forEach((track) => peerConnection.current.addTrack(track, stream));

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { answer, room });
    });

    socket.on("answer", async ({ answer }) => {
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("candidate", async ({ candidate }) => {
      console.log("✅ ICE Candidate Received:", candidate);
      if (candidate) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });

    return () => {
      socket.emit("leaveRoom", room);
      socket.disconnect();
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [room]);

  const startCall = async () => {
    setConnected(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideoRef.current.srcObject = stream;
      stream
        .getTracks()
        .forEach((track) => peerConnection.current.addTrack(track, stream));

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", { offer, room });
    } catch (error) {
      console.error("Error accessing media devices:", error);
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
            style={{
              width: "45%",
              marginRight: "10px",
              backgroundColor: "black",
            }}
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
