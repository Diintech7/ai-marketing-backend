import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { ROLES } from "../constants/index.js";

const router = Router();

// Apply auth middleware to all admin routes
router.use(protect);

// ----------------------------------------------------
// Admin & Super Admin Routes
// ----------------------------------------------------
router.use(restrictTo(ROLES.ADMIN, ROLES.SUPERADMIN));

router.get("/pending-clients", adminController.getPendingClients);
router.post("/approve-client/:id", adminController.approveClient);
router.post("/reject-client/:id", adminController.rejectClient);

// ----------------------------------------------------
// Super Admin Only Routes
// ----------------------------------------------------
router.post("/create-admin", restrictTo(ROLES.SUPERADMIN), adminController.createAdmin);
router.get("/admins", restrictTo(ROLES.SUPERADMIN), adminController.getAdmins);
router.get("/admins/:id/clients", restrictTo(ROLES.SUPERADMIN), adminController.getAdminClients);

// ----------------------------------------------------
// Admin Only Routes
// ----------------------------------------------------
router.get("/my-clients", restrictTo(ROLES.ADMIN, ROLES.SUPERADMIN), adminController.getMyClients);
router.put("/clients/:id/features", restrictTo(ROLES.ADMIN, ROLES.SUPERADMIN), adminController.updateClientFeatures);

export default router;
