import mongoose from "mongoose";
const {APP_NAME = "sadiq_sharp_sub"} = process.env;

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: ["service", "wallet", "charge", "package"],
      required: true,
      default: "service",
      index: true,
    },

    service: {
      type: String,
      enum: [
        "data",
        "airtime",
        "electricity",
        "cable",
        "bill",
        "education",
        "ussd",
      ]
    },

    walletAction: {
      type: String,
      enum: ["funding", "debit", "credit", "refund"],
      default: "debit"
    },

    packageAction: {
      type: String,
      enum: ["downgrade", "upgrade"],
    },

    provider: {
      type: String,
      enum: ["ussd", "system", "services", "payment"],
      default: "services"
    },

    amount: {
      type: String, // amount of item eg 1GB, 100 Naira card, 1 Exam PIN 
      required: true,
      default: "0"
    },

    costPrice: {
      type: Number,
      default: 0, // how much does it cost 
    },

    fee: {
      type: Number, // fee in case of eg funding etc
    },

    previousBalance: {
      type: Number,
      default: 0, // balance before operation
    },

    newBalance: {
      type: Number,
      default: 0, // balance after operation
    },

    network: {
      type: String,
      // which network for data and airtime
    },

    planId: {
      type: String,
      // the id for plan  service id
    },
    
    planType: {
      type: String,
      // type of plan eg sme corporate etc
    },

  
    recipient: {
      type: String,
      // who receive the value, phone number, meter number etc
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      default: `${APP_NAME}_${Date.now()}`,
      index: true, // our reference
    },

    providerReference: {
      type: String,
      default: "processing_reference",
      // external provider reference eg payment service 
    },

    status: {
      type: String,
      enum: ["processing", "success", "failed", "reversed"],
      default: "processing",
      index: true,
      // status of operation
    },

    channel: {
      type: String,
      enum: ["app", "api", "admin", "ussd"],
      default: "app",
    },

    paymentSource: {
      type: String,
      //enum: ["va", "link", "wallet", "system"],
      default: "wallet",
    },

    description: {
      type: String,
      default: "transaction is currently processing"
    },
    
    // other needed
    disco: {
      type: String,
      // for electricity
    },
    
    newPackage: {
      type: String,
      // package name for package upgrade
    },
    
    examType: {
      type: String,
      // for exam eg waec neco
    },
    
    quantity: {
      type: String,
      // eg exam pin quantity etc
    },
    
    pins: {
      type: [String],
      // exam pins 
    },
    
    // other meta
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: { profit: 0},
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
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("vtu_transaction", TransactionSchema);