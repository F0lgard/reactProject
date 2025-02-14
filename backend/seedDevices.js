const mongoose = require("mongoose");
const Device = require("./models/Device"); // Шлях до моделі, виправи якщо треба

mongoose.connect("mongodb://localhost:27017/computerClub", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const devices = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `ПК${i + 1}P`,
    type: "pc",
    zone: "Pro",
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `ПК${i + 1}V`,
    type: "pc",
    zone: "VIP",
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `PS${i + 1}`,
    type: "ps",
    zone: "PS",
  })),
];

const seedDB = async () => {
  //await Device.deleteMany({}); // Видаляє всі пристрої перед ініціалізацією
  await Device.insertMany(devices.map((d) => ({ ...d, bookings: [] })));
  console.log("Пристрої успішно додані!");
  mongoose.connection.close();
};

seedDB();
