import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url || "", true);
    const { pathname } = parsedUrl;

    if (req.method === "POST") {
        let body = "";

        req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            if (pathname === "/query") {
                console.log("Received POST data on /query:", body);
                res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

                res.end(await llmSearch(body));
                //res.end("POST request received on /submit");
                // } else if (pathname === '/upload') {
                //   console.log('Received POST data on /upload:', body);
                //   res.writeHead(200, { 'Content-Type': 'text/plain' });
                //   res.end('POST request received on /upload');
                // }
            } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found");
            }
        });
    } else if (req.method === "GET") {
       
        if (pathname === "/info") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "This is the info endpoint" }));
        } else if (pathname === "/status") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "Server is running" }));
        } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
        }
    } else {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
    }
});

server.listen(3000, () => {
    console.log("Server is listening on port 3000");
});

const llm = new ChatOpenAI({
    //configuration: ClientOptions(),
    openAIApiKey: process.env.OPENAI_SECRET_KEY,
    model: "gpt-4",
    //zero temperature means no extra creativity
    temperature: 0,
});

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_SECRET_KEY,
});

const vectorStore = new Chroma(embeddings, {
    collectionName: "robot-collection",
    url: "http://192.168.0.223:8102",
    collectionMetadata: { "hnsw:space": "cosine" },
});

// Retrieve and generate using the relevant snippets of the blog.
//const retriever = vectorStore.asRetriever();
//const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt"); // Is a predefined one.

// const systemTemplate = "Translate the following into {language}:";
// const prompt = ChatPromptTemplate.fromMessages([
//     ["system", systemTemplate],
//     ["user", "{text}"],
// ]);
// Retrieve relevant documents

const prompt = ChatPromptTemplate.fromTemplate(
    `Answer the following question based on the provided context: 
    {context}
    Question: {question}`,
);

 const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

async function llmSearch(query: string): Promise<string> {
    //const retrievedDocs = await retriever.invoke(query);
    const retrievedDocs = await vectorStore.similaritySearch(query);

    const result = await ragChain.invoke({
        question: query,
        context: retrievedDocs,
    });

    console.log("Generated response:", result);
    return result;
} 

// const query = "How to check the sonars?";
// //const retrievedDocs = await retriever.invoke(query);
// const retrievedDocs = await vectorStore.similaritySearch(query);

// const result = await ragChain.invoke({
//     question: query,
//     context: retrievedDocs,
// });

// console.log("Generated response:", result);
