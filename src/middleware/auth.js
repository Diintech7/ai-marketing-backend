import { verifyAccessToken } from "../helpers/jwt.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;

    if (!token) return next(new AppError("Not authorized", 401));

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new AppError("Token expired or invalid", 401));
    }

    const user = await User.findById(decoded.id)
      .select("-password +metaAccessToken +googleAdsRefreshToken +googleAdsDeveloperToken");

    if (!user || !user.isActive) return next(new AppError("User not found", 401));

    req.user = user;
    next();
  } catch (err) {
    next(err); // pass real error — DB errors won't become 401
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return next(new AppError("You do not have permission", 403));
  next();
};
