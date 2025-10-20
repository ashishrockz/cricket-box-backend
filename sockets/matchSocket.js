module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinRoom", ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
      io.to(roomId).emit("system", { message: `User joined ${roomId}` });
      console.log(`${socket.id} joined ${roomId}`);
    });

    socket.on("leaveRoom", ({ roomId }) => {
      if (!roomId) return;
      socket.leave(roomId);
      io.to(roomId).emit("system", { message: `User left ${roomId}` });
      console.log(`${socket.id} left ${roomId}`);
    });

    socket.on("ballUpdate", (data) => {
      if (!data || !data.roomId) return;
      // broadcast update to all clients in the room
      io.to(data.roomId).emit("updateScore", data);
    });

    socket.on("matchEnd", (data) => {
      if (!data || !data.roomId) return;
      io.to(data.roomId).emit("matchEnded", data);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};
