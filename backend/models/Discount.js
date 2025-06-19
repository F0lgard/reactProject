const discountSchema = new mongoose.Schema({
  zone: { type: String, enum: ["Pro", "VIP", "PS"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  isActive: { type: Boolean, default: true },
});
const Discount = mongoose.model("Discount", discountSchema);
