import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const extensionUserSchema = new mongoose.Schema(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true, 
      trim: true 
    },
    password: { 
      type: String, 
      required: true, 
      select: false 
    },
    employeeName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    role: { 
      type: String, 
      enum: ["operator", "manager"], 
      default: "operator" 
    },
    lastUsedAt: { 
      type: Date, 
      default: null 
    },
    totalLeadsScraped: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

// Hash password before saving
extensionUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
extensionUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const ExtensionUser = mongoose.model("ExtensionUser", extensionUserSchema);
export default ExtensionUser;
