const express = require("express");
require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();

const authRouter = require('./routes/authRoutes');
const cookieParser = require("cookie-parser");
require("./config/dbConnect");

app.use(cookieParser());
app.use(bodyParser.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.enable('trust proxy');
app.use(cors({ credentials: true, origin: process.env.REMOTE }));
app.options(process.env.REMOTE, cors());

app.use('/api/v1/auth/', authRouter);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log("Server up at port " + port);
});
