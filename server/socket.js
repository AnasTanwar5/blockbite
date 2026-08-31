const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { verifyToken, JWT_SECRET } = require("./middleware/auth");

let io = null;

const authenticateSocket = (socket) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];

  if (!token) {
    return socket.emit("auth_error", { message: "Authentication token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    socket.join(`user:${decoded.id}`);
    socket.join(`role:${decoded.role}`);

    if (decoded.role === "restaurant") {
      socket.join("restaurants");
    } else if (decoded.role === "driver") {
      socket.join("drivers");
    } else if (decoded.role === "customer") {
      socket.join("customers");
    }

    socket.emit("connected", { userId: decoded.id, role: decoded.role });
  } catch (err) {
    socket.emit("auth_error", { message: "Invalid or expired token" });
    socket.disconnect();
  }
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    authenticateSocket(socket);

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => io;

const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

const emitToRole = (role, event, data) => {
  if (io) io.to(`role:${role}`).emit(event, data);
};

const emitToAll = (event, data) => {
  if (io) io.emit(event, data);
};

const emitOrderCreated = (order) => {
  if (!io || !order) return;
  io.to(`user:${order.customer}`).emit("order:created", order);
  io.to("restaurants").emit("order:new", order);
};

const emitOrderUpdated = (order) => {
  if (!io || !order) return;
  io.to(`user:${order.customer}`).emit("order:updated", order);
  if (order.driver) io.to(`user:${order.driver}`).emit("order:updated", order);
  if (order.restaurant) io.to(`user:${order.restaurant}`).emit("order:updated", order);
  io.to("restaurants").emit("order:updated", order);
  io.to("drivers").emit("order:updated", order);
};

const emitOrderDelivered = (order) => {
  if (!io || !order) return;
  io.to(`user:${order.customer}`).emit("order:delivered", order);
  if (order.driver) io.to(`user:${order.driver}`).emit("order:delivered", order);
  if (order.restaurant) io.to(`user:${order.restaurant}`).emit("order:delivered", order);
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToRole,
  emitToAll,
  emitOrderCreated,
  emitOrderUpdated,
  emitOrderDelivered,
};
