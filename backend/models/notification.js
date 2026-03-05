import { Schema, model , ObjectId} from "mongoose";

const Notification = new Schema({
  title: {
    type: String,
    required: true,
    maxLength: 200
  },
  for: {
    type: String,
    enum: ["single", "all"],
    default: "single"
  },
  collectionKey: {
    type: String
  },
  description: {
    type: String, 
    required: true
  },
  createdAt: {
    type: Date,
    default: () => Date.now()
  },
  data: {
    type: Object,
  },
  flag: {
    type: String,
    enum: ['normal', 'info', 'warning', 'urgent'],
    default: "normal"
  },
  from: {
    type: String,
    enum: ['system', 'api', 'provider'],
    default: 'system'
  },
  userId: {
    type: ObjectId,
    ref: "Arcane_user",
    required: true
  },
  seen: {
    type: Boolean,
    default: false
  }
})

export default model("vtu_notification", Notification)