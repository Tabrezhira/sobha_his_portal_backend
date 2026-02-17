import User from './user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/jwt.js';

// Register a new user
async function register(req, res, next) {
	try {
		const { name, empId, email, password, role, locationId, managerLocation } = req.body || {};
		if (!empId || !email || !password || !locationId) {
			return res.status(400).json({ success: false, message: 'empId, email, password and locationId required' });
		}

		const exists = await User.findOne({ $or: [{ email }, { empId }] });
		if (exists) return res.status(409).json({ success: false, message: 'User already exists' });

		const hash = await bcrypt.hash(password, 10);
		const user = new User({ name, empId, email, password: hash, role, locationId, managerLocation });
		const saved = await user.save();
		const out = saved.toObject();
		delete out.password;
		// create JWT so client can use it immediately after registering
		const token = jwt.sign({ id: saved._id, role: saved.role }, JWT_SECRET, { expiresIn: '7d' });
		return res.status(201).json({ success: true, data: out, token });
	} catch (err) { next(err); }
}

// Login: returns JWT
async function login(req, res, next) {
  try {
    let { email, empId, password } = req.body || {};

    if ((!email && !empId) || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'credentials required' });
    }

    // 🔥 normalize email if present
    if (email) email = email.toLowerCase().trim();

    const query = email ? { email } : { empId };

    const user = await User.findOne(query);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password || '');
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const out = user.toObject();
    delete out.password;

    return res.json({ success: true, data: out, token });
  } catch (err) {
    next(err);
  }
}


// List users with simple filters and pagination
async function getUsers(req, res, next) {
	try {
		const { page = 1, limit = 20, empId, email, role, locationId, managerLocation } = req.query;
		const q = {};
		if (empId) q.empId = empId;
		if (email) q.email = email;
		if (role) q.role = role;
		if (locationId) q.locationId = locationId;
		if (managerLocation) {
			const list = Array.isArray(managerLocation)
				? managerLocation
				: String(managerLocation).split(',').map((v) => v.trim()).filter(Boolean);
			q.managerLocation = { $in: list };
		}

		const p = Math.max(1, parseInt(page, 10));
		const l = Math.max(1, parseInt(limit, 10));

		const [total, items] = await Promise.all([
			User.countDocuments(q),
			User.find(q).select('-password').skip((p - 1) * l).limit(l).sort({ createdAt: -1 }),
		]);

		return res.json({ success: true, data: items, meta: { total, page: p, limit: l } });
	} catch (err) { next(err); }
}

// Get single user by id
async function getUserById(req, res, next) {
	try {
		const { id } = req.params;
		const user = await User.findById(id).select('-password');
		if (!user) return res.status(404).json({ success: false, message: 'Not found' });
		return res.json({ success: true, data: user });
	} catch (err) { next(err); }
}

// Update user
async function updateUser(req, res, next) {
	try {
		const { id } = req.params;
		const payload = { ...req.body };
		if (payload.password) payload.password = await bcrypt.hash(payload.password, 10);
		const updated = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).select('-password');
		if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
		return res.json({ success: true, data: updated });
	} catch (err) { next(err); }
}

// Delete user
async function deleteUser(req, res, next) {
	try {
		const { id } = req.params;
		const deleted = await User.findByIdAndDelete(id).select('-password');
		if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
		return res.json({ success: true, data: deleted });
	} catch (err) { next(err); }
}

// Refresh token: validate JWT and issue a new one with user data
async function refreshToken(req, res, next) {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ success: false, message: 'Invalid token' });

		const token = jwt.sign(
			{ id: user._id, role: user.role },
			JWT_SECRET,
			{ expiresIn: '1d' }
		);

		const out = user.toObject();
		delete out.password;

		return res.json({ success: true, data: out, token });
	} catch (err) { next(err); }
}

export default { register, login, getUsers, getUserById, updateUser, deleteUser, refreshToken };

