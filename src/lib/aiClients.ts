import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const deepseek = new OpenAI({ 
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
});
export const grok = new OpenAI({ 
    baseURL: 'https://api.grok.ai/v1',
    apiKey: process.env.GROK_API_KEY,
});