import { verifyAccessToken } from "../helpers/jwt.js";
import ExtensionUser from "../models/ExtensionUser.js";
import AppError from "../utils/AppError.js";

export const protectExtension = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    if (!token) {
      return next(new AppError("Access denied. No extension token provided.", 401));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new AppError("Token expired or invalid. Please login again.", 401));
    }

    const operator = await ExtensionUser.findById(decoded.id);

    if (!operator) {
      return next(new AppError("Operator not found or unauthorized.", 401));
    }

    if (!operator.isActive) {
      return next(new AppError("Account has been deactivated.", 403));
    }

    req.extensionUser = operator;
    next();
  } catch (err) {
    next(err);
  }
};
