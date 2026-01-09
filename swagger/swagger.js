// swagger/swagger.js
const swaggerJsDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Cricket Box API",
      version: "1.0.0",
      description: "Cricket Box backend API (Rooms, Matches, Friends, Users, Scoring)"
    },
    servers: [
      { url: "https://cricket-box-backend.onrender.com", description: "dev server" }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        // --- User ---
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            email: { type: "string", nullable: true }
          }
        },
        // --- PlayerRef ---
        PlayerRef: {
          type: "object",
          properties: {
            userId: { type: "string" },
            username: { type: "string" }
          }
        },
        // --- TeamData ---
        TeamData: {
          type: "object",
          properties: {
            captain: { $ref: "#/components/schemas/PlayerRef" },
            players: {
              type: "array",
              items: { $ref: "#/components/schemas/PlayerRef" }
            },
            staticCaptain: { type: "string", nullable: true },
            staticPlayers: { type: "array", items: { type: "string" } }
          }
        },
        // --- Room ---
        Room: {
          type: "object",
          properties: {
            id: { type: "string" },
            roomCode: { type: "string" },
            name: { type: "string" },
            createdBy: { type: "string" },
            umpire: { $ref: "#/components/schemas/PlayerRef" },
            teamA: { $ref: "#/components/schemas/TeamData" },
            teamB: { $ref: "#/components/schemas/TeamData" },
            overs: { type: "number" },
            maxPlayersPerTeam: { type: "number" },
            status: { type: "string", enum: ["pending", "in_progress", "finished"] }
          }
        },
        // --- Ball ---
        Ball: {
          type: "object",
          properties: {
            over: { type: "integer" },
            ballInOver: { type: "integer" },
            striker: { type: "string" },
            nonStriker: { type: "string" },
            bowler: { type: "string" },
            runs: { type: "integer" },
            extras: {
              type: "object",
              properties: {
                wide: { type: "integer" },
                noBall: { type: "integer" },
                bye: { type: "integer" },
                legBye: { type: "integer" },
                penalty: { type: "integer" }
              }
            },
            totalRunsThisBall: { type: "integer" },
            isWicket: { type: "boolean" },
            wicketType: { type: "string", nullable: true },
            wicketPlayer: { type: "string", nullable: true },
            commentary: { type: "string", nullable: true }
          }
        },
        // --- Innings ---
        Innings: {
          type: "object",
          properties: {
            teamName: { type: "string" },
            balls: { type: "array", items: { $ref: "#/components/schemas/Ball" } },
            totalRuns: { type: "integer" },
            wickets: { type: "integer" },
            legalDeliveries: { type: "integer" },
            oversLimit: { type: "integer" },
            batsmen: { type: "array", items: { type: "object" } },
            bowlers: { type: "array", items: { type: "object" } },
            fallOfWickets: { type: "array", items: { type: "object" } },
            partnerships: { type: "object" },
            currentPartnership: { type: "object" },
            completed: { type: "boolean" }
          }
        },
        // --- Match ---
        Match: {
          type: "object",
          properties: {
            id: { type: "string" },
            roomId: { type: "string" },
            matchType: { type: "string" },
            tossWinner: { type: "string" },
            tossChoice: { type: "string" },
            innings: { type: "array", items: { $ref: "#/components/schemas/Innings" } },
            currentInningsIndex: { type: "integer" },
            status: { type: "string" },
            result: { type: "object" },
            createdAt: { type: "string", format: "date-time" }
          }
        }
      }
    },
    security: [{ BearerAuth: [] }]
  },
  apis: [
    "./routes/*.js",
    "./controllers/*.js"
  ]
};

module.exports = swaggerJsDoc(options);
