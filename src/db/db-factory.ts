import { MongoDBService } from "./mongo-db-service.js";
import { PostgresDBService } from "./postgres-db-service.js";

export type DatabaseService = MongoDBService | PostgresDBService;

export class DatabaseFactory {
    static createDatabaseService(): DatabaseService {
        const databaseType = process.env.DATABASE_TYPE || "mongo";
        
        switch (databaseType.toLowerCase()) {
            case "postgres":
            case "postgresql":
                console.log("Start Postgres DB Service");
                return new PostgresDBService();
            case "mongo":
            case "mongodb":
            default:
                console.log("Start Mongo DB Service");
                return new MongoDBService();
        }
    }
}