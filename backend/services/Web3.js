import bip39 from "bip39";
import bip32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import dotenv from "dotenv";
import crypto from "crypto";
import User from "../models/user.js";
import tronwebPkg from "tronweb";

import pkg from "ethereumjs-wallet";
const hdkey = pkg.hdkey;

dotenv.config();

const { PHASE_PHRASE, USDT_CONTRACT_ADDRESS, TRON_API_KEY } = process.env;
const TronWeb = tronwebPkg.TronWeb || tronwebPkg;
const bip32 = bip32Factory(ecc);

const mnemonic = PHASE_PHRASE;
const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = bip32.fromSeed(seed);

//call this method to generate phase phrase
function GetMasterKey() {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  const root = bip32.fromSeed(seed);

  return {
    Mnemonic: mnemonic,
    Seed: seed,
    Root: root,
  };
}
export function generateAddress(index) {
  const account = TronWeb.createAccount();

  return account;
}

function generateWalletFromPassphrase(passphrase) {
  // Hash the passphrase to 32 bytes
  const privateKey = crypto
    .createHash("sha256")
    .update(passphrase)
    .digest("hex");
  const address = TronWeb.address.fromPrivateKey(privateKey);
  return { privateKey, address };
}

export function generateChildWallet(index) {
  const PARENT_MNEMONIC = mnemonic;
  const seed = bip39.mnemonicToSeedSync(PARENT_MNEMONIC);
  const root = hdkey.fromMasterSeed(seed);
  const path = `m/44'/195'/0'/0/${index}`;
  const childNode = root.derivePath(path);

  const privateKey = childNode.getWallet().getPrivateKey().toString("hex");
  const address = TronWeb.address.fromPrivateKey(privateKey);

  return { index, privateKey, address };
}

 
 
// ---------------------------
// TronWeb setup
// ---------------------------
const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  headers: { "TRON-PRO-API-KEY": TRON_API_KEY || "" },
  privateKey: "", // optional for reading events
});
 
async function findUser(address) {
  return await User.findOne({ walletAddress: address });
}

// ---------------------------
// Check USDT transfers
// ---------------------------
async function checkTransfers() {
  try {
    const events = await tronWeb.getEventResult(USDT_CONTRACT_ADDRESS, {
      eventName: "Transfer",
      size: 200,
    });

    for (const e of events) {
      const from = tronWeb.address.fromHex(e.result.from);
      const to = tronWeb.address.fromHex(e.result.to);
      const amount = e.result.value / 1e6; // USDT decimals

      const user = await findUser(to);
      if (user) {
        user.balance = (user.balance || 0) + amount;
        await user.save();
        console.log(`Deposited ${amount} USDT to ${to}`);
      }
    }
  } catch (err) {
    console.error("Error fetching events:", err);
  }
}
