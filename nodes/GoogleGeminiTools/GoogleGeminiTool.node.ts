import {
	NodeConnectionTypes,
	type INodePropertyOptions,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

/**
 * Built-in (server-side) Gemini tools
 * ----------------------------------------------------------------------------
 * Gemini's `googleSearch`, `urlContext`, etc. are *server-side* tools: plain
 * config objects (e.g. `{ googleSearch: {} }`) that Gemini executes itself and
 * folds into its answer. Unlike normal n8n tools there is no function for the
 * Agent to call back into — so this node is a deliberately "dummy" emitter that
 * just supplies the chosen config object.
 *
 * How it flows end-to-end (verified against the installed libs):
 *   1. The node returns the bare config object as its AiTool `response`.
 *   2. n8n's `getConnectedTools` passes it through untouched (it only rewrites
 *      tools that carry a `schema`). It DOES enforce unique tool names, so each
 *      object carries a distinct `name` — otherwise two built-in tools both read
 *      as `undefined` and collide. (Hence: add one node per tool TYPE.)
 *   3. The Agent hands every connected tool to `model.bindTools(...)`. The
 *      langchain-google-genai wrapper routes anything *without* a `name`+`schema`
 *      pair into its native-tool branch, merging it with the real function tools
 *      as a sibling of `functionDeclarations` in a single request.
 *   4. The @google/genai serializer copies only known keys (`googleSearch`,
 *      `urlContext`, ...) into the request, so the extra `name`/`description` we
 *      attach for n8n's benefit are stripped before the API ever sees them.
 *
 * IMPORTANT: the emitted object must NOT carry a `schema`. A `schema` would make
 * the wrapper treat it as a client-side function declaration (slotting it INTO
 * `functionDeclarations`) instead of the native server-side tool.
 */

/**
 * The built-in tool types. Each value is, by design, the exact key on the
 * @google/genai `Tool` interface — so the dropdown value doubles as the config
 * key we emit.
 */
type BuiltinToolType = 'googleSearch' | 'urlContext' | 'codeExecution';

interface BuiltinToolSpec {
	/** Label shown in the Tool dropdown. */
	displayName: string;
	/** Tool name the Agent sees; must be unique among connected tools. */
	toolName: string;
	/** Passed through as the tool description (and shown in the dropdown hint). */
	description: string;
	/** Documentation link for the built-in tool. */
	docsUrl: string;
}

/** Registry of supported built-in tools, keyed by their @google/genai field. */
const BUILTIN_TOOLS: Record<BuiltinToolType, BuiltinToolSpec> = {
	googleSearch: {
		displayName: 'Google Search',
		toolName: 'google_search',
		description: 'Ground answers with live Google Search results (server-side)',
		docsUrl: 'https://ai.google.dev/gemini-api/docs/google-search',
	},
	urlContext: {
		displayName: 'URL Context',
		toolName: 'url_context',
		description: 'Fetch and read URLs mentioned in the prompt to ground answers (server-side)',
		docsUrl: 'https://ai.google.dev/gemini-api/docs/url-context',
	},
	codeExecution: {
		displayName: 'Code Execution',
		toolName: 'code_execution',
		description: 'Run Python in a sandbox to compute answers (server-side)',
		docsUrl: 'https://ai.google.dev/gemini-api/docs/code-execution',
	},
};

const DEFAULT_TOOL: BuiltinToolType = 'googleSearch';

/** Dropdown options generated from the registry, so adding a tool is one entry. */
const toolOptions: INodePropertyOptions[] = (Object.keys(BUILTIN_TOOLS) as BuiltinToolType[]).map(
	(key) => ({
		name: BUILTIN_TOOLS[key].displayName,
		value: key,
		description: BUILTIN_TOOLS[key].description,
	}),
);

/**
 * Notice shown on the node explaining it only works wired into an AI Agent.
 * Inlined (rather than importing n8n internals) so the community package stays
 * dependency-light, mirroring the model node's own notice.
 */
const connectionHintNotice: INodeProperties = {
	displayName:
		'This node must be connected to an AI Agent. <a data-action="openSelectiveNodeCreator" data-action-parameter-connectiontype="ai_tool">Insert one</a>',
	name: 'notice',
	type: 'notice',
	default: '',
	typeOptions: {
		containerClass: 'ndv-connection-hint-notice',
	},
};

/**
 * A single drag-and-drop node for Gemini's server-side built-in tools. Pick the
 * tool via the `Tool` dropdown; add one node per tool to combine several (each
 * type emits a distinct name, so they don't collide in the Agent).
 */
export class GoogleGeminiTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Gemini Tool',
		name: 'googleGeminiTool',
		icon: 'file:google.svg',
		group: ['transform'],
		version: 1,
		description: 'Enable a server-side Gemini built-in tool (Google Search, URL Context, ...)',
		defaults: {
			name: 'Google Gemini Built-in Tool (@google/genai)',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
				Tools: ['Other Tools'],
			},
		},
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		inputs: [],
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [
			connectionHintNotice,
			{
				displayName: 'Tool',
				name: 'tool',
				type: 'options',
				noDataExpression: true,
				default: DEFAULT_TOOL,
				description: 'Which built-in Gemini tool to enable. Add one node per tool.',
				options: toolOptions,
			},
			{
				displayName:
					'This is a server-side Gemini tool: the model runs it itself and there is nothing else to configure. Connect it to a Gemini-backed AI Agent and it is enabled automatically. Only works with Google Gemini models.',
				name: 'builtinNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	/**
	 * Supplies the bare built-in tool config object for the chosen type.
	 * `name`/`description` exist only to satisfy n8n's tool plumbing and are
	 * stripped by the @google/genai serializer before the request is sent.
	 */
	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const type = this.getNodeParameter('tool', itemIndex) as BuiltinToolType;
		const spec = BUILTIN_TOOLS[type];

		return {
			response: {
				[type]: {},
				name: spec.toolName,
				description: spec.description,
			},
		};
	}
}
