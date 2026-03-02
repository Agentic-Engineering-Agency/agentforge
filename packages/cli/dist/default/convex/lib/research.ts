"use node";

/**
 * Research Orchestrator for AgentForge
 *
 * Provides multi-agent research orchestration without depending on @agentforge-ai/core.
 * Uses the local Agent implementation for LLM calls.
 */

import { Agent } from "./agent";

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
    const baseConfig = {
      id: "research-agent",
      name: "Research Agent",
      instructions: this.getResearchInstructions(),
      model: {
        providerId,
        modelId,
        apiKey,
        url,
      },
      temperature: 0.7,
      maxTokens: 2000,
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
    baseConfig: Omit<AgentConfig, "id" | "name">,
    topic: string
  ): Promise<string[]> {
    const agent = new Agent({ ...baseConfig, id: "question-gen", name: "Question Generator" });

    const prompt = `Generate ${this.agentCount} specific research questions about: "${topic}"

Each question should:
- Explore a different aspect of the topic
- Be answerable with available information
- Help build a comprehensive understanding

Output ONLY a JSON array of question strings. No other text.`;

    const result = await agent.generate([{ role: "user", content: prompt }]);

    // Try to parse JSON from the response
    const text = result.text.trim();
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch {
      // Fallback: extract lines that look like questions
      return text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(/^[-*•]\d*\s*/, "").replace(/^\d+[\.)]\s*/, "").trim())
        .slice(0, this.agentCount);
    }
  }

  private async answerQuestion(
    baseConfig: Omit<AgentConfig, "id" | "name">,
    question: string,
    topic: string
  ): Promise<string> {
    const agent = new Agent({ ...baseConfig, id: "researcher", name: "Researcher" });

    const prompt = `Research Question: ${question}

Context: We are researching "${topic}"

Provide a comprehensive answer based on your knowledge. Include:
- Direct answer to the question
- Key facts and details
- Relevant context
- Any important caveats or limitations`;

    const result = await agent.generate([{ role: "user", content: prompt }]);
    return result.text.trim();
  }

  private async synthesizeFindings(
    baseConfig: Omit<AgentConfig, "id" | "name">,
    topic: string,
    findings: Array<{ question: string; answer: string }>
  ): Promise<string> {
    const agent = new Agent({ ...baseConfig, id: "synthesizer", name: "Synthesizer" });

    const findingsText = findings
      .map((f, i) => `Q${i + 1}: ${f.question}\nA: ${f.answer}`)
      .join("\n\n---\n\n");

    const prompt = `Synthesize the following research findings about "${topic}" into a comprehensive report.

${findingsText}

Your synthesis should:
1. Provide an executive summary
2. Identify key themes and patterns
3. Highlight important insights
4. Note any gaps or contradictions
5. Suggest areas for further investigation`;

    const result = await agent.generate([{ role: "user", content: prompt }]);
    return result.text.trim();
  }

  private async generateFollowUpQuestions(
    baseConfig: Omit<AgentConfig, "id" | "name">,
    topic: string,
    synthesis: string
  ): Promise<string[]> {
    const agent = new Agent({ ...baseConfig, id: "followup-gen", name: "Follow-up Generator" });

    const prompt = `Based on the following research synthesis about "${topic}", generate 3-5 insightful follow-up questions that would deepen understanding.

Research Synthesis:
${synthesis}

Output ONLY a JSON array of question strings. No other text.`;

    const result = await agent.generate([{ role: "user", content: prompt }]);

    // Try to parse JSON from the response
    const text = result.text.trim();
    try {
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch {
      // Fallback: extract lines
      return text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(/^[-*•]\d*\s*/, "").replace(/^\d+[\.)]\s*/, "").trim())
        .slice(0, 5);
    }
  }
}

// Re-export AgentConfig for convenience
export type { AgentConfig } from "./agent";
