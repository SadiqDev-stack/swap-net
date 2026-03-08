import axios from "axios";
import crypto from "crypto";
import User from "../models/user.js";
import {
  createLog
} from "../utilities/vtu.js";
import {
  random
} from "../utilities/general.js"

const {PAYMENT_HASH_KEY, PAYMENT_BANK_NAME = "9PSB", PAYMENT_ENDPOINT, PAYMENT_KEY, PAYMENT_TEST_KEY, PAYMENT_HASH_KEY2, PAYMENT_KEY2} = process.env;

const getHeader = (req) => {
  const apiKey = req.config ? req.config.apiKeys.payment : PAYMENT_KEY;
  
  return {
    headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
    }
  }
}

const getHeader2 = (req) => {
  const apiKey = req.config?.apiKeys?.paymentkey2 || PAYMENT_KEY2;
  
  return {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  }
}

const createPaymentlink = async (req, {
  amount = 10000,
  tx_ref = `checkout_${Date.now()}`,
  currency = "NGN",
  redirect_url = "https://sadiqsharpsub.vercel.app",
  customer = {
    email: "sadiqmuh1321@gmail.com",
    phone_number: "08145742404",
    name: "sadiq Abubakar"
  },
  customization = {
    title: "sadiq sharp sub funding payment",
    logo: "https://sadiqsharpsub.vercel.app/images/logo.png"
  },
  meta = {
    // extra data 
    paymentType: "funding wallet",
    userId: "0182920282910"
  }
}) => {
  
  const response = await axios.post(`${PAYMENT_ENDPOINT}/payments`, {
    amount,
    currency,
    meta,
    customization,
    customer,
    tx_ref,
    redirect_url
  }, getHeader(req));
  
  const {status, data} = response.data;
  
  return {success: status == "success", link: data.link, reference: tx_ref}
}


//for flutterwave we remove because isnt cheap at all
const createVirtualAccountWithFlutterWave = async (req, {
  email = "sadiqmuh1321@gmail.com",
  name = "sadiq abubakar",
  bvn = "",
  nin = "",
  currency = "NGN",
  narration  = "sadiq sharp sub wallet",
  meta = {}
}) => {
  try {
    const response = await axios.post(
      `${PAYMENT_ENDPOINT}/virtual-account-numbers`,
      {
        email,
        name,
        bvn,
        nin,
        currency,
        is_permanent: true,
        narration,
        meta
      },
      getHeader(req)
    );
    
    

    const data = response.data.data;

    return {
      success: true,
      accountNumber: data.account_number,
      accountName: narration || data.account_name || `${name} - Wallet`,
      bankName: data.bank_name,
      reference: data.order_ref,
      flwRef: data.flw_ref,
      meta: data.meta
    };
  } catch (e) {
    console.log(e)
    return { success: false };
  }
};


const PAYMENT_ENDPOINT2 = "https://api.billstack.co/v2/thirdparty"
const ALLBANKS = ["9PSB", "PALMPAY", /*"BANKLY", "SAVEHAVEN"*/]

const getBank = (user, req) => {
  const userBanks = user.wallets.map(wallet => wallet.bankName);
  if(!userBanks){
    return req.config.paymentBankName || PAYMENT_BANK_NAME 
  }
 
  let newBankName;
  let counter = 0;
  
  while(!newBankName || userBanks.includes(newBankName)){
    counter++
    newBankName = ALLBANKS[random(0, ALLBANKS.length)]
    if(counter >= 10) break
  }
  
  return newBankName
}

const createVirtualAccountWithBillStack = async (req, {
  email = "sadiqmuh1321@gmail.com",
  name = "sadiq abubakar",
  bvn = "",
  nin = "",
  phone = "",
  currency = "NGN",
  user = {},
  narration  = "sadiq sharp sub wallet",
  meta = {}
}) => {
  try {
    
    const [firstName] = name.split(" ");
    const lastName = name.slice(name.indexOf(" "), name.length);
    
 const requestData = {
  email,
  reference: `sadiq_sub${Date.now()}`,
  firstName,
  lastName,
  phone,
  bank: getBank(user, req)
}


    
    const response = await axios.post(
      `${PAYMENT_ENDPOINT2}/generateVirtualAccount/`,
       requestData,
       getHeader2(req)
      )
    
    

    const data = response.data.data;
    const accountDetails = data?.account[0];
    console.log(response.data)

    return {
      success: response?.data.status || false,
      accountNumber: accountDetails?.account_number,
      accountName: accountDetails?.account_name || `${name} - Wallet`,
      bankName: accountDetails?.bank_name,
      reference: data?.reference,
      flwRef: data?.reference,
      meta: data?.meta
    };
    
    if(response?.data.status){
      // verify in background 
     const kycResponse = await axios.post(`${PAYMENT_ENDPOINT2}/upgradeVirtualAccount`, {
        customer: email,
        bvn: bvn || nin 
      }, getHeader2(req));
     
     console.log(kycResponse.data)
     
     await createLog(
       `VIRTUAL_ACCOUNT_KYC_${kycResponse.data.status ? "APPROVED" : "FAILED"}`,
       req.body,
       req.headers
     )
    }
    
  } catch (e) {
    console.log(e)
    return { success: false };
  }
};


const confirmTransaction = async (req, transactionRef) => {
  try {
    let res = await axios.get(
      `${PAYMENT_ENDPOINT}/transactions/${transactionRef}/verify`,
      getHeader(req)
    );
    
    console.log(res);
    
    const { status, data, message} = res.data;
    return { success: status == "success" || data, data, message }
  } catch (er) {
    console.log(er)
    return { success: false, message: "error getting transaction" };
  }
};

const getPaymentGatewayBalance = async (req) => {
  try{
  const res = await axios.get(`${PAYMENT_ENDPOINT}/balances`, getHeader(req));
  const data = res.data;
  return {success: data.status == "success", data: data?.data || []}
  }catch(er){
    console.log(er)
    return {success: false, message: "something went wrong getting payment provider balance"}
  }
}

const convertCurrency = async (from, to, amnount) => {
  // add api
  return Math.random(500)
}


export {
  createVirtualAccountWithFlutterWave,
  createVirtualAccountWithBillStack,
  createPaymentlink,
  confirmTransaction,
  getPaymentGatewayBalance,
  convertCurrency
};