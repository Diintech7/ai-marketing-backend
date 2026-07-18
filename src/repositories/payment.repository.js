import BaseRepository from "./base.repository.js";
import Payment from "../models/Payment.js";

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  findByUser(userId, options = {}) {
    return this.find({ user: userId }, options);
  }

  findByOrderId(orderId) {
    return this.findOne({ razorpayOrderId: orderId });
  }
}

export default new PaymentRepository();
