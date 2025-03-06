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

const CREATED_DATE_COLUMN_ID = "date_mknhjdhp";
const TEXT_DATE_COLUMN_ID = "date_mkn218r2";

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
    referral_url : formData["URL"] || "N/A",
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
    long_text_mknqqja7 : mappedData.referral_url,
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
    res
      .status(500)
      .json({
        success: false,
        message: "Error saving to Monday.com",
        error: error.response?.data || error.message,
      });
  }
});

//date-conversion
app.post("/monday-webhook", async (req, res) => {
  try {
      console.log("🚀 Webhook received>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", JSON.stringify(req.body, null, 2));

      // ✅ Handle the challenge request from Monday.com
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

      if (!boardId || !pulseId) {
          return res.status(400).json({ error: "Missing boardId or pulseId" });
      }

      if (type === "create_pulse") {
          let dateText = await getMondayColumnValue(boardId, pulseId, TEXT_DATE_COLUMN_ID);

          if (!dateText) {
              return res.status(200).json({ message: "No Date (Text) found, skipping update" });
          }

          const formattedDate = formatDate(dateText);
          if (!formattedDate) {
              return res.status(400).json({ error: "Invalid date format" });
          }

          const updateSuccess = await updateMondayDate(boardId, pulseId, formattedDate);
          return res.status(updateSuccess ? 200 : 500).json({ message: updateSuccess ? "Created Date updated" : "Failed to update Created Date" });
      }

      if ((type === "change_column_value" || type === "update_column_value") && columnId === TEXT_DATE_COLUMN_ID) {
          let dateText = value.text || value;

          if (previousValue && previousValue.text === dateText) {
              return res.status(200).json({ message: "Date has not changed, no update needed" });
          }

          const formattedDate = formatDate(dateText);
          if (!formattedDate) {
              return res.status(400).json({ error: "Invalid date format" });
          }

          console.log("📝 Updating Created Date column...");
          const updateSuccess = await updateMondayDate(boardId, pulseId, formattedDate);
          return res.status(updateSuccess ? 200 : 500).json({ message: updateSuccess ? "Date updated successfully" : "Failed to update Created Date" });
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
      console.error("❌ Error fetching Monday.com column value:", error.response?.data || error.message);
      return null;
  }
}


function formatDate(dateString) {
  console.log("📌 Raw date string:", dateString);

  // Parse as an ISO 8601 date string (which Monday.com sends)
  let parsedDate = moment.utc(dateString);

  if (!parsedDate.isValid()) {
      console.error("❌ Invalid date format:", dateString);
      return null;
  }

  // Convert to IST (Indian Standard Time)
  let istDate = parsedDate.tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

  console.log("🕰️ Converted to IST:", istDate);

  return istDate;
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

      console.log("✅ Monday API Response:", JSON.stringify(response.data, null, 2));

      if (response.data.errors) {
          console.error("❌ Monday API Error:", response.data.errors);
          return false;
      }

      console.log("✅ Created Date updated successfully!");
      return response.data.data?.change_column_value?.id ? true : false;
  } catch (error) {
      console.error("❌ Error updating Monday.com:", error.response?.data || error.message);
      return false;
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});
