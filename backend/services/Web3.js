const bip39 = require("bip39");
const bip32 = require("bip32");
const TronWeb = require("tronweb");
const {Phase_Phrase} = proccess.env;
import User from './models/user.js'

const mnemonic = Phase_Phrase;

const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = bip32.fromSeed(seed);

function generateAddress(index) {
  const path = `m/44'/195'/0'/0/${index}`;
  const child = root.derivePath(path);

  const privateKey = child.privateKey.toString("hex");
  const address = TronWeb.address.fromPrivateKey(privateKey);

  return {
    index,
    address,
    privateKey
  };
}

for (let i = 0; i < 5; i++) {
  console.log(generateAddress(i));
}

 

async function checkTransfers() {

    
const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io"
});

const CONTRACT = "USDT_CONTRACT_ADDRESS";



  const events = await tronWeb.getEventResult(CONTRACT, {
    eventName: "Transfer",
    size: 200
  });


  //change this 
        const Deposit =()=>{



        }



  events.forEach(e => {

    const from = tronWeb.address.fromHex(e.result.from);
    const to = tronWeb.address.fromHex(e.result.to);
    const amount = e.result.value;

     const user = findUser(to)

     if(user){

        //call transaction deposit function here
     }
  });
}


const findUser  =async (address)=>{

        const user = await User.findOne({
        $inc: {
            walletAddress: address
        }
    }) 
    
}


setInterval(checkTransfers, 10000);