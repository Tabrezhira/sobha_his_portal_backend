// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// dotenv.config();

// const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/sobhamedical';

// async function test() {
//   await mongoose.connect(uri);
//   const ClinicVisit = mongoose.model('ClinicVisit', new mongoose.Schema({}, { strict: false }));
  
//   try {
//     // Try chaining
//     console.log("Testing chaining...");
//     const res1 = await ClinicVisit.aggregate([{ $limit: 1 }]).allowDiskUse(true);
//     console.log("res1 success", typeof res1);
//   } catch (e) {
//     console.error("Test 1 failed:", e.message);
//   }

//   try {
//     // Try options param
//     console.log("Testing options array...");
//     const res2 = await ClinicVisit.aggregate([{ $limit: 1 }]).option({ allowDiskUse: true });
//     console.log("res2 success", typeof res2);
//   } catch (e) {
//     console.error("Test 2 failed:", e.message);
//   }

//   try {
//     // Try options param inside the call
//     console.log("Testing options arg...");
//     const res3 = await ClinicVisit.aggregate([{ $limit: 1 }], { allowDiskUse: true });
//     console.log("res3 success", typeof res3);
//   } catch (e) {
//     console.error("Test 3 failed:", e.message);
//   }

//   process.exit();
// }

// test();
