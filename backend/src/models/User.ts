import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 24,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast presence lookups
UserSchema.index({ username: 1 });
UserSchema.index({ isOnline: 1 });

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
