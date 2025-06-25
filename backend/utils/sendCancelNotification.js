// sendCancelNotification.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "refidSC@gmail.com",
    pass: "mooa swrm svcv zfsd",
  },
});

const sendCancelNotification = async (to, username, startTime) => {
  const formattedTime = new Date(startTime).toLocaleString("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const mailOptions = {
    from: "Cyber Zone <noreply@club.com>",
    to,
    subject: "Ваше бронювання було скасовано адміністратором",
    html: `
      <p>Шановний(а) ${username},</p>
      <p>Ваше бронювання, яке було заплановане на <strong>${formattedTime}</strong>, скасовано адміністратором.</p>
      <p>Якщо у вас є питання, будь ласка, зверніться до адміністрації для уточнення причин.</p>
      <p>З повагою,<br>Команда Cyber Zone</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendCancelNotification;
