import ExtensionUser from "../models/ExtensionUser.js";
import AppError from "../utils/AppError.js";
import { successResponse } from "../utils/apiResponse.js";
import { generateAccessToken } from "../helpers/jwt.js";

// Operator Login Handler
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const operator = await ExtensionUser.findOne({ email }).select("+password");

    if (!operator) {
      throw new AppError("Invalid credentials", 401);
    }

    if (!operator.isActive) {
      throw new AppError("Account has been deactivated. Please contact your administrator.", 403);
    }

    const isMatch = await operator.comparePassword(password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    // Update last activity timestamp
    operator.lastUsedAt = new Date();
    await operator.save();

    const accessToken = generateAccessToken(operator._id);

    return successResponse(
      res, 
      { 
        accessToken, 
        user: { 
          id: operator._id, 
          email: operator.email, 
          name: operator.employeeName, 
          role: operator.role 
        } 
      }, 
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
};

// Operator Profile Fetch Handler
export const getMe = async (req, res, next) => {
  try {
    if (!req.extensionUser) {
      throw new AppError("Not authenticated", 401);
    }

    return successResponse(
      res,
      {
        user: {
          id: req.extensionUser._id,
          email: req.extensionUser.email,
          name: req.extensionUser.employeeName,
          role: req.extensionUser.role
        }
      },
      "Profile fetched successfully"
    );
  } catch (err) {
    next(err);
  }
};
