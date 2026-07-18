import AuthService from "../services/auth.service.js";
import { successResponse } from "../utils/apiResponse.js";

export const register = async (req, res, next) => {
  try {
    const data = await AuthService.register(req.body);
    successResponse(res, data, "Registration successful. Please verify your email.", 201);
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const data = await AuthService.login(req.body, res);
    successResponse(res, data, "Login successful");
  } catch (err) { next(err); }
};

export const logout = (req, res, next) => {
  try {
    AuthService.logout(res);
    successResponse(res, {}, "Logged out successfully");
  } catch (err) { next(err); }
};

export const refreshToken = async (req, res, next) => {
  try {
    const data = await AuthService.refreshToken(req.cookies.refreshToken);
    successResponse(res, data, "Token refreshed");
  } catch (err) { next(err); }
};

export const verifyEmail = async (req, res, next) => {
  try {
    await AuthService.verifyEmail(req.query.token);
    successResponse(res, {}, "Email verified successfully");
  } catch (err) { next(err); }
};

export const forgotPassword = async (req, res, next) => {
  try {
    await AuthService.forgotPassword(req.body.email);
    successResponse(res, {}, "Password reset email sent");
  } catch (err) { next(err); }
};

export const resetPassword = async (req, res, next) => {
  try {
    await AuthService.resetPassword(req.query.token, req.body.password);
    successResponse(res, {}, "Password reset successful");
  } catch (err) { next(err); }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await AuthService.getMe(req.user._id);
    successResponse(res, user, "User fetched");
  } catch (err) { next(err); }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await AuthService.updateProfile(req.user._id, req.body);
    successResponse(res, user, "Profile updated");
  } catch (err) { next(err); }
};

export const changePassword = async (req, res, next) => {
  try {
    await AuthService.changePassword(req.user._id, req.body);
    successResponse(res, {}, "Password changed successfully");
  } catch (err) { next(err); }
};
