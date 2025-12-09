const { MongoClient } = require('mongodb');

// Connection URI
const uri = "mongodb+srv://topcadefx:0TdElmVAYYo3mHN6@cluster0.us9wzbh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a new MongoClient
const client = new MongoClient(uri);

async function showCollections() {
  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log("✅ Successfully connected to MongoDB!\n");

    // List all databases
    const databasesList = await client.db().admin().listDatabases();
    console.log("📁 Available databases:");
    databasesList.databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    console.log("\n");

    // Connect to a specific database
    // You can change "test" to your database name, or leave it to use the default
    const databaseName = "test"; // Change this to your database name
    const database = client.db(databaseName);
    
    console.log(`📂 Collections in database "${databaseName}":`);
    
    // Get all collections
    const collections = await database.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log("   No collections found in this database.");
    } else {
      for (const collection of collections) {
        console.log(`   - ${collection.name}`);
        
        // Get collection stats (optional)
        try {
          const stats = await database.collection(collection.name).estimatedDocumentCount();
          console.log(`     Documents: ${stats}`);
        } catch (e) {
          console.log(`     Documents: Unable to count`);
        }
      }
    }

    // Example: Show sample documents from a specific collection
    if (collections.length > 0) {
      console.log("\n📄 Sample documents from first collection:");
      const firstCollection = collections[0].name;
      const sampleDocs = await database.collection(firstCollection).find({}).limit(3).toArray();
      console.log(JSON.stringify(sampleDocs, null, 2));
    }

  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message);
  } finally {
    // Close the connection
    await client.close();
    console.log("\n🔌 Connection closed");
  }
}

async function truncateCollectionDirect() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const databaseName = "test"; // Change this to your database name
    const database = client.db(databaseName);
    const collection = database.collection("calls");

    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} documents from "calls" collection`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
  }
}

// Run the function
showCollections();
//truncateCollectionDirect();