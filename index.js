import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import moment from "moment-timezone";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;

const DEMO_BOARD_ID = "1944965797";

const CREATED_DATE_COLUMN_ID = "date_mknhjdhp";
const TEXT_DATE_COLUMN_ID = "date_mkn218r2";

const STATUS_COLUMN_ID = "status";
const LEAD_SCORE_COLUMN_ID = "numeric_mknst4ys";


const DEALS_COLUMN_ID = "numeric_mknseckr" ;

const LEAD_SCORE_MAPPING = {
  "New / Unqualified": 10,
  "Marketing qualified": 20,
  Followups: 25,
  "Sales qualified": 40,
  Junk: 0,
  "Closed (Not interested)": 0,
};

const DEAL_LEAD_SCORE_MAPPING = {
  "Pre Quote": 50,
  "Active Negotiation": 65,
  "Quote Given": 80,
  "Closed Won": 100,
  "Closed Lost": 0,
};

if (!MONDAY_API_KEY || !BOARD_ID || !GROUP_ID) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const mapWebflowFields = (formName, formData, submittedAt) => {
  let mappedData = { date: new Date(submittedAt).toISOString().split("T")[0] };
  console.log("form data", formData);
  mappedData = {
    ...mappedData,
    lead:
      formData["Name"] ||
      formData["Full Name"] ||
      (formData["First Name"] && formData["Last Name"]
        ? `${formData["First Name"]} ${formData["Last Name"]}`
        : "User"),
    company: formData["Company"] || "N/A",
    email: formData["Email"] || formData["Contact Email"] || "N/A",
    phone:
      formData["Phone"] ||
      formData["Phone 2"] ||
      formData["Contact No"] ||
      "N/A",
    message:
      formData["Message"] ||
      formData["Tell us what you are trying to build"] ||
      "N/A",
    source: formData["Form Source"] || "N/A",
    referral_url: formData["URL"] || "N/A",
  };

  console.log("Mapped Data", mappedData);
  return mappedData;
};

// webflow-webhook

app.post("/webflow-webhook", async (req, res) => {
  console.log("✅ Webflow Webhook Received!");

  const { payload } = req.body;
  if (!payload) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payload structure" });
  }

  const formName = payload.name || "Unknown Form";
  const formData = payload.data || {};
  const submittedAt = payload.submittedAt || new Date().toISOString();

  console.log(`📌 Form Submitted: ${formName}`);

  const mappedData = mapWebflowFields(formName, formData, submittedAt);
  console.log("📝 Mapped Data:", mappedData);

  const columnValues = {
    date4: mappedData.date,
    text_mknfkez9: mappedData.email,
    text_mknfphdb: mappedData.phone,
    text_mknf6w0k: mappedData.company || "",
    long_text_mkng2j3v: mappedData.message,
    text_mknh2vcq: mappedData.source,
    long_text_mknqqja7: mappedData.referral_url,
    status: { label: "New" },
  };

  const query = `
    mutation {
      create_item (
        board_id: ${BOARD_ID}, 
        group_id: "${GROUP_ID}",
        item_name: "${mappedData.lead}",
        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
      ) {
        id
      }
    }`;

  try {
    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          Authorization: MONDAY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Data saved to Monday.com:", response.data);
    res
      .status(200)
      .json({ success: true, message: `Received and saved form: ${formName}` });
  } catch (error) {
    console.error(
      "❌ Error saving to Monday.com:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Error saving to Monday.com",
      error: error.response?.data || error.message,
    });
  }
});

//date-conversion
app.post("/monday-webhook", async (req, res) => {
  try {

    console.log("🚀 Webhook received", JSON.stringify(req.body, null, 2));

    if (req.body.challenge) {
      console.log("🔄 Responding to challenge...");
      return res.json({ challenge: req.body.challenge });
    }

    const event = req.body.event;
    if (!event) {
      console.log("🛑 Ignoring webhook - No event data");
      return res.status(400).json({ error: "No event data" });
    }

    const { boardId, pulseId, type, columnId, value, previousValue } = event;

    console.log("🛠️ Debugging columnId before condition check:", columnId);
    console.log("✅ Expected column ID for Lead Score:", LEAD_SCORE_COLUMN_ID);
    console.log("✅ Event Type:", type);

    if (!boardId || !pulseId) {
      return res.status(400).json({ error: "Missing boardId or pulseId" });
    }

    // ✅ Date Change Handling
    if (
      type === "create_pulse" ||
      (type === "change_column_value" && columnId === TEXT_DATE_COLUMN_ID)
    ) {
      let dateText =
        type === "create_pulse"
          ? await getMondayColumnValue(boardId, pulseId, TEXT_DATE_COLUMN_ID)
          : value.text || value;

      if (!dateText || (previousValue && previousValue.text === dateText)) {
        return res
          .status(200)
          .json({ message: "No Date change detected, skipping update" });
      }

      const formattedDate = formatDate(dateText);
      if (!formattedDate) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      console.log("📝 Updating Created Date column...");
      const updateSuccess = await updateMondayDate(
        boardId,
        pulseId,
        formattedDate
      );
      return res.status(updateSuccess ? 200 : 500).json({
        message: updateSuccess
          ? "Date updated successfully"
          : "Failed to update Created Date",
      });
    }

    // ✅ Status Change Handling
    if (
      (type === "change_column_value" || type === "update_column_value") &&
      columnId === STATUS_COLUMN_ID
    ) {
      const newStatus = value.label?.text;
      const previousStatus = previousValue?.label?.text;

      if (!newStatus || !(newStatus in LEAD_SCORE_MAPPING)) {
        console.log("❌ Invalid status value, skipping update:", newStatus);
        return res.status(400).json({ error: "Invalid status value" });
      }

      const newLeadScore = LEAD_SCORE_MAPPING[newStatus];
      const previousLeadScore = previousStatus
        ? LEAD_SCORE_MAPPING[previousStatus]
        : null; // Get previous score

      if (previousLeadScore === null) {
        console.log(
          "⚠️ No previous lead score found, setting new score directly."
        );
      } else {
        console.log(
          `🔄 Status changed from ${previousStatus} to ${newStatus}, Lead Score from ${previousLeadScore} to ${newLeadScore}`
        );

        // Adjust the lead score based on direction of change
        const scoreChange = newLeadScore - previousLeadScore;
        if (scoreChange < 0) {
          console.log(`📉 Lead Score decreased by ${Math.abs(scoreChange)}`);
        } else if (scoreChange > 0) {
          console.log(`📈 Lead Score increased by ${scoreChange}`);
        } else {
          console.log("🔄 No change in lead score.");
        }
      }

      const updateSuccess = await updateMondayLeadScore(
        boardId,
        pulseId,
        newLeadScore
      );
      return res.status(updateSuccess ? 200 : 500).json({
        message: updateSuccess
          ? "Lead Score updated successfully"
          : "Failed to update Lead Score",
        previousLeadScore,
        newLeadScore,
        scoreChange: newLeadScore - (previousLeadScore ?? 0), // Return score difference
      });
    }

    if (
      (type === "change_column_value" || type === "update_column_value") && columnId === "deal_stage") {
      console.log("🚀 Triggered status update event!");

      console.log(`📌 Event Type: ${type}`);
      console.log(`📋 Column ID: ${columnId} (Expected: ${STATUS_COLUMN_ID})`);

      const newStatus = value.label?.text;
      const previousStatus = previousValue?.label?.text;

      console.log("🆕 New Status:", newStatus);
      console.log("📜 Previous Status:", previousStatus);

      if (!newStatus || !(newStatus in DEAL_LEAD_SCORE_MAPPING)) {
        console.log("❌ Invalid status value, skipping update:", newStatus);
        return res.status(400).json({ error: "Invalid status value" });
      }

      console.log("✅ Valid status detected, processing update...");

      const newLeadScore = DEAL_LEAD_SCORE_MAPPING[newStatus];
      const previousLeadScore = previousStatus
        ? DEAL_LEAD_SCORE_MAPPING[previousStatus]
        : null;

      console.log("📊 Lead Score Mapping:", DEAL_LEAD_SCORE_MAPPING);
      console.log(`🎯 New Lead Score: ${newLeadScore}`);
      console.log(`📉 Previous Lead Score: ${previousLeadScore}`);

      if (previousLeadScore === null) {
        console.log(
          "⚠️ No previous lead score found, setting new score directly."
        );
      } else {
        console.log(
          `🔄 Status changed from "${previousStatus}" to "${newStatus}", Lead Score from ${previousLeadScore} to ${newLeadScore}`
        );

        const scoreChange = newLeadScore - previousLeadScore;
        console.log(`📊 Score Change: ${scoreChange}`);

        if (scoreChange < 0) {
          console.log(`📉 Lead Score decreased by ${Math.abs(scoreChange)}`);
        } else if (scoreChange > 0) {
          console.log(`📈 Lead Score increased by ${scoreChange}`);
        } else {
          console.log("🔄 No change in lead score.");
        }
      }

      console.log(
        `📋 Updating Lead Score for Pulse ID: ${pulseId}, Board ID: ${DEMO_BOARD_ID}`
      );

      try {
        const updateSuccess = await updateMondayDealScore(
          DEMO_BOARD_ID,
          pulseId,
          newLeadScore
        );

        console.log(
          `✅ Update Status: ${updateSuccess ? "Success" : "Failed"}`
        );

        return res.status(updateSuccess ? 200 : 500).json({
          message: updateSuccess
            ? "Lead Score updated successfully"
            : "Failed to update Lead Score",
          previousLeadScore,
          newLeadScore,
          scoreChange: newLeadScore - (previousLeadScore ?? 0),
        });
      } catch (error) {
        console.error("❌ Error updating Lead Score:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }


    return res.status(200).json({ message: "Ignoring unrelated event" });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getMondayColumnValue(boardId, pulseId, columnId) {
  try {
    const query = `
          query {
              items(ids: ${pulseId}) {
                  column_values(ids: ["${columnId}"]) {
                      text
                  }
              }
          }
      `;

    console.log("📡 Fetching column value from Monday.com...");
    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    const columnValue = response.data.data?.items[0]?.column_values[0]?.text;
    return columnValue || null;
  } catch (error) {
    console.error(
      "❌ Error fetching Monday.com column value:",
      error.response?.data || error.message
    );
    return null;
  }
}

function formatDate(dateString) {
  if (!dateString) return null;

  console.log("📥 Received date for formatting:", dateString);

  const cleanedDateString = dateString.replace(/\+\d{2}(:\d{2}|\.\d{2})?$/, "");
  console.log("🔄 Cleaned Date String:", cleanedDateString);

  let parsedDate = moment.utc(cleanedDateString, moment.ISO_8601, true);
  if (!parsedDate.isValid()) {
    console.error("❌ Invalid date format received:", dateString);
    return null;
  }

  let istDate = parsedDate.tz("Asia/Kolkata");

  const formattedDate = istDate.format("YYYY-MM-DD");
  console.log("✅ Final Formatted Date (IST):", formattedDate);

  return formattedDate;
}

async function updateMondayLeadScore(boardId, pulseId, leadScore) {
  try {
    const mutation = `
          mutation {
              change_column_value(
                  board_id: ${boardId}, 
                  item_id: ${pulseId}, 
                  column_id: "${LEAD_SCORE_COLUMN_ID}", 
                  value: "${leadScore}"
              ) {
                  id
              }
          }
      `;

    console.log("📡 Sending Lead Score update to Monday.com:", mutation);

    const response = await axios.post(
      "https://api.monday.com/v2",
      { query: mutation },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    console.log(
      "✅ Monday API Response:",
      JSON.stringify(response.data, null, 2)
    );

    if (response.data.errors) {
      console.error("❌ Monday API Error:", response.data.errors);
      return false;
    }

    console.log("✅ Lead Score updated successfully!");
    return response.data.data?.change_column_value?.id ? true : false;
  } catch (error) {
    console.error(
      "❌ Error updating Lead Score in Monday.com:",
      error.response?.data || error.message
    );
    return false;
  }
}

//NEW
async function updateMondayDealScore(boardId, pulseId, dealScore) {
  try {
    const mutation = `
          mutation {
              change_column_value(
                  board_id: ${boardId}, 
                  item_id: ${pulseId}, 
                  column_id: "${DEALS_COLUMN_ID}", 
                  value: "${dealScore}"
              ) {
                  id
              }
          }
      `;

    console.log("📡 Sending Deal Score update to Monday.com:", mutation);

    const response = await axios.post(
      "https://api.monday.com/v2",
      { query: mutation },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    console.log("✅ Monday API Response:", JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error("❌ Monday API Error:", response.data.errors);
      return false;
    }

    console.log("✅ Deal Score updated successfully!");
    return response.data.data?.change_column_value?.id ? true : false;
  } catch (error) {
    console.error(
      "❌ Error updating Deal Score in Monday.com:",
      error.response?.data || error.message
    );
    return false;
  }
}


async function updateMondayDate(boardId, pulseId, formattedDate) {
  try {
    if (!formattedDate) {
      console.error("❌ Invalid formatted date:", formattedDate);
      return false;
    }

    const mutation = `
          mutation {
              change_column_value(
                  board_id: ${boardId}, 
                  item_id: ${pulseId}, 
                  column_id: "${CREATED_DATE_COLUMN_ID}", 
                  value: "{\\"date\\":\\"${formattedDate}\\"}"
              ) {
                  id
              }
          }
      `;

    console.log("📡 Sending update to Monday.com:", mutation);

    const response = await axios.post(
      "https://api.monday.com/v2",
      { query: mutation },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    console.log(
      "✅ Monday API Response:",
      JSON.stringify(response.data, null, 2)
    );

    if (response.data.errors) {
      console.error("❌ Monday API Error:", response.data.errors);
      return false;
    }

    console.log("✅ Created Date updated successfully!");
    return response.data.data?.change_column_value?.id ? true : false;
  } catch (error) {
    console.error(
      "❌ Error updating Monday.com:",
      error.response?.data || error.message
    );
    return false;
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});


