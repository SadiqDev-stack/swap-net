import express from "express";
import axios from "axios";
import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import authorize from '../middlewares/authorization.js';
import { convertCurrency } from '../services/payment.js';
import {
    getTransactionDescription
} from '../utilities/wallet.js'


const { CONVERSION_KEY } = process.env;


const app = express();
app.use(authorize);

const minSwap = {
    'NGN': 1500,
    'USD': 1,
    'OTHER': 0
}

// use to swap user currencies;
app.use(authorize)
app.post('/swap', async (req, res, next) => {
    try{
        const {user} = req;
        let { from, to} = req.query;
        from = from.toUpperCase();
        to = to.toUpperCase();

        const {amount} = req.body;
        let userBalance;

        if(!from && !to) throw new req.AppError('enter valid from and to');
        if(from == to) throw new req.AppError('you cannot convert same currencies')
        const isOtherCurrency = !(from == 'NGN' || from == 'USD');
        const isTargetCurrencyOtherCurrency = !(to == 'NGN' || to == 'USD');

        console.log(user)
        // check minimum amount for the currency
        userBalance = isOtherCurrency ? user.balance.OTHER[from] : user.balance[from];
        const minSwapForCurrency = minSwap[isOtherCurrency ? 'OTHER' : from];
        if(amount < minSwapForCurrency) throw new req.AppError(`the minimum swap amount for this currency is ${minSwapForCurrency} ${from}`)
        // check if the user balance is enough 
        if(amount > userBalance) throw new req.AppError(`your account balance is too low ${userBalance} ${from}`)
        // find the exchange rate
        const convertedAmount = await convertCurrency(from, to, amount);
    
        if(typeof convertedAmount !== "number" || convertedAmount < 0) 
            throw new req.AppError('something went wrong retriving currency rate');

        const fromBalanceKey = `balance.${isOtherCurrency ? `other.${from}` : from}`;
        const toBalanceKey = `balance.${isTargetCurrencyOtherCurrency ? `other.${to}` : to}`;

   const finalUser = await User.findByIdAndUpdate(
     user._id,
     {
    $inc: {
      [fromBalanceKey]: -convertedAmount,
      [toBalanceKey]: convertedAmount
    }
  },
  { new: true }
  );

  // balance of the two currencies before tbe conversion
  const oldFromBalance = user[fromBalanceKey];
  const oldToBalance = user[toBalanceKey];

  // balance of the two currencies after the conversion
  const newFromBalance = finalUser[fromBalanceKey];
  const newToBalance = finalUser[toBalanceKey];


  const swappingTransaction = await Transaction.create({
    type: 'swapping',
    amount: convertedAmount,
    success: true,
    userId: user._id,
    meta: {
        userId: user._id,
        from: {
            currency: from,
            balanceBefore: oldFromBalance,
            balanceAfter: newFromBalance
        },
        to: {
            currency: to,
            balanceBefore: oldToBalance,
            balanceAfter: newToBalance
        },
        currencyEquivalence: convertedAmount
  },
  desciption: getTransactionDescription('swap', {
    from,
    to,
    amount,
    convertedAmount
  })
})

    return res.json({
        sucess: true,
        data: {
            transaction: swappingTransaction,
            user: finalUser,
            message: swappingTransaction.desciption
        }
    })

    }catch(er){
        req.err = er;
        next()
    }
});

export default app