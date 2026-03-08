import colors from "colors";
import errorHandler from "./error.js";
const {APP_ID} = process.env;
// import VtuServices from "../services/vtu.js"
import {
  dbHandler
} from "../middlewares/dbhandler.js"

class AppError extends Error {
  constructor(message, statusCode = 400, isSystemError = false) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isSystemError = isSystemError; // false = app error, true = system error
    this.isOperational = true; // Mark as operational error
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const log = (message, color = "good") => {
  switch (color) {
    case "good":
      console.log(`\n ${colors.green(message)} \n`);
      break;
    case "bad":
      console.log(`\n ${colors.red(message)} \n`);
      break;
    case "warning":
      console.log(`\n ${colors.yellow(message)} \n`);
      break;
    default:
      console.log(`\n ${message} \n`);
  }
}

const apiAccessibleRoutes = ["/api/services/", "/api/config", "/api/transaction/", "/api/user/info"];
const allowedDomains = ["sadiqsharpsub.com.ng", "sadiqsharpsub.vercel.app"]

const logger = async (req, res, next) => {
  try{
  const { method, url } = req;
  console.log(req.body)
  req.body = req.body || {};
  const host = req.get('host');
  req.domain = `${req.protocol}://${req.get("host")}`
  req.err = false;
  req.message = false;
  req.AppError = AppError;
  log(`\n\na host ${host}, Sent ${method} Request To ${url}\n\n`);
 
  
  let { apikey = "", appid = 0 } = req.headers;
  if(typeof apikey !== "string") throw new req.AppError("invalid api key type!!")
  req.requestType = apikey ? "api" : "app";
   
  if(appid == APP_ID){
    apiAccessibleRoutes.push("/")
    // allow our app to access all our routes 
  }
   
   
  //  if(req.requestType == "api"){
  //          const domainMatch = allowedDomains.find(dm => req.domain.includes(dm));
  //          const match = apiAccessibleRoutes.find(route => {
  //              return req.path.includes(route);
  //           });
            
  //           if(req.path.includes("api") || req.method !== "GET"){
  //             if(!match && !domainMatch) throw new req.AppError("this route is not accessible through api")
  //             return next()
  //           }
  //   }
  
  return next()
  }catch(er){
    console.error(er)
    req.err = er;
    errorHandler(req, res, next)
  }
}



export {
  log,
  logger,
  AppError
}