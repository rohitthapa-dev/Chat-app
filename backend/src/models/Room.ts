// backend/src/models/Room.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IRoom extends Document {
  type: "direct" | "group";
  name?: string;
  members: string[];
  admins: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, trim: true },
    members: { type: [String], required: true, index: true },
    admins: { type: [String], default: [] },
  },
  { timestamps: true },
);

RoomSchema.pre("validate", function (this: IRoom) {
  if (
    this.type === "group" &&
    this.members.length > 0 &&
    this.admins.length === 0
  ) {
    const firstMember = this.members[0];
    if (firstMember) {
      this.admins = [firstMember];
    }
  }
});

const Room = mongoose.model<IRoom>("Room", RoomSchema);
export default Room;

export async function findOrCreateDirectRoom(
  userA: string,
  userB: string,
): Promise<IRoom> {
  const members = [userA, userB].sort();

  // 1. Try to find the existing room
  let room = await Room.findOne({
    type: "direct",
    members: { $all: members, $size: 2 },
  });

  // 2. If it doesn't exist, create it
  if (!room) {
    room = await Room.create({
      type: "direct",
      members: members,
    });
  }

  return room;
}
