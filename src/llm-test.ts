import { startLangChainStream } from "./controllers/ai.js";

const testResults = async () => {
    const chunks = [];
    try {
        const stream = await startLangChainStream(
            "Warum fährt mein Roboter langsam?",
        );
        for await (const chunk of stream) {
            console.log(chunk);
            chunks.push(chunk);
        }

        console.log("final: " + chunks.join(""));
    } catch (e) {
    }
};
testResults();

// (async () => {
//     const chunks = [];
//     try {
//         const stream = await startLangChainStream(
//             "Roboter mit höchster Flächenleistung?",
//         );
//         for await (const chunk of stream) {
//             chunks.push(chunk);
//         }
//     } catch (e) {
//     }
// });
