import { AIServiceType } from "../ai/ai-interface.js";
import { startLangChainStream } from "../controllers/ai.js";

const testResults = async () => {
    const chunks = [];
    try {
        const stream = await startLangChainStream(
            //"Warum fährt mein Roboter langsam?",
            "Wie update ich die RTK-Basis?",
            AIServiceType.OLLAMA
        );
        for await (const chunk of stream) {

            if (typeof chunk === "string") {
                chunks.push(chunk);
                console.log(chunk);
            } else {
                console.log("Non-string chunk:", chunk);
            }
        }

        console.log("final: " + chunks.join(""));
    } catch (e) {
        console.log('error', e);
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
