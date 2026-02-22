import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.DATABASE_URL || "mongodb://localhost:27017/sobha").then(async () => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("collections:", collections.map(c => c.name));
    
    const hospitals = await db.collection("hospitals").find({}).sort({_id: -1}).limit(1).toArray();
    console.log("data:", JSON.stringify(hospitals[0], null, 2));
    process.exit(0);
});
