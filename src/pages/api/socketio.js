import { Server } from "socket.io";

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log("Socket.io is already running");
  } else {
    console.log("Starting Socket.io server...");

    const io = new Server(res.socket.server, {
      path: "/api/socketio",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("findMatch", (data) => {
        console.log("Finding match for:", data);
        // Matchmaking logic goes here
        socket.emit("matched", { room: "1234" }); // Example room ID
      });

      socket.on("offer", (offer) => {
        socket.broadcast.emit("offer", offer);
      });

      socket.on("answer", (answer) => {
        socket.broadcast.emit("answer", answer);
      });

      socket.on("candidate", (candidate) => {
        socket.broadcast.emit("candidate", candidate);
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
