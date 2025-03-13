
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;
const RECRUITMENT_BOARD_ID = process.env.RECRUITMENT_BOARD_ID;


if (!MONDAY_API_KEY || !BOARD_ID || !GROUP_ID) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const mapWebflowFields = (formName, formData, submittedAt) => {
  let mappedData = { date: new Date(submittedAt).toISOString().split("T")[0] };
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

  return mappedData;
};

export const webflowWebhooks = async (req, res) => {

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

    res
      .status(200)
      .json({ success: true, message: `Received and saved form: ${formName}` });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error saving to Monday.com",
      error: error.response?.data || error.message,
    });
  }
};

export const getRecruitmentDetails = async()=>{
  try {
    
  } catch (error) {
    
  }
}
