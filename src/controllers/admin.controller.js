import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { successResponse } from "../utils/apiResponse.js";
import { ROLES } from "../constants/index.js";

// Fetch all pending clients
export const getPendingClients = async (req, res, next) => {
  try {
    const pendingClients = await User.find({ role: ROLES.CLIENT, approvalStatus: "pending" }).select("-password");
    successResponse(res, pendingClients, "Pending clients fetched successfully");
  } catch (err) {
    next(err);
  }
};

// Approve a client
export const approveClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedAdminId } = req.body;

    const client = await User.findById(id);
    if (!client) throw new AppError("Client not found", 404);
    if (client.role !== ROLES.CLIENT) throw new AppError("Only clients can be approved", 400);

    client.approvalStatus = "approved";

    if (req.user.role === ROLES.ADMIN) {
      // Assign to the admin who approved
      client.assignedAdmin = req.user._id;
    } else if (req.user.role === ROLES.SUPERADMIN) {
      // Superadmin must explicitly assign an admin
      if (!assignedAdminId) {
        throw new AppError("Super Admin must provide an assignedAdminId", 400);
      }
      client.assignedAdmin = assignedAdminId;
    }

    await client.save();
    successResponse(res, client, "Client approved and assigned successfully");
  } catch (err) {
    next(err);
  }
};

// Reject a client
export const rejectClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await User.findById(id);
    if (!client) throw new AppError("Client not found", 404);
    
    client.approvalStatus = "rejected";
    await client.save();
    successResponse(res, client, "Client rejected");
  } catch (err) {
    next(err);
  }
};

// Create an Admin (SuperAdmin only)
export const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email already exists", 409);

    const admin = await User.create({
      name,
      email,
      password,
      role: ROLES.ADMIN,
      approvalStatus: "approved",
      isEmailVerified: true,
    });

    successResponse(res, { id: admin._id, name: admin.name, email: admin.email }, "Admin created successfully", 201);
  } catch (err) {
    next(err);
  }
};

// Get all admins (SuperAdmin only, useful for dropdowns)
export const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: ROLES.ADMIN }).select("name email role createdAt");
    successResponse(res, admins, "Admins fetched successfully");
  } catch (err) {
    next(err);
  }
};

// Get clients assigned to a specific admin (SuperAdmin only)
export const getAdminClients = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clients = await User.find({ role: ROLES.CLIENT, assignedAdmin: id }).select("name email createdAt approvalStatus");
    successResponse(res, clients, "Admin clients fetched successfully");
  } catch (err) {
    next(err);
  }
};

// Get clients assigned to the currently logged in Admin (Admin only)
export const getMyClients = async (req, res, next) => {
  try {
    const clients = await User.find({ role: ROLES.CLIENT, assignedAdmin: req.user._id }).select("name email createdAt approvalStatus");
    successResponse(res, clients, "Your clients fetched successfully");
  } catch (err) {
    next(err);
  }
};
