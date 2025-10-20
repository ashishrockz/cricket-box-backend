require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middlewares/errorHandler");
const socketSetup = require("./sockets/matchSocket");

// Connect DB
connectDB();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/room", require("./routes/roomRoutes"));
app.use("/api/match", require("./routes/matchRoutes"));
app.use("/api/tournaments", require("./routes/tournamentRoutes"));

// Swagger
const swaggerDocument = require("./swagger/swagger.json");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health
app.get("/", (req, res) => res.json({ ok: true, service: "Cricket Box Backend" }));

// 404 middleware
app.use(notFound);

// Error handler
app.use(errorHandler);

// Create server + socket
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
socketSetup(io);

// Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

