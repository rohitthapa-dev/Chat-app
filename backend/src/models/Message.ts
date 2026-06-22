import mongoose, { Document, Schema } from "mongoose";

export interface IMessage extends Document {
  senderId: string;
  recipientId: string;
  channelId: string; // deterministic: [senderId, recipientId].sort().join('_')
  content: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    senderId: {
      type: String,
      required: true,
      trim: true,
    },
    recipientId: {
      type: String,
      required: true,
      trim: true,
    },
    channelId: {
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
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for fast DM history retrieval — matches query pattern
MessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
// Channel index for room-based queries
MessageSchema.index({ channelId: 1, createdAt: 1 });

/**
 * Utility: derive the deterministic channel ID from two usernames.
 * Called identically on both frontend and backend — never diverges.
 */
export const getDMChannelId = (userA: string, userB: string): string =>
  [userA.toLowerCase(), userB.toLowerCase()].sort().join("_");

const Message = mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
