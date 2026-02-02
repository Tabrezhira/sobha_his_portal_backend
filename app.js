import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { connectDB } from './config/db.js';

dotenv.config();
const app = express();

const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Sobha Medical API Backend',
    version: '1.0.0',
    status: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mount module routers
import clinicRoutes from './modules/clinic/clinic.routes.js';
import isolationRoutes from './modules/isolation/isolation.routes.js';
import hospitalRoutes from './modules/hospital/hospital.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

app.use('/api/clinic', clinicRoutes);
app.use('/api/isolation', isolationRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// Connect to DB if env provided (no-throw in serverless environments)
if (process.env.MONGODB_URI) {
  connectDB().catch(err => console.error('DB connect failed', err));
}

export default app;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}
