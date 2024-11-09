const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const shortid = require("shortid");
const WebSocket = require("ws");
const axios = require("axios");

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
      default: "./uploads/usericon.png", // URL дефолтного аватара
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    lastCommentDate: Date,
  },
  { timestamps: true }
);

// Створення моделі користувача на основі схеми
const User = mongoose.model("User", userSchema);
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
const BookingSchema = new mongoose.Schema({
  zone: String,
  hours: Number,
  price: Number,
  userId: mongoose.Schema.Types.ObjectId,
  userEmail: String, // Додаємо поле для зберігання емейлу користувача
  date: Date,
  createdAt: { type: Date, default: Date.now, index: { expires: "3d" } }, // Додаємо поле createdAt з TTL індексом
});

const Booking = mongoose.model("Booking", BookingSchema);

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

const onNewBooking = (booking) => {
  notifyClients({ type: "NEW_BOOKING", booking });
};

// Обробник POST-запиту для створення нового користувача
app.post("/register", async (req, res) => {
  const { username, email, password, role, avatar } = req.body; // Додано поле ролі

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    const newUser = new User({ username, email, password, role, avatar }); // Додано поле ролі
    await newUser.save();
    console.log("User registered successfully:", newUser);
    res.status(200).send("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to register user");
  }
});

// Обробник POST-запиту для входу користувача
app.post("/login", async (req, res) => {
  const { login, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }],
    });

    if (!user) {
      return res.status(401).json({ message: "Неправильний логін або емейл" });
    }

    if (user.password === password) {
      res.status(200).json(user);
    } else {
      res.status(401).json({ message: "Неправильний пароль" });
    }
  } catch (error) {
    console.error("Помилка при авторизації:", error);
    res.status(500).json({ message: "Помилка сервера" });
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

app.post("/bookings", async (req, res) => {
  const { zone, hours, price, userId, date } = req.body;

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
});

// Обробник POST-запиту для зміни пароля
app.post("/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);

    if (user && user.password === currentPassword) {
      user.password = newPassword;
      await user.save();
      res
        .status(200)
        .json({ success: true, message: "Пароль успішно змінено" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Неправильний поточний пароль" });
    }
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

  if (sentiment === "Neutral" && rating <= 3) {
    return "Negative"; // Якщо нейтральний настрій і низька оцінка, робимо негативним
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
  const { text, rating, useri } = req.body;

  try {
    // Знаходимо користувача за ID
    const user = await User.findById(useri.userId);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const currentDate = new Date();
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7); // Поточна дата мінус тиждень

    // Якщо дата останнього коментаря була менше тижня тому, перевіряємо кількість коментарів
    if (user.lastCommentDate && user.lastCommentDate > oneWeekAgo) {
      if (user.commentsCount >= 3) {
        return res
          .status(400)
          .json({ error: "Ви можете написати лише 3 відгуки на тиждень" });
      }
    } else {
      // Якщо користувач не додавав коментарів протягом останнього тижня
      user.commentsCount = 0; // Оновлюємо лічильник
    }

    // Викликаємо Flask API для аналізу настрою
    const response = await axios.post("http://127.0.0.1:5000/api/analyze", {
      text,
    });
    const { sentiment, processed_text: processedText } = response.data;

    // Коригування настрою на основі оцінки
    const adjustedSentiment = adjustSentiment(sentiment, rating);

    // Створення нового відгуку
    const newReview = new Review({
      text,
      rating,
      useri,
      sentiment: adjustedSentiment,
      processedText,
    });

    await newReview.save();

    // Оновлюємо інформацію про кількість коментарів та дату
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

// Додайте обробник помилок для всіх інших запитів
app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
