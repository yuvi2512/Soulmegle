import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Button, TextField, Container, Typography } from "@mui/material";
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
  path: "/api/socketio",
});

export default function Home() {
  const [interests, setInterests] = useState("");
  const [matchedUser, setMatchedUser] = useState(null);
  const router = useRouter();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null); // Initialize as null

  useEffect(() => {
    if (typeof window !== "undefined") {  // Ensure it runs only in the browser
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
    }

    socket.on("matched", (data) => {
      setMatchedUser(data);
      initiateCall();
    });

    socket.on("offer", async (offer) => {
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", answer);
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
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

  const handleMatch = () => {
    if (interests.trim()) {
      socket.emit("findMatch", { interests });
    }
  };

  const initiateCall = async () => {
    if (!peerConnection.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
    localVideoRef.current.srcObject = stream;

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", event.candidate);
      }
    };

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", offer);
  };

  const startChat = () => {
    if (matchedUser) {
      router.push(`/chat?room=${matchedUser.room}`);
    }
  };

  return (
    <Container maxWidth="sm" style={{ textAlign: "center", marginTop: "50px" }}>
      <Typography variant="h4" gutterBottom>
        Find Someone with Similar Interests
      </Typography>
      <TextField
        fullWidth
        label="Enter your interests (comma-separated)"
        variant="outlined"
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        margin="normal"
      />
      <Button variant="contained" color="primary" onClick={handleMatch}>
        Find a Match
      </Button>
      {matchedUser && (
        <>
          <Typography variant="h6" style={{ marginTop: "20px" }}>
            Match found! Click below to start chatting.
          </Typography>
          <Button variant="contained" color="secondary" onClick={startChat}>
            Start Chat
          </Button>
          <div style={{ marginTop: "20px" }}>
            <video ref={localVideoRef} autoPlay playsInline style={{ width: "45%", marginRight: "10px" }}></video>
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "45%" }}></video>
          </div>
        </>
      )}
    </Container>
  );
}
