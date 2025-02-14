import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button, TextField, Container, Typography } from "@mui/material";
import { io } from "socket.io-client";

const socket = io("https://server-1-fkui.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"],
});

export default function Home() {
  const [interests, setInterests] = useState("");
  const [matchedRoom, setMatchedRoom] = useState(null);
  const router = useRouter();

  useEffect(() => {
    socket.on("matched", (data) => {
      setMatchedRoom(data.room);
    });

    return () => {
      socket.off("matched");
    };
  }, []);

  const handleMatch = () => {
    if (interests.trim()) {
      socket.emit("findMatch", { interests });
    }
  };

  const startChat = () => {
    if (matchedRoom) {
      router.push(`/chat?room=${matchedRoom}`);
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
      {matchedRoom && (
        <>
          <Typography variant="h6" style={{ marginTop: "20px" }}>
            Match found! Click below to start chatting.
          </Typography>
          <Button variant="contained" color="secondary" onClick={startChat}>
            Start Chat
          </Button>
        </>
      )}
    </Container>
  );
}
