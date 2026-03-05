import User from "../models/user.js";
import Transaction from "../models/transaction.js";
import { Router } from "express";
import Log from "../models/log.js";
import Notification from "../models/notification.js";
// import Stat from "../models/stat.js";
import crypto from "crypto";
import {
createPaymentlink,
createVirtualAccountWithFlutterWave,
confirmTransaction,
createVirtualAccountWithBillStack
} from "../services/payment.js";

import {
  createFundingTransaction,
  updateTransactionStatus,
  updateStat,
  getFundingProfit,
  getFundingAmount,
  createLog,
  logError
} from "../utilities/vtu.js";
import authorize from "../middlewares/authorization.js";
// import requireConfig from "../middlewares/config.js"
const {PAYMENT_HASH_KEY, PAYMENT_KEY_2, PAYMENT_HASH_KEY2} = process.env
import mongoose from "mongoose";
const {ObjectId} = mongoose.Types;
const paymentRedirect = "https://sadiqsharpsub.com.ng/auth.html";

const app = Router();

// Helper functions
const validateId = (id) => {
    if (!id) return false;
    return ObjectId.isValid(id) ? new ObjectId(id) : false;
};


const allowedEvents = ["charge.completed"];



app.post("/webhook", async (req, res) => {
  const transactionState = [];
  
  try {
    transactionState.push("Starting webhook processing");
    
    req.config = await requireConfig();
    if(!req.config) {
      transactionState.push("Configuration not found - aborting");
      return res.status(400).json({
        received: true,
        message: "app configuration not found"
      });
    }
    
    transactionState.push("Configuration loaded successfully");
    
    const signature = req.headers["verif-hash"];
    const hashKey = req?.config?.apiKeys.paymentHash || PAYMENT_HASH_KEY;
    
    if (signature !== hashKey || !allowedEvents.includes(req.body.event)) {
      transactionState.push(`Invalid signature or event: ${req.body.event} - aborting`);
      return res.status(400).json({ 
        success: false, 
        message: "invalid web hook signature or event", 
        event: req.body.event, 
        allowedEvents, 
        signature
      });
    }
    
    transactionState.push("Signature verified successfully");
    
    const { success, message, data } = await confirmTransaction(req, req.body.data.id);
   
    if(!success){
      transactionState.push(`Transaction confirmation failed: ${message}`);
      return res.json({
        success: false,
        message,
        data
      });
    }
    
    transactionState.push("Transaction confirmed with payment provider");

    const {
      meta,
      channel = data.payment_type || "bank_transfer",
      reference = data.flw_ref || data.id,
      customer,
      fee = data.app_fee || 0,
      createdAt = data.created_at,
      status,
      id
    } = data;
    const amount = data.amount_settled;
    
    let {userId, paymentType, paymentPurpose, name, email, originatorname, bankname, originatoraccountnumber} = meta;
    if(!validateId(userId)){
      transactionState.push(`Error Invalid User Id: ${userId}`)
      return res.status(400).json({
      success: false,
      message: "inavlid user id"
    })
    }
    
    userId = validateId(userId)
    
    transactionState.push(`Processing payment: reference=${reference}, amount=${amount}, user=${userId}, status=${status}`);

    if (!id || !reference) {
      transactionState.push("Invalid payment id or reference - aborting");
      return res.json({ 
        received: false, 
        message: "invalid payment id or reference in confirmation" 
      });
    }

    const existingTx = await Transaction.findOne({
      providerReference: reference
    });
    
    if (existingTx) {
      transactionState.push(`Duplicate transaction found: ${reference} - aborting`);
      return res.status(200).json({ 
        existingTx, 
        success: false, 
        message: `payment transaction with reference: ${reference}, id: ${id} already exist` 
      });
    }
    
    transactionState.push("No duplicate transaction found - proceeding");
    
    const user = await User.findById(userId);
    transactionState.push(user ? `User found: ${userId}` : `User not found: ${userId}`);

    if (status !== "successful") {
      transactionState.push(`Processing non-successful status: ${status}`);
      
      const pendingTx = await Transaction.create({
        providerReference: reference,
        amount: String(amount),
        paymentSource: channel,
        fee: data.fee || data.app_fee || 0,
        userId,
        category: "wallet",
        walletAction: "credit",
        provider: "payment",
        previousBalance: user.balance || 0,
        newBalance: user.balance || 0,
        status: status == 'pending' ? "processing" : status,
        meta,
        description: status == "failed" ? "payment failed" : "payment is still pending"
      });
      
      transactionState.push(`Pending transaction created: ${pendingTx._id}, status: ${pendingTx.status}`);
      
      await Notification.create({
        userId,
        title: `payment ${status == "pending" ? "processing" : status}`,
        description: `the payment you attempted has been ${status}, if you have issues send this reference: ${reference} and id: ${id} to the admin`,
        flag: "urgent",
        from: "provider"
      });
      
      transactionState.push(`Notification created for user: ${userId}`);
      return res.status(200).json({ 
        success: true, 
        message: `in-successful payment and status saved, reference: ${reference}, id: ${id}, status: ${status}` 
      });
    }

    if (!user) {
      transactionState.push(`User not found in database: ${userId} - creating failed transaction`);
      
      const failedTx = await Transaction.create({
        userId,
        category: "wallet",
        walletAction: "funding",
        provider: "payment",
        amount,
        status,
        previousBalance: 0,
        newBalance: 0,
        providerReference: reference,
        paymentSource: channel,
        meta,
        description: `funding failed user with id: ${userId} doesnt exist in our database`
      });
      
      transactionState.push(`Failed transaction created: ${failedTx._id}`);
      
      await Notification.create({
        title: `payment ${status}`,
        description: `the payment you attempted has been failed because the user doesn't exist in our database, if you have issues forward this id: ${userId} to the admin`,
        flag: "warning",
        from: "system",
        userId
      });
      
      transactionState.push(`Notification created for missing user`);
      return res.status(400).json({ 
        success: false, 
        message: `user ${name} with this payment id: ${userId} doesn't exist in our database` 
      });
    }

    transactionState.push(`Processing successful payment for user: ${userId}, current balance: ${user.balance}`);
    
    const { percent, fixed } = req.config.fundingDetails.fee;

    const fundingFee = getFundingProfit(req, amount, fee);
    const fundingAmount = getFundingAmount(req, amount, fee);
    
    transactionState.push(`Calculated funding: amount=${fundingAmount}, fee=${fundingFee}, providerFee=${fee}`);

    const fundingTx = await createFundingTransaction(
      userId, 
      user.balance, 
      fundingAmount, 
      fundingFee, 
      reference, 
      `${paymentType} • ${channel}`, 
      "success", 
      "app", 
      { ...meta, profit: fundingFee, fundingAmount, fundingFee, providerFee: fee}
    );
    
    transactionState.push(`Funding transaction created: ${fundingTx._id}, new balance: ${user.balance + fundingAmount}`);

    await User.findByIdAndUpdate(userId, {
      $inc: { 
        balance: fundingAmount,
        notification: 1,
        totalFunding: fundingAmount
      }
    });
    
    transactionState.push(`User balance updated: added ${fundingAmount}, new total: ${user.balance + fundingAmount}`);
    
    await Notification.create({
      userId,
      title: `payment successful`,
      description: `your wallet has been credited with ₦${fundingAmount} using method: ${channel == "bank_transfer" ? `bank transfer from ${originatorname} - ${originatoraccountnumber}, ${bankname}` : channel}, a processing fee of ₦${fundingFee + fee} was charged from the amount deposited, thank you for trusting us 🙏`,
      from: "system"
    });
    
    transactionState.push(`Success notification created for user`);
    
    await updateStat("success", fundingAmount, "deposit", {
      profit: fundingFee
    });
    
    transactionState.push("Statistics updated successfully");
    
    transactionState.push("Webhook processing completed successfully");
    return res.json({ 
      received: true, 
      message: `${name} is credited with ${fundingAmount}` 
    });
    
  } catch (er) {
    transactionState.push(`Error caught: ${er.message}`);
    return res.status(400).json({ 
      success: false, 
      message: er.message 
    });
    
  } finally {
    try {
      if (transactionState.length > 0) {
        await createLog("PAYMENY_WEBHOOK_PROCESSING_STATE", {
          event: req.body?.event,
          reference: req.body?.data?.flw_ref || req.body?.data?.id,
          userId: req.body?.data?.meta?.userId,
          status: req.body?.data?.status,
          transactionState: transactionState.join(", "),
          finalState: transactionState[transactionState.length - 1]
        }, null, req.headers);
      }
      
      if (req.err) {
        await logError("PAYMENT_WEBHOOK_PROCESSING_ERROR", req.err, {
          event: req.body?.event,
          transactionState: transactionState.join(", "),
          body: req.body
        });
      }
    } catch (logError) {
      console.error("Failed to create webhook log:", logError);
    }
  }
});

// for billstack 


app.post("/webhook/billstack", async (req, res) => {
  const transactionState = [];
  
  try {
    transactionState.push("Starting BillStack webhook processing");
    
    req.config = await requireConfig();
    if (!req.config) {
      transactionState.push("Configuration not found - aborting");
      return res.status(400).json({
        received: true,
        message: "app configuration not found"
      });
    }
    
    transactionState.push("Configuration loaded successfully");
    
    // BillStack webhook security verification
    const signature = req.headers["x-wiaxy-signature"];
    const secretKey = req?.config?.apiKeys?.paymentkey2 || PAYMENT_KEY_2 || req?.config?.apiKeys?.paymentHash || PAYMENT_HASH_KEY;
    
    if (!secretKey) {
      transactionState.push("BillStack secret key not configured - aborting");
      return res.status(400).json({
        success: false,
        message: "webhook secret key not configured"
      });
    }
    
    // check MD5 hash of secret key for comparison
     const expectedSignature = crypto.createHash('md5', secretKey).update(JSON.stringify(req.body)).digest('hex');
     
    if (signature == expectedSignature) {
      transactionState.push(`Invalid BillStack signature - aborting. Received: ${signature}, Expected: ${expectedSignature}, secret: ${secretKey}`);
      return res.status(400).json({
        success: false,
        message: "invalid webhook signature"
      });
    }
    
    transactionState.push("BillStack signature verified successfully");
    
    const { event, data } = req.body;
    
    // BillStack specific event validation
    if (event !== "PAYMENT_NOTIFICATION") {
      transactionState.push(`Invalid BillStack event: ${event} - aborting`);
      return res.status(400).json({
        success: false,
        message: "invalid event type",
        event,
        expectedEvent: "PAYMENT_NOTIFICATION"
      });
    }
    
    
    // Check if it's a reserved account transaction
    if (data.type !== "RESERVED_ACCOUNT_TRANSACTION") {
      transactionState.push(`Unsupported BillStack transaction type: ${data.type} - ignoring`);
      return res.status(200).json({
        received: true,
        message: "unsupported transaction type, ignoring"
      });
    }
    
    transactionState.push(`Processing BillStack payment: reference=${data.reference}, amount=${data.amount}`);
    
    // Extract data from BillStack webhook payload
    const {
      reference,
      merchant_reference,
      wiaxy_ref,
      amount,
      created_at,
      account,
      payer,
      customer
    } = data;
    
    
    const user = await User.findOne({
      email: data.customer.email
    });
    
   
    
    if (!user) {
      transactionState.push(`No such user found in database: ${data.customer.email}`);
      
      // Try to extract from wiaxy_ref or other fields if needed
      // This is a fallback - you should properly store and retrieve the userId
      return res.status(400).json({
        success: false,
        message: "user not found in  database webhook",
        data: {
          reference,
          merchant_reference,
          account_number: account.account_number
        }
      });
    }
    
    let userId = user._id;
    
    // Validate userId
    if (!validateId(userId)) {
      transactionState.push(`Error Invalid User Id: ${userId}`);
      return res.status(400).json({
        success: false,
        message: "invalid user id"
      });
    }
    
    userId = validateId(userId);
    
    // Check for duplicate transaction
    const existingTx = await Transaction.findOne({
      providerReference: wiaxy_ref
    });
    
    if (existingTx) {
      transactionState.push(`Duplicate BillStack transaction found: ${reference} - aborting`);
      return res.status(200).json({
        existingTx,
        success: false,
        message: `payment transaction with reference: ${reference} already exists`
      });
    }
    
    transactionState.push("No duplicate transaction found - proceeding");
    
    
    if (!user) {
      transactionState.push(`User not found in database: ${userId} - creating failed transaction`);
      
      const failedTx = await Transaction.create({
        userId,
        category: "wallet",
        walletAction: "funding",
        provider: "app",
        amount: parseFloat(amount),
        status: "failed",
        previousBalance: 0,
        newBalance: 0,
        providerReference: reference,
        paymentSource: "bank_transfer",
        meta: {
          billstackData: data,
          account,
          payer,
          merchant_reference,
          wiaxy_ref
        },
        description: `funding failed - user with id: ${userId} doesn't exist in our database`
      });
      
      await Notification.create({
        title: "payment failed",
        description: `the payment to account ${account.account_number} failed because the user doesn't exist in our database`,
        flag: "warning",
        from: "system",
        userId
      });
      
      return res.status(400).json({
        success: false,
        message: `user with id: ${userId} doesn't exist in our database`
      });
    }
    
    transactionState.push(`Processing successful BillStack payment for user: ${userId}, current balance: ${user.balance}`);
    
    // Calculate fees (adjust based on your BillStack fee structure)
    const providerFees = {
      percent: 0.5,
      fixed: 0,
      capped: 300
    };
    
    let providerFee = 
    ((amount / 100) * providerFees.percent)
    + providerFees.fixed;
    providerFee = providerFee >= providerFees.capped ? providerFees.capped : providerFee;
    
     
    const { percent, fixed } = req.config.fundingDetails.fee;
    const fundingFee = getFundingProfit(req, parseFloat(amount), providerFee);
    const fundingAmount = getFundingAmount(req, parseFloat(amount), providerFee);
    
    transactionState.push(`Calculated funding: amount=${fundingAmount}, fee=${fundingFee}, providerFee=${providerFee}`);
    
    // Create transaction record
    const fundingTx = await createFundingTransaction(
      userId,
      user.balance,
      fundingAmount,
      fundingFee,
      wiaxy_ref,
      `virtual account • ${account.bank_name}`,
      "success",
      "app",
      {
        merchant_reference,
        wiaxy_ref,
        account_number: account.account_number,
        account_name: account.account_name,
        bank_name: account.bank_name,
        payer_account: payer.account_number,
        payer_name: `${payer.first_name} ${payer.last_name}`,
        profit: fundingFee,
        fundingAmount,
        fundingFee,
        providerFee,
        billstack_data: data
      }
    );
    
    transactionState.push(`Funding transaction created: ${fundingTx._id}, new balance: ${user.balance + fundingAmount}`);
    
    // Update user balance
    await User.findByIdAndUpdate(userId, {
      $inc: {
        balance: fundingAmount,
        notification: 1,
        totalFunding: fundingAmount
      }
    });
    
    transactionState.push(`User balance updated: added ${fundingAmount}`);
    
    // Create notification
    await Notification.create({
      userId,
      title: "payment successful",
      description: `your wallet has been credited with ₦${fundingAmount} from ${payer?.account_name || "__"} ${payer?.account_number || "__"} ${payer?.bank_name || "__"}. A processing fee of ₦${amount - fundingAmount} was charged.`,
      from: "system"
    });
    
    transactionState.push(`Success notification created for user`);
    
    // Update statistics
    await updateStat("success", fundingAmount, "deposit", {
      profit: fundingFee,
      provider: "app"
    });
    
    transactionState.push("Statistics updated successfully");
    transactionState.push("BillStack webhook processing completed successfully");
    
    return res.status(200).json({
      received: true,
      success: true,
      message: `successfully processed BillStack payment of ₦${fundingAmount} for user ${userId}`
    });
    
  } catch (er) {
    transactionState.push(`Error caught: ${er.message}`);
    console.error("BillStack webhook error:", er);
    
    return res.status(500).json({
      success: false,
      message: "internal server error processing BillStack webhook"
    });
    
  } finally {
    try {
      if (transactionState.length > 0) {
        await createLog("BILLSTACK_WEBHOOK_PROCESSING_STATE", {
          body: req.body,
          transactionState
        }, null, req.headers);
      }
      
      if (req.err) {
        await logError("BILLSTACK_WEBHOOK_PROCESSING_ERROR", req.err, {
          body: req.body,
          transactionState
        });
      }
    } catch (logError) {
      console.error("Failed to create BillStack webhook log:", logError);
    }
  }
});


// others need authorization
app.use(authorize);

app.get("/confirmpayment/:reference", async (req, res) => {
  try{
    const {reference} = req.params;
    if(typeof reference !== "string" || !reference) throw new req.AppError("invalid reference!!")
    const {success, data} = await confirmTransaction(req, reference)
    res.json({ success, data })
  }catch(er){
    res.json({
      success: false,
      message: er.message
    })
  }
})


app.post("/generateLink", async (req, res, next) => {
  try{
 let {amount} = req.body;
 const {email, _id, phone, name} = req.user;
 
 if(!email || typeof email !== "string" || 
  typeof amount !== "number" || amount < 50 
 ) throw new req.AppError("invalid request data!!")
 
 if(amount < 50 && !isNaN(amount)) return res.json({
   success: false,
   message: amount < 50 ? "minimum amount is ₦50" : "amount must be a number"
 })
 
 amount = Number(amount)
 
 const {success, link, reference} = await createPaymentlink(req, {
   amount,
   redirect_url: paymentRedirect,
   customer: {
     email,
     phone_number: phone,
     name
   },
   customization: {
    title: "sadiq sharp sub wallet funding payment",
    logo: `${req.domain}/images/logo.png`
   },
   meta: {
     userId: _id,
     paymentType: "payment link",
     paymentPurpose: "wallet funding",
     email,
     name,
     phone
   }
  })
  
  
  if(success) return res.json({
    success,
    data: {
      link,
      reference
    }
  })
  
  if(!success) throw new req.AppError("something went wrong generating payment link")
  }catch(er){
    req.err = er;
    next()
  }
})

const maxNameLength = 50;
const maxWalletLength = 3;

app.post("/reserveAccount", async (req, res, next) => {
  try{
    let { email, _id, phone} = req.user;
    const {bvn = "", nin = "", name = req.user.name} = req.body;
    if(typeof bvn !== "string" || typeof nin !== "string") throw new req.AppError("invalid kyc bvn or nin cresidentials!!")
    
    if(req.user.wallets.length >= maxWalletLength) return res.json({
      success: false,
      message: `you can't have more than ${maxWalletLength} virtual wallets`
    })
    
    if(bvn.length < 11 && nin.length < 11) return res.json({
      success: false,
      message: "valid nin or bvn is required to create funding wallet"
    })
    
    const kycDetails = {};
    if(nin) kycDetails.nin = nin;
    if(bvn) kycDetails.bvn = bvn;
 
    const [first_name, second_name] = name.split(" ");

    const narration = `sadiq sharp sub - ${
      name.length < maxNameLength ? name : 
      `${first_name} ${second_name}`
    }`;
    
   let {success, message, accountNumber, accountName, bankName, reference } = await createVirtualAccountWithBillStack(req, {
      email,
      name,
      bvn,
      nin,
      narration,
      phone,
      user: req.user,
      meta: {
        userId: _id,
        paymentType: "virtual account",
        paymentPurpose: "wallet funding",
        phone, 
        name,
        email
      }
    })
    
    if(!success) return res.json({
      success,
      message: message ??= "something went wrong creating virtual account"
    })
    
    
    
    const user = await User.findByIdAndUpdate(_id, {
      $push: {
        wallets: {
          accountNumber,
          accountName,
          bankName
        }
      },
      $set: {
        kycDetails
      }
    }, {new: true})
    
    return res.json({
      success: true,
      data: {
        user,
        reference,
        accountName,
        accountNumber,
        bankName
      }
    })
  }catch(er){
    console.log(er)
    req.err = er;
    next()
  }
})




export default app