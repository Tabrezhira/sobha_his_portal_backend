import mongoose from 'mongoose';

// Create the standalone connection instance first
export const legacyDb = mongoose.createConnection();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const legacyUri = process.env.LEGACY_MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  try {
    // Connect the primary database
    await mongoose.connect(uri);
    console.log('MongoDB connected to main database');

    // Connect the legacy database if the URI was provided
    if (legacyUri) {
      await legacyDb.openUri(legacyUri);
      console.log('MongoDB connected to legacy database');
    }

  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

if (legacyDb) {
  legacyDb.on('error', (err) => {
    console.error('Legacy MongoDB connection error:', err.message);
  });
}

export default mongoose;
