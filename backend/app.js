const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const shortid = require("shortid");
const WebSocket = require("ws");

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

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
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

// Створення моделі користувача на основі схеми
const User = mongoose.model("users", userSchema);

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
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    const newUser = new User({ username, email, password });
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

// Обробник POST-запиту для створення нового бронювання
app.post("/bookings", async (req, res) => {
  const { zone, hours, price, userId, date } = req.body;

  try {
    const newBooking = new Booking({ zone, hours, price, userId, date });
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

// Додайте обробник помилок для всіх інших запитів
app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
