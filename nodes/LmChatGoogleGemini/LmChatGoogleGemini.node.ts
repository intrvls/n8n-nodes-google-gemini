import { ChatGoogleGenerativeAI } from '@intrvls/langchain-google-genai';
import type { GoogleGenerativeAIChatInput } from '@intrvls/langchain-google-genai';
import type { SafetySetting } from '@google/genai';
import { HarmBlockThreshold, HarmCategory } from '@google/genai';

// The thinking types aren't exported from the library, so derive them from the
// exported constructor-input interface to stay in sync with the upstream shape.
type ThinkingConfig = NonNullable<GoogleGenerativeAIChatInput['thinkingConfig']>;
type ThinkingLevel = NonNullable<ThinkingConfig['thinkingLevel']>;
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type INodeProperties,
} from 'n8n-workflow';

const DEFAULT_MODEL_V1 = 'models/gemini-2.5-flash';
const DEFAULT_MODEL_V11 = 'models/gemini-3-flash-preview';

/**
 * Notice field shown on AI sub-nodes that explains they must be connected to a
 * root node (Agent / Chain) rather than used standalone. Mirrors the field that
 * n8n's internal `getConnectionHintNoticeField` produces, but inlined so the
 * community package has no dependency on private n8n internals.
 */
const connectionHintNotice: INodeProperties = {
	displayName:
		'This node must be connected to an AI Agent or Chain. <a data-action="openSelectiveNodeCreator" data-action-parameter-connectiontype="ai_languageModel">Insert one</a>',
	name: 'notice',
	type: 'notice',
	default: '',
	typeOptions: {
		containerClass: 'ndv-connection-hint-notice',
	},
};

export class LmChatGoogleGemini implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Gemini Chat Model',
		// Keeps backwards compatibility: the node was first published under
		// this name, so it must not be changed.
		name: 'lmChatGoogleGemini',
		icon: 'file:google.svg',
		group: ['transform'],
		version: [1, 1.1],
		description: 'Chat Model Google Gemini',
		defaults: {
			name: 'Google Gemini Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgooglegemini/',
					},
				],
			},
		},
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		inputs: [],
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'googlePalmApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.host }}',
		},
		properties: [
			connectionHintNotice,
			{
				displayName:
					'When using Gemini models, prefer the latest generation (e.g. Gemini 2.5 / 3). Older models may be deprecated by Google at any time.',
				name: 'modelNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'options',
				description:
					'The model which will generate the completion. <a href="https://developers.generativeai.google/models/language">Learn more</a>.',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/v1beta/models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'models',
										},
									},
									{
										type: 'filter',
										properties: {
											// Exclude embedding/image-generation models, and anything
											// older than Gemini 2.5 (1.x, 2.0, and unversioned aliases).
											// Keeps gemini-2.5* and gemini-3+ (and future major versions).
											pass: "={{ /gemini-(2\\.5|[3-9]|\\d\\d)/.test($responseItem.name) && !$responseItem.name.includes('embedding') && !$responseItem.name.includes('imagen') }}",
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{ $responseItem.name }}',
											value: '={{ $responseItem.name }}',
											description: '={{ $responseItem.description }}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: DEFAULT_MODEL_V1,
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'options',
				description:
					'The model which will generate the completion. <a href="https://developers.generativeai.google/models/language">Learn more</a>.',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/v1beta/models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'models',
										},
									},
									{
										type: 'filter',
										properties: {
											// Same 2.5+ floor as the v1 model field above.
											pass: "={{ /gemini-(2\\.5|[3-9]|\\d\\d)/.test($responseItem.name) && !$responseItem.name.includes('embedding') && !$responseItem.name.includes('imagen') }}",
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{ $responseItem.name }}',
											value: '={{ $responseItem.name }}',
											description: '={{ $responseItem.description }}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: DEFAULT_MODEL_V11,
				displayOptions: {
					show: {
						'@version': [{ _cnd: { gte: 1.1 } }],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxOutputTokens',
						default: 1024,
						description: 'The maximum number of tokens to generate in the completion',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls the randomness of the sampling process. A higher temperature creates more diverse sampling, but increases the risk of hallucinations.',
						type: 'number',
					},
					{
						displayName: 'Top K',
						name: 'topK',
						default: 40,
						typeOptions: { maxValue: 40, minValue: -1, numberPrecision: 0 },
						description:
							'Used to remove "long tail" low probability responses. Defaults to -1, which disables it.',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 0.9,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Used to set the cumulative probability cutoff for token selection. Lower values mean sampling from a smaller, more top-weighted nucleus.',
						type: 'number',
					},
					{
						displayName: 'Thinking Level',
						name: 'thinkingLevel',
						type: 'options',
						default: 'HIGH',
						description:
							'Reasoning effort for Gemini 3+ models. Higher levels let the model spend more tokens thinking before it answers. Ignored by models that do not support thinking.',
						options: [
							{ name: 'Minimal', value: 'MINIMAL' },
							{ name: 'Low', value: 'LOW' },
							{ name: 'Medium', value: 'MEDIUM' },
							{ name: 'High', value: 'HIGH' },
						],
					},
					{
						displayName: 'Thinking Budget',
						name: 'thinkingBudget',
						type: 'number',
						default: -1,
						typeOptions: { minValue: -1 },
						description:
							'Gemini 2.5 only — number of tokens the model may spend thinking. Use -1 for a dynamic budget, or 0 to disable thinking. Gemini 3+ models use Thinking Level instead.',
					},
					{
						displayName: 'Include Thoughts',
						name: 'includeThoughts',
						type: 'boolean',
						default: false,
						description:
							'Whether to return thought summaries from the model in the response, when available',
					},
					{
						displayName: 'Stop Sequences',
						name: 'stopSequences',
						type: 'string',
						typeOptions: { multipleValues: true },
						default: [],
						placeholder: 'Add Stop Sequence',
						description:
							'Up to 5 character sequences that stop output generation. A stop sequence is not included in the response.',
					},
					{
						displayName: 'Maximum Retries',
						name: 'maxRetries',
						type: 'number',
						default: 2,
						typeOptions: { minValue: 0 },
						description:
							'Number of times to retry the request on a transient error (rate limits or 5xx) before failing',
					},
					{
						displayName: 'JSON Output',
						name: 'json',
						type: 'boolean',
						default: false,
						description:
							'Whether to force the model to respond with valid JSON. Supported by Gemini 2.5+ models.',
					},
					// Safety settings
					{
						displayName: 'Safety Settings',
						name: 'safetySettings',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {
							values: {
								category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
								threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
							},
						},
						placeholder: 'Add Option',
						options: [
							{
								name: 'values',
								displayName: 'Values',
								values: [
									{
										displayName: 'Safety Category',
										name: 'category',
										type: 'options',
										description: 'The category of harmful content to filter',
										default: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
										options: [
											{
												name: 'Dangerous Content',
												value: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
											},
											{
												name: 'Harassment',
												value: HarmCategory.HARM_CATEGORY_HARASSMENT,
											},
											{
												name: 'Hate Speech',
												value: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
											},
											{
												name: 'Sexually Explicit',
												value: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
											},
										],
									},
									{
										displayName: 'Safety Threshold',
										name: 'threshold',
										type: 'options',
										description: 'The threshold above which content is blocked',
										default: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
										options: [
											{
												name: 'Block Few',
												value: HarmBlockThreshold.BLOCK_ONLY_HIGH,
											},
											{
												name: 'Block Most',
												value: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
											},
											{
												name: 'Block None',
												value: HarmBlockThreshold.BLOCK_NONE,
											},
											{
												name: 'Block Some',
												value: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
											},
										],
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('googlePalmApi');

		const modelName = this.getNodeParameter('modelName', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			maxOutputTokens?: number;
			temperature?: number;
			topK?: number;
			topP?: number;
			stopSequences?: string[];
			maxRetries?: number;
			json?: boolean;
			thinkingLevel?: ThinkingLevel;
			thinkingBudget?: number;
			includeThoughts?: boolean;
			safetySettings?: {
				values?: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>;
			};
		};

		const safetySettings: SafetySetting[] | undefined = options.safetySettings?.values?.map(
			(setting) => ({
				category: setting.category,
				threshold: setting.threshold,
			}),
		);

		// Assemble thinkingConfig from only the keys the user actually set. The API
		// rejects thinkingConfig on models that don't support thinking, so it is
		// omitted entirely when empty.
		const thinkingConfig: ThinkingConfig = {};
		if (options.thinkingLevel) thinkingConfig.thinkingLevel = options.thinkingLevel;
		if (options.thinkingBudget !== undefined) thinkingConfig.thinkingBudget = options.thinkingBudget;
		if (options.includeThoughts !== undefined) thinkingConfig.includeThoughts = options.includeThoughts;
		const hasThinkingConfig = Object.keys(thinkingConfig).length > 0;

		const model = new ChatGoogleGenerativeAI({
			apiKey: credentials.apiKey as string,
			baseUrl: credentials.host as string,
			model: modelName,
			topK: options.topK,
			topP: options.topP,
			temperature: options.temperature,
			maxOutputTokens: options.maxOutputTokens,
			maxRetries: options.maxRetries,
			stopSequences: options.stopSequences,
			json: options.json,
			safetySettings,
			...(hasThinkingConfig ? { thinkingConfig } : {}),
		});

		return {
			response: model,
		};
	}
}
