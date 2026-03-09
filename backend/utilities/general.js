// for jwt
import jwt from "jsonwebtoken";
import crypto from "bcryptjs";
import mailer from "nodemailer";
import User from "../models/user.js";
import fs from "fs/promises";
import path from "path";
import {log} from "../middlewares/logger.js"
import compressor from "lz-string";
import multer from "multer";
import mongoose from "mongoose";
const ObjectId = mongoose.Types.ObjectId;
import {Redis} from "@upstash/redis";
import {AppError} from "../middlewares/logger.js"
import rateLimit from "express-rate-limit";
// import requireConfig from "../middlewares/config.js";

const { ENV_TYPE = "development", UPSTASH_REDIS_REST_URL, APP_ID, APP_NAME, UPSTASH_REDIS_REST_TOKEN, HASH_KEY, HASH_ROUNDS, SENDER_MAIL, MAIL_APP_KEY, TOKEN_EXPIRE_TIME } =
    process.env;
const CACHE_EXPIRE_TIME = Number(process.env.CACHE_EXPIRE_TIME || 3600)


// for json web token
const createToken = (data, expiresIn = false) => {
    return expiresIn
        ? jwt.sign(data, HASH_KEY, { expiresIn })
        : jwt.sign(data, HASH_KEY);
};

const getTokenData = token => {
    return !token ? new Error() : jwt.verify(token, HASH_KEY);
}

// for cypto
const hash = data => crypto.hashSync(data, HASH_KEY, parseInt(HASH_ROUNDS));
const compareHashes = crypto.compareSync;
const randomHash = HASH_ROUNDS => crypto.genSalt(parseInt(HASH_ROUNDS));

const composeMail = async (req, receiver, subject, body, other = {}) => {
    //if(!req.config) req.config = await requireConfig()
    
    const options = {
        subject,
        from: SENDER_MAIL,
        to: receiver,
        html: body,
        ...other
    };
    
   // for nodemailer
const config = {
    port: 587,
    host: "smtp.gmail.com",
    secure: false,
    auth: {
        user: req?.config?.apiKeys?.emailaddress ||  SENDER_MAIL,
        pass: req?.config?.apiKeys?.emailappkey || MAIL_APP_KEY
    }
};

const transporter = mailer.createTransport(config);

   const sent = await transporter.sendMail(options);
   return sent ? true : false
};


// fs for adding and retrieving files
const readFile = (url, callback) => {
    return fs.readFile(url)
};

function writeFile(path, buffer) {
    return fs.writeFile(path, buffer)
}

const deleteFile = (url, callback) => {
    return fs.unlink(url)
};

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



// helper for managing files to upload folder 
const getFileData = file => {
    const { mimetype, buffer, size } = file;
    const ext = mimetype.split("/")[1];
    
    return {
        type: mimetype, 
        size, 
        ext,
        buffer
    }
}

const uploadFile = async (file, folder) => {
const {type, size, ext, buffer} = getFileData(file);

const fileName = `${new ObjectId().toString()}.${ext}`;
    console.log(fileName)
    const savePath = path.join(__dirname, "uploads", folder, fileName); // adjust to your structure
    await fs.writeFile(savePath, buffer);

    return {
    name: fileName,
    type,
    size,
    url: `uploads/${folder}/${fileName}`
    }
}

const rewriteFile = async (file, location) => {
    const {type, buffer, size, ext} = getFileData(file);
    const savePath = path.join(__dirname, location); // adjust to your structure
    await fs.writeFile(savePath, buffer);
    return {
    name: location,
    type,
    size,
    url: location
    }
}



// to tell user something and redirect eg in email confirmation if confirmed
const sendMessage = (res, message, redirect, img = "/images/success.png") => {
    res.send(messageTemplate(message, redirect, img))
}

/* for.multer upload files */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});


process.__dirname = __dirname;

const generateKey = () => "swapnet_" + new ObjectId().toString();

const setCookie = (res, key = 'key', value = 'value', expiresInMs = 1000 * 60 * 60) => {
    const options = {
        httpOnly: true,
        sameSite: 'strict',
        secure: ENV_TYPE == 'production',
    };
    if(expiresInMs) options.maxAge = expiresInMs
    res.cookie(key, value, options)
}

// for caching
const cacheMem = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN
})


const setCache = (key, data, expiring = true) => {
    return false // disabled
    key = `${APP_NAME}:${APP_ID}:${key}`
    if(!data) return false
    try{
    const serializedData = JSON.stringify(data);
    if (expiring === true) {
        return cacheMem.set(key, serializedData, {
            EX: CACHE_EXPIRE_TIME,
        });
    } else if (typeof expiring === "number") {
        return cacheMem.set(key, serializedData, {
            EX: expiring
        });
    } else {
        return cacheMem.set(key, serializedData);
    }
    log("cache added/updated: " + expiring, "warning")
    }catch(er){
        return false
    }
};

const getCache = key => {
    return false // disabled 
    if(!key) return false
    key = `${APP_NAME}:${APP_ID}:${key}`;
    return new Promise((res, rej) => {
        cacheMem.get(key)
            .then(data => {
                try {
                    res(JSON.parse(data));
                } catch (err) {
                    res(data);
                }
                if(data) log("cache hitted!!")
            })
            .catch(err =>{
            log("cache missed!!!", "bad")
            res(false)
            })
    });
};

const checkCache = async (key, notFoundCb) => {
    const data = await notFoundCb(); // disabled
    return data[0]
    try {
        const data = await getCache(key);
        if (data){
            return data;
        }
    
        if(!notFoundCb) return false
        const [freshData, expiring = false] = await notFoundCb();
        await setCache(key, freshData, expiring);
        
        return freshData;
    } catch (err) {
        throw err;
    }
};


// for input and data 
const specialChars = "{}|$[]<>()!?;:*\'\"&`/\\";

function sanitizeInput(input) {
    if (!input || typeof input !== "string") throw new AppError("invalid input data")
    let sanitizedInput = "";
    for (const char of input) {
        if (!specialChars.includes(char)) sanitizedInput += char
    }
    return sanitizedInput

}


const useLimiter = (timeString, max, handler = null) => {
  // Convert human-readable time to milliseconds
  const getTimeMs = (timeStr) => {
    const units = {
      s: 1000,         // seconds
      m: 60 * 1000,    // minutes
      h: 60 * 60 * 1000, // hours
      d: 24 * 60 * 60 * 1000, // days
      w: 7 * 24 * 60 * 60 * 1000 // weeks
    };
    
    const unit = timeStr.slice(-1);
    const value = parseInt(timeStr.slice(0, -1));
    
    return value * (units[unit] || 1000); // default to seconds
  };

  const windowMs = getTimeMs(timeString);

  const limiter = rateLimit({
    windowMs: windowMs,
    max: max,
    handler: handler || ((req, res) => {
        
      if(req.method !== "GET" && req.path.includes("/api/")){
      res.status(429).json({
        success: false,
        message: `Too many requests, please try again in ${timeString}.`
      });
      }else{
          res.redirect(`/message?description=too%20many%20request%20please%20try%20again%20later!%20in%20${timeString}&spinner=false&redirect=false`)
      }
    }),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: function(req) {
     return req.headers['x-real-ip'];
    }
  });

  return limiter;
};

const random = (min, max) => {
    return Math.floor(Math.random() * (max - min) + min)
}

export {
    createToken,
    getTokenData,
    hash,
    compareHashes,
    composeMail,
    randomHash,
    readFile,
    writeFile,
    deleteFile,
    __dirname,
    path,
    sendMessage,
    upload,
    uploadFile,
    rewriteFile,
    generateKey,
    setCookie,
    cacheMem,
    checkCache,
    getCache,
    setCache,
    sanitizeInput,
    useLimiter,
    random
};
