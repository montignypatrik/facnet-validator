/**
 * OpenAI GPT-4 integration service for intelligent NAM extraction from text.
 *
 * Uses GPT-4o model with structured JSON output to identify Quebec health
 * insurance numbers (NAM) from OCR-extracted text.
 */

import OpenAI from "openai";
import { TextByPage } from "../types";

/**
 * System prompt with NAM format instructions
 */
const SYSTEM_PROMPT = `You are a medical billing data extraction assistant specializing in Quebec healthcare documents.

Your task: Extract all Quebec health insurance numbers (NAM/Numéro d'assurance maladie) from the provided text.

NAM Format Rules:
- Exactly 12 characters
- First 4 characters: Letters only (A-Z)
- Last 8 characters: Digits only (0-9)
- Example: ABCD12345678

Instructions:
1. Scan the entire text for strings matching the NAM format
2. Extract ALL valid NAMs (there may be multiple)
3. Track which page each NAM was found on
4. Ignore strings that don't match the exact format
5. Return results as JSON object with "nams" array only, no other text

Output Format:
{
  "nams": [
    {"nam": "ABCD12345678", "page": 1},
    {"nam": "WXYZ98765432", "page": 2}
  ]
}

If no valid NAMs found, return: {"nams": []}`;

/**
 * Raw NAM from OpenAI response
 */
interface RawNAM {
  nam: string;
  page: number;
}

/**
 * OpenAI response structure
 */
interface OpenAIResponse {
  nams: RawNAM[];
}

/**
 * Extract NAMs from text using OpenAI GPT-4.
 *
 * @param textByPage - Dictionary mapping page number to list of text lines
 *                     Example: {1: ['Line 1', 'Line 2'], 2: ['Line 3']}
 * @returns List of extracted NAMs with page numbers
 *          Example: [{"nam": "ABCD12345678", "page": 1}, ...]
 *          Returns empty array if no NAMs found
 * @throws Error for OpenAI API errors (AuthenticationError, RateLimitError, etc.)
 *
 * This function:
 * - Combines text from all pages with page markers
 * - Sends to GPT-4o with structured JSON response format
 * - Uses temperature=0 for deterministic extraction
 * - Parses JSON response to extract NAM list
 */
export async function extractNAMsWithGPT4(
  textByPage: TextByPage
): Promise<RawNAM[]> {
  const startTime = Date.now();

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  // Combine text from all pages with page markers
  let userPrompt = "Extract NAMs from this document:\n\n";

  // Sort pages by page number
  const sortedPages = Object.keys(textByPage)
    .map(Number)
    .sort((a, b) => a - b);

  for (const page of sortedPages) {
    const lines = textByPage[page];
    userPrompt += `--- Page ${page} ---\n`;
    userPrompt += lines.join("\n");
    userPrompt += "\n\n";
  }

  console.log(`[OPENAI] Sending text to OpenAI GPT-4: ${sortedPages.length} pages (${userPrompt.length} chars)`);

  try{
    // Call GPT-4o API with structured output
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0, // Deterministic extraction
      max_tokens: 4000, // Increased from 1000 to handle larger responses
    });

    // Parse JSON response
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      console.error("[OPENAI] Empty response from OpenAI");
      return [];
    }

    console.log(`[OPENAI] Response length: ${responseContent.length} chars, finish_reason: ${response.choices[0]?.finish_reason}`);

    let parsedResponse: OpenAIResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError: any) {
      console.error(`[OPENAI] Failed to parse OpenAI JSON response: ${parseError.message}`);
      console.error(`[OPENAI] Malformed response (first 500 chars): ${responseContent.substring(0, 500)}`);
      // Return empty array if JSON parsing fails
      return [];
    }

    // Extract NAMs array from response
    const nams = parsedResponse.nams || [];

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Estimate cost (GPT-4o pricing: ~$0.005 per 1K input tokens, ~$0.015 per 1K output tokens)
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const estimatedCost =
      (inputTokens / 1000) * 0.005 + (outputTokens / 1000) * 0.015;

    console.log(
      `[OPENAI] OpenAI GPT-4 completed in ${elapsedTime}s: ${nams.length} NAMs found, ~$${estimatedCost.toFixed(4)} cost`
    );

    return nams;
  } catch (error: any) {

    console.error(`[OPENAI] OpenAI API error: ${error.constructor.name}: ${error.message}`);
    // Re-raise for retry logic to handle
    throw error;
  }
}

/**
 * Format NAMs list for logging (without PHI concerns as NAMs are fictional in POC).
 *
 * @param nams - List of NAM dictionaries from extractNAMsWithGPT4
 * @returns Formatted string with NAM count and list
 */
export function formatNAMsForLogging(nams: RawNAM[]): string {
  if (!nams || nams.length === 0) {
    return "No NAMs found";
  }

  const namStrings = nams.map((n) => `${n.nam} (page ${n.page})`);
  return `${nams.length} NAMs: ${namStrings.join(", ")}`;
}
