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
    },
  ],
  turnirName: String,
  uniqueCode: String,
});

const Turnir = mongoose.model("Turnir", turnirSchema);

const BookingSchema = new mongoose.Schema({
  zone: String,
  hours: Number,
  price: Number,
  userId: mongoose.Schema.Types.ObjectId,
  date: Date,
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model("Booking", BookingSchema);

// WebSocket сервер
const wss = new WebSocket.Server({ port: 8080 });

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

app.post("/login", async (req, res) => {
  const { login, password } = req.body;

  try {
    const user = await User.findOne({ username: login });

    if (user && password === user.password) {
      res.status(200).json(user);
    } else {
      res
        .status(401)
        .json({ message: "Неправильне ім'я користувача або пароль" });
    }
  } catch (error) {
    console.error("Помилка при авторизації:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

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

app.get("/turnirs", async (req, res) => {
  try {
    const turnirs = await Turnir.find();
    res.status(200).json(turnirs);
  } catch (error) {
    console.error("Помилка завантаження турнірів:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// Обробник POST-запиту для створення нового бронювання
app.post("/bookings", async (req, res) => {
  const { zone, hours, price, userId } = req.body;
  const date = new Date();

  try {
    const newBooking = new Booking({ zone, hours, price, userId, date });
    await newBooking.save();
    onNewBooking(newBooking); // Викликаємо функцію для повідомлення клієнтів
    res.status(200).json({ message: "Booking created successfully" });
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

// Додайте обробник помилок для всіх інших запитів
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Щось пішло не так на сервері!");
});

// Прослуховування порту сервера
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
