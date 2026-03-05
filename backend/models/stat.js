import {Schema, model} from "mongoose";


const Stat = new Schema({
    totalUsersCount: {
      type: Number,
      default: 0 // total amount of users
    },
    totalSalesCount: {
      type: Number,
      default: 0 // total sales count 1 per service
    },
    activeUsersCount: {
      type: Number,
      default: 0 // active users verified and active
    },
    totalPurchases: {
      type: Number,
      default: 0 // purchases amount
    },
    totalDeposit: {
      type: Number,
      default: 0 // deposit count
    },
    totalDepositCount: {
      type: Number, 
      default: 0
    },
    successTransactionsCount: {
      type: Number,  // count successes
      default: 0
    },
    failedTransactionsCount: {
      type: Number, // count failures
      default: 0
    },
    totalBalance: {
      type: Number,  // available balance in the app
      default: 0
    },
    totalProfit: {
      type: Number, // total profit generated from.app usually fess and transaction.meta.profit
      default: 0 
    },
    totalGbPurchased: {
      type: Number,
      default: 0 ,
      // this is how much data purchased
    },
    assistantUsageCount: {
      type: Number,
      default: 0,
      // how many times our ai assistant is prompted and successfully responded
    },
    assistantNotificationCount: {
      type: Number,
      default: 0,
      // how many notification for urgent request our assitant send
    }
  })


export default model("vtu_stats", Stat)