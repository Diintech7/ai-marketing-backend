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
    const { assignedAdminId, adMode } = req.body;

    const client = await User.findById(id);
    if (!client) throw new AppError("Client not found", 404);
    if (client.role !== ROLES.CLIENT) throw new AppError("Only clients can be approved", 400);

    client.approvalStatus = "approved";
    if (adMode && ["PERSONAL", "PLATFORM"].includes(adMode)) {
      client.adMode = adMode;
    }

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
    const clients = await User.find({ role: ROLES.CLIENT, assignedAdmin: id }).select("name email role createdAt approvalStatus");
    successResponse(res, clients, "Admin clients fetched successfully");
  } catch (err) {
    next(err);
  }
};

// Get clients assigned to the currently logged in Admin (Admin only)
export const getMyClients = async (req, res, next) => {
  try {
    const clients = await User.find({ role: ROLES.CLIENT, assignedAdmin: req.user._id }).select("name email role createdAt approvalStatus accessibleFeatures adMode walletBalance");
    successResponse(res, clients, "Your clients fetched successfully");
  } catch (err) {
    next(err);
  }
};

// Update accessible features for a client
export const updateClientFeatures = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { features, adMode } = req.body;
    
    // Ensure the client belongs to the admin (if not superadmin)
    const query = { _id: id, role: ROLES.CLIENT };
    if (req.user.role === ROLES.ADMIN) {
      query.assignedAdmin = req.user._id;
    }

    const updatePayload = { accessibleFeatures: features };
    if (adMode && ["PERSONAL", "PLATFORM"].includes(adMode)) {
      updatePayload.adMode = adMode;
    }

    const client = await User.findOneAndUpdate(
      query,
      updatePayload,
      { new: true, runValidators: true }
    ).select("name email accessibleFeatures adMode");

    if (!client) {
      throw new AppError("Client not found or not assigned to you", 404);
    }

    successResponse(res, client, "Client features updated successfully");
  } catch (err) {
    next(err);
  }
};

// Recharge a client's wallet balance
export const rechargeClientWallet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError("Invalid recharge amount. Must be greater than 0.", 400);
    }

    const client = await User.findById(id);
    if (!client) throw new AppError("Client not found", 404);
    if (client.role !== ROLES.CLIENT) {
      throw new AppError("Only client wallets can be recharged", 400);
    }

    // Access control check: logged-in user must be superadmin OR the client's assignedAdmin
    if (req.user.role !== ROLES.SUPERADMIN && client.assignedAdmin?.toString() !== req.user._id.toString()) {
      throw new AppError("You are not authorized to recharge this client's wallet", 403);
    }

    // Add balance to user
    client.walletBalance = (client.walletBalance || 0) + parsedAmount;
    await client.save();

    successResponse(res, { walletBalance: client.walletBalance }, `Successfully added ₹${parsedAmount} to client's wallet`);
  } catch (err) {
    next(err);
  }
};
