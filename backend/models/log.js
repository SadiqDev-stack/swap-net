import mongoose from "mongoose";

const Log = new mongoose.Schema({
  event: {
    type: String,
    index: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  },
  receivedAt: {
    type: Date,
    default: Date.now()
  }
}, {strict: false});

export default mongoose.model("vtu_log", Log);