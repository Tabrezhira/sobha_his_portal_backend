import nodemailer from "nodemailer";

export const sendMail = async (req, res) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: "tabrez.hakimji@sobhaconst.com",
                pass: "Nov@2025",
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: "tabrez.hakimji@sobhaconst.com",
            to: "ricky.johnson@sobhaconst.com",
            subject: "Test Mail from Express",
            text: "hi from express",
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);

        res.status(200).json({
            success: true,
            message: "Mail sent successfully",
            messageId: info.messageId
        });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({
            success: false,
            message: "Error sending email",
            error: error.message
        });
    }
};

export default { sendMail };
