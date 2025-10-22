/**
 * OpenAI GPT-4 integration service for intelligent NAM extraction from text.
 *
 * Uses GPT-4o model with structured JSON output to identify Quebec health
 * insurance numbers (NAM) from OCR-extracted text.
 */

import OpenAI from "openai";
import { TextByPage } from "../types";

/**
 * System prompt with NAM, date, and time format instructions
 */
const SYSTEM_PROMPT = `You are a medical billing data extraction assistant specializing in Quebec healthcare documents.

Your task: Extract all Quebec health insurance numbers (NAM/Numéro d'assurance maladie), visit dates, and visit times from the provided text.

NAM Format Rules:
- Exactly 12 characters
- First 4 characters: Letters only (A-Z)
- Last 8 characters: Digits only (0-9)
- Example: ABCD12345678

Visit Date Rules:
- The visit date typically appears once at the top of each page
- Extract in YYYY-MM-DD format (e.g., 2025-01-21)
- If you find dates in other formats (DD/MM/YYYY, DD-MM-YYYY, etc.), convert them to YYYY-MM-DD
- Each NAM should be associated with the date from its page
- If no date is found, set to null

Visit Time Rules:
- The visit time typically appears near the NAM on the same page
- Extract in HH:MM 24-hour format (e.g., 08:00, 14:30)
- If you find times in 12-hour format (e.g., 2:30 PM), convert to 24-hour (14:30)
- If you find times in other formats (14h30, 1430), convert to HH:MM
- If no time is found for a NAM, set to null (default of 08:00 will be used)

Instructions:
1. Scan the entire text for strings matching the NAM format
2. Extract ALL valid NAMs (there may be multiple per page)
3. For each NAM, extract the associated visit date and time
4. Track which page each NAM was found on
5. Dates typically appear once per page (at the top), times appear near each NAM
6. Return results as JSON object with "nams" array only, no other text

Output Format:
{
  "nams": [
    {"nam": "ABCD12345678", "visitDate": "2025-01-21", "visitTime": "08:00", "page": 1},
    {"nam": "WXYZ98765432", "visitDate": "2025-01-22", "visitTime": "14:30", "page": 2},
    {"nam": "EFGH11223344", "visitDate": "2025-01-21", "visitTime": null, "page": 1}
  ]
}

If no valid NAMs found, return: {"nams": []}`;

/**
 * Raw NAM extraction from OpenAI response
 */
interface RawNAM {
  nam: string;
  visitDate: string | null;
  visitTime: string | null;
  page: number;
}

/**
 * OpenAI response structure
 */
interface OpenAIResponse {
  nams: RawNAM[];
}

/**
 * Extract NAMs, visit dates, and visit times from text using OpenAI GPT-4.
 *
 * @param textByPage - Dictionary mapping page number to list of text lines
 *                     Example: {1: ['Line 1', 'Line 2'], 2: ['Line 3']}
 * @returns List of extracted NAMs with dates, times, and page numbers
 *          Example: [{"nam": "ABCD12345678", "visitDate": "2025-01-21", "visitTime": "08:00", "page": 1}, ...]
 *          Returns empty array if no NAMs found
 * @throws Error for OpenAI API errors (AuthenticationError, RateLimitError, etc.)
 *
 * This function:
 * - Combines text from all pages with page markers
 * - Sends to GPT-4o with structured JSON response format
 * - Uses temperature=0 for deterministic extraction
 * - Parses JSON response to extract NAM list with dates and times
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
  let userPrompt = "Extract NAMs, visit dates, and visit times from this document:\n\n";

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
      max_tokens: 10000, // Increased to handle large documents with date/time fields
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

  const namStrings = nams.map((n) => {
    const dateStr = n.visitDate || "no date";
    const timeStr = n.visitTime || "no time";
    return `${n.nam} (${dateStr} ${timeStr}, page ${n.page})`;
  });
  return `${nams.length} NAMs: ${namStrings.join(", ")}`;
}
