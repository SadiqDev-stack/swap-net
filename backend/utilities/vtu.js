import Transaction from "../models/transaction.js"
import Stat from "../models/stat.js";
import User from "../models/user.js";
import Log from "../models/log.js"

let servicePackage = false;

const convertToGb = (dataDescription, unit = null) => {
  // If we already have unit info from getDataUnit
  if (unit) {
    const amountNum = parseFloat(dataDescription);
    if (isNaN(amountNum)) return 0;
    
    const unitLower = unit.toLowerCase();
    
    if (unitLower.includes("tb")) return amountNum * 1024;
    if (unitLower.includes("gb")) return amountNum;
    if (unitLower.includes("mb")) return amountNum / 1024;
    if (unitLower.includes("kb")) return amountNum / (1024 * 1024);
    return 0;
  }
  
  // For complex descriptions, use extractTotalDataGB
  const result = extractTotalDataGB(dataDescription);
  return result.totalGB;
};

const getDataUnit = (description) => {
  if (!description) return { amount: 0, unit: "gb" };
  
  const match = description.match(/(\d+(\.\d+)?)\s*(tb|gb|mb|kb)/i);
  if (match) {
    return {
      amount: parseFloat(match[1]),
      unit: match[3].toLowerCase(),
      isExactMatch: true
    };
  }
  
  const numberMatch = description.match(/(\d+(\.\d+)?)/);
  if (numberMatch) {
    return {
      amount: parseFloat(numberMatch[1]),
      unit: "gb",
      isExactMatch: false
    };
  }
  
  return { amount: 0, unit: "gb", isExactMatch: false };
};


const getPackageValue = (value, margin = 0, packageData = servicePackage) => {
  const discount = packageData.discount;
  
  if(discount == 0) return value
  const discountAmount = (discount / 100) * margin;
  const returnValue = value - discountAmount;
  
  return Math.ceil(returnValue)
}

const convertToNumber = currencyString => {
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  return Math.ceil(parseFloat(cleaned));
}




// New helper function to extract total GB from complex descriptions
const extractTotalDataGB = (description) => {
  if (!description) return { totalGB: 0, units: [] };
  
  // Find all data units in the description
  const matches = description.match(/(\d+(\.\d+)?)\s*(tb|gb|mb|kb)/gi);
  
  if (!matches || matches.length === 0) {
    // Try to find just a number
    const numberMatch = description.match(/(\d+(\.\d+)?)/);
    if (numberMatch) {
      const amount = parseFloat(numberMatch[1]);
      return { 
        totalGB: amount, // Assume GB if no unit specified
        units: [{ amount, unit: 'gb' }]
      };
    }
    return { totalGB: 0, units: [] };
  }
  
  // Calculate total in GB
  let totalGB = 0;
  const units = [];
  
  matches.forEach(match => {
    const unitMatch = match.match(/(\d+(\.\d+)?)\s*(tb|gb|mb|kb)/i);
    if (unitMatch) {
      const amount = parseFloat(unitMatch[1]);
      const unit = unitMatch[3].toLowerCase();
      units.push({ amount, unit });
      
      // Convert to GB
      switch(unit) {
        case 'tb': totalGB += amount * 1024; break;
        case 'gb': totalGB += amount; break;
        case 'mb': totalGB += amount / 1024; break;
        case 'kb': totalGB += amount / (1024 * 1024); break;
      }
    }
  });
  
  return {
    totalGB: parseFloat(totalGB.toFixed(2)),
    units: units
  };
};

const getDataVendingAmount = (price, dataDescription, margin) => {
  const dataInfo = extractTotalDataGB(dataDescription);
  const totalGB = dataInfo.totalGB;
  const basePrice = convertToNumber(price);
  const vendingPrice = basePrice + (totalGB * margin);
  
  return getPackageValue(vendingPrice, margin);
};

const getAirtimeVendingAmount = (discount, margin) => {
  const percentDiscount = (discount / 100) * margin;
  return getPackageValue(percentDiscount + margin, margin)
}

const getExamVendingAmount = (amount, margin) => {
  return getPackageValue(convertToNumber(amount) + margin, margin)
}

const getCableVendingAmount = (amount, margin) => {
  return getPackageValue(convertToNumber(amount) + margin, margin)
}

const getElectricityVendingAmount = (discount, margin) => {
  return getPackageValue(margin - discount, margin)
}

const calculateVendingServices = (providerServices, user, appConfig) => {
  if(!user || !providerServices || !appConfig) throw new Error("fail to get services, some data not found")
  
  
  const providerAirtime = providerServices.airtime || [];
  const providerDataPlans = providerServices.dataPlans || [];
  const providerEducation = providerServices.education || [];
  const providerCable = providerServices.cablePlans || [];
  const providerElectricity = providerServices.electricity || [];
  
  const {services, packages} = appConfig;
  servicePackage = packages.find(pkg => pkg.name == user.package) || packages[0];
  
  const vendingServices = {};
  
  for(const serviceName in services){
    const service = services[serviceName];
    
    if(!service.active) continue; // Skip inactive service, don't return
    
    vendingServices[serviceName] = {
      active: service.active
    }
    
    if(serviceName == "data"){
      vendingServices[serviceName].networks = [];
      vendingServices[serviceName].plans = {};
      
      providerDataPlans.forEach(plan => {
        const {network, serviceID, amount, dataPlan, dataType, validity} = plan;
        
        const serviceConfig = service.networks.find(config => config.name == network && config.active);
        if(!serviceConfig) return;
        
        const {plans: allowedPlans, margin} = serviceConfig;
        if(!allowedPlans.find(name => name.includes(dataType))) return;
        
        const vendingPlanOption = {
          serviceId: serviceID,
          network,
          validity,
          planType: dataType,
          amount: dataPlan,
          price: getDataVendingAmount(amount, dataPlan, margin) || margin// dataPlan is the description
        }
        
        if(!vendingServices[serviceName].networks.includes(network)){
          vendingServices[serviceName].plans[network] = {};
          vendingServices[serviceName].networks.push(network);
        }
        
        if(!vendingServices[serviceName].plans[network][dataType]){
          vendingServices[serviceName].plans[network][dataType] = []
        }
        
        vendingServices[serviceName].plans[network][dataType].push(vendingPlanOption)
      })
    } else if(serviceName == "airtime"){
      vendingServices[serviceName].networks = {};
      
      providerAirtime.forEach(airtime => {
        const {network, serviceID, discount} = airtime;
        const serviceConfig = service.networks.find(config => config.name == network && config.active);
        if(!serviceConfig) return;
        
        const {margin} = serviceConfig;
        vendingServices[serviceName].networks[network] = {
          margin: getAirtimeVendingAmount(parseFloat(discount), margin),
          marginType: "percent",
          serviceID
        }
      })
    } else if(serviceName == "education"){
      vendingServices[serviceName].exams = [];
      
      providerEducation.forEach(exam => {
        const {type, amount, serviceID} = exam;
        const serviceConfig = service.exams.find(config => config.name == type && config.active)
        if(!serviceConfig) return;
        
        const {margin} = serviceConfig;
        vendingServices[serviceName].exams.push({
          type,
          serviceID,
          price: getExamVendingAmount(amount, margin)
        })
      })
    } else if(serviceName == "cable"){
      vendingServices[serviceName].providers = [];
      
      providerCable.forEach(cableProvider => {
        const {serviceID, cablePlan, cable, amount} = cableProvider;
        const config = service.providers.find(config => config.name == cable && config.active)
        if(!config) return;
        
        const {margin} = config;
        vendingServices[serviceName].providers.push({
          serviceID,
          price: getCableVendingAmount(amount, margin),
          cable,
          cablePlan
        })
      })
    } else if(serviceName == "electricity"){
      vendingServices[serviceName].providers = [];
      
      providerElectricity.forEach(provider => {
        const {disco, serviceID, discount} = provider;
        const config = service.discos.find(config => disco.includes(config.name) && config.active);
        if(!config) return;
        
        const {margin} = config;
        vendingServices[serviceName].providers.push({
          serviceID,
          disco,
          margin: getElectricityVendingAmount(parseFloat(discount), margin),
          marginType: "fixed"
        })
      })
    } else if(serviceName == "rechargeCard"){
      vendingServices[serviceName].networks = {};
      
      // Handle rechargeCard if you have provider data for it
      // This depends on whether your API returns recharge card data
    }
  }
 
    return vendingServices
}


// for transaction

const createPackageTransaction = async (userId, previousBalance, newBalance, newPackage, status = "processing", channel = "app", meta = {}) => {
  const fee = newPackage.price;
  meta = {
    ...meta, 
    profit: fee
  }
  const description = `Package ${fee == 0 ? "downgraded" : "upgraded"} to ${newPackage.name}, ${newPackage.description}`;
  const reference = Date.now().toString();
  
  const data = {
    userId,
    category: "package",
    walletAction: "debit",
    packageAction: fee === 0 ? "downgrade" : "upgrade",
    provider: "system",
    amount: fee,
    costPrice: fee,
    fee,
    previousBalance,
    newBalance,
    reference,
    providerReference: reference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    meta,
    newPackage: newPackage.name
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createDataTransaction = async (userId, oldBalance, newBalance, amount, costPrice, network, planId, planType, recipient, description, status, channel = "app", meta, providerReference = null) => {
  const previousBalance = oldBalance;
  
  const data = {
    userId,
    category: "service",
    service: "data",
    provider: "services",
    amount,
    costPrice,
    previousBalance,
    newBalance,
    network,
    planId,
    planType,
    recipient,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createAirtimeTransaction = async (userId, oldBalance, newBalance, amount, costPrice, network, recipient, description, status = "processing", channel = "app", meta = {}, providerReference = null) => {
  const previousBalance = oldBalance
  
  const data = {
    userId,
    category: "service",
    service: "airtime",
    provider: "services",
    amount: `₦${amount}`,
    costPrice,
    previousBalance,
    newBalance,
    network,
    recipient,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createElectricityTransaction = async (userId, oldBalance, newBalance, amount, costPrice, disco, recipient, description, status = "processing", channel = "app", meta = {}, providerReference = null) => {
  const previousBalance = oldBalance
 
  const data = {
    userId,
    category: "service",
    service: "electricity",
    provider: "services",
    amount: `₦${amount}`,
    costPrice,
    previousBalance,
    newBalance,
    recipient,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    disco,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createCableTransaction = async (userId, oldBalance, newBalance, amount, costPrice, cable, planName, recipient, description, status = "processing", channel = "app", meta = {}, providerReference = null) => {
  const previousBalance = oldBalance
  
  
  const data = {
    userId,
    category: "service",
    service: "cable",
    provider: "services",
    amount: `₦${amount}`,
    costPrice,
    previousBalance,
    newBalance,
    planName,
    recipient,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    cable,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createEducationTransaction = async (userId, oldBalance, newBalance, amount, costPrice, examType, quantity, description, status = "processing", channel = "app", meta = {}, providerReference = null) => {
  const previousBalance = oldBalance
  
  const data = {
    userId,
    category: "service",
    service: "education",
    provider: "services",
    amount: `₦${amount}`,
    costPrice,
    previousBalance,
    newBalance,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    examType,
    quantity,
    pins: [],
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createFundingTransaction = async (userId, previousBalance, amount, fee = 0, providerReference, paymentSource = "virtual_account", status = "processing", channel = "app", meta = {}) => {
  const newBalance = previousBalance + amount;
  const description = `Wallet Credited With ₦${amount}`;
  
  const data = {
    userId,
    category: "wallet",
    walletAction: "funding",
    provider: "payment",
    amount: `₦${amount}`,
    costPrice: 0,
    fee,
    previousBalance,
    newBalance,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource,
    description,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createRefundTransaction = async (userId, amount, providerReference = null, status = "processing", channel = "app", meta = {}) => {
  const previousBalance = 0;
  const newBalance = amount;
  const description = `Wallet Refunded With ₦${amount}`;
  
  const data = {
    userId,
    category: "wallet",
    walletAction: "refund",
    provider: "system",
    amount,
    costPrice: 0,
    fee: 0,
    previousBalance,
    newBalance,
    reference: Date.now().toString(),
    providerReference,
    status,
    channel,
    paymentSource: "wallet",
    description,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const createChargeTransaction = async (userId, oldBalance, newBalance, amount, status = "processing", channel = "app", meta = {}) => {
  const previousBalance = oldBalance;
  const description = meta.reason || "not specified!"
  
  const data = {
    userId,
    category: "charge",
    provider: "system",
    amount: `₦${amount}`,
    costPrice: 0,
    fee: 0,
    previousBalance,
    newBalance,
    reference: Date.now().toString(),
    status,
    channel,
    paymentSource: "wallet",
    description,
    meta
  };
  
  const transaction = await Transaction.create(data);
  return transaction;
}

const updateTransactionStatus = async (transactionId, status, providerReference = null, other = {}) => {
  const updateData = { status, ...other };
  if(providerReference) updateData.providerReference = providerReference;
  
  const transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    updateData,
    { new: true }
  );
  
  return transaction;
}

const updateTransactionBalance = async (transactionId, previousBalance, newBalance) => {
  const transaction = await Transaction.findByIdAndUpdate(
    transactionId,
    { previousBalance, newBalance },
    { new: true }
  );
  
  return transaction;
}

const validatePhone = phone => {
  const NETWORK_PREFIXES = [
  // MTN
  "0803", "0806", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916", "0703", "0704", "0706", "07025", "07026", "0911",
  
  // Airtel
  "0802", "0808", "0812", "0901", "0902", "0904", "0907", "0908", "0912", "0701", "0708", "0809", "0811",
  
  // Glo
  "0805", "0807", "0811", "0815", "0905", "0915", "0705",
  
  // 9mobile
  "0809", "0817", "0818", "0819", "0908", "0909", "0919",
  
  // Visafone
  "07025", "07026", "0704",
  
  // VITEL 
  "0712"
];

// removed phone validation
if(!phone /* || !NETWORK_PREFIXES.includes(phone.slice(0, 4)) || */ || phone.length < 11) return false
return true
}

// utilities
// Helper function to check transaction pin
const checkTransactionPin = (req, transactionPin) => {
    if(req.requestType !== "api") {
        if(transactionPin !== req.user.transactionPin) {
            throw new Error("Invalid transaction pin");
        }
    }
}

// Helper function to calculate airtime cost
const calculateAirtimeCost = (amount, marginPercent) => {
    const marginAmount = (marginPercent / 100) * amount;
    return Math.ceil(amount + marginAmount);
}

// Helper function to update stats after transactio
/* 
        if(status !== "failed"){
        if(type == "purchase" || type == "deposit" || type == "refund"){
        if (type === 'purchase') {
            updateData.totalPurchases = amount;
            updateData.totalSalesCount = 1;
            if(meta.profit) updateData.totalProfit = meta.profit || 0
            if(meta.amountInGb) updateData.totalGbPurchased = meta.amountInGb || 0
        } else if(type == "deposit"){
          updateData.totalDepositCount = 1;
          updateData.totalDeposit = amount;
          updateData.totalBalance = amount;
          updateData.totalProfit = meta.profit || 0
        }
        
        if (status === 'success') {
           updateData.successTransactionsCount = 1;
           if(type == "purchase") updateData.totalBalance = -amount; // Deduct from system balance
        } else if (status === 'failed') {
            updateData.failedTransactionsCount = 1;
        }
        }else{
          if(type == "registration"){
            updateData.totalUsersCount = amount;
            updateData.activeUsersCount = amount
          }
        }
        }else{
          // reverse failed 
          if (type == "purchase" || type == "deposit" || type == "refund") {
          if (type === 'purchase') {
            updateData.totalPurchases = -amount;
            updateData.totalSalesCount = -1;
            // fix later 
            if (meta.profit) updateData.totalProfit = -meta.profit;
            if (meta.amountInGb) updateData.totalGbPurchased = -meta.amountInGb
          } else if (type == "deposit") {
            updateData.totalDepositCount = -1;
            updateData.totalDeposit = -amount;
            updateData.totalBalance = -amount;
          }
          
          if (status === 'success') {
            updateData.successTransactionsCount = -1;
            if (type == "purchase") updateData.totalBalance = amount; // add from system balance
          } else if (status === 'failed') {
            updateData.failedTransactionsCount = 1;
          }
        } else {
          if (type == "registration") {
            updateData.totalUsersCount = -amount;
            updateData.activeUsersCount = -amount
          }
        }
          
        }
        */
const updateStat = async (status, amount, type = 'purchase', meta = {}) => {
    try {
        const updateData = {};
        
        if(status == "success"){
         if(type == "purchase"){
           updateData.totalPurchases = amount;
           updateData.totalSalesCount = 1;
           updateData.totalBalance = -amount;
           updateData.totalProfit = meta.profit || 0;
           updateData.totalGbPurchased = meta.amountInGb || meta.dataGb || 0;
           updateData.successTransactionsCount = 1;
         }
         
         if(type == "deposit"){
           updateData.successTransactionsCount = 1;
           updateData.totalDepositCount = 1;
           updateData.totalDeposit = amount;
           updateData.totalBalance = amount;
           updateData.totalProfit = meta.profit || 0
         }
         
         if(type == "registration"){
           updateData.totalUsersCount = 1;
           updateData.activeUsersCount = 1;
         }
        
        }else if(status == "failed"){
          if(type == "purchase"){
            updateData.failedTransactionsCount = 1;
          }
        }else if(status == "failed-resolve"){
           updateData.failedTransactionsCount = 1;
        }else if(status == "success-resolve"){
           updateData.totalPurchases = amount;
           updateData.totalSalesCount = 1;
           updateData.totalBalance = -amount;
           updateData.totalProfit = meta.profit || 0;
           updateData.totalGbPurchased = meta.amountInGb || meta.dataGb || 0;
           updateData.successTransactionsCount = 1;
       
        }
        
        await Stat.findOneAndUpdate(
            {},
            { $inc: updateData },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Helper function to generate consistent messages
const generateMessage = (status, serviceType, details = {}) => {
    const { amount, phone, network, planType, validity, price, cableProvider, iucNumber, planName, disco, meterNumber, token, examType, quantity } = details;
    
    const thankYou = " Thank you for trusting us 🙏";
    
    if (status === "success") {
        switch(serviceType) {
            case "data":
                return `You successfully gifted ${amount} ${planType} data to ${phone} valid for ${validity}.${thankYou}`;
            case "airtime":
                return `You successfully sent ₦${amount} airtime to ${phone}.${thankYou}`;
            case "cable":
                return `Cable subscription successful: ${planName} ${cableProvider} to ${iucNumber} the value is delivered to your cable.${thankYou}`;
            case "electricity":
                return `Electricity bill payment successful: ₦${amount} ${disco} to ${meterNumber} ${token ? `your token is ${token}` : " your subscription is delivered to your meter thank you"} .${thankYou}`;
            case "education":
                const pinMessage = details.pins?.length ? `Your pins are: ${details.pins.join(", ")}.` : "View transaction history for pins.";
                return `${examType} pin purchase successful: ${quantity} pin(s). ${pinMessage}${thankYou}`;
            default:
                return `Transaction successful.${thankYou}`;
        }
    } else if (status === "processing") {
        return `Oops 😔 your transaction is still processing. We will notify you once finished.${thankYou}`;
    } else if (status === "failed") {
        return details.message || `Oh no 😔 the transaction failed unexpectedly. Please try again.${thankYou}`;
    } else if (status === "error") {
        return `Service temporarily unavailable. Please try again later.${thankYou}`;
    }
    
    return `Transaction ${status}.${thankYou}`;
}

// Helper function to create response object
const createResponse = (success, status, message, data = {}, transaction = null, balances = {}) => {
    const response = {
        success,
        status,
        message,
        data: {
            ...data,
            status,
            ...balances
        }
    };
    
    if (transaction) {
        response.transaction = transaction;
    }
    
    return response;
}

// Helper function for atomic balance deduction
const deductUserBalance = async (userId, amount, spentField = 'data') => {
  const updateQuery = {
          $inc: {
            balance: -amount,
            [`totalSpent.${spentField}`]: amount,
            "totalSpent.total": amount,
            
          }
        }
        
  
    const result = await User.findOneAndUpdate(
        {
            _id: userId,
            balance: { $gte: amount } // Only update if balance is sufficient
        },
        updateQuery,
        { 
            new: true,
            returnDocument: 'after'
        }
    );
    
    return result;
};

// Helper function to check balance and deduct atomically
const processPayment = async (req, costPrice, spentField = 'data') => {
    // Quick check using cached user balance from authorization
    if (req.user.balance < costPrice) {
        return {
            success: false,
            user: null,
            oldBalance: req.user.balance,
            newBalance: req.user.balance,
            message: "Insufficient balance, please fund your wallet and try again"
        };
    }
    
    // Atomic balance deduction
    const user = await deductUserBalance(req.user._id, costPrice, spentField);
    
    if (!user) {
        return {
            success: false,
            user: null,
            oldBalance: req.user.balance,
            newBalance: req.user.balance,
            message: "Insufficient balance, please fund your wallet and try again"
        };
    }
    
    return {
        success: true,
        user: user,
        oldBalance: user.balance + costPrice, // Calculate old balance from new balance
        newBalance: user.balance
    };
};



const getTodayTransactionStats = async (userId = null) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get ALL transactions for today
  const filter = {
    createdAt: { $gte: today, $lt: tomorrow }
  };

  if (userId) filter.userId = userId;

  const allTransactions = await Transaction.find(filter);
  
  // Get only successful transactions for certain calculations
  const successfulTransactions = allTransactions.filter(tx => tx.status === "success");

  const stats = {
    totalTransactions: allTransactions.length,
    
    services: {
      data: { 
        total: 0,           // Revenue from ALL data attempts
        cost: 0,            // Cost from ALL data attempts
        count: 0,           // Total attempts count
        totalGB: 0,         // Data GB only from SUCCESSFUL purchases
        profit: 0,          // Profit only from SUCCESSFUL purchases
        breakdown: {} 
      },
      airtime: { 
        total: 0, 
        cost: 0, 
        count: 0, 
        totalValue: 0, 
        profit: 0 
      },
      electricity: { 
        total: 0, 
        cost: 0, 
        count: 0, 
        totalValue: 0, 
        profit: 0 
      },
      cable: { 
        total: 0, 
        cost: 0, 
        count: 0, 
        profit: 0 
      },
      education: { 
        total: 0, 
        cost: 0, 
        count: 0, 
        totalPins: 0, 
        profit: 0 
      }
    },

    wallet: {
      funding: { total: 0, count: 0 },
      debit: { total: 0, count: 0 },
      credit: { total: 0, count: 0 },
      refund: { total: 0, count: 0 }
    },

    totals: {
      totalCost: 0,           // Cost from ALL transactions
      totalRevenue: 0,        // Revenue from ALL transactions
      totalFunding: 0,        // Only SUCCESSFUL funding
      totalRefunds: 0,        // Only SUCCESSFUL refunds
      profit: 0               // Profit only from SUCCESSFUL purchases
    },

    networks: {
      MTN: { total: 0, cost: 0, count: 0, profit: 0 },
      GLO: { total: 0, cost: 0, count: 0, profit: 0 },
      AIRTEL: { total: 0, cost: 0, count: 0, profit: 0 },
      "9MOBILE": { total: 0, cost: 0, count: 0, profit: 0 }
    },

    // New field for status breakdown
    statusBreakdown: {
      success: successfulTransactions.length,
      failed: allTransactions.filter(t => t.status === "failed").length,
      processing: allTransactions.filter(t => t.status === "processing").length,
      reversed: allTransactions.filter(t => t.status === "reversed").length
    }
  };

  // Process ALL transactions for revenue, cost, and counts
  allTransactions.forEach(tx => {
    const amount = parseFloat(tx.amount) || 0;
    const costPrice = tx.costPrice || 0;

    // Add to total revenue and cost (ALL transactions)
    stats.totals.totalRevenue += amount;
    stats.totals.totalCost += costPrice;

    if (tx.category === "service") {
      if (tx.service === "data") {
        stats.services.data.total += amount;
        stats.services.data.cost += costPrice;
        stats.services.data.count++;
        
        if (tx.planType) {
          if (!stats.services.data.breakdown[tx.planType]) {
            stats.services.data.breakdown[tx.planType] = { 
              total: 0, cost: 0, count: 0, totalGB: 0, profit: 0 
            };
          }
          stats.services.data.breakdown[tx.planType].total += amount;
          stats.services.data.breakdown[tx.planType].cost += costPrice;
          stats.services.data.breakdown[tx.planType].count++;
        }
      }
      // ... (keep your existing structure for other services)
      else if (tx.service === "airtime") {
        stats.services.airtime.total += amount;
        stats.services.airtime.cost += costPrice;
        stats.services.airtime.totalValue += amount;
        stats.services.airtime.count++;
      }
      else if (tx.service === "electricity") {
        stats.services.electricity.total += amount;
        stats.services.electricity.cost += costPrice;
        stats.services.electricity.totalValue += amount;
        stats.services.electricity.count++;
      }
      else if (tx.service === "education") {
        stats.services.education.total += amount;
        stats.services.education.cost += costPrice;
        stats.services.education.count++;
      }
      else if (tx.service === "cable") {
        stats.services.cable.total += amount;
        stats.services.cable.cost += costPrice;
        stats.services.cable.count++;
      }

      if (tx.network && stats.networks[tx.network]) {
        stats.networks[tx.network].total += amount;
        stats.networks[tx.network].cost += costPrice;
        stats.networks[tx.network].count++;
      }
    }
  });

  // Process ONLY SUCCESSFUL transactions for profit and data GB
  successfulTransactions.forEach(tx => {
    const amount = parseFloat(tx.amount) || 0;
    const costPrice = tx.costPrice || 0;
    const profit = tx.meta?.profit || 0;
    stats.totals.profit += profit;

    if (tx.category === "service") {
      if (tx.service === "data") {
        stats.services.data.profit += profit;
        
        const unitInfo = getDataUnit(tx.description);
        const gbAmount = convertToGb(unitInfo.amount, unitInfo.unit);
        stats.services.data.totalGB += gbAmount;
        
        if (tx.planType && stats.services.data.breakdown[tx.planType]) {
          stats.services.data.breakdown[tx.planType].totalGB += gbAmount;
          stats.services.data.breakdown[tx.planType].profit += profit;
        }
      }
      else if (tx.service === "airtime") {
        stats.services.airtime.profit += profit;
      }
      else if (tx.service === "electricity") {
        stats.services.electricity.profit += profit;
      }
      else if (tx.service === "education") {
        stats.services.education.profit += profit;
        if (tx.pins && Array.isArray(tx.pins)) {
          stats.services.education.totalPins += tx.pins.length;
        }
      }
      else if (tx.service === "cable") {
        stats.services.cable.profit += profit;
      }

      // Add profit to network stats
      if (tx.network && stats.networks[tx.network]) {
        stats.networks[tx.network].profit += profit;
      }

  }
    else if (tx.category === "wallet") {
      if (tx.walletAction === "funding") {
        stats.wallet.funding.total += amount;
        stats.wallet.funding.count++;
        stats.totals.totalFunding += amount;
      }
      else if (tx.walletAction === "debit") {
        stats.wallet.debit.total += amount;
        stats.wallet.debit.count++;
      }
      else if (tx.walletAction === "credit") {
        stats.wallet.credit.total += amount;
        stats.wallet.credit.count++;
      }
      else if (tx.walletAction === "refund") {
        stats.wallet.refund.total += amount;
        stats.wallet.refund.count++;
        stats.totals.totalRefunds += amount;
      }
    }
  });

  return {
    success: true,
    date: today.toISOString().split('T')[0],
    userId: userId || "all",
    stats
  };
};

const getTodayAdminDashboard = async () => {
  const result = await getTodayTransactionStats();
  
  if (!result.success) return result;

  const simplified = {
    summary: {
      totalTransactions: result.stats.totalTransactions,
      successfulTransactions: result.stats.statusBreakdown.success,
      failedTransactions: result.stats.statusBreakdown.failed,
      processingTransactions: result.stats.statusBreakdown.processing,
      totalRevenue: `₦${result.stats.totals.totalRevenue.toFixed(2)}`,  // All attempted revenue
      totalCost: `₦${result.stats.totals.totalCost.toFixed(2)}`,        // All costs
      totalProfit: `₦${result.stats.totals.profit.toFixed(2)}`,         // Only successful profit
      totalFunding: `₦${result.stats.totals.totalFunding.toFixed(2)}`,
      totalRefunds: `₦${result.stats.totals.totalRefunds.toFixed(2)}`
    },
    
    topServices: {
      data: {
        attempts: result.stats.services.data.count,
        successful: result.stats.statusBreakdown.success, // Rough estimate
        revenue: `₦${result.stats.services.data.total.toFixed(2)}`,
        profit: `₦${result.stats.services.data.profit.toFixed(2)}`,
        totalData: `${result.stats.services.data.totalGB.toFixed(2)} GB`
      },
      airtime: {
        attempts: result.stats.services.airtime.count,
        revenue: `₦${result.stats.services.airtime.total.toFixed(2)}`,
        profit: `₦${result.stats.services.airtime.profit.toFixed(2)}`,
        totalValue: `₦${result.stats.services.airtime.totalValue.toFixed(2)}`
      },
      electricity: {
        attempts: result.stats.services.electricity.count,
        revenue: `₦${result.stats.services.electricity.total.toFixed(2)}`,
        profit: `₦${result.stats.services.electricity.profit.toFixed(2)}`,
        totalValue: `₦${result.stats.services.electricity.totalValue.toFixed(2)}`
      }
    },
    
    walletActivity: {
      totalFunding: result.stats.wallet.funding.count,
      totalFundingAmount: `₦${result.stats.wallet.funding.total.toFixed(2)}`,
      totalRefunds: result.stats.wallet.refund.count,
      totalRefundAmount: `₦${result.stats.wallet.refund.total.toFixed(2)}`
    },
    
    topNetworks: {}
  };

  Object.entries(result.stats.networks).forEach(([network, data]) => {
    if (data.count > 0) {
      simplified.topNetworks[network] = {
        attempts: data.count,
        revenue: `₦${data.total.toFixed(2)}`,
        profit: `₦${data.profit.toFixed(2)}`
      };
    }
  });

  return {
    ...result,
    dashboard: simplified
  };
};

// ===== HELPER FUNCTIONS =====
const findNetworkById = (networks, networkId) => {
  return networks.find(network => network.id === parseInt(networkId));
};

const findProviderByCode = (providers, code) => {
  return providers.find(provider => provider.code === code);
};

const findExamByCode = (exams, code) => {
  return exams.find(exam => exam.code === code);
};

const getNextId = (array) => {
  const maxId = array.reduce((max, item) => Math.max(max, item.id || 0), 0);
  return maxId + 1;
};

// for profit calculation

const getPackageProfitOutput = (req = {
  user: {"package": "basic"},
  config: {
    packages: [{
      name: "basic",
      discount: 5
    }]
  }
}, profit = 50) => {
  const { config, user } = req;
  const { discount = 5 } = config.packages.find(pkg => pkg.name.toUpperCase() == user.package.toUpperCase())
  
  return profit - ((discount / 100) * profit);
}

const getDataProfit = (req, network, amount) => {
  const {config, user} = req;
  const { margin = 30 } = config.services.data.networks.find(nt => nt.name.toUpperCase() == network.toUpperCase());
  const totalGb = convertToGb(amount) || .5;
  const profit = margin * totalGb;
  return getPackageProfitOutput(req, profit)
}

const getAirtimeProfit = (req, network, amount) => {
  const {config, user} = req;
  const { margin = 1 } = config.services.airtime.networks.find(nt => nt.name.toUpperCase() == network.toUpperCase());
  const profit = (margin / 100 * amount);
  return getPackageProfitOutput(req, profit)
}

const getCableProfit = (req, providerCode) => {
  const {config, user} = req;
  const { margin = 100 } = config.services.cable.providers.find(pr => pr.code.toUpperCase() == providerCode.toUpperCase());
  const profit = margin;
  return getPackageProfitOutput(req, profit)
}

const getElectricityProfit = (req, disco) => {
  const { config, user } = req;
  const { margin = 100 } = config.services.electricity.discos.find(disc => disco.toUpperCase().includes(disc.code.toUpperCase()) || disc.code.toUpperCase().includes(disco.toUpperCase()));
  const profit = margin;
  return getPackageProfitOutput(req, profit)
}

const getEducationProfit = (req, exam, quantity) => {
  const { config, user } = req;
  const { margin = 100 } = config.services.education.exams.find(ex => ex.code.toUpperCase() == exam.toUpperCase());
  const profit = margin * quantity;
  return getPackageProfitOutput(req, profit)
}

const getPackageProfit = (req, targetPackage) => {
  return targetPackage.price
}

const getFundingProfit = (req, amount, providerFee = 0) => {
//  amount = amount - providerFee;
  const {config} = req;
  const {fixed, percent, startAmount} = config.fundingDetails.fee;
  const profit = amount >= startAmount ? fixed + ((percent / 100) * amount) : 0
  return profit
}

const getFundingAmount = (req, amount, providerFee) => {
  amount = amount - providerFee;
  const { config } = req;
  const { fixed, percent, startAmount = 500 } = config.fundingDetails.fee;
  const fundingAmount = amount - (amount >= startAmount ? fixed + ((percent / 100) * amount) : providerFee)
  return fundingAmount
}


// for testing mode
// Mock API function for testing
const createMockResponse = (endpointPath, req) => {
  const body = req.body || {};
  // Get the current date for timestamps
  const now = new Date();
  const timestamp = now.getTime();
  const reference = `MOCK_REF_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate random outer status
  const outerStatuses = ['success', 'error', 'failed'];
  const outerStatus = outerStatuses[Math.floor(Math.random() * outerStatuses.length)];
  
  // Generate random inner data status (only for transaction endpoints)
  const innerStatuses = ['success', 'failed', 'processing'];
  const innerStatus = outerStatus == "success" ? ["processing", "success"][Math.floor(Math.random() * 1)] : innerStatuses[Math.floor(Math.random() * innerStatuses.length)];
  
  // Helper to generate appropriate response based on outerStatus
  const generateResponse = (data) => {
    if (outerStatus === 'success') {
      return {
        status: 'success',
        message: data.message || 'Operation completed successfully',
        data: data.payload
      };
    } else if (outerStatus === 'error') {
      return {
        status: 'error',
        message: data.errorMessage || 'An error occurred while processing your request',
        data: data.payload || null
      };
    } else { // failed
      return {
        status: 'failed',
        message: data.errorMessage || 'Transaction failed',
        data: data.payload || null
      };
    }
  };
  
  switch(endpointPath) {
    case 'balance':
      return generateResponse({
        message: 'Wallet balance fetched successfully',
        payload: {
          funds: Math.floor(Math.random() * 100000) + 1000
        }
      });
      
    case 'services':
      const servicesData = {
        airtime: [
          { network: 'MTN', serviceID: '1', discount: '2.5' },
          { network: 'AIRTEL', serviceID: '2', discount: '2.5' },
          { network: 'GLO', serviceID: '3', discount: '2.5' },
          { network: '9MOBILE', serviceID: '4', discount: '2.5' }
        ],
        dataPlans: [
          { serviceID: '35', network: 'GLO', dataPlan: '500MB', amount: '205.00', dataType: 'CORPORATE GIFTING', validity: '30 Days' },
          { serviceID: '68', network: '9MOBILE', dataPlan: '500MB', amount: '143.00', dataType: 'CORPORATE GIFTING', validity: '30 Days' },
          { serviceID: '25', network: 'MTN', dataPlan: '1GB', amount: '350.00', dataType: 'SME', validity: '30 Days' },
          { serviceID: '42', network: 'AIRTEL', dataPlan: '2GB', amount: '600.00', dataType: 'SME', validity: '30 Days' }
        ],
        cablePlans: [
          { serviceID: '101', cablePlan: 'STARTIMES BASIC', cable: 'STARTIMES', amount: '4,000.00', discount: '0.001' },
          { serviceID: '95', cablePlan: 'GOTV MAX', cable: 'GOTV', amount: '8,500.00', discount: '1' }
        ],
        electricity: [
          { disco: 'IKEJA ELECTRICITY (IKEDC)', serviceID: '1', discount: '0.5' }
        ],
        education: [
          { serviceID: '1', type: 'WAEC', amount: '3,370.00' }
        ]
      };
      
      return generateResponse({
        message: 'Services fetched successfully',
        payload: servicesData
      });
      
    case 'airtime':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      return generateResponse({
        message: `You have successfully sent ₦${body.amount} airtime to ${body.mobileNumber}`,
        payload: {
          type: 'airtime',
          reference: reference,
          amount: body.amount,
          amountCharged: Math.floor(body.amount * 0.98), // 2% discount
          phoneNumber: body.mobileNumber,
          network: body.serviceID === '1' ? 'MTN' : 
                  body.serviceID === '2' ? 'AIRTEL' : 
                  body.serviceID === '3' ? 'GLO' : '9MOBILE',
          status: innerStatus
        }
      });
      
    case 'data':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      const dataPlans = [
        { plan: '500MB', amount: 500, network: 'MTN' },
        { plan: '1GB', amount: 1000, network: 'MTN' },
        { plan: '2GB', amount: 2000, network: 'AIRTEL' },
        { plan: '3GB', amount: 3000, network: 'GLO' }
      ];
      const randomPlan = dataPlans[Math.floor(Math.random() * dataPlans.length)];
      
      return generateResponse({
        message: `Dear Customer, You have successfully gifted ${body.mobileNumber} with ${randomPlan.plan} of Data. Thank you.`,
        payload: {
          type: 'data',
          reference: reference,
          amount: randomPlan.amount,
          dataPlan: randomPlan.plan,
          dataType: body.serviceID < 50 ? 'SME' : 'CORPORATE GIFTING',
          network: randomPlan.network,
          status: innerStatus
        }
      });
      
    case 'validatecable':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      return generateResponse({
        message: 'Validation successful',
        payload: {
          customerName: 'JOHN DOE',
          currentBouquet: 'UNKNOWN'
        }
      });
      
    case 'subcable':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      return generateResponse({
        message: 'Cable subscription successful',
        payload: {
          type: 'cable',
          reference: reference,
          customerName: 'JOHN DOE',
          iucNumber: body.iucNum,
          plan: body.serviceID === '101' ? 'STARTIMES BASIC' : 'GOTV MAX',
          status: innerStatus
        }
      });
      
    case 'validatemeter':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      return generateResponse({
        message: 'Validation successful',
        payload: {
          customerName: 'John Paul',
          meterNumber: body.meterNum,
          meterType: body.meterType === 1 ? 'Prepaid' : 'Postpaid',
          disco: 'IKEDC'
        }
      });
      
    case 'electricity':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      const token = `MOCK_TOKEN_${Math.random().toString(36).substr(2, 10).toUpperCase()}`;
      
      return generateResponse({
        message: 'Electricity payment successful',
        payload: {
          type: 'electricity',
          reference: reference,
          token: innerStatus === 'success' ? token : null,
          meterNumber: body.meterNum,
          amount: body.amount,
          disco: 'IKEDC',
          units: Math.floor(body.amount / 50), // Mock units calculation
          status: innerStatus
        }
      });
      
    case 'education':
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      const pins = [];
      for (let i = 0; i < body.quantity; i++) {
        pins.push({
          pin: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
          serialNo: `SRN${Math.random().toString(36).substr(2, 10).toUpperCase()}`
        });
      }
      
      return generateResponse({
        message: 'WAEC pin purchase successful',
        payload: {
          type: 'education',
          educationType: 'waec',
          amount: 3370 * body.quantity,
          pins: innerStatus === 'success' ? pins : [],
          quantity: body.quantity,
          status: innerStatus
        }
      });
      
    case 'transaction': // Bank verification
      if (!body) {
        return generateResponse({
          errorMessage: 'Invalid request body',
          payload: null
        });
      }
      
      return generateResponse({
        message: 'Account verification successful',
        payload: {
          status: 'success',
          account_name: 'EMMANUEL OLA MUSA',
          account_number: body.acctNum,
          first_name: 'EMMANUEL',
          last_name: 'MUSA',
          other_name: 'OLA',
          Bank_name: 'PALMPAY',
          bank_code: body.bankCode
        }
      });
      
    default:
      return generateResponse({
        errorMessage: `Endpoint ${endpointPath} not found`,
        payload: null
      });
  }
};


const createLog = async (event, payload = {}, error = null, headers = {}) => {
    try {
        const log = await Log.create({
            event,
            headers,
            payload,
            error: error?.message || error,
            receivedAt: new Date()
        });
        return log;
    } catch (logError) {
        console.error('Failed to create log:', logError);
        return null;
    }
};

const logError = async (event, error, context = {}) => {
    try {
        await createLog(`${event}_ERROR`, context, error);
        console.error(`[${event} ERROR]:`, error, context);
    } catch (logError) {
        console.error('Failed to log error:', logError, { originalError: error, context });
    }
};


export {
  createPackageTransaction,
  createDataTransaction,
  createAirtimeTransaction,
  createElectricityTransaction,
  createCableTransaction,
  createEducationTransaction,
  createFundingTransaction,
  createRefundTransaction,
  createChargeTransaction,
  updateTransactionStatus,
  updateTransactionBalance,
  calculateVendingServices,
  validatePhone,
  checkTransactionPin,
  createResponse,
  calculateAirtimeCost,
  updateStat,
  generateMessage,
  deductUserBalance,
  processPayment,
  getTodayTransactionStats,
  getDataUnit,
  getTodayAdminDashboard,
  findNetworkById,
  findProviderByCode,
  findExamByCode,
  getNextId,
  getDataProfit,
  getCableProfit,
  getAirtimeProfit,
  getElectricityProfit,
  getEducationProfit,
  getFundingProfit,
  getPackageProfit,
  getFundingAmount,
  createMockResponse,
  logError,
  createLog,
  convertToGb
}