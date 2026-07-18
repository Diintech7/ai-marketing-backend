import crypto from "crypto";
import AuthRepository from "../repositories/auth.repository.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../helpers/jwt.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../helpers/email.js";
import AppError from "../utils/AppError.js";
import { COOKIE_OPTIONS } from "../constants/index.js";

const AuthService = {
  register: async ({ name, email, password }) => {
    const existing = await AuthRepository.findByEmail(email);
    if (existing) throw new AppError("Email already registered", 409);

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const user = await AuthRepository.create({
      name,
      email,
      password,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000,
    });

    await sendVerificationEmail(email, verifyToken);
    return { id: user._id, name: user.name, email: user.email };
  },

  login: async ({ email, password }, res) => {
    const user = await AuthRepository.findByEmail(email);
    if (!user || !(await user.comparePassword(password)))
      throw new AppError("Invalid email or password", 401);

    if (!user.isEmailVerified) throw new AppError("Please verify your email first", 401);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

    return {
      accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan, credits: user.credits },
    };
  },

  logout: (res) => {
    res.clearCookie("refreshToken");
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
};

export default AuthService;
