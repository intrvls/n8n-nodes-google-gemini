import { ChatGoogleGenerativeAI } from '@intrvls/langchain-google-genai';
import type { SafetySetting } from '@google/genai';
import { HarmBlockThreshold, HarmCategory } from '@google/genai';
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
											// Exclude embedding and image-generation only models.
											pass: "={{ !$responseItem.name.includes('embedding') && !$responseItem.name.includes('imagen') }}",
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
											pass: "={{ !$responseItem.name.includes('embedding') && !$responseItem.name.includes('imagen') }}",
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

		const model = new ChatGoogleGenerativeAI({
			apiKey: credentials.apiKey as string,
			baseUrl: credentials.host as string,
			model: modelName,
			topK: options.topK,
			topP: options.topP,
			temperature: options.temperature,
			maxOutputTokens: options.maxOutputTokens,
			safetySettings,
		});

		return {
			response: model,
		};
	}
}
