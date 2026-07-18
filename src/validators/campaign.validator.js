import { body } from "express-validator";
import { validate } from "./auth.validator.js";

export const createCampaignValidator = [
  body("name").trim().notEmpty().withMessage("Campaign name is required"),
  body("objective").notEmpty().withMessage("Objective is required"),
  body("budget").isNumeric().withMessage("Budget must be a number"),
  body("startDate")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("Start date must be a valid ISO8601 date")
    .custom((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(value);
      if (inputDate < today) {
        throw new Error("Start date cannot be in the past");
      }
      return true;
    }),
  body("endDate")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("End date must be a valid ISO8601 date")
    .custom((value, { req }) => {
      if (req.body.startDate) {
        const start = new Date(req.body.startDate);
        const end = new Date(value);
        if (end < start) {
          throw new Error("End date cannot be before start date");
        }
      }
      return true;
    }),
  validate,
];

export const updateBudgetValidator = [
  body("budget").isNumeric().withMessage("Budget must be a number"),
  validate,
];
