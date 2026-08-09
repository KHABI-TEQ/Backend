import nodemailer from "nodemailer";

type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  /** Set true to skip buyer in-app / push mirroring for this mail. */
  skipBuyerInbox?: boolean;
};

const sendEmail = async (emailOptions: EmailOptions) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    secure: false,
    port: 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: `${process.env.FROM_NAME} <${process.env.EMAIL_USER}>`,
    to: emailOptions.to,
    subject: emailOptions.subject,
    text: emailOptions.text,
    html: emailOptions.html,
    attachments: emailOptions.attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);

    if (!emailOptions.skipBuyerInbox) {
      // Dynamic import avoids circular deps with controllers/DB.
      void import("../services/buyerNotification.service")
        .then(({ mirrorEmailToBuyerInbox }) =>
          mirrorEmailToBuyerInbox({
            to: emailOptions.to,
            subject: emailOptions.subject,
            text: emailOptions.text,
          })
        )
        .catch((err) =>
          console.warn(
            "[Email] Buyer inbox mirror failed:",
            (err as Error).message
          )
        );
    }
  } catch (error) {
    console.error("Error sending email: %s", error);
  }
};

export default sendEmail;
