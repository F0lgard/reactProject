const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const shortid = require("shortid");
const WebSocket = require("ws");
const axios = require("axios");
const Device = require("./models/Device");
const sendVerificationEmail = require("./utils/sendVerificationEmail");
const crypto = require("crypto"); // для створення токену
const sendResetEmail = require("./utils/sendResetEmail");
const bcrypt = require("bcrypt");

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));
// Підключення до бази даних MongoDB
mongoose.connect("mongodb://localhost:27017/computerClub", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

// Перевірка підключення до бази даних
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  console.log("Connected to the database");
});

// Створення схеми користувача

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatar: {
      type: String,
      default: "./uploads/usericon.png",
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    lastCommentDate: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // ✅ Нові поля для підтвердження email:
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },

    // ✅ Нові поля для no-show
    noShowCount: {
      type: Number,
      default: 0, // Кількість no-show
    },
    noShowHistory: {
      type: [
        {
          date: { type: Date, default: Date.now },
          type: { type: String, enum: ["cancelled", "noShow"], required: true }, // Тип події
          bookingId: { type: mongoose.Schema.Types.ObjectId },
        },
      ],
      default: [], // Історія no-show
    },
    cancelCount: { type: Number, default: 0 },
    cancelHistory: [
      {
        date: { type: Date, required: true },
        type: { type: String, required: true },
        bookingId: { type: mongoose.Schema.Types.ObjectId },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User; // Експортуємо модель

// Створення схеми турніру
const turnirSchema = new mongoose.Schema({
  pairs: [
    {
      team1: String,
      team2: String,
      winner: String, // Додаємо поле для переможця
    },
  ],
  turnirName: String,
  uniqueCode: String,
  createdAt: { type: Date, default: Date.now, index: { expires: "7d" } }, // Додаємо поле createdAt з TTL індексом
});

const Turnir = mongoose.model("Turnir", turnirSchema);

// Створення схеми бронювання
/* const BookingSchema = new mongoose.Schema({
  zone: String,
  hours: Number,
  price: Number,
  userId: mongoose.Schema.Types.ObjectId,
  userEmail: String, // Додаємо поле для зберігання емейлу користувача
  date: Date,
  time: String,
  createdAt: { type: Date, default: Date.now, index: { expires: "3d" } }, // Додаємо поле createdAt з TTL індексом
}); */

//const Booking = mongoose.model("Booking", BookingSchema);

// WebSocket сервер
const wss = new WebSocket.Server({ port: 8000 });

wss.on("connection", (ws) => {
  console.log("New client connected");
  ws.on("message", (message) => {
    console.log(`Received message => ${message}`);
  });
  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

const notifyClients = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

/*const onNewBooking = (booking) => {
  notifyClients({ type: "NEW_BOOKING", booking });
};*/

app.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Користувач із таким ім'ям або емейлом вже існує" });
    }

    const avatar =
      req.body.avatar || "http://localhost:3001/uploads/usericon.png";

    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 🔐 Хешуємо пароль перед збереженням
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword, // зберігаємо хеш, а не оригінал
      role,
      avatar,
      verificationToken,
      isVerified: false,
    });

    await newUser.save();

    // 🔔 Надсилаємо лист
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: "Користувач створений. Перевірте пошту для підтвердження.",
    });
  } catch (err) {
    console.error("Помилка реєстрації:", err);
    res.status(500).json({ error: "Не вдалося зареєструвати користувача" });
  }
});

app.post("/login", async (req, res) => {
  const { login, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }],
    });

    if (!user) {
      return res.status(401).json({ message: "Неправильний логін або емейл" });
    }

    const isHashed = user.password.startsWith("$2b$");

    let isPasswordValid = false;

    if (isHashed) {
      // 🔐 новий користувач
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      // 🧓 старий користувач
      if (user.password === password) {
        // 🔄 автоматично хешуємо й оновлюємо пароль
        const hashed = await bcrypt.hash(password, 10);
        user.password = hashed;
        await user.save();
        isPasswordValid = true;
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неправильний пароль" });
    }

    // 🔒 Перевірка email верифікації
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Будь ласка, підтвердіть свою електронну пошту перед входом.",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Помилка при авторизації:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Невірний запит: немає токену");
  }

  try {
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).send("Невірний або прострочений токен");
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.send(`
      <h2>✅ Пошта успішно підтверджена!</h2>
      <p>Тепер ви можете увійти до системи.</p>
    `);
  } catch (err) {
    console.error("Помилка під час верифікації:", err);
    res.status(500).send("Сталася помилка на сервері");
  }
});

app.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Пошта вже підтверджена" });
    }

    // Створюємо новий токен
    const newToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = newToken;

    await user.save();

    await sendVerificationEmail(user.email, newToken, user.username);
    res.status(200).json({ message: "Лист підтвердження повторно надіслано" });
  } catch (error) {
    console.error("Помилка при повторній верифікації:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

app.post("/request-password-reset", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: "Користувача з таким email не знайдено." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiration = Date.now() + 60 * 60 * 1000; // 1 година

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expiration;
    await user.save();

    await sendResetEmail(email, token);

    res.json({ message: "Лист з відновленням надіслано." });
  } catch (error) {
    console.error("Помилка надсилання листа:", error);
    res.status(500).json({ message: "Не вдалося надіслати лист." });
  }
});

app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Недійсне або прострочене посилання." });
    }

    // 🔐 Хешуємо новий пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Пароль успішно змінено!" });
  } catch (error) {
    console.error("Помилка при скиданні паролю:", error);
    res.status(500).json({ message: "Серверна помилка." });
  }
});

// Обробник POST-запиту для створення нового турніру
app.post("/createTurnir", async (req, res) => {
  const { pairs, turnirName } = req.body;
  try {
    const uniqueCode = shortid.generate();
    const newTurnir = new Turnir({ pairs, turnirName, uniqueCode });
    await newTurnir.save();
    res.status(200).json({ uniqueCode });
  } catch (error) {
    console.error("Помилка при створенні турніру:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// Обробник POST-запиту для пошуку турніру за унікальним кодом
app.post("/findTurnir", async (req, res) => {
  const { uniqueCode } = req.body;

  try {
    const turnirData = await Turnir.findOne({ uniqueCode });

    if (turnirData) {
      const { pairs, turnirName, uniqueCode } = turnirData;
      res.status(200).json({ turnirData: { pairs, turnirName, uniqueCode } });
      console.log("turnir found");
      console.log(turnirData);
    } else {
      res.status(404).json({ message: "Турнір не знайдено" });
    }
  } catch (error) {
    console.error("Помилка при пошуку турніру:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// Обробник POST-запиту для оновлення турніру
app.post("/updateTurnir", async (req, res) => {
  const { turnir } = req.body;

  try {
    const updatedTurnir = await Turnir.findOneAndUpdate(
      { uniqueCode: turnir.uniqueCode },
      { pairs: turnir.pairs },
      { new: true }
    );

    if (updatedTurnir) {
      res.status(200).json({ message: "Турнір успішно оновлено" });
    } else {
      res.status(404).json({ message: "Турнір не знайдено" });
    }
  } catch (error) {
    console.error("Помилка при оновленні турніру:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

/*app.post("/bookings", async (req, res) => {
  const { zone, hours, price, userId, date, time } = req.body;

  try {
    const user = await User.findById(userId); // Знаходимо користувача за userId
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const newBooking = new Booking({
      zone,
      hours,
      price,
      userId,
      userEmail: user.email, // Зберігаємо емейл користувача
      date,
      time,
    });
    await newBooking.save();
    onNewBooking(newBooking); // Викликаємо функцію для повідомлення клієнтів
    res
      .status(200)
      .json({ message: "Booking created successfully", booking: newBooking });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Обробник GET-запиту для отримання всіх бронювань
app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Обробник GET-запиту для отримання бронювань користувача
app.get("/bookings/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const bookings = await Booking.find({ userId });
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Обробник DELETE-запиту для видалення бронювання
app.delete("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Received delete request for booking ID:", id); // Log the received ID

  try {
    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    notifyClients({ type: "DELETE_BOOKING", booking: deletedBooking });
    res.status(200).json({
      message: "Booking deleted successfully",
      booking: deletedBooking,
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ message: "Server error" });
  }
}); */

// Обробник POST-запиту для зміни пароля

app.post("/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Користувача не знайдено" });
    }

    // 🔐 Перевірка поточного пароля
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Неправильний поточний пароль" });
    }

    // 🔐 Хешуємо новий пароль
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;

    await user.save();
    res.status(200).json({ success: true, message: "Пароль успішно змінено" });
  } catch (error) {
    console.error("Помилка при зміні пароля:", error);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});

// Обробник POST-запиту для перевірки унікальності користувацького імені
app.post("/check-username", async (req, res) => {
  const { username } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to check username");
  }
});

// Обробник POST-запиту для перевірки унікальності емейлу
app.post("/check-email", async (req, res) => {
  const { email } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to check email");
  }
});

// Схема для MongoDB
const reviewSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    useri: {
      username: { type: String, required: true },
      profileImage: { type: String, default: "" },
      userId: { type: String, required: true },
    },
    sentiment: { type: String, required: true }, // Поле для настрою
    processedText: { type: String, required: true }, // Поле для відфільтрованого тексту
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);

// Функція коригування настрою
const adjustSentiment = (sentiment, rating) => {
  if (sentiment === "Negative" && rating > 3) {
    return "Neutral"; // Якщо негативний настрій і висока оцінка, робимо нейтральним
  }

  if (sentiment === "Neutral" && rating <= 2) {
    return "Negative"; // Якщо нейтральний настрій і низька оцінка, робимо негативним
  }

  if (sentiment === "Positive" && rating <= 3) {
    return "Neutral"; // Якщо нейтральний настрій і низька оцінка, робимо негативним
  }

  return sentiment; // Для інших випадків повертаємо оригінальний настрій
};

// Ендпойнт для отримання всіх коментарів
app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

app.post("/api/reviews", async (req, res) => {
  const { text, rating, useri, sentiment, processedText } = req.body;

  try {
    const user = await User.findById(useri.userId);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const currentDate = new Date();
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    if (user.role !== "admin") {
      if (user.lastCommentDate && user.lastCommentDate > oneWeekAgo) {
        if (user.commentsCount >= 3) {
          return res
            .status(400)
            .json({ error: "Ви можете написати лише 3 відгуки на тиждень" });
        }
      } else {
        user.commentsCount = 0;
      }
    }

    const adjustedSentiment = adjustSentiment(sentiment, rating);

    const newReview = new Review({
      text,
      rating,
      useri,
      sentiment: adjustedSentiment,
      processedText,
    });

    await newReview.save();

    user.commentsCount += 1;
    user.lastCommentDate = currentDate;
    await user.save();

    return res.status(201).json(newReview);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error adding review" });
  }
});

const multer = require("multer");
const path = require("path");

// Налаштування для multer

// Налаштування multer для збереження файлів
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Папка для збереження
  },
  filename: (req, file, cb) => {
    // Генерація імені файлу
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Завантаження аватара користувача
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId відсутній у запиті" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    // Зберігаємо шлях до файлу аватара
    user.avatar = `http://localhost:3001/uploads/${req.file.filename}`;
    await user.save();
    console.log("userId на бекенді:", userId);
    console.log("Файл:", req.file);

    res.status(200).json({
      message: "Аватар успішно завантажено",
      avatar: user.avatar,
    });
    console.log("Новий аватар користувача:", user.avatar);
  } catch (error) {
    console.error("Помилка при завантаженні аватара:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// **Отримати список пристроїв і їх статус**
app.get("/devices/status", async (req, res) => {
  try {
    const devices = await Device.find();

    const currentTime = new Date();
    const bufferTime = 30 * 60 * 1000; // 30 хвилин у мілісекундах

    const devicesWithStatus = devices.map((device) => {
      const isBooked = device.bookings.some(
        (booking) =>
          (currentTime >= booking.startTime && currentTime < booking.endTime) ||
          (booking.startTime - currentTime <= bufferTime &&
            booking.startTime > currentTime)
      );

      return { ...device.toObject(), isBooked };
    });

    res.json(devicesWithStatus);
  } catch (error) {
    res.status(500).json({ error: "Помилка отримання статусу пристроїв" });
  }
});

app.post("/devices/book", async (req, res) => {
  try {
    const { deviceId, userId, userEmail, startTime, duration, price } =
      req.body;

    // Конвертація в UTC з урахуванням часового поясу клієнта
    const clientStart = new Date(startTime);
    const utcStart = new Date(
      clientStart.getTime() - clientStart.getTimezoneOffset() * 60000
    );
    const utcEnd = new Date(utcStart.getTime() + duration * 3600000);

    // Перевірка мінімального часу (8:00 за локальним часом клієнта)
    const clientHours = clientStart.getHours();
    if (clientHours < 8) {
      return res.status(400).json({ error: "Бронювання можливе з 08:00" });
    }

    // Перевірка максимального часу (24:00 за локальним часом)
    const clientEnd = new Date(clientStart.getTime() + duration * 3600000);
    if (
      clientEnd.getHours() >= 24 ||
      clientEnd.getDate() !== clientStart.getDate()
    ) {
      return res
        .status(400)
        .json({ error: "Бронювання має закінчуватися до 24:00" });
    }

    // Перевірка на минулий час (UTC)
    const nowUTC = new Date();
    if (utcStart < nowUTC) {
      return res
        .status(400)
        .json({ error: "Неможливо бронювати на минулий час" });
    }

    // Пошук пристрою та перевірка конфліктів
    const device = await Device.findOne({ id: deviceId });
    if (!device) {
      return res.status(404).json({ error: "Пристрій не знайдено" });
    }

    const hasConflict = (device.bookings || []).some((b) => {
      const existingStart = new Date(b.startTime);
      const existingEnd = new Date(b.endTime);
      // Ігноруємо бронювання зі статусом 'cancelled'
      if (b.status === "cancelled" || b.status === "noShow") {
        console.log(
          `⏭ Пропускаємо конфлікт з 'cancelled' бронюванням: ${existingStart.toISOString()} - ${existingEnd.toISOString()}`
        );
        return false;
      }
      return utcStart < existingEnd && utcEnd > existingStart;
    });

    if (hasConflict) {
      return res.status(400).json({ error: "Час вже зайнятий" });
    }

    // Збереження в UTC
    device.bookings.push({
      userId,
      userEmail,
      startTime: utcStart,
      endTime: utcEnd,
      price,
      status: "pending", // Встановлюємо статус 'pending' за замовчуванням
    });

    await device.save();
    notifyClients({ type: "BOOKING_UPDATED", device });
    res.json({ message: "Успішно", booking: device.bookings.at(-1) });
  } catch (error) {
    res.status(500).json({ error: "Помилка сервера" });
  }
});

app.get("/bookings/user/:userId", async (req, res) => {
  try {
    const devices = await Device.find({ "bookings.userId": req.params.userId });

    const bookings = devices.flatMap((device) =>
      device.bookings
        .filter((b) => b.userId === req.params.userId)
        .map((b) => ({
          id: b._id, // Додано ID бронювання для адмін-функцій
          deviceId: device.id,
          type: device.type,
          zone: device.zone,
          startTime: b.startTime,
          endTime: b.endTime,
          price: b.price,
        }))
    );

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Помилка отримання бронювань" });
  }
});

// Функція для оновлення статусу бронювання
const updateBookingStatus = async (deviceId, bookingId, status, userId) => {
  try {
    const device = await Device.findOne({ id: deviceId });
    if (!device) throw new Error("Пристрій не знайдено");

    const booking = device.bookings.id(bookingId);
    if (!booking) throw new Error("Бронювання не знайдено");

    const now = new Date(); // Локальний час
    const startTime = new Date(booking.startTime); // UTC з БД
    const endTime = new Date(booking.endTime); // UTC з БД

    // Конвертуємо now у UTC для порівняння
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    console.log("📅 Поточний час (UTC):", nowUTC.toISOString());
    console.log("⏳ Start Time (UTC):", startTime.toISOString());
    console.log("⌛ End Time (UTC):", endTime.toISOString());
    console.log("📋 Поточний статус:", booking.status);

    if (status === "cancelled" && nowUTC < startTime) {
      booking.status = "cancelled";
      console.log("✅ Статус змінено на 'cancelled'");
    } else if (
      status === "noShow" &&
      nowUTC >= startTime &&
      nowUTC <= endTime
    ) {
      booking.status = "noShow";
      console.log("✅ Статус змінено на 'noShow'");
      const user = await User.findOne({ _id: booking.userId });
      if (user) {
        user.noShowCount += 1;
        user.noShowHistory.push({ date: nowUTC, type: "noShow" });
        await user.save();
        console.log("🔄 noShowCount оновлено для користувача:", user._id);
      }
    } else if (status === "completed" && nowUTC > endTime) {
      booking.status = "completed";
      console.log("✅ Статус змінено на 'completed'");
    } else {
      throw new Error(
        `Неможливо змінити статус на '${status}' у поточному стані: nowUTC=${nowUTC.toISOString()}, startTime=${startTime.toISOString()}, endTime=${endTime.toISOString()}`
      );
    }

    await device.save();
    console.log(
      `Статус бронювання ${bookingId} оновлено на ${status} о ${nowUTC}`
    );
    return { success: true, message: `Статус оновлено на ${status}` };
  } catch (error) {
    console.error("Помилка оновлення статусу:", error);
    throw error;
  }
};

// Роут для скасування бронювання
app.post("/api/cancel-booking", async (req, res) => {
  try {
    const { deviceId, bookingId, userId, startTime } = req.body;
    const now = new Date();
    const bookingStartTime = new Date(startTime); // Отримуємо startTime з фронту (UTC)
    const userRole = req.headers.role || "user"; // Роль із заголовка
    console.log("📦 Отримані дані:", {
      deviceId,
      bookingId,
      userId,
      startTime,
      userRole,
    });
    if (!deviceId || !bookingId || !userId || !startTime) {
      throw new Error("Відсутні обов'язкові поля в запиті");
    }
    const device = await Device.findOne({ id: deviceId });
    console.log("Знайдено пристрій:", device ? "Так" : "Ні");
    if (!device) throw new Error("Пристрій не знайдено");
    const booking = device.bookings.id(bookingId);
    console.log("Знайдено бронювання:", booking ? "Так" : "Ні");
    if (!booking) throw new Error("Бронювання не знайдено");
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const startUTC = new Date(booking.startTime);
    const endUTC = new Date(booking.endTime);
    console.log("Часи:", { nowUTC, startUTC, endUTC });
    let status;
    if (nowUTC < startUTC) {
      status = "cancelled";
    } else if (nowUTC >= startUTC && nowUTC <= endUTC) {
      status = "noShow";
    } else {
      throw new Error("Бронювання вже завершено або не розпочалося коректно");
    }

    // Оновлення користувача (автора бронювання)
    const originalUserId = booking.userId;
    console.log("Оригінальний користувач:", originalUserId);
    const user = await User.findOne({ _id: originalUserId });
    if (!user) {
      console.warn("Користувач не знайдено:", originalUserId);
    } else {
      // Оновлення історії з заповненням bookingId для старих записів
      user.noShowHistory = user.noShowHistory.map((entry) => ({
        ...entry,
        bookingId: entry.bookingId || booking._id, // Заповнюємо відсутні bookingId
      }));
      user.cancelHistory = user.cancelHistory.map((entry) => ({
        ...entry,
        bookingId: entry.bookingId || booking._id, // Заповнюємо відсутні bookingId
      }));

      if (status === "noShow") {
        user.noShowCount += 1;
        user.noShowHistory.push({
          date: nowUTC,
          type: "noShow",
          bookingId: booking._id,
        });
        console.log("🔄 noShowCount оновлено для користувача:", originalUserId);
      } else if (status === "cancelled") {
        user.cancelCount += 1;
        user.cancelHistory.push({
          date: nowUTC,
          type: "cancelled",
          bookingId: booking._id,
        });
        console.log("🔄 cancelCount оновлено для користувача:", originalUserId);
      }
      await user.save();
      console.log("Користувач збережений:", user._id);
    }

    // Якщо адмін скасовує, зараховуємо noShow автору бронювання
    if (userRole === "admin" && status === "noShow") {
      console.log("Адмін скасував noShow для користувача:", originalUserId);
    }

    booking.status = status;
    await device.save();
    console.log(
      `Статус бронювання ${bookingId} оновлено на ${status} о ${nowUTC}`
    );

    res.json({ success: true, message: `Статус оновлено на ${status}` });
  } catch (error) {
    console.error("Помилка в /api/cancel-booking:", error);
    res.status(500).json({ error: error.message });
  }
});

// Функція для автоматичного оновлення статусів на completed
const checkCompletedBookings = async () => {
  try {
    const now = new Date();
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const devices = await Device.find();
    for (const device of devices) {
      for (const booking of device.bookings) {
        if (
          booking.status === "pending" &&
          nowUTC > new Date(booking.endTime)
        ) {
          await updateBookingStatus(
            device.id,
            booking._id,
            "completed",
            booking.userId
          );
        }
      }
    }
    console.log(`Перевірка завершених бронювань о ${nowUTC}`);
  } catch (error) {
    console.error("Помилка перевірки завершених бронювань:", error);
  }
};

// Запуск перевірки кожні 5 хвилин
setInterval(checkCompletedBookings, 1 * 60 * 1000);

// Тестовий роут
app.get("/api/check-status", async (req, res) => {
  await checkCompletedBookings();
  res.json({ message: "Статуси перевірено" });
});

app.delete("/admin/bookings/:bookingId", async (req, res) => {
  try {
    const userId = req.headers.userid; // Передавати userId у headers
    if (!userId) {
      return res.status(403).json({ error: "Неавторизований запит" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(403).json({ error: "Користувач не знайдений" });
    }

    const device = await Device.findOne({
      "bookings._id": req.params.bookingId,
    });
    if (!device) {
      return res.status(404).json({ error: "Пристрій не знайдено" });
    }

    const booking = device.bookings.find(
      (b) => b._id.toString() === req.params.bookingId
    );

    if (!booking) {
      return res.status(404).json({ error: "Бронювання не знайдено" });
    }

    // Дозволяємо видалення, якщо користувач є власником бронювання або адміністратором
    if (booking.userId.toString() !== userId && user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Ви не можете видалити це бронювання" });
    }

    // Видалення бронювання
    device.bookings = device.bookings.filter(
      (b) => b._id.toString() !== req.params.bookingId
    );
    await device.save();

    notifyClients({ type: "BOOKING_DELETED", device });
    res.json({ message: "Бронювання видалено" });
  } catch (error) {
    console.error("Помилка видалення:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});
// Додати годину до бронювання
app.patch("/admin/bookings/:bookingId", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Доступ заборонено" });
    }

    // Знайти пристрій та бронювання
    const device = await Device.findOne({
      "bookings._id": req.params.bookingId,
    });
    if (!device) {
      return res.status(404).json({ error: "Пристрій не знайдено" });
    }

    const booking = device.bookings.id(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Бронювання не знайдено" });
    }

    // Збільшити тривалість
    booking.endTime = new Date(booking.endTime.getTime() + 3600000);
    await device.save();

    notifyClients({ type: "BOOKING_UPDATED", device });
    res.json({ message: "Годину додано", booking });
  } catch (error) {
    console.error("Помилка продовження:", error);
    res.status(500).json({ error: "Помилка сервера" });
  }
});

// Додамо ендпоінт для отримання бронювань з урахуванням ролі
app.get("/bookings", async (req, res) => {
  try {
    const { userId, role } = req.query;

    if (role === "admin") {
      const devices = await Device.find();
      const allBookings = devices.flatMap((device) =>
        device.bookings.map((b) => ({
          ...b.toObject(),
          deviceId: device.id,
          zone: device.zone,
        }))
      );
      return res.json(allBookings);
    }

    const userDevices = await Device.find({ "bookings.userId": userId });
    const userBookings = userDevices.flatMap((device) =>
      device.bookings
        .filter((b) => b.userId === userId)
        .map((b) => ({
          ...b.toObject(),
          deviceId: device.id,
          zone: device.zone,
        }))
    );

    res.json(userBookings);
  } catch (error) {
    res.status(500).json({ error: "Помилка отримання бронювань" });
  }
});

app.get("/analytics/summary", async (req, res) => {
  try {
    const getLocalDateString = (date) => {
      const offsetMs = date.getTimezoneOffset() * 60000;
      const local = new Date(date.getTime() - offsetMs);
      return local.toISOString().slice(0, 10);
    };

    const nowUTC = new Date();
    const offsetMs = nowUTC.getTimezoneOffset() * 60000;
    const now = new Date(nowUTC.getTime() - offsetMs);

    console.log("Поточний час (now):", now);

    const from = req.query.from
      ? new Date(req.query.from + "T00:00:00.000Z")
      : new Date(getLocalDateString(now) + "T00:00:00.000Z");

    const to = req.query.to
      ? new Date(req.query.to + "T23:59:59.999Z")
      : new Date(getLocalDateString(now) + "T23:59:59.999Z");

    console.log("Computed 'from' date:", from);
    console.log("Computed 'to' date:", to);

    const devices = await Device.find();

    let totalRevenue = 0;
    let totalBookingsCount = 0;
    let activeBookingsCount = 0;

    const zoneStats = {
      Pro: { revenue: 0, durationHours: 0 },
      VIP: { revenue: 0, durationHours: 0 },
      PS: { revenue: 0, durationHours: 0 },
    };

    const hourUsage = new Array(24).fill(0);
    const dailyRevenueMap = new Map();
    const dailyBookingsMap = new Map();

    devices.forEach((device) => {
      const zone = device.zone;
      if (!zoneStats[zone]) return;

      device.bookings.forEach((booking) => {
        const startUTC = new Date(booking.startTime);
        const endUTC = new Date(booking.endTime);
        const price = booking.price || 0;
        const status = booking.status || "pending"; // Фallback для старих записів

        // Фільтруємо лише completed бронювання для доходів та підрахунків
        if (
          (from && endUTC < from) ||
          (to && startUTC > to) ||
          status === "cancelled" ||
          status === "noShow"
        ) {
          return;
        }

        // Підрахунок для completed бронювань
        if (status === "completed") {
          totalBookingsCount++;

          const durationHours = (endUTC - startUTC) / (1000 * 60 * 60);

          totalRevenue += price;
          zoneStats[zone].revenue += price;
          zoneStats[zone].durationHours += durationHours;

          const hour = startUTC.getUTCHours();
          hourUsage[hour]++;

          const dayKey = startUTC.toISOString().split("T")[0];
          dailyRevenueMap.set(
            dayKey,
            (dailyRevenueMap.get(dayKey) || 0) + price
          );
          dailyBookingsMap.set(dayKey, (dailyBookingsMap.get(dayKey) || 0) + 1);
        }

        // Активні бронювання лише зі статусом 'pending'
        if (status === "pending" && startUTC <= now && endUTC >= now) {
          activeBookingsCount++;
        }
      });
    });

    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(
      ([date, revenue]) => ({ date, revenue })
    );
    const dailyBookings = Array.from(dailyBookingsMap.entries()).map(
      ([date, count]) => ({ date, count })
    );

    res.json({
      totalRevenue,
      zoneStats,
      hourUsage,
      activeBookingsCount,
      totalBookingsCount,
      dailyRevenue,
      dailyBookings,
    });
  } catch (error) {
    console.error("Аналітика помилка:", error);
    res.status(500).json({ error: "Помилка при обробці аналітики" });
  }
});

// Додайте обробник помилок для всіх інших запитів
app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// ... (попередній імпорт, ініціалізація)
