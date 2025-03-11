import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const completions=async(messages, format = null)=>{
    let ret_val = { status: -1, data: [] };
    try {
        const aiRequest = {
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500
        };

        const openaiApiKey = process.env.OPENAI_API_KEY;
        const response = await axios.post('https://api.openai.com/v1/chat/completions', aiRequest, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        const textResponse = response.data.choices[0].message.content;

        if (textResponse) {
            if (format == 'followup') {
                try {
                    ret_val.data = textResponse
                        .split('\n')
                        .map((q) => q.trim())
                        .filter((text) => text.length);
                    ret_val.status = 0;
                } catch (error) {
                    console.error('Error formatting questions:', error);
                }
            } else {
                ret_val.data = textResponse
            }
            ret_val.status=0
        }
    } catch (error) {
        console.error('Error in openai/completion:', error);
    }
    return ret_val;
}


