import crypto from "crypto";
import AuthRepository from "../repositories/auth.repository.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../helpers/jwt.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../helpers/email.js";
import AppError from "../utils/AppError.js";
import { COOKIE_OPTIONS, ROLES } from "../constants/index.js";

const AuthService = {
  register: async ({ name, email, password, phone }) => {
    const existing = await AuthRepository.findByEmail(email);
    if (existing) throw new AppError("Email already registered", 409);

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const user = await AuthRepository.create({
      name,
      email,
      password,
      phone,
      // emailVerifyToken: verifyToken,
      // emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000,
      isEmailVerified: true, // Auto verify for now as per user request
    });

    // await sendVerificationEmail(email, verifyToken);
    return { id: user._id, name: user.name, email: user.email };
  },

  login: async ({ email, password, portal }, res) => {
    const user = await AuthRepository.findByEmail(email);
    if (!user || !(await user.comparePassword(password)))
      throw new AppError("Invalid email or password", 401);

    if (portal) {
      if (portal === 'superadmin' && user.role !== ROLES.SUPERADMIN) {
         throw new AppError("Access denied. Please use the client portal.", 403);
      }
      if (portal === 'admin' && user.role !== ROLES.ADMIN) {
         throw new AppError("Access denied. Please use the client portal.", 403);
      }
      if (portal === 'client' && (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN)) {
         throw new AppError("Admins must login through the admin portal.", 403);
      }
    }

    if (!user.isEmailVerified) throw new AppError("Please verify your email first", 401);
    
    if (user.role === "client" && user.approvalStatus === "pending") {
      throw new AppError("Your account is pending admin approval.", 403);
    }
    if (user.role === "client" && user.approvalStatus === "rejected") {
      throw new AppError("Your account registration was rejected.", 403);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const cookieName = portal ? `${portal}_refreshToken` : "client_refreshToken";
    res.cookie(cookieName, refreshToken, COOKIE_OPTIONS);

    return {
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan, credits: user.credits, accessibleFeatures: user.accessibleFeatures, walletBalance: user.walletBalance, adMode: user.adMode, apiKeys: user.apiKeys },
    };
  },

  googleLogin: async ({ token, portal }, res) => {
    // Verify token with Google
    const axios = (await import("axios")).default;
    let userInfo;
    try {
      const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      userInfo = data;
    } catch (err) {
      throw new AppError("Invalid Google token", 401);
    }

    let user = await AuthRepository.findByEmail(userInfo.email);
    if (!user) {
      // Auto register for Google users
      user = await AuthRepository.create({
        name: userInfo.name,
        email: userInfo.email,
        password: crypto.randomBytes(16).toString("hex"), // Dummy password
        isEmailVerified: true,
        authProvider: "google",
        googleId: userInfo.sub,
        avatar: userInfo.picture,
      });
    }

    if (portal) {
      if (portal === 'superadmin' && user.role !== ROLES.SUPERADMIN) throw new AppError("Access denied.", 403);
      if (portal === 'admin' && user.role !== ROLES.ADMIN) throw new AppError("Access denied.", 403);
      if (portal === 'client' && (user.role === ROLES.ADMIN || user.role === ROLES.SUPERADMIN)) throw new AppError("Admins must login through admin portal.", 403);
    }

    if (user.role === "client" && user.approvalStatus === "pending") {
      throw new AppError("Your account is pending admin approval.", 403);
    }
    if (user.role === "client" && user.approvalStatus === "rejected") {
      throw new AppError("Your account registration was rejected.", 403);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const cookieName = portal ? `${portal}_refreshToken` : "client_refreshToken";
    res.cookie(cookieName, refreshToken, COOKIE_OPTIONS);

    return {
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan, credits: user.credits, accessibleFeatures: user.accessibleFeatures, walletBalance: user.walletBalance, adMode: user.adMode, apiKeys: user.apiKeys },
    };
  },

  logout: (res, portal = "client") => {
    res.clearCookie(`${portal}_refreshToken`);
  },

  refreshToken: async (token) => {
    if (!token) throw new AppError("No refresh token", 401);
    const decoded = verifyRefreshToken(token);
    const user = await AuthRepository.findById(decoded.id);
    if (!user) throw new AppError("User not found", 401);
    return { accessToken: generateAccessToken(user._id) };
  },

  verifyEmail: async (token) => {
    const user = await AuthRepository.findByToken("emailVerifyToken", token);
    if (!user || user.emailVerifyExpires < Date.now())
      throw new AppError("Invalid or expired token", 400);

    await AuthRepository.update(user._id, {
      isEmailVerified: true,
      emailVerifyToken: undefined,
      emailVerifyExpires: undefined,
    });
  },

  forgotPassword: async (email) => {
    const user = await AuthRepository.findByEmail(email);
    if (!user) throw new AppError("No user with that email", 404);

    const resetToken = crypto.randomBytes(32).toString("hex");
    await AuthRepository.update(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpires: Date.now() + 60 * 60 * 1000,
    });

    await sendPasswordResetEmail(email, resetToken);
  },

  resetPassword: async (token, password) => {
    const user = await AuthRepository.findByToken("passwordResetToken", token);
    if (!user || user.passwordResetExpires < Date.now())
      throw new AppError("Invalid or expired token", 400);

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  },

  getMe: async (id) => {
    const user = await AuthRepository.findById(id);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  updateProfile: async (id, { name, company, metaAccessToken, metaAdAccountId, googleAdsCustomerId, googleAdsRefreshToken, googleAdsDeveloperToken }) => {
    const allowed = {};
    if (name)                    allowed.name = name;
    if (company !== undefined)   allowed.company = company;
    if (metaAccessToken  !== undefined) allowed.metaAccessToken  = metaAccessToken;
    if (metaAdAccountId  !== undefined) allowed.metaAdAccountId  = metaAdAccountId;
    if (googleAdsCustomerId      !== undefined) allowed.googleAdsCustomerId      = googleAdsCustomerId;
    if (googleAdsRefreshToken    !== undefined) allowed.googleAdsRefreshToken    = googleAdsRefreshToken;
    if (googleAdsDeveloperToken  !== undefined) allowed.googleAdsDeveloperToken  = googleAdsDeveloperToken;
    const user = await AuthRepository.update(id, allowed);
    if (!user) throw new AppError("User not found", 404);
    return user;
  },

  changePassword: async (id, { currentPassword, newPassword }) => {
    const user = await AuthRepository.findByIdWithPassword(id);
    if (!user) throw new AppError("User not found", 404);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw new AppError("Current password is incorrect", 400);
    user.password = newPassword;
    await user.save();
  },

  generateApiKey: async (userId) => {
    const user = await AuthRepository.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const newKey = `diin_${crypto.randomBytes(16).toString("hex")}`;
    user.apiKeys.push(newKey);
    await user.save();
    
    return { apiKey: newKey };
  },
};

export default AuthService;
