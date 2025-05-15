import { openai, anthropic, gemini } from './aiClients';

export async function evaluateWithModel(model: any, prompt: string): Promise<any> {
    try {
        switch (model.provider) {
            case 'openai':
            case 'deepseek':
            case 'grok': {
                const openaiResponse = await openai.chat.completions.create({
                    model: model.name,
                    messages: [{ role: 'user', content: prompt }],
                });
                if (
                    !openaiResponse ||
                    !openaiResponse.choices ||
                    !openaiResponse.choices[0] ||
                    !openaiResponse.choices[0].message ||
                    typeof openaiResponse.choices[0].message.content !== 'string'
                ) {
                    throw new Error('Respuesta inválida de OpenAI');
                }
                return openaiResponse.choices[0].message.content;
            }
            case 'anthropic': {
                const anthropicResponse = await anthropic.messages.create({
                    model: model.name,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 100,
                });
                if (!anthropicResponse || typeof anthropicResponse !== 'string') {
                    throw new Error('Respuesta inválida de Anthropic');
                }
                return anthropicResponse;
            }
            case 'gemini': {
                const result = await gemini.models.generateContentStream({ model: model.name, contents: prompt });
                let chunks = [];
                for await (const chunk of result) {
                    if (chunk && typeof chunk.text === 'string') {
                        chunks.push(chunk.text);
                    }
                }
                if (!chunks.length) {
                    throw new Error('Respuesta vacía de Gemini');
                }
                return chunks.join('');
            }
            default:
                throw new Error(`Proveedor no soportado: ${model.provider}`);
        }
    } catch (error: any) {
        console.error('Error en evaluateWithModel:', error);
        return `ERROR: ${error.message || error}`;
    }
}

export async function evaluateWithFakeModel(model: any, prompt: string): Promise<any> {
    return '4';
}