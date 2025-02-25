import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;

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
  };

  console.log("Mapped Data", mappedData);
  return mappedData;
};

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

app.listen(PORT, () =>
  console.log(
    `🚀 Webhook listening on http://localhost:${PORT}/webflow-webhook`
  )
);
