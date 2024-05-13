const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const shortid = require("shortid");

const app = express();
const port = 3001;

app.use(cors());

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

const turnirSchema = new mongoose.Schema({
  pairs: [{ team1: String, team2: String }],
  turnirName: String,
  uniqueCode: String,
});

const Turnir = mongoose.model("Turnir", turnirSchema);

module.exports = Turnir;

// Додавання middleware для обробки JSON-даних
app.use(bodyParser.json());

// Обробник POST-запиту для створення нового користувача
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Перевірка, чи користувач з таким ім'ям користувача або електронною адресою вже існує
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    // Створення нового екземпляра користувача
    const newUser = new User({ username, email, password });

    // Збереження нового користувача в базі даних
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
    // Знайдіть користувача за ім'ям користувача
    const user = await User.findOne({ username: login });

    // Перевірте, чи користувач існує та чи правильний пароль
    if (user && password === user.password) {
      // Якщо авторизація успішна, поверніть користувача зі статусом 200
      res.status(200).json(user);
    } else {
      // Якщо ім'я користувача або пароль неправильні, поверніть статус 401 (Unauthorized)
      res
        .status(401)
        .json({ message: "Неправильне ім'я користувача або пароль" });
    }
  } catch (error) {
    // Обробляємо помилку
    console.error("Помилка при авторизації:", error);
    res.status(500).json({ message: "Помилка сервера" });
  }
});

// const Turnir = require("./models/Turnir");

app.post("/createTurnir", async (req, res) => {
  const { pairs, turnirName } = req.body; // Зміна з teams на pairs
  console.log(pairs);
  try {
    const uniqueCode = shortid.generate();
    const newTurnir = new Turnir({ pairs, turnirName, uniqueCode }); // Зміна з teams на pairs
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
      res.status(200).json({ turnirData });
      console.log("turnit find");
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

// Додайте обробник помилок для всіх інших запитів
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Щось пішло не так на сервері!");
});

// Прослуховування порту сервера
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
