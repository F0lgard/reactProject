const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, enum: ["pc", "ps"], required: true },
  zone: { type: String, enum: ["Pro", "VIP", "PS"], required: true },
  bookings: [
    {
      userId: { type: String, required: true },
      userEmail: { type: String, required: true },
      startTime: { type: Date, required: true },
      endTime: { type: Date, required: true },
      price: { type: Number, required: true }, // Додаємо нове поле
    },
  ],
});
const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
