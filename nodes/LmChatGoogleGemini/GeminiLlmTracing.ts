import { N8nLlmTracing } from '@n8n/ai-utilities';
import type { ISupplyDataFunctions } from 'n8n-workflow';
import type { LLMResult } from '@langchain/core/outputs';
import type { BaseMessage } from '@langchain/core/messages';
import type { GenerateContentResponse } from '@google/genai';

/** Curated, panel-friendly summary distilled from the raw Gemini response. */
interface GeminiMetadata {
	model?: string;
	responseId?: string;
	createTime?: string;
	finishReason?: string;
	finishMessage?: string;
	serviceTier?: string;
	latencyMs?: number;
	includesThinking?: boolean;
	thinking?: string;
	avgLogprobs?: number;
	tokenUsage?: {
		prompt?: number;
		response?: number;
		thoughts?: number;
		cached?: number;
		total?: number;
		promptModalities?: Record<string, number>;
	};
	toolCalls?: unknown[];
	safetyRatings?: unknown;
	promptFeedback?: unknown;
	grounding?: unknown;
	citations?: unknown;
	urlContext?: unknown;
}

/** server-timing looks like `gfet4t7; dur=3063` — pull the duration in ms. */
function parseLatencyMs(headers: Record<string, unknown> | undefined): number | undefined {
	const serverTiming = headers?.['server-timing'];
	if (typeof serverTiming !== 'string') return undefined;
	const match = serverTiming.match(/dur=([\d.]+)/);
	return match ? Number(match[1]) : undefined;
}

/**
 * Distil the verbose raw `GenerateContentResponse` into the handful of fields
 * worth surfacing. Everything that's redundant (answer/thinking text, opaque
 * thoughtSignature, raw headers, role) is dropped; optional blocks are emitted
 * only when present.
 */
function summarizeRawResponse(
	raw: GenerateContentResponse | undefined,
	toolCalls: unknown[] | undefined,
): GeminiMetadata | undefined {
	if (!raw) return undefined;

	const candidate = raw.candidates?.[0];
	const usage = raw.usageMetadata as
		| {
				promptTokenCount?: number;
				candidatesTokenCount?: number;
				thoughtsTokenCount?: number;
				cachedContentTokenCount?: number;
				totalTokenCount?: number;
				serviceTier?: string;
				promptTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
		  }
		| undefined;
	const headers = (raw as { sdkHttpResponse?: { headers?: Record<string, unknown> } })
		.sdkHttpResponse?.headers;

	const promptModalities = usage?.promptTokensDetails?.reduce<Record<string, number>>(
		(acc, detail) => {
			if (detail.modality && typeof detail.tokenCount === 'number') {
				acc[detail.modality] = detail.tokenCount;
			}
			return acc;
		},
		{},
	);

	const tokenUsage = usage
		? {
				prompt: usage.promptTokenCount,
				response: usage.candidatesTokenCount,
				...(usage.thoughtsTokenCount ? { thoughts: usage.thoughtsTokenCount } : {}),
				...(usage.cachedContentTokenCount
					? { cached: usage.cachedContentTokenCount }
					: {}),
				total: usage.totalTokenCount,
				...(promptModalities && Object.keys(promptModalities).length
					? { promptModalities }
					: {}),
			}
		: undefined;

	// The thinking summary is carried in the `thought: true` content part(s).
	// Keep the human-readable text; the opaque `thoughtSignature` blob is dropped.
	const thinking = candidate?.content?.parts
		?.filter(
			(part): part is { thought?: boolean; text?: string } =>
				(part as { thought?: boolean }).thought === true,
		)
		.map((part) => part.text)
		.filter((text): text is string => typeof text === 'string' && text.length > 0)
		.join('\n')
		.trim();

	// Reasoning may run (thoughtsTokenCount > 0) even when no summary text is
	// returned, so flag thinking from either signal.
	const includesThinking = Boolean(thinking) || (usage?.thoughtsTokenCount ?? 0) > 0;

	const summary: GeminiMetadata = {
		...(raw.modelVersion ? { model: raw.modelVersion } : {}),
		...(raw.responseId ? { responseId: raw.responseId } : {}),
		...(raw.createTime ? { createTime: raw.createTime } : {}),
		...(candidate?.finishReason ? { finishReason: String(candidate.finishReason) } : {}),
		...(candidate?.finishMessage ? { finishMessage: candidate.finishMessage } : {}),
		...(usage?.serviceTier ? { serviceTier: usage.serviceTier } : {}),
		...((): { latencyMs?: number } => {
			const latencyMs = parseLatencyMs(headers);
			return latencyMs !== undefined ? { latencyMs } : {};
		})(),
		...(includesThinking ? { includesThinking: true } : {}),
		...(thinking ? { thinking } : {}),
		...(typeof candidate?.avgLogprobs === 'number'
			? { avgLogprobs: candidate.avgLogprobs }
			: {}),
		...(tokenUsage ? { tokenUsage } : {}),
		...(toolCalls?.length ? { toolCalls } : {}),
		...(candidate?.safetyRatings ? { safetyRatings: candidate.safetyRatings } : {}),
		...(raw.promptFeedback ? { promptFeedback: raw.promptFeedback } : {}),
		...(candidate?.groundingMetadata ? { grounding: candidate.groundingMetadata } : {}),
		...(candidate?.citationMetadata ? { citations: candidate.citationMetadata } : {}),
		...(candidate?.urlContextMetadata ? { urlContext: candidate.urlContextMetadata } : {}),
	};

	return summary;
}

/**
 * Gemini-aware tracing handler.
 *
 * The model subclass attaches the full raw `GenerateContentResponse` to each
 * generation's `generationInfo.rawResponse`. Here we distil it into a compact,
 * readable `geminiMetadata` summary (model, response id, finish reason, latency,
 * full token breakdown, tool calls, safety/grounding/citation info) and drop the
 * verbose raw payload — so the sub-node output/logs panel stays readable.
 */
export class GeminiLlmTracing extends N8nLlmTracing {
	constructor(executionFunctions: ISupplyDataFunctions) {
		super(executionFunctions);
	}

	async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
		for (const generations of output.generations ?? []) {
			for (const generation of generations) {
				// Only chat generations carry a message; text-only generations don't.
				const message = (generation as { message?: BaseMessage }).message;
				if (!message) continue;

				// Drop the raw payload from generationInfo; we replace it with a summary.
				const { rawResponse, ...existing } = generation.generationInfo ?? {};
				const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;

				const geminiMetadata = summarizeRawResponse(
					rawResponse as GenerateContentResponse | undefined,
					toolCalls,
				);
				if (!geminiMetadata) continue;

				generation.generationInfo = { ...existing, geminiMetadata };
			}
		}

		return super.handleLLMEnd(output, runId);
	}
}
