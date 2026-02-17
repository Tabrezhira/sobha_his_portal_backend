import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  empId: { type: String, unique: true },
  email: { type: String, unique: true , lowercase: true, trim: true},
  password: String,

  role: {
    type: String,
    enum: ['staff', 'manager', 'superadmin'],
    default: 'staff',
  },

  locationId: {
    type: String,
    required: true,
  },
  managerLocation: {
  type: [String],
}
}, { timestamps: true });

export default mongoose.model('User', UserSchema);