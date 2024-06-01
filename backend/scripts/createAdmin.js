const mongoose = require("mongoose");
const User = require("../models/User");

mongoose.connect("mongodb://localhost:27017/computerClub", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createAdmin = async () => {
  const username = "admin";
  const email = "admin@example.com";
  const password = "adminpassword";

  const admin = new User({
    username,
    email,
    password,
    role: "admin",
  });

  await admin.save();
  console.log("Admin user created");
  mongoose.connection.close();
};

createAdmin().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
