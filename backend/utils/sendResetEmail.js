// utils/sendResetEmail.js
const nodemailer = require("nodemailer");

const sendResetEmail = async (email, token) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: "refidSC@gmail.com", // або твій gmail
      pass: "mooa swrm svcv zfsd",
    },
  });

  const resetLink = `http://localhost:3000/reset-password/${token}`;

  const mailOptions = {
    from: '"Cyber Zone" <noreply@club.com>',
    to: email,
    subject: "Відновлення паролю",
    html: `
      <p>Щоб змінити пароль, перейдіть за посиланням нижче:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Посилання дійсне протягом 1 години.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendResetEmail;
