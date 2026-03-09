import User from "../models/user.js";
import { checkCache, setCache, getCache, setCookie, compareHashes, createToken } from "../utilities/general.js";
import { log } from "../middlewares/logger.js";
import {dbHandler} from "./dbhandler.js"
import {sendMail} from "../services/mail.js"
import requireConfig from "./config.js";

const { MAX_LOGIN_FAIL_ATTEMPT = 5, LOGIN_TERMINATION_MINUTE = 1 , LOGIN_EXPIRE = 1000 * 60 * 60} = process.env;

export default async (req, res, next) => {
  try {
    const { email, password, keepMe = false} = req.body;
    const user = await User.findOne({ email });
  
    
    if (!user) {
      log("User with this email doesn't exist", "bad");
      return res.json({
        message: "User with this email doesn't exist",
        success: false,
      });
    }

    const now = Date.now();
    const lockDuration = LOGIN_TERMINATION_MINUTE * 60 * 1000; // convert minute to ms

    const timeSinceLastFail = now - (user.lastFailedLogin || 0);

   if (user.loginFailAttempt >= MAX_LOGIN_FAIL_ATTEMPT && timeSinceLastFail < lockDuration) {
      const remainingMs = lockDuration - timeSinceLastFail;
      const remainingSec = Math.ceil(remainingMs / 1000);
      return res.json({
        success: false,
        data: {terminated: remainingSec},
        message: `Too many failed attempts. Try again after ${remainingSec}s`,
      });
    }

    const isCorrectPassword = await compareHashes(password, user.password);

    if (!isCorrectPassword) {
      if(user.loginFailAttempt < MAX_LOGIN_FAIL_ATTEMPT) user.loginFailAttempt += 1;
      user.lastFailedLogin = now;
      await user.save();

      const remainAttempt = MAX_LOGIN_FAIL_ATTEMPT - user.loginFailAttempt;

      return res.json({
        message:
          remainAttempt > 0
            ? `Incorrect password. You have ${remainAttempt} attempts left.`
            : `Account locked. Try again after ${LOGIN_TERMINATION_MINUTE} minute(s).`,
        success: false,
        data: {terminated: remainAttempt <= 0}
      });
    }


    const accessToken = await createToken({ _id: user._id, email: user.email, isAdmin: user.role == "super" || user.role == "admin", keepMe: keepMe ? LOGIN_EXPIRE : false});
    req.user = user;
    req.token = accessToken;
    
    if(user.role == "admin" || user.role == "super"){
     req.config = await requireConfig();
     return sendMail({
        template: "confirmation",
        subject: "admin email confirmation",
        title: "confirm login",
        description: `
          please click on the link below to login to your admin account 
          <br> <br>
          <b> this is additional security layer added to admin account to ensure security </b>
        `,
        url: `${req.domain}/api/user/admin/authorize/${accessToken}`,
        buttonText: "confirm login",
        email: user.email
      }, req, success => {
       return res.json({
          success,
          message: success ? "please wait a bit!" : "something went wrong please try again",
          redirect: !success ? "" : decodeURI(`/message?title=confirm admin login &spinner=false &description=please check your email including your spam folder to allow access to your admin account, this is a security layer that prevent un authorise access to admin panel &redirect=false `)
        })
      })
    
    }
    
    setCookie(res, "token", accessToken, keepMe ? LOGIN_EXPIRE : false)

    user.loginFailAttempt = 0;
    user.lastFailedLogin = 0;
    user.lastLogin = now;
    await user.save();

    
    
    
    next();
  } catch (er) {
    log(er, "bad");
    res.status(400).json({
      success: false,
      message: "something went wrong try again!",
    });
  }
};