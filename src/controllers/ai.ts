import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { Content, StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { NextFunction, Request, Response } from "express";
import { StreamEvent,StreamEventData } from '@langchain/core/tracers/log_stream';


export const getAIResult = async (req: Request, res: Response) => {
    const { query } = req.body as { query: string };

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    res.end(await llmSearch(query));
};
// https://www.robinwieruch.de/langchain-javascript-stream-structured/
export const streamAIResult = async (req: Request, res: Response) => {
    const { query } = req.body as { query: string };
    let headers = new Map<string, string>();
    headers.set("Connection", "keep-alive");
    headers.set("Content-Encoding", "none");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeaders(headers);

    // // Set the response headers for streaming
    // res.setHeader("Content-Type", "text/plain");
    // res.setHeader("Transfer-Encoding", "chunked");
    const retrievedDocs = await vectorStore.similaritySearch(query);

    let eventStream = await ragChain.streamEvents({
        question: query,
        context: retrievedDocs,

    }, {
        version: "v2",
        encoding: "text/event-stream",
    });

    // for await (const { event, data } of eventStream) {
    //     if (event === "on_chat_model_stream") {
    //         await this.handleChatModelStream(data, res, model, metrics);
    //         if (typeof data.chunk.content === "string") {
    //             result += data.chunk.content;
    //         }
    //     }
    // }
    // Pipe the stream to the response
    //  stream.pipe(res);

    //  // Handle stream end
    //  stream.on('end', () => {
    //    res.end();
    //  });

    //  // Handle stream errors
    //  stream.on('error', (err) => {
    //    console.error('Stream error:', err);
    //    res.status(500).send('Internal Server Error');
    //  });
   
    const chunks = [];
    for await (const chunk of eventStream) {
        chunks.push(chunk);
        console.log(`${chunk}|`);
        res.write(chunk);
    }

    //res.send(stream);
    res.end();

    //     const stream = await ragChain.stream({
    //         question: query,
    //         context: retrievedDocs,
    //     });
    //     const chunks = [];

    //   for await (const chunk of stream) {
    //   chunks.push(chunk);
    //   //console.log(`${chunk.content}|`);
    //   res.send(chunk);
};

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
async function llmSearchWStreamResp(query: string): Promise<string> {
    //const retrievedDocs = await retriever.invoke(query);
    const retrievedDocs = await vectorStore.similaritySearch(query);

    const result = await ragChain.invoke({
        question: query,
        context: retrievedDocs,
    });

    console.log("Generated response:", result);
    return result;
}
