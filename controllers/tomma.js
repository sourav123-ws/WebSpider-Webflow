import axios from "axios";

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = 1997104480;

export const createBookingItem = async (req, res) => {
  console.log("Incoming status:", req.body.status);

  const {
    bookingId,
    assistantId,
    bookingRefNr,
    customerFirstName,
    customerLastName,
    customerPhoneNumber,
    dtmBookedFor,
    numberOfPersons,
    diningArea,
    cancelReason,
    status,
    failReason,
  } = req.body;

  console.log("REQ BODY",req.body)

  const isCancelled = status === "CANCELED";
  const isReserved = status === "RESERVED";
  const isFailed = status === "FAILED";

  if (isCancelled) {
    try {
      const findQuery = `
        query {
          boards(ids: ${BOARD_ID}) {
            items_page(limit: 100) {
              items {
                id
                column_values {
                  id
                  text
                }
              }
            }
          }
        }
      `;

      const findRes = await axios.post(
        "https://api.monday.com/v2",
        { query: findQuery },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );

      const items = findRes.data.data.boards[0].items_page.items;
      const matchingItem = items.find((item) => {
        const bookingIdCol = item.column_values.find((col) => col.id === "text_mkpsxdc3");
        return bookingIdCol?.text === bookingId.toString();
      });

      if (!matchingItem) {
        return res.status(404).json({ success: false, message: "Booking item not found" });
      }

      const updateQuery = `
        mutation {
          change_multiple_column_values(
            board_id: ${BOARD_ID},
            item_id: ${matchingItem.id},
            column_values: ${JSON.stringify(JSON.stringify({
              color_mkpshs7z: { label: "CANCELED" },
              text_mkpsm1pf: cancelReason || "N/A"
            }))}
          ) {
            id
          }
        }
      `;

      const updateRes = await axios.post(
        "https://api.monday.com/v2",
        { query: updateQuery },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );

      console.log("Booking canceled, item updated:", updateRes.data.data.change_multiple_column_values.id);
      return res.status(200).json({ success: true, itemId: matchingItem.id });

    } catch (err) {
      console.error("Error during cancel update:", err.response?.data || err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (isReserved || isFailed) {
    const columnValues = {
      text_mkpsxdc3: bookingId.toString(),
      text_mkpswjjk: assistantId,
      text_mkps3cmr: customerFirstName,
      text_mkps7pxw: customerLastName,
      text_mkps8544: customerPhoneNumber,
      text_mkpskagj: dtmBookedFor,
      date4: {
        date: dtmBookedFor.split("T")[0],
      },
      text_mkpsq54c: numberOfPersons.toString(),
      text_mkpsjrwn: diningArea,
      text_mkpsra36: isFailed ? (failReason) : "N/A",
      text_mkpsm1pf : "N/A",
      color_mkpshs7z: { label: status },
    };

    if (isReserved) {
      columnValues.text_mkpspcgy = bookingRefNr;
    }else{
      columnValues.text_mkpspcgy = "N/A";
    }

    const fullName = `${customerFirstName || ''} ${customerLastName || ''}`.trim();

    const createQuery = `
      mutation {
        create_item(
          board_id: ${BOARD_ID},
          group_id: "topics",
          item_name: "${fullName}",
          column_values: ${JSON.stringify(JSON.stringify(columnValues))}
        ) {
          id
        }
      }
    `;

    try {
      const response = await axios.post(
        "https://api.monday.com/v2",
        { query: createQuery },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );

      if (response.data.errors) {
        console.error("GraphQL error:", response.data.errors);
        return res.status(500).json({ success: false, error: response.data.errors });
      }

      console.log("Booking created (RESERVED/FAILED), item ID:", response.data.data.create_item.id);
      return res.status(200).json({
        success: true,
        itemId: response.data.data.create_item.id,
      });

    } catch (err) {
      console.error("Error creating booking item:", err.response?.data || err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(400).json({ success: false, message: "Unsupported status" });
};
