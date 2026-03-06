"use node";

/**
 * Research Orchestrator for AgentForge
 *
 * Provides multi-agent research orchestration without depending on @agentforge-ai/core.
 * Uses the local Agent implementation for LLM calls.
 */

// Agent removed — using callLLM() helper below
export interface AgentConfig { provider: string; modelId?: string; apiKey: string; instructions?: string; }

async function callLLM(config: AgentConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.modelId ?? "gpt-4o-mini", messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]}),
  });
  const d = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content ?? "";
}

export interface ResearchConfig {
  topic: string;
  depth: "shallow" | "medium" | "deep";
}

export interface ResearchOptions {
  providerId: string;
  modelId: string;
  apiKey: string;
  url?: string;
}

export interface ResearchResult {
  findings: Array<{ question: string; answer: string; sources?: string[] }>;
  synthesis: string;
  questions: string[];
}

/**
 * ResearchOrchestrator — Multi-agent research coordinator.
 *
 * Coordinates multiple agent instances to research a topic from different angles.
 */
export class ResearchOrchestrator {
  private readonly config: ResearchConfig;
  private readonly agentCount: number;

  constructor(config: ResearchConfig) {
    this.config = config;
    this.agentCount = config.depth === "shallow" ? 3 : config.depth === "medium" ? 5 : 10;
  }

  /**
   * Run research using the provided LLM configuration.
   */
  async run(options: ResearchOptions): Promise<ResearchResult> {
    const { topic, depth } = this.config;
    const { providerId, modelId, apiKey, url } = options;

    // Create base agent configuration
    const baseConfig: AgentConfig = {
      provider: providerId,
      modelId,
      apiKey,
      instructions: this.getResearchInstructions(),
    };

    // Step 1: Generate research questions
    const researchQuestions = await this.generateQuestions(baseConfig, topic);
    const questions = researchQuestions.slice(0, this.agentCount);

    // Step 2: Research each question
    const findings: Array<{ question: string; answer: string; sources?: string[] }> = [];

    for (const question of questions) {
      try {
        const answer = await this.answerQuestion(baseConfig, question, topic);
        findings.push({ question, answer });
      } catch (error) {
        findings.push({
          question,
          answer: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // Step 3: Synthesize findings
    const synthesis = await this.synthesizeFindings(baseConfig, topic, findings);

    // Step 4: Generate follow-up questions
    const followUpQuestions = await this.generateFollowUpQuestions(baseConfig, topic, synthesis);

    return {
      findings,
      synthesis,
      questions: followUpQuestions,
    };
  }

  private getResearchInstructions(): string {
    return `You are a research assistant. Your task is to:
1. Investigate the given topic thoroughly
2. Provide accurate, factual information
3. Cite sources when possible
4. Identify key insights and patterns
5. Highlight areas of uncertainty or controversy

Be thorough but concise. Focus on the most important information.`;
  }

  private async generateQuestions(
    baseConfig: AgentConfig,
    topic: string
  ): Promise<string[]> {
    const prompt = `Generate 5 research questions about: ${topic}`;
    return await callLLM(baseConfig, baseConfig.instructions ?? "", prompt);
  }

  private async answerQuestion(
    baseConfig: AgentConfig,
    question: string,
    topic: string
  ): Promise<string> {
    const prompt = `Answer this research question about ${topic}: ${question}`;
    return await callLLM(baseConfig, baseConfig.instructions ?? "", prompt);
  }

  private async synthesizeFindings(
    baseConfig: AgentConfig,
    topic: string,
    findings: Array<{ question: string; answer: string }>
  ): Promise<string> {
    const prompt = `Synthesize findings about ${topic}`;
    return await callLLM(baseConfig, baseConfig.instructions ?? "", prompt);
  }

  private async generateFollowUpQuestions(
    baseConfig: AgentConfig,
    topic: string,
    synthesis: string
  ): Promise<string[]> {
    const prompt = `Based on synthesis about ${topic}, suggest 3 follow-up questions: ${synthesis}`;
    return await callLLM(baseConfig, baseConfig.instructions ?? "", prompt);

  }
}
