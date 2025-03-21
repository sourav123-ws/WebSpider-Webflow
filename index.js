import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { main } from "./monday.js";
import { managerScoreValue, mondayWebhooks } from "./controllers/monday-webhooks.js";
import { getRecruitmentDetails, webflowWebhooks } from "./controllers/webflow-webhooks.js";
import cron from "node-cron";
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
app.post("/get-recruitment-details",getRecruitmentDetails)
app.post("/manage-score-value",managerScoreValue);


app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});

cron.schedule("30 3,15 * * *", async () => {
  console.log("Running cron job at 9:00 AM and 9:00 PM IST...");
  try {
    await main();
  } catch (error) {
    console.error("Error occurred during cron job execution:", error);
  }
});


