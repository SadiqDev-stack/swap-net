import { Schema, model } from "mongoose";
const {BASIC_API_LIMIT = 1000, BASIC_EMAIL_LIMIT = 200, MAX_LOGIN_FAIL_ATTEMPT = 5} = process.env
import {generateKey} from "../utilities/general.js"
import { defaultPackages, profitMargins} from "./configuration.js"

let totalSpentSchema = {
  type: Object,
  default: {total: 0, packages: 0}
};

for(const service in profitMargins){
  totalSpentSchema.default[service] = 0;
}


const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxLength: 200,
    trim: true,
    lowercase: true
  }, 
  email: {
    type: String,
    required: true,
    unique: true,
    maxLength: 200,
    lowercase: true,
  }, 
  
  active: {
    type: Boolean, 
    default: true
  },
  
  activationMessage: {
    type: String, 
    lowercase: true
  },
  
  phone: {
    type: String, 
    required: true,
    unique: true,
    maxLength: 200
  },
  accountMode: {
    type: String, 
    enum: ["live", "test"]
  },
  password: {
    type: String,
    required: true,
    maxLength: 1000
  },
  gender: {
    type: String,
    enum: ["male", "female"],
    default: "male"
  },
  state: {
    type: String,
    required: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ["admin", "user", "super"],
    default: "user"
  },
  "package": {
    type: String,
    default: defaultPackages[0].name
  },
  webhook: {
    type: String,
    maxLength: 500,
    default: null
  },
  apiKey: {
    type: String,
    unique: true,
    default: () => generateKey()
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now()
  },
  loginFailAttempt: {
    type: Number,
    max: MAX_LOGIN_FAIL_ATTEMPT,
    default: 0
  },
  lastFailedLogin: {
    type: Date,
    default: Date.now()
  },
 balace: {
  USD: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  NGN: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // Dynamic currencies (BTC, ETH, USDT, etc)
  others: {
    type: Map,
    of: {
      type: Number,
      min: 0,
      default: 0
    },
    default: {}
  }
},
  createdAt: {
    type: Date,
    default: Date.now()
  },
  
  updatedAt: {
    type: Date,
    default: Date.now()
  },
  
  wallets: {
    type: [{
      accountNumber: String,
      accountName: String,
      bankName: String,
    }],
    default: []
  },
  customerCode: {
    type: String
  },
  transactionPin: {
    type: String,
    maxLength: 4,
    default: "0000"
  },
  address: {
    type: String, 
    required: true
  },
  kycDetails: {
    type: Object,
    required: true
  },
  lastFunding: {
    type: Date,
    default: Date.now()
  },
  totalFunding: {
    type: Number,
    default: 0
  },
  
  notification: {
    type: Number,
    default: 0
  },
  
  storage: {
    phoneNumbers: [String],
    default: {
      wallets: []
    }
  },
  totalSpent: totalSpentSchema,
}, {
  timestamps: true
});
/*
UserSchema.index({ email: 1 });
UserSchema.index({ apiKey: 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ "otpExpires": 1 }, { expireAfterSeconds: 0 });
*/

export default model("swapnet_user", UserSchema)