import {genkit, modelRef} from 'genkit';
import {openAICompatible} from '@genkit-ai/compat-oai';

const openRouterModelName =
  process.env.OPENROUTER_MODEL || 'openrouter/meta-llama-3.1-70b-instruct';

export const openRouterModel = modelRef({
  name: openRouterModelName,
});

export const ai = genkit({
  plugins: [
    openAICompatible({
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
    }),
  ],
  model: openRouterModel,
});
