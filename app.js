import './instrument.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { connectDB } from './config/db.js';
import './config/env.js';
import * as Sentry from "@sentry/node";

const app = express();

const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
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
import resolutionRoutes from './modules/handI/resolution/resolution.routes.js';
import ipAdmissionRoutes from './modules/handI/ipAdmission/ipAdmission.routes.js';
import memberFeedbackRoutes from './modules/handI/memberFeedback/memberFeedback.routes.js';
import notAnsCallRoutes from './modules/handI/notAnsCall/notAnsCall.routes.js';
import grievanceRoutes from './modules/handI/grievance/grievance.routes.js';
import happinessSurveyRoutes from './modules/handI/happinessSurvey/happinessSurvey.routes.js';
import patientRoutes from './modules/patient/patient.routes.js';
import professionRoutes from './modules/profession/profession.routes.js';
import empDojRoutes from './modules/employeeDOJ/empDoj.routes.js';
import isdRoutes from './modules/isd/isd.routes.js';
import rctRoutes from './modules/rct/rct.routes.js';
import mailRoutes from './modules/mail/mail.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';

app.use('/api/clinic', clinicRoutes);
app.use('/api/isolation', isolationRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resolution', resolutionRoutes);
app.use('/api/ip-admission', ipAdmissionRoutes);
app.use('/api/member-feedback', memberFeedbackRoutes);
app.use('/api/not-ans-call', notAnsCallRoutes);
app.use('/api/grievance', grievanceRoutes);
app.use('/api/happiness-survey', happinessSurveyRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/professions', professionRoutes);
app.use('/api/emp-doj', empDojRoutes);
app.use('/api/isd', isdRoutes);
app.use('/api/rct', rctRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/upload', uploadRoutes);

app.get("/debug-sentry", function mainHandler(req, res) {
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);
  throw new Error("My first Sentry error!");
});

app.get("/test-log", function mainHandler(req, res) {
  Sentry.logger.info('User triggered test log', { action: 'test_log' });
  res.status(200).send("Test log sent!");
});

app.get("/test-metrics", function mainHandler(req, res) {
  Sentry.metrics.count('button_click', 1);
  Sentry.metrics.gauge('page_load_time', 150);
  Sentry.metrics.distribution('response_time', 200);
  res.status(200).send("Test metrics emitted!");
});

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

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
