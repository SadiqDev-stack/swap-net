import Transaction from "../models/transaction.js";
import {Router} from "express";
import authorize from "../middlewares/authorization.js";
import {sanitizeInput} from "../utilities/general.js";

const app = Router();

app.use(authorize)

app.get("/:reference", async (req, res, next) => {
  try {
    
    const {reference = ""} = req.params;
    if(!reference || typeof reference !== "string") throw new req.AppError("invalid transaction reference!!");
    const transaction = await Transaction.findOne({ 
      $or: [{ reference }, {providerReference: reference}],
      userId: req.user._id
    }).lean()
    
    if(!transaction) throw new req.AppError ("transaction doesnt exist");
    transaction.username = req.user.name;
    
    return res.json({
      success: true,
      data: {
        transaction
      }
    })
  }catch(er){
    req.err = er;
    next()
  }
})




app.get("/history", async (req, res, next) => {
  try {
    const { _id } = req.user;
    
    for (const field in req.query) {
      if (field && field !== "page" && field !== "limit") req.query[field] = sanitizeInput(req.query[field])
    }
    
    const {
        page = 1,
        limit = 20,
        status,
        service,
        network,
        channel = "app",
        search,
        dateFrom,
        category,
        walletAction,
        provider
    } = req.query;
    
    
    const query = { userId: _id };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    if (status) query.status = status;
    if (service) query.service = service;
    if (category) query.category = category;
    if (walletAction) query.walletAction = walletAction;
    if (provider) query.provider = provider;
    
    if (network && (service === "data" || service === "airtime")) {
      query.network = network;
    }
    
    if (channel) query.channel = channel;
    if (dateFrom) query.createdAt = { $gte: new Date(dateFrom) };
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { reference: searchRegex },
        { providerReference: searchRegex },
        { recipient: searchRegex },
        { description: searchRegex },
        { planId: searchRegex }
      ];
    }
    
    
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("-__v -meta._id -meta.userId")
      .lean();
    
    const total = transactions.length;
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          hasNext,
          hasPrev
        }
      }
    });
    
  } catch (error) {
    req.err = error;
    next();
  }
});


export default app