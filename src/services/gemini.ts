import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiResponse {
  text: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  isSensitive?: boolean;
  suggestedMood?: number;
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  private generateSystemPrompt(context: string): string {
    return `You are Ava, a compassionate and supportive AI assistant for Serene Space, a mental health support platform. Your role is to provide emotional support, active listening, and gentle guidance.

Guidelines:
- Be warm, empathetic, and non-judgmental
- Use trauma-informed language (avoid triggering words)
- Don't provide medical diagnoses or replace professional therapy
- Encourage healthy coping strategies
- Respect user privacy and boundaries
- Keep responses concise but meaningful
- Use soft, calming language

Context: ${context}

Remember: You are a supportive companion, not a therapist. Always prioritize user safety and wellbeing.`;
  }

  async generateResponse(message: string, conversationHistory: Array<{role: string, content: string}> = [], userMood?: number): Promise<GeminiResponse> {
    try {
      const context = userMood ? `User's current mood: ${userMood}/5` : 'User seeking emotional support';
      const systemPrompt = this.generateSystemPrompt(context);

      const chat = this.model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...conversationHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
        },
      });

      const result = await chat.sendMessage(message);
      const response = result.response;
      const text = response.text();

      // Analyze sentiment and sensitivity
      const sentiment = this.analyzeSentiment(text);
      const isSensitive = this.detectSensitiveContent(text);
      const suggestedMood = this.suggestMood(text, userMood);

      return {
        text,
        sentiment,
        isSensitive,
        suggestedMood
      };

    } catch (error) {
      console.error('Error generating Gemini response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async analyzeMessage(message: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    isSensitive: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedMood?: number;
  }> {
    try {
      const analysisPrompt = `Analyze this message for emotional content and potential risk factors. Respond with a JSON object containing:
      - sentiment: "positive", "negative", or "neutral"
      - isSensitive: boolean (contains sensitive topics like self-harm, abuse, etc.)
      - riskLevel: "low", "medium", or "high"
      - suggestedMood: number 1-5 (if applicable)

Message: "${message}"

Respond only with the JSON object.`;

      const result = await this.model.generateContent(analysisPrompt);
      const response = result.response.text();
      
      try {
        return JSON.parse(response);
      } catch {
        // Fallback analysis
        return {
          sentiment: this.analyzeSentiment(message),
          isSensitive: this.detectSensitiveContent(message),
          riskLevel: 'low',
          suggestedMood: undefined
        };
      }
    } catch (error) {
      console.error('Error analyzing message:', error);
      return {
        sentiment: 'neutral',
        isSensitive: false,
        riskLevel: 'low'
      };
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['happy', 'good', 'great', 'better', 'hopeful', 'grateful', 'calm', 'peaceful'];
    const negativeWords = ['sad', 'angry', 'anxious', 'depressed', 'hopeless', 'worried', 'stressed', 'overwhelmed'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private detectSensitiveContent(text: string): boolean {
    const sensitiveKeywords = [
      'suicide', 'self-harm', 'kill myself', 'end my life',
      'abuse', 'trauma', 'assault', 'violence',
      'addiction', 'overdose'
    ];
    
    const lowerText = text.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerText.includes(keyword));
  }

  private suggestMood(text: string, currentMood?: number): number | undefined {
    // Simple mood suggestion based on content
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('better') || lowerText.includes('improved')) {
      return Math.min(5, (currentMood || 3) + 1);
    }
    
    if (lowerText.includes('worse') || lowerText.includes('difficult')) {
      return Math.max(1, (currentMood || 3) - 1);
    }
    
    return undefined;
  }

  async generateSummary(messages: Array<{content: string, sender: string}>): Promise<string> {
    try {
      const conversation = messages.map(msg => `${msg.sender}: ${msg.content}`).join('\n');
      const summaryPrompt = `Summarize this conversation in 2-3 sentences, focusing on the emotional journey and key topics discussed:

${conversation}

Provide a compassionate and insightful summary.`;

      const result = await this.model.generateContent(summaryPrompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Conversation summary unavailable';
    }
  }
}

let geminiServiceInstance: GeminiService | null = null;

export const getGeminiService = (): GeminiService => {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
};

export default getGeminiService;
