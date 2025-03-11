import nodemailer from "nodemailer";


export const sendMail=async(toEmail, body, subject, ccEmail = '')=>{
    console.log("BODY",body);
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'hello@spiderx.ai',
            pass: 'dgqg dmee ckoz ytvf'
        }
    });

    let mailOptions = {
        from: 'hello@spiderx.ai',
        to: toEmail,
        cc: ccEmail || undefined,
        subject: subject,
        html: `<div style="overflow-x: auto; white-space: nowrap;">
              <pre>${body}</pre>
           </div>`
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${toEmail} , ${ccEmail}`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}
