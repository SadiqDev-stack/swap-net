import mongoose from "mongoose";
const {APP_NAME = "sadiq_sharp_sub"} = process.env;
import { generateKey } from "../utilities/general.js";

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enums: ['swapping', 'transfer', 'widrawal', 'funding', 'refund', 'reward']
    },

    walletAction: {
      type: String,
      enum: ["funding", "debit", "credit", "refund"]
    },

  
    amount: {
      currency: String,
      value: {
        type: Number,
        min: 0
      }
    },

    fee: {
      type: Number,
      min: 0 // incase of eg funding etc
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      default: () => generateKey(),
      index: true, // our reference
    },

    status: {
      type: String,
      enum: ["processing", "successful", "failed", "reversed"],
      default: "successful",
      index: true,
      // status of operation
    },

    channel: {
      type: String,
      enum: ["app", "api", "admin", "ussd"],
      default: "app",
    },

   
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: { profit: 0 },
      // other data about transaction
    },
    
    createdAt: {
      type: Date,
      default: Date.now(),
      // when this is created
    },
    
    updatedAt: {
      type: Date,
      default: Date.now()
      // when was it updated last
    },

    description: {
      type: String
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("swapnet_transaction", TransactionSchema)