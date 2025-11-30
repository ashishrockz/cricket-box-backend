const crypto = require("crypto");

const generateRoomId = () => "ROOM-" + crypto.randomBytes(3).toString("hex").toUpperCase();
const generateInviteCode = () => crypto.randomBytes(3).toString("base64").replace(/[^A-Z0-9]/gi, "").substring(0, 6).toUpperCase();
const emitRoomUpdate = (roomId, data) => {
  if (global.io) {
    global.io.to(roomId.toString()).emit("ROOM_UPDATED", data);
  }
};

module.exports = { generateRoomId, generateInviteCode, emitRoomUpdate };