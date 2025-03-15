import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

// Redis clients: one for publishing, one for subscribing
const redisPublisher = createClient({
    url: process.env.REDIS_HOST + ":" + (process.env.REDIS_PORT || "6379"),
});
const redisSubscriber = createClient({
    url: process.env.REDIS_HOST + ":" + (process.env.REDIS_PORT || "6379"),
});

// Connect Redis clients
(async () => {
    await redisPublisher.connect();
    await redisSubscriber.connect();
})();

redisPublisher.on("error", (err) => {
    console.error("RedisPublisher error:", err);
});

redisSubscriber.on("error", (err) => {
    console.error("RedisSubscriber error:", err);
});

export { redisPublisher, redisSubscriber };
