import { NextRequest, NextResponse } from "next/server";
import { sarvamTTS, SUPPORTED_LANGUAGES } from "@/lib/ai/sarvam-tts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { intelligentTextChunker } from "@/lib/text-chunking/intelligent-text-chunker";
import { streamingErrorHandler, ErrorRecoveryStrategy } from "@/lib/error-handling";
import { ParallelProcessor } from "@/lib/performance";
import { z } from "zod";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const bodySchema = z.object({
  text: z.string().min(3).max(50000), // Increased limit for large content
  language: z.string().default("hi-IN"),
  speaker: z.string().optional().default("anushka"),
  pitch: z.number().min(-20).max(20).optional().default(0),
  pace: z.number().min(0.25).max(4.0).optional().default(1.0),
  chunkSize: z.number().min(100).max(1000).optional().default(600),
  retryAttempts: z.number().min(1).max(5).optional().default(3),
  enableParallelProcessing: z.boolean().optional().default(true),
  maxConcurrency: z.number().min(1).max(5).optional().default(3),
});

// Enhanced error recovery strategies (imported from error-handling module)

// Helper function to send audio chunks with proper splitting
function sendAudioChunk(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  options: {
    base64Chunk: string;
    index: number;
    total: number;
    requestId: string;
  }
): void {
  const { base64Chunk, index, total, requestId } = options;

  // Split large base64 data into smaller parts to avoid JSON parsing issues
  const maxBase64ChunkSize = 40000; // 40KB for better reliability
  const base64Length = base64Chunk.length;

  if (base64Length > maxBase64ChunkSize) {
    // Split into multiple parts
    const parts = Math.ceil(base64Length / maxBase64ChunkSize);

    console.log(
      `[TTS_STREAM_SPLIT] Request ${requestId}: Splitting chunk ${
        index + 1
      } into ${parts} parts`
    );

    for (let part = 0; part < parts; part++) {
      const start = part * maxBase64ChunkSize;
      const end = Math.min(start + maxBase64ChunkSize, base64Length);
      const partData = base64Chunk.slice(start, end);

      const chunkData = {
        type: "audio_chunk_part",
        data: partData,
        index,
        total,
        part,
        totalParts: parts,
        isLastPart: part === parts - 1,
        requestId,
        timestamp: Date.now(),
      };

      const jsonData = JSON.stringify(chunkData);
      controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));

      console.log(
        `[TTS_STREAM_PART] Request ${requestId}: Sent part ${
          part + 1
        }/${parts} of chunk ${index + 1}`
      );
    }
  } else {
    // Send as single chunk
    const chunkData = {
      type: "audio_chunk",
      data: base64Chunk,
      index,
      total,
      requestId,
      timestamp: Date.now(),
    };

    const jsonData = JSON.stringify(chunkData);
    controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));

    console.log(
      `[TTS_STREAM_SINGLE] Request ${requestId}: Sent single chunk ${
        index + 1
      }/${total}`
    );
  }
}

// Helper function for chunk-by-chunk translation
async function translateInChunks(
  text: string,
  targetLanguage: string,
  genAI: GoogleGenerativeAI,
  requestId: string
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Split text into smaller chunks (paragraphs or sentences)
    const chunks = text.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);
    const translatedChunks: string[] = [];
    
    console.log(`[TTS_CHUNK_TRANSLATION] Request ${requestId}: Translating ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;
      
      const chunkPrompt = `Translate this ${targetLanguage} text exactly as written. Do not summarize or change the content. Maintain all details and narrative elements:

${chunk}`;
      
      try {
        const result = await model.generateContent(chunkPrompt);
        const translatedChunk = result.response.text().trim();
        translatedChunks.push(translatedChunk);
        
        console.log(`[TTS_CHUNK_TRANSLATION] Request ${requestId}: Chunk ${i + 1}/${chunks.length} translated`);
      } catch (chunkError) {
        console.error(`[TTS_CHUNK_TRANSLATION_ERROR] Request ${requestId}: Failed to translate chunk ${i + 1}:`, chunkError);
        // Use original chunk if translation fails
        translatedChunks.push(chunk);
      }
      
      // Add small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return translatedChunks.join('\n\n');
  } catch (error) {
    console.error(`[TTS_CHUNK_TRANSLATION_ERROR] Request ${requestId}:`, error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[TTS_STREAM_START] Request ${requestId} initiated`);

  if (!sarvamTTS.isConfigured()) {
    console.error(
      `[TTS_STREAM_ERROR] Request ${requestId}: TTS service not configured`
    );
    return NextResponse.json(
      { error: "TTS service is not configured." },
      { status: 503 }
    );
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error(
      `[TTS_STREAM_ERROR] Request ${requestId}: Invalid JSON in request body`,
      error
    );
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(requestBody);
  if (!parsed.success) {
    console.error(
      `[TTS_STREAM_ERROR] Request ${requestId}: Validation failed`,
      parsed.error.issues
    );
    return NextResponse.json(
      {
        error: "Invalid input",
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  let {
    text,
    language,
    speaker,
    pitch,
    pace,
    chunkSize,
    retryAttempts,
    enableParallelProcessing,
    maxConcurrency,
  } = parsed.data;

  console.log(`[TTS_STREAM_INFO] Request ${requestId}:`, {
    textLength: text.length,
    language,
    speaker,
    pitch,
    pace,
    chunkSize,
    retryAttempts,
    textPreview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
  });

  try {
    const errorHandler = streamingErrorHandler;

    // Handle translation if needed
    const needsTranslation = language !== "en-IN" && language !== "en-US";

    if (needsTranslation && GEMINI_API_KEY) {
      console.log(
        `[TTS_STREAM_TRANSLATION] Request ${requestId}: Translating text for language: ${language}`
      );

      const supportedLang = SUPPORTED_LANGUAGES.find(
        (lang) => lang.code === language
      );

      if (supportedLang) {
        let translationResult: string | null = null;
        
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
          });
          const targetLanguageName = supportedLang.name;

          const prompt = `You are a professional translator. Translate the following English text to ${targetLanguageName} with these requirements:

1. Translate EVERY sentence and paragraph exactly as written
2. Do NOT summarize, shorten, or skip any content
3. Maintain the exact same structure, length, and narrative flow
4. Preserve all dialogue, descriptions, and story elements
5. Keep the same paragraph breaks and formatting
6. Return ONLY the complete translated text, nothing else

Text to translate:

${text}`;
          const result = await model.generateContent(prompt);
          translationResult = result.response.text();
        } catch (translationError) {
          console.error(`[TTS_STREAM_TRANSLATION_ERROR] Request ${requestId}:`, translationError);
          translationResult = null;
        }

        if (translationResult) {
          // Validate translation quality
          const originalLength = text.length;
          const translatedLength = translationResult.length;
          const lengthRatio = translatedLength / originalLength;
          
          // Check if translation is suspiciously short (might be summarized)
          if (lengthRatio < 0.3) {
            console.warn(
              `[TTS_STREAM_TRANSLATION_WARNING] Request ${requestId}: Translation seems too short (${lengthRatio.toFixed(2)}x original), attempting chunk-by-chunk translation.`
            );
            
            // Try chunk-by-chunk translation as fallback
            try {
              const fallbackGenAI = new GoogleGenerativeAI(GEMINI_API_KEY);
              const chunkTranslationResult = await translateInChunks(
                text, 
                supportedLang.name, 
                fallbackGenAI,
                requestId
              );
              
              if (chunkTranslationResult && chunkTranslationResult.length > originalLength * 0.5) {
                text = chunkTranslationResult;
                console.log(
                  `[TTS_STREAM_TRANSLATION] Request ${requestId}: Chunk-by-chunk translation successful`,
                  {
                    originalLength,
                    translatedLength: chunkTranslationResult.length,
                    lengthRatio: (chunkTranslationResult.length / originalLength).toFixed(2)
                  }
                );
              } else {
                console.warn(
                  `[TTS_STREAM_TRANSLATION] Request ${requestId}: Chunk-by-chunk translation also failed, using original text`
                );
              }
            } catch (chunkError) {
              console.error(
                `[TTS_STREAM_TRANSLATION_ERROR] Request ${requestId}: Chunk-by-chunk translation failed:`,
                chunkError
              );
            }
          } else {
            text = translationResult;
            console.log(
              `[TTS_STREAM_TRANSLATION] Request ${requestId}: Translation completed successfully`,
              {
                originalLength,
                translatedLength,
                lengthRatio: lengthRatio.toFixed(2),
                originalWords: text.split(/\s+/).length,
                translatedWords: translationResult.split(/\s+/).length
              }
            );
          }
        } else {
          console.warn(
            `[TTS_STREAM_TRANSLATION] Request ${requestId}: Translation failed, using original text`
          );
        }
      }
    }

    // Use intelligent text chunking strategy
    console.log(
      `[TTS_STREAM_CHUNKING] Request ${requestId}: Starting text chunking with size ${chunkSize}`
    );

    const textChunks = intelligentTextChunker.splitText(text, {
      maxChunkSize: chunkSize,
      minChunkSize: Math.floor(chunkSize * 0.1), // 10% of max size as minimum
      splitStrategy: "hybrid",
    });

    console.log(
      `[TTS_STREAM_CHUNKING] Request ${requestId}: Created ${textChunks.length} chunks`,
      {
        chunks: textChunks.map((chunk, index) => ({
          index,
          length: chunk.text.length,
          preview:
            chunk.text.substring(0, 50) + (chunk.text.length > 50 ? "..." : ""),
        })),
      }
    );

    // Validate chunks to ensure no content loss
    const originalWordCount = text.split(/\s+/).length;
    const chunkedWordCount = textChunks.reduce(
      (total, chunk) => total + chunk.text.split(/\s+/).length,
      0
    );

    if (
      Math.abs(originalWordCount - chunkedWordCount) >
      originalWordCount * 0.05
    ) {
      console.warn(
        `[TTS_STREAM_WARNING] Request ${requestId}: Potential content loss detected`,
        {
          originalWords: originalWordCount,
          chunkedWords: chunkedWordCount,
          difference: Math.abs(originalWordCount - chunkedWordCount),
        }
      );
    }

    // Create a readable stream for progressive audio delivery
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let processedChunks = 0;
        let failedChunks = 0;
        const chunkStartTime = Date.now();

        try {
          console.log(
            `[TTS_STREAM_PROCESSING] Request ${requestId}: Starting audio generation for ${textChunks.length} chunks`,
            {
              parallelProcessing: enableParallelProcessing,
              maxConcurrency: enableParallelProcessing ? maxConcurrency : 1,
            }
          );

          if (enableParallelProcessing && textChunks.length > 1) {
            // Use parallel processing for better performance
            const parallelProcessor = new ParallelProcessor<
              (typeof textChunks)[0],
              ArrayBuffer
            >({
              maxConcurrency,
              retryAttempts,
              retryDelayMs: 1000,
              progressiveThreshold: 2, // Start sending after 2 chunks are ready
              timeoutMs: 30000,
            });

            // Process chunks in parallel with progressive delivery
            await parallelProcessor.processParallel(
              textChunks,
              async (textChunk, index) => {
                console.log(
                  `[TTS_STREAM_PARALLEL] Request ${requestId}: Processing chunk ${
                    index + 1
                  }/${textChunks.length}`,
                  {
                    chunkLength: textChunk.text.length,
                    chunkPreview:
                      textChunk.text.substring(0, 100) +
                      (textChunk.text.length > 100 ? "..." : ""),
                  }
                );

                const chunkResult = await sarvamTTS.generateAudio({
                  text: textChunk.text,
                  language,
                  speaker,
                  pitch,
                  pace,
                });

                if (chunkResult.error) {
                  throw new Error(`TTS Generation Error: ${chunkResult.error}`);
                }

                if (!chunkResult.audioData) {
                  throw new Error("No audio data received");
                }

                console.log(
                  `[TTS_STREAM_PARALLEL_SUCCESS] Request ${requestId}: Chunk ${
                    index + 1
                  } generated successfully`,
                  {
                    audioSize: chunkResult.audioData.byteLength,
                  }
                );

                return chunkResult.audioData;
              },
              {
                onProgress: (completed, total, results) => {
                  console.log(
                    `[TTS_STREAM_PARALLEL_PROGRESS] Request ${requestId}: ${completed}/${total} chunks completed`
                  );
                },
                onProgressiveReady: (readyResults) => {
                  console.log(
                    `[TTS_STREAM_PARALLEL_READY] Request ${requestId}: ${readyResults.length} chunks ready for progressive delivery`
                  );

                  // Send ready chunks immediately
                  readyResults.forEach((result) => {
                    if (result.result && !result.error) {
                      const audioData = result.result;
                      const base64Chunk =
                        Buffer.from(audioData).toString("base64");

                      // Send chunk data
                      sendAudioChunk(controller, encoder, {
                        base64Chunk,
                        index: result.index,
                        total: textChunks.length,
                        requestId,
                      });

                      processedChunks++;
                    }
                  });
                },
                onComplete: (allResults) => {
                  console.log(
                    `[TTS_STREAM_PARALLEL_COMPLETE] Request ${requestId}: All chunks processed`
                  );

                  // Send any remaining chunks that weren't sent progressively
                  allResults.forEach((result) => {
                    if (result.result && !result.error) {
                      const audioData = result.result;
                      const base64Chunk =
                        Buffer.from(audioData).toString("base64");

                      // Check if this chunk was already sent
                      if (result.index >= processedChunks) {
                        sendAudioChunk(controller, encoder, {
                          base64Chunk,
                          index: result.index,
                          total: textChunks.length,
                          requestId,
                        });

                        processedChunks++;
                      }
                    } else if (result.error) {
                      failedChunks++;

                      // Send error notification for this chunk
                      const errorData = {
                        type: "chunk_error",
                        message: `Failed to process chunk ${
                          result.index + 1
                        }: ${result.error.message}`,
                        index: result.index,
                        total: textChunks.length,
                        requestId,
                        timestamp: Date.now(),
                      };
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
                      );
                    }
                  });
                },
                onError: (error, task) => {
                  console.error(
                    `[TTS_STREAM_PARALLEL_ERROR] Request ${requestId}: Task ${task.id} failed:`,
                    error
                  );
                  failedChunks++;
                },
              }
            );
          } else {
            // Sequential processing (original logic)
            for (let i = 0; i < textChunks.length; i++) {
              const textChunk = textChunks[i];
              const chunkContext = `chunk-${i}-${requestId}`;
              let chunkProcessed = false;

              console.log(
                `[TTS_STREAM_CHUNK] Request ${requestId}: Processing chunk ${
                  i + 1
                }/${textChunks.length}`,
                {
                  chunkLength: textChunk.text.length,
                  chunkPreview:
                    textChunk.text.substring(0, 100) +
                    (textChunk.text.length > 100 ? "..." : ""),
                }
              );

              // Retry logic for individual chunks
              while (!chunkProcessed) {
                try {
                  const chunkResult = await sarvamTTS.generateAudio({
                    text: textChunk.text,
                    language,
                    speaker,
                    pitch,
                    pace,
                  });

                  if (chunkResult.error) {
                    throw new Error(`TTS Generation Error: ${chunkResult.error}`);
                  }

                  if (!chunkResult.audioData) {
                    throw new Error("No audio data received");
                  }

                  // Send audio chunk as base64 encoded data
                  const base64Chunk = Buffer.from(
                    chunkResult.audioData
                  ).toString("base64");

                  console.log(
                    `[TTS_STREAM_CHUNK_SUCCESS] Request ${requestId}: Chunk ${
                      i + 1
                    } generated successfully`,
                    {
                      audioSize: chunkResult.audioData.byteLength,
                      base64Size: base64Chunk.length,
                    }
                  );

                  sendAudioChunk(controller, encoder, {
                    base64Chunk,
                    index: i,
                    total: textChunks.length,
                    requestId,
                  });

                  processedChunks++;
                  chunkProcessed = true;
                  errorHandler.reset(chunkContext); // Reset retry count on success
                } catch (chunkError) {
                  const shouldRetry = await errorHandler.handleError(
                    chunkError instanceof Error
                      ? chunkError
                      : new Error(String(chunkError)),
                    chunkContext,
                    {
                      type: "retry",
                      maxAttempts: retryAttempts,
                      backoffMs: 1000,
                    }
                  );

                  if (!shouldRetry) {
                    // Skip this chunk and continue with next
                    console.error(
                      `[TTS_STREAM_CHUNK_FAILED] Request ${requestId}: Skipping chunk ${
                        i + 1
                      } after max retries`
                    );
                    failedChunks++;
                    chunkProcessed = true;

                    // Send error notification for this chunk
                    const errorData = {
                      type: "chunk_error",
                      message: `Failed to process chunk ${i + 1}`,
                      index: i,
                      total: textChunks.length,
                      requestId,
                      timestamp: Date.now(),
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
                    );
                  }
                }
              }
            }
          }

          const processingTime = Date.now() - chunkStartTime;
          console.log(
            `[TTS_STREAM_COMPLETE] Request ${requestId}: Processing completed`,
            {
              totalChunks: textChunks.length,
              processedChunks,
              failedChunks,
              processingTimeMs: processingTime,
              averageTimePerChunk: processingTime / textChunks.length,
            }
          );

          // Send completion signal with summary
          const completionData = {
            type: "complete",
            summary: {
              totalChunks: textChunks.length,
              processedChunks,
              failedChunks,
              processingTimeMs: processingTime,
            },
            requestId,
            timestamp: Date.now(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(completionData)}\n\n`)
          );
        } catch (error) {
          console.error(
            `[TTS_STREAM_FATAL_ERROR] Request ${requestId}:`,
            error
          );
          const errorData = {
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to generate audio stream",
            code: "UNKNOWN_ERROR",
            requestId,
            timestamp: Date.now(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
          );
        } finally {
          const totalTime = Date.now() - startTime;
          console.log(`[TTS_STREAM_END] Request ${requestId}: Stream ended`, {
            totalTimeMs: totalTime,
            processedChunks,
            failedChunks,
          });
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "X-Request-ID": requestId,
        // Prevent timeouts for large content
        "Keep-Alive": "timeout=300, max=1000",
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[TTS_STREAM_FATAL_ERROR] Request ${requestId}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      totalTimeMs: totalTime,
    });

    return NextResponse.json(
      {
        error: "Failed to generate audio stream.",
        requestId,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
