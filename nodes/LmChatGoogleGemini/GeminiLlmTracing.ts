import { N8nLlmTracing } from '@n8n/ai-utilities';
import type { ISupplyDataFunctions } from 'n8n-workflow';
import type { LLMResult } from '@langchain/core/outputs';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Gemini-aware tracing handler.
 *
 * The Gemini wrapper already places most per-candidate metadata (finishReason,
 * safetyRatings, citationMetadata, groundingMetadata, urlContextMetadata,
 * avgLogprobs, …) onto each generation's `generationInfo`, which n8n's base
 * `N8nLlmTracing` forwards to the sub-node's output/logs panel.
 *
 * Two things the base handler drops on the floor:
 *   1. `tool_calls` — they live on the message, and the base `handleLLMEnd`
 *      keeps only `['text', 'generationInfo']`, discarding the message.
 *   2. The granular token breakdown — the wrapper folds reasoning ("thinking")
 *      tokens into `output_tokens` and the default token parser only reports
 *      prompt/completion/total.
 *
 * This subclass folds both into `generationInfo.geminiMetadata` *before*
 * delegating to the base implementation, so they survive into the panel without
 * any change to the wrapper.
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

				const existing = generation.generationInfo ?? {};
				const usage = (message as { usage_metadata?: Record<string, unknown> })
					.usage_metadata;
				const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;

				generation.generationInfo = {
					...existing,
					geminiMetadata: {
						// Tools the model actually invoked this turn.
						...(toolCalls?.length ? { toolCalls } : {}),
						// Full token breakdown incl. reasoning/cache detail when present.
						...(usage ? { usageMetadata: usage } : {}),
						// finishReason / safetyRatings / grounding / citations are already
						// on `existing` (spread from the candidate by the wrapper); surface
						// the common ones explicitly so they're easy to find in the panel.
						...(existing.finishReason ? { finishReason: existing.finishReason } : {}),
						...(existing.safetyRatings ? { safetyRatings: existing.safetyRatings } : {}),
						...(existing.groundingMetadata
							? { groundingMetadata: existing.groundingMetadata }
							: {}),
						...(existing.citationMetadata
							? { citationMetadata: existing.citationMetadata }
							: {}),
						...(existing.urlContextMetadata
							? { urlContextMetadata: existing.urlContextMetadata }
							: {}),
					},
				};
			}
		}

		return super.handleLLMEnd(output, runId);
	}
}
