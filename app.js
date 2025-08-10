const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const config = require("./config/index");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");

const indexRouter = require("./routes/index");
const { initializeBot } = require("./telegram_bot");

const app = express();
mongoose.set("strictQuery", true);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Initialize database connection
main().catch(function (err) { 
	console.error("Failed to connect to database:", err); 
});

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);

async function main() {
  try {
     await mongoose.connect(config.mongodb_uri);
    console.log("Database connection established");
  } catch (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

initializeBot();

module.exports = app;
