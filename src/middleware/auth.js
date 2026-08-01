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

    const impersonateId = req.headers["x-impersonate-user"];
    if (impersonateId && (user.role === "super_admin" || user.role === "admin")) {
      const targetUser = await User.findById(impersonateId)
        .select("-password +metaAccessToken +googleAdsRefreshToken +googleAdsDeveloperToken");
        
      if (!targetUser || targetUser.role === "super_admin") {
        return next(new AppError("Invalid impersonation target", 400));
      }

      if (targetUser.role === "admin" && user.role !== "super_admin") {
        return next(new AppError("Only Super Admins can impersonate Admins", 403));
      }

      // If just a regular admin, they can only impersonate their assigned clients
      if (user.role === "admin" && targetUser.assignedAdmin?.toString() !== user._id.toString()) {
        return next(new AppError("You do not have permission to impersonate this client", 403));
      }

      // Proceed with impersonation
      req.adminUser = user; // Store the original admin context just in case
      req.user = targetUser; // Act as the client
    }

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
