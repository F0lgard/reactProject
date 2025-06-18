const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");

(async () => {
  // Підключення до MongoDB
  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const db = client.db("computerClub"); // Назва бази даних
    const collection = db.collection("devices");

    // Читання JSON-файлу
    const rawData = fs.readFileSync(
      "generated_may_bookings_realistic.json",
      "utf-8"
    );
    const data = JSON.parse(rawData);
    const newDevices = data.devices;

    // Перевірка і перетворення $oid у ObjectId для _id пристроїв і бронювань, а також дат
    const updatedDevices = newDevices.map((device) => {
      console.log("Raw device._id:", device._id); // Відладка
      console.log("device._id.$oid:", device._id.$oid); // Відладка
      const deviceId = new ObjectId(device._id["$oid"]); // Явний доступ до $oid
      const updatedBookings = device.bookings.map((booking) => {
        console.log("Raw booking._id:", booking._id); // Відладка
        console.log("booking._id.$oid:", booking._id.$oid); // Відладка
        try {
          const bookingId = new ObjectId(booking._id["$oid"]);
          return {
            ...booking,
            _id: bookingId,
            startTime: new Date(booking.startTime["$date"]), // Конвертація в Date
            endTime: new Date(booking.endTime["$date"]), // Конвертація в Date
          };
        } catch (err) {
          console.error(
            `Помилка конвертації _id ${booking._id.$oid}:`,
            err.message
          );
          return {
            ...booking,
            _id: new ObjectId(), // Генеруємо новий унікальний ObjectId
            startTime: new Date(booking.startTime["$date"]), // Конвертація в Date
            endTime: new Date(booking.endTime["$date"]), // Конвертація в Date
          };
        }
      });
      return { _id: deviceId, bookings: updatedBookings };
    });

    // Оновлення кожного пристрою, замінюючи bookings
    const bulkOperations = updatedDevices.map((device) => ({
      updateOne: {
        filter: { _id: device._id }, // Фільтр за ObjectId
        update: { $set: { bookings: device.bookings } }, // Оновлюємо лише bookings
        upsert: false, // Не додаємо нові пристрої
      },
    }));

    // Виконуємо bulk операції
    const result = await collection.bulkWrite(bulkOperations);
    console.log(
      `Оновлено ${result.modifiedCount} документів у колекції 'devices'.`
    );
  } catch (err) {
    console.error("Помилка:", err);
  } finally {
    await client.close();
  }
})();
