const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "refidSC@gmail.com", // ✅ ЗАМІНИ на свій Gmail
    pass: "mooa swrm svcv zfsd", // ✅ ЗАМІНИ на свій App Password
  },
});

const sendVerificationEmail = async (to, token) => {
  const link = `http://localhost:3001/verify-email?token=${token}`;

  const mailOptions = {
    from: '"Cyber Zone" <noreply@club.com>', // той самий email
    to,
    subject: "Підтвердження email для комп'ютерного клубу",
    html: `
      <h2>Привіт!</h2>
      <p>Натисни, щоб підтвердити свою пошту:</p>
      <a href="${link}" style="padding: 10px 15px; background: #4caf50; color: white; text-decoration: none; border-radius: 4px;">Підтвердити</a>
      <p>Якщо ти не реєструвався — просто ігноруй це повідомлення.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendVerificationEmail;
