import express from "express";
import cors from "cors";
import mongoose from 'mongoose';
import {templates} from "./services/mail.js";
import cookieParser from "cookie-parser"
import {dbHandler} from "./middlewares/dbhandler.js";
import errorHandler from "./middlewares/error.js"

const app = express();
const { PORT = 8080, DB_URI } = process.env;
import { logger, log } from "./middlewares/logger.js";
import { getCache, setCache, cacheMem, useLimiter} from "./utilities/general.js";
import path from "path";
import userRouter from "./routers/user.js";
// import notificationRouter from "./routers/notification.js";
// import servicesRouter from "./routers/services.js";
import transactionRouter from "./routers/transaction.js";
import paymentRouter from "./routers/payment.js";
// import configRouter from "./routers/configuration.js";
// import adminRouter from "./routers/admin.js";
// import assistantRouter from "./routers/assistant.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {createLog, logError} from "./utilities/vtu.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/*
mongoose.connect(DB_URI)
  .then(() => {
    log("database connected, starting a server...", "warning")
    startServer()
  })
  .catch(er => {
    log('error connecting database ' + er, "bad")
})*/

mongoose.set("bufferCommands", false);

// middlewares 
app.use(cookieParser())
app.use(express.json());
app.use(cors())
app.use(logger)

app.get("/", useLimiter("1m", 200));
app.use("/api/user", useLimiter("1m", 100));
app.use("/api/user/apikey/refresh", useLimiter("1m", 100));
app.use("/api/services", useLimiter("1m", 100));
app.use("/api/transaction", useLimiter("1m", 100));
app.use("/api/admin", useLimiter("1m", 100));
app.use("/api/payment", useLimiter("1m", 30));
app.use("/api/notification", useLimiter("1m", 100))
app.use("/api/configuration", useLimiter("1m", 100));
app.use("/api/assistant", useLimiter("1m", 30));


// auto login if token exist
app.use((req, res, next) => {
  const { token = false } = req.cookies;
  const isAuthPage = req.url === "/auth.html";
  const isDashboardPage = req.path.includes("/dashboard/");
  if (token && isAuthPage) {
    return res.redirect("/user/dashboard.html");
  }
  if (!token && isDashboardPage) {
    return res.redirect("/auth.html");
  }
  next();
});


app.use(express.static(path.join(__dirname, "../frontend"), { dotfiles: "allow" }))

// routers 
app.use("/api/user", dbHandler, userRouter);
// app.use("/api/notification", dbHandler, notificationRouter);
// app.use("/api/services", dbHandler, servicesRouter);
app.use("/api/payment", dbHandler, paymentRouter)
// app.use("/api/assistant", dbHandler, assistantRouter)
// for transaction and receipt 
app.get("/transaction/receipt/:reference", (req, res) => {
  const {reference} = req.params;
  res.sendFile(path.join(__dirname, "../frontend/services/transaction-receipt.html"));
})
app.use("/api/transaction", dbHandler, transactionRouter);
// app.use("/api/config", dbHandler, configRouter);
// app.use("/api/admin", dbHandler, adminRouter)
/*
app.use("/api/configuration", configurationRouter);
app.use("/api/transaction", transactionRouter)
app.use("/api/customers", transactionRouter)
app.use("/api/transaction", transactionRouter)
*/

// for message plain and redirect 
app.get("/message", (req, res, next) => {
  try{
    res.send(templates.message({...req.query, req}))
  }catch(er){
    next()
  }
})

// for error logging testing
app.post("/log", dbHandler, async (req, res, next) => {
  try{
    
    const log = await createLog("MANUAL_EVENT_CREATION", {
      body: req.body,
      headers: req.headers,
    })
    res.json({
      success: true,
      data: { log }
    })
  }catch(er){
    res.json({
      success: false,
      message:  er.message || "something went wrong"
    })
  }
})


// for web pages 
const webPages = [
  "/index",
  "/user/",
  "/admin/",
  "/images/",
  "/utilities/",
  "/documentation",
  "/404",
  "/auth",
  "/axios",
  "/support",
  "/maintainance",
  "/reset",
  "/terms",
  "/services/",
  "/download"
]


app.use("/", (req, res, next) => {
  const isApi = req.path.startsWith("/api");
  const isFile = req.path.includes(".");
  const pageFound = webPages.find(page => req.path.startsWith(page));
  
  
  if (!isApi && !isFile && pageFound) {
    return res.redirect(`${req.domain}${req.path}.html`)
  }
  next();
});

// API error and not found handler
app.use(errorHandler);




// server starting
const startServer = () => {
  app.listen(PORT, () => {
    log(`server started at http://localhost:${PORT}`)
  })
}

startServer();
// dbHandler(); on start

export default app