// src/redisClient.ts
import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

//https://redis.io/docs/latest/develop/clients/nodejs/
const client = redis.createClient({
  url: process.env.REDIS_HOST + ":" + (process.env.REDIS_PORT || "6379"),
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

export default client;
