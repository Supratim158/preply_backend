const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const AuthRoute = require('./routes/authRoutes');
const UserRoute = require('./routes/userRoutes');
const ReminderRoute = require('./routes/reminderRoutes');
const NotificationRoute = require('./routes/notificationRoutes');
const {
  startNotificationScheduler,
} = require('./controllers/notificationScheduler');

mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Preply DB connected");
    // Start notification scheduler only after MongoDB is connected
    startNotificationScheduler();
  })
  .catch((err) => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", AuthRoute);
app.use("/api/users", UserRoute);
app.use("/api/reminders", ReminderRoute);
app.use("/api/notification", NotificationRoute);

app.listen(process.env.PORT || 1520, () =>
  console.log(`Preply backend is running on ${process.env.PORT}`)
);