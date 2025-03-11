import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { main } from "./monday.js";
import { managerScoreValue, mondayWebhooks } from "./controllers/monday-webhooks.js";
import { webflowWebhooks } from "./controllers/webflow-webhooks.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;


if (!MONDAY_API_KEY || !BOARD_ID || !GROUP_ID) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}


app.post("/webflow-webhook",webflowWebhooks);
app.post("/monday-webhook",mondayWebhooks);
app.post("/manage-score-value",managerScoreValue);


// setInterval(() => {
//   console.log("⏳ Running main() at:", new Date().toLocaleTimeString());
//   main();
// }, 60 * 1000)

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});
