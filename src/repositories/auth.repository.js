import User from "../models/User.js";

const AuthRepository = {
  findByEmail: (email) => User.findOne({ email }).select("+password"),
  findById: (id) => User.findById(id),
  findByToken: (field, token) => User.findOne({ [field]: token }),
  findByIdWithPassword: (id) => User.findById(id).select("+password"),
  create: (data) => User.create(data),
  update: (id, data) => User.findByIdAndUpdate(id, data, { new: true }),
};

export default AuthRepository;
