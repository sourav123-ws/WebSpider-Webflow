import nodemailer from "nodemailer";


export const sendMail=async(toEmail, body, subject, ccEmail = '' , bccEmail = '')=>{
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
        bcc : bccEmail || undefined,
        subject: subject,
        html: body
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${toEmail} , ${ccEmail}`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}


export const getTimeOfDay=()=>{
    const hours = new Date().getHours();
    return hours < 12 ? "Morning" : "Evening";
  }
  