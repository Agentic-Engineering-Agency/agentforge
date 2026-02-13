import { z } from 'zod';

/**
 * Schema descriptor for tool listing.
 */
export interface ToolSchema {
  /** The unique name of the tool. */
  name: string;
  /** A human-readable description of the tool. */
  description?: string;
  /** JSON Schema representation of the input. */
  inputSchema: Record<string, unknown>;
  /** JSON Schema representation of the output. */
  outputSchema: Record<string, unknown>;
}

/**
 * Represents a tool that can be registered and executed by the MCP server.
 *
 * @typeParam TInput - The Zod schema type for the tool's input.
 * @typeParam TOutput - The Zod schema type for the tool's output.
 */
export interface Tool<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** The unique name of the tool. */
  name: string;
  /** A human-readable description of the tool. */
  description?: string;
  /** The Zod schema for the tool's input. */
  inputSchema: TInput;
  /** The Zod schema for the tool's output. */
  outputSchema: TOutput;
  /**
   * The function that implements the tool's logic.
   * @param input - The validated input matching the input schema.
   * @returns A promise that resolves with the tool's output.
   */
  handler: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

/**
 * A server that implements the Model Context Protocol (MCP) for tool communication.
 *
 * Provides a central registry for tools that agents can discover and invoke.
 * All tool inputs and outputs are validated against their Zod schemas.
 *
 * @example
 * ```typescript
 * const server = new MCPServer();
 *
 * server.registerTool({
 *   name: 'add',
 *   description: 'Adds two numbers',
 *   inputSchema: z.object({ a: z.number(), b: z.number() }),
 *   outputSchema: z.number(),
 *   handler: async ({ a, b }) => a + b,
 * });
 *
 * const result = await server.callTool('add', { a: 5, b: 3 });
 * // result === 8
 * ```
 */
export class MCPServer {
  private tools: Map<string, Tool> = new Map();

  /**
   * Registers a new tool with the MCP server.
   *
   * @param tool - The tool definition to register.
   * @throws {Error} If a tool with the same name is already registered.
   */
  public registerTool<
    TInput extends z.ZodTypeAny,
    TOutput extends z.ZodTypeAny,
  >(tool: Tool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered.`);
    }
    this.tools.set(tool.name, tool as unknown as Tool);
  }

  /**
   * Retrieves a list of all registered tools and their schemas.
   *
   * @returns An array of tool schema descriptors.
   */
  public listTools(): ToolSchema[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.zodToJsonSchema(tool.inputSchema),
      outputSchema: this.zodToJsonSchema(tool.outputSchema),
    }));
  }

  /**
   * Invokes a specified tool with the provided input.
   *
   * @param toolName - The name of the tool to invoke.
   * @param input - The input to the tool (will be validated against the schema).
   * @returns A promise that resolves with the validated result.
   * @throws {Error} If the tool is not found or input/output validation fails.
   */
  public async callTool(toolName: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool with name '${toolName}' not found.`);
    }

    const parsedInput = tool.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new Error(
        `Invalid input for tool '${toolName}': ${parsedInput.error.message}`
      );
    }

    const result = await tool.handler(parsedInput.data);

    const parsedOutput = tool.outputSchema.safeParse(result);
    if (!parsedOutput.success) {
      throw new Error(
        `Invalid output from tool '${toolName}': ${parsedOutput.error.message}`
      );
    }

    return parsedOutput.data;
  }

  /**
   * Converts a Zod schema to a simplified JSON Schema representation.
   * @param schema - The Zod schema to convert.
   * @returns A simplified JSON Schema object.
   */
  private zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    // Simple conversion - in production, use zod-to-json-schema
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = { type: this.getZodTypeName(value as z.ZodTypeAny) };
      }
      return { type: 'object', properties };
    }
    return { type: this.getZodTypeName(schema) };
  }

  /**
   * Gets the type name for a Zod schema.
   */
  private getZodTypeName(schema: z.ZodTypeAny): string {
    if (schema instanceof z.ZodString) return 'string';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodArray) return 'array';
    if (schema instanceof z.ZodObject) return 'object';
    return 'unknown';
  }
}
