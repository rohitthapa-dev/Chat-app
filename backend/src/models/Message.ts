import mongoose, { Document, Schema } from "mongoose";

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  senderId: string;
  content: string;
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    senderId: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    readBy: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

MessageSchema.index({ roomId: 1, createdAt: 1 });

const Message = mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
