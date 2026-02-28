/**
 * @module orchestrator
 *
 * Deep Research Mode — parallel multi-agent research orchestration.
 *
 * Coordinates multiple research agents to investigate a topic from different
 * angles and synthesizes findings into a comprehensive report.
 */

import { Agent as MastraAgent } from '@mastra/core/agent';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Research depth levels controlling how many parallel agents are spawned.
 */
export type ResearchDepth = 'shallow' | 'standard' | 'deep';

/**
 * Configuration for the research orchestrator.
 */
export interface ResearchConfig {
  /** The research topic/question to investigate. */
  topic: string;
  /** Depth of research — controls number of parallel agents. */
  depth: ResearchDepth;
}

/**
 * Agent configuration for LLM provider settings.
 */
export interface ResearchAgentConfig {
  providerId: string;
  modelId: string;
  apiKey: string;
  url?: string;
}

/**
 * A single research question to investigate.
 */
export interface ResearchQuestion {
  id: string;
  question: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Research finding from a single agent.
 */
export interface ResearchFinding {
  questionId: string;
  question: string;
  answer: string;
  sources?: string[];
}

/**
 * Complete research report with all findings and synthesis.
 */
export interface ResearchReport {
  topic: string;
  depth: ResearchDepth;
  questions: ResearchQuestion[];
  findings: ResearchFinding[];
  synthesis: string;
  timestamp: number;
}

// ─── ResearchOrchestrator ───────────────────────────────────────────────────────

/**
 * Orchestrates parallel multi-agent research on a given topic.
 *
 * @example
 * ```ts
 * const orch = new ResearchOrchestrator({ topic: 'AI agents', depth: 'standard' });
 * const report = await orch.run({
 *   providerId: 'openai',
 *   modelId: 'gpt-4o-mini',
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 * console.log(report.synthesis);
 * ```
 */
export class ResearchOrchestrator {
  readonly topic: string;
  readonly depth: ResearchDepth;
  readonly agentCount: number;

  constructor(config: ResearchConfig) {
    this.topic = config.topic;
    this.depth = config.depth;
    this.agentCount = this._getAgentCount(config.depth);
  }

  /**
   * Run the full research workflow:
   * 1. Planning: Break topic into sub-questions
   * 2. Research: Parallel agents investigate each question
   * 3. Synthesis: Combine all findings into a coherent report
   *
   * @param agentConfig - LLM provider configuration for research agents.
   * @returns Complete research report with findings and synthesis.
   */
  async run(agentConfig: ResearchAgentConfig): Promise<ResearchReport> {
    const timestamp = Date.now();

    // Step 1: Planning — generate research questions
    const questions = await this._plannerStep(agentConfig);

    // Step 2: Research — parallel investigation
    const findings = await this._researchStep(questions, agentConfig);

    // Step 3: Synthesis — combine findings
    const synthesis = await this._synthesisStep(findings, agentConfig);

    return {
      topic: this.topic,
      depth: this.depth,
      questions,
      findings,
      synthesis,
      timestamp,
    };
  }

  // ─── Private Steps ─────────────────────────────────────────────────────────────

  /**
   * Step 1: Generate research questions based on the topic.
   */
  private async _plannerStep(agentConfig: ResearchAgentConfig): Promise<ResearchQuestion[]> {
    const planner = new MastraAgent({
      id: 'research-planner',
      name: 'Research Planner',
      instructions: `You are a research planner. Break down research topics into specific, answerable questions.

Given a topic, generate ${this.agentCount} distinct research questions that cover different aspects of the topic.

Return ONLY a JSON array of objects with this exact format:
[
  {"id": "q1", "question": "..."},
  {"id": "q2", "question": "..."},
  ...
]`,
      model: {
        providerId: agentConfig.providerId,
        modelId: agentConfig.modelId,
        apiKey: agentConfig.apiKey,
        ...(agentConfig.url && { url: agentConfig.url }),
      },
    });

    const response = await planner.generate([
      {
        role: 'user',
        content: `Generate ${this.agentCount} research questions for the topic: "${this.topic}"`,
      },
    ]);

    try {
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from planner response');
      }
      const questions = JSON.parse(jsonMatch[0]);

      return questions.map((q: any) => ({
        id: q.id || `q-${Math.random().toString(36).slice(2, 8)}`,
        question: q.question,
        status: 'pending' as const,
      }));
    } catch (err) {
      // Fallback to default questions if JSON parsing fails
      return Array.from({ length: this.agentCount }, (_, i) => ({
        id: `q${i + 1}`,
        question: `What are the key aspects of "${this.topic}" (perspective ${i + 1})?`,
        status: 'pending' as const,
      }));
    }
  }

  /**
   * Step 2: Parallel research on all questions.
   */
  private async _researchStep(
    questions: ResearchQuestion[],
    agentConfig: ResearchAgentConfig
  ): Promise<ResearchFinding[]> {
    const researchAgents = questions.map((q, i) => ({
      id: q.id,
      question: q.question,
      agent: new MastraAgent({
        id: `researcher-${i + 1}`,
        name: `Researcher ${i + 1}`,
        instructions: `You are a research agent. Investigate the assigned question thoroughly and provide a detailed, accurate answer.

Focus on:
- Factual accuracy
- Specific examples and evidence
- Current state of knowledge (as of 2024)
- Multiple perspectives where relevant

Cite any sources mentioned in your response.`,
        model: {
          providerId: agentConfig.providerId,
          modelId: agentConfig.modelId,
          apiKey: agentConfig.apiKey,
          ...(agentConfig.url && { url: agentConfig.url }),
        },
      }),
    }));

    // Run all research agents in parallel
    const results = await Promise.allSettled(
      researchAgents.map(async ({ id, question, agent }) => {
        const response = await agent.generate([
          {
            role: 'user',
            content: `Research this question: "${question}"`,
          },
        ]);

        return {
          questionId: id,
          question,
          answer: response.text,
        };
      })
    );

    return results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        questionId: questions[i].id,
        question: questions[i].question,
        answer: `Research failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      };
    });
  }

  /**
   * Step 3: Synthesize all findings into a coherent report.
   */
  private async _synthesisStep(
    findings: ResearchFinding[],
    agentConfig: ResearchAgentConfig
  ): Promise<string> {
    const synthesizer = new MastraAgent({
      id: 'research-synthesizer',
      name: 'Research Synthesizer',
      instructions: `You are a research synthesizer. Combine multiple research findings into a comprehensive, well-structured report.

Your report should:
1. Start with an executive summary
2. Present key findings organized by theme
3. Highlight consensus and disagreements
4. Identify gaps or areas needing further research
5. Conclude with actionable insights

Use markdown formatting for readability.`,
      model: {
        providerId: agentConfig.providerId,
        modelId: agentConfig.modelId,
        apiKey: agentConfig.apiKey,
        ...(agentConfig.url && { url: agentConfig.url }),
      },
    });

    const findingsText = findings
      .map((f) => `## Question: ${f.question}\n\n${f.answer}\n`)
      .join('\n---\n\n');

    const response = await synthesizer.generate([
      {
        role: 'user',
        content: `Synthesize these research findings into a comprehensive report on the topic: "${this.topic}"\n\n${findingsText}`,
      },
    ]);

    return response.text;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private _getAgentCount(depth: ResearchDepth): number {
    switch (depth) {
      case 'shallow':
        return 3;
      case 'standard':
        return 5;
      case 'deep':
        return 10;
      default:
        return 5;
    }
  }
}
