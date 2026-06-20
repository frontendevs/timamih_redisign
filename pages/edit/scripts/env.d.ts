/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ANTHROPIC_API_KEY: string;
	readonly VITE_OPENAI_API_KEY: string;
	readonly VITE_GOOGLE_AI_KEY: string;
	readonly VITE_GH_CLIENT_ID: string;
	readonly VITE_GH_OAUTH_WORKER: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
