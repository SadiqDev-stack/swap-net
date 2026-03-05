
import { getTokenData ,setCookie, setCache, getCache, checkCache } from "../utilities/general.js";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import User from "../models/user.js";
import {Configuration} from "../models/configuration.js";
const { APP_ID } = process.env;
import {dbHandler} from "./dbhandler.js";
// import requireConfig from "./config.js";


export default async (req, res, next) => {
    try {
      
        let { apikey = "" } = req.headers;
        if(typeof apikey !== "string") throw new req.AppError("invalid api key type!!")
        req.requestType = apikey ? "api" : "app";
        const token = req.cookies.token;
        
        
       
        if (!token && !apikey) {
            throw new req.AppError("invalid or expired token/apikey please relogin!");
        }
        
        let userQuery;
        let user;
        
        if(!req.dbConnected) await dbHandler(req, res)
        
        if(req.requestType == "app"){
         const userData = await getTokenData(token);
         if(!userData){
            throw new req.AppError("token expired relogin!")
         }
         
         userQuery = { _id: userData._id};
         user = await checkCache(`users:${APP_ID}:${userQuery._id}`, async () => {
             return [await User.findOne(userQuery).lean()]
         })
        }else{
         userQuery = { apiKey: apikey };
         user = await User.findOne(userQuery).lean();
         if(user) await setCache(`users:${user._id}`, user)
        }
        
        
        if(!user) throw new req.AppError("user doesnt exist");
      
       const config = await requireConfig(req)
        
       if(user && !user.active && !user.emailVerified){
            return res.json({
                success: false,
                message: !user.emailVerified ? "please relogin and verify your email" : "your account is not active please take action or contact admin",
                redirect: !user.emailVerified ? "/auth.html" : "/user/activate.html"
            })
        }
        
        if(!config || config.maintainance){
            if(!config.admins.find(admin => user._id == admin._id) && user.role !== "admin" && user.role !== "super") return res.json({
                success: false,
                message: !config ? "a slight issue from our side, please try again 🙏" : "sorry we are currently in maintainance mode please be patient and come back later 🙏",
                redirect: config.maintainance ? "/maintainance.html" : false
            })
        }
 
        
        req.user = user;
        req.config = config;
        next()
        

    } catch (er) {
      //  res.redirect("/auth.html");
      res.clearCookie("token");
      res.json({
          success: false,
          redirect: "/index.html",
          message: er.message
      })
    }
};
