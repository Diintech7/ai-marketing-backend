import { body, validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  next();
};

export const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[0-9]+$/)
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 10, max: 15 })
    .withMessage("Phone number must be between 10 and 15 digits"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  validate,
];

export const loginValidator = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

export const forgotPasswordValidator = [
  body("email").isEmail().withMessage("Valid email is required"),
  validate,
];

export const resetPasswordValidator = [
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  validate,
];
