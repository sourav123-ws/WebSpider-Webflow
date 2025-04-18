import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { main } from "./monday.js";
import { managerScoreValue, mondayWebhooks } from "./controllers/monday-webhooks.js";
import { getRecruitmentDetails, webflowWebhooks } from "./controllers/webflow-webhooks.js";
import cron from "node-cron";
import { fetchAndSaveLatestCallsToMonday, fetchAndSaveLatestJulyCallsToMonday, insertThroughWebhook } from "./controllers/voice-records.js";
import { createBookingItem } from "./controllers/tomma.js";
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
app.post("fetch-save-vodafone-calls",fetchAndSaveLatestCallsToMonday);
app.post("/fetch-save-july-calls",fetchAndSaveLatestJulyCallsToMonday);
app.post("/insert-through-webhook", insertThroughWebhook)
app.post("/tomma-booking-webhook",createBookingItem);

app.get("/run-cron", async (req, res) => {
  console.log("🚀 Running cron job...");

  try {
    await main();
    console.log("✅ Cron job completed successfully.");
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error during cron job execution:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});



