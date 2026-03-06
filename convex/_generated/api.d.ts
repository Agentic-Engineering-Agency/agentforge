/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  agents: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: string;
        instructions: string;
        maxTokens?: number;
        model: string;
        name: string;
        projectId?: Id<"projects">;
        provider: string;
        sandboxEnabled?: boolean;
        sandboxImage?: string;
        temperature?: number;
        tools?: any;
        topP?: number;
        userId?: string;
        workspaceStorage?: {
          accessKeyId?: string;
          basePath?: string;
          bucket?: string;
          endpoint?: string;
          region?: string;
          secretAccessKey?: string;
          type: "local" | "s3" | "r2";
        };
      },
      any
    >;
    get: FunctionReference<"query", "public", { id: string }, any>;
    list: FunctionReference<
      "query",
      "public",
      { projectId?: Id<"projects">; userId?: string },
      any
    >;
    listActive: FunctionReference<
      "query",
      "public",
      { projectId?: Id<"projects">; userId?: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: string }, any>;
    run: FunctionReference<
      "action",
      "public",
      {
        agentId: string;
        prompt: string;
        threadId?: Id<"threads">;
        userId?: string;
      },
      any
    >;
    toggleActive: FunctionReference<"mutation", "public", { id: string }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: string;
        instructions?: string;
        isActive?: boolean;
        maxTokens?: number;
        model?: string;
        name?: string;
        projectId?: Id<"projects">;
        provider?: string;
        sandboxEnabled?: boolean;
        sandboxImage?: string;
        temperature?: number;
        tools?: any;
        topP?: number;
        workspaceStorage?: {
          accessKeyId?: string;
          basePath?: string;
          bucket?: string;
          endpoint?: string;
          region?: string;
          secretAccessKey?: string;
          type: "local" | "s3" | "r2";
        };
      },
      any
    >;
  };
  analytics: {
    getDashboardStats: FunctionReference<"query", "public", {}, any>;
    getUsageSummary: FunctionReference<
      "query",
      "public",
      { days: number },
      any
    >;
  };
  apiAccessTokens: {
    generate: FunctionReference<
      "mutation",
      "public",
      { expiresAt?: number; name: string },
      any
    >;
    list: FunctionReference<"query", "public", {}, any>;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"apiAccessTokens"> },
      any
    >;
    revoke: FunctionReference<
      "mutation",
      "public",
      { id: Id<"apiAccessTokens"> },
      any
    >;
  };
  apiAccessTokensActions: {
    generate: FunctionReference<
      "action",
      "public",
      { agentId?: string; name: string },
      any
    >;
  };
  apiKeyActions: {
    testKey: FunctionReference<
      "action",
      "public",
      { keyValue: string; provider: string },
      any
    >;
  };
  apiKeys: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        encryptedKey: string;
        keyName: string;
        provider: string;
        userId?: string;
      },
      any
    >;
    get: FunctionReference<"query", "public", { id: Id<"apiKeys"> }, any>;
    getActiveForProvider: FunctionReference<
      "query",
      "public",
      { provider: string; userId?: string },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { provider?: string; userId?: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: Id<"apiKeys"> }, any>;
    toggleActive: FunctionReference<
      "mutation",
      "public",
      { id: Id<"apiKeys"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        encryptedKey?: string;
        id: Id<"apiKeys">;
        isActive?: boolean;
        keyName?: string;
      },
      any
    >;
    updateLastUsed: FunctionReference<
      "mutation",
      "public",
      { id: Id<"apiKeys"> },
      any
    >;
  };
  channelConnections: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        botToken: string;
        botUsername?: string;
        channel: string;
        projectId?: Id<"projects">;
        teamId?: string;
        userId?: string;
        webhookSecret?: string;
      },
      any
    >;
    getById: FunctionReference<
      "query",
      "public",
      { id: Id<"channelConnections"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { agentId?: string; channel?: string; userId?: string },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"channelConnections"> },
      any
    >;
    updateActivity: FunctionReference<
      "mutation",
      "public",
      { id: Id<"channelConnections">; messageCount?: number },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      { id: Id<"channelConnections">; status: string },
      any
    >;
  };
  config: {
    getConfig: FunctionReference<
      "query",
      "public",
      { agentId: string; projectId?: Id<"projects">; userId?: string },
      any
    >;
  };
  cronJobs: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        description?: string;
        metadata?: any;
        name: string;
        projectId?: Id<"projects">;
        prompt: string;
        schedule: string;
        userId?: string;
      },
      any
    >;
    get: FunctionReference<"query", "public", { id: Id<"cronJobs"> }, any>;
    getDueJobs: FunctionReference<"query", "public", {}, any>;
    getRunHistory: FunctionReference<
      "query",
      "public",
      { cronJobId: Id<"cronJobs">; limit?: number },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        agentId?: string;
        isEnabled?: boolean;
        projectId?: Id<"projects">;
        userId?: string;
      },
      any
    >;
    recordRun: FunctionReference<
      "mutation",
      "public",
      {
        cronJobId: Id<"cronJobs">;
        error?: string;
        output?: string;
        status: "success" | "failed" | "running";
      },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"cronJobs"> },
      any
    >;
    toggleEnabled: FunctionReference<
      "mutation",
      "public",
      { id: Id<"cronJobs"> },
      any
    >;
    triggerNow: FunctionReference<
      "mutation",
      "public",
      { id: Id<"cronJobs"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: Id<"cronJobs">;
        isEnabled?: boolean;
        metadata?: any;
        name?: string;
        prompt?: string;
        schedule?: string;
      },
      any
    >;
    updateLastRun: FunctionReference<
      "mutation",
      "public",
      { id: Id<"cronJobs">; nextRun: number },
      any
    >;
    updateRun: FunctionReference<
      "mutation",
      "public",
      {
        error?: string;
        output?: string;
        runId: Id<"cronJobRuns">;
        status: "success" | "failed" | "running";
      },
      any
    >;
  };
  files: {
    confirmUpload: FunctionReference<
      "mutation",
      "public",
      {
        folderId?: Id<"folders">;
        metadata?: any;
        mimeType: string;
        name: string;
        originalName: string;
        projectId?: Id<"projects">;
        size: number;
        storageId: Id<"_storage">;
        userId?: string;
      },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        folderId?: Id<"folders">;
        metadata?: any;
        mimeType: string;
        name: string;
        originalName: string;
        projectId?: Id<"projects">;
        size: number;
        url: string;
        userId?: string;
      },
      any
    >;
    generateUploadUrl: FunctionReference<"mutation", "public", any, any>;
    get: FunctionReference<"query", "public", { id: Id<"files"> }, any>;
    getDownloadUrl: FunctionReference<
      "query",
      "public",
      { id: Id<"files"> },
      any
    >;
    getFileUrl: FunctionReference<
      "query",
      "public",
      { storageId: string },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { folderId?: Id<"folders">; projectId?: Id<"projects">; userId?: string },
      any
    >;
    moveToFolder: FunctionReference<
      "mutation",
      "public",
      { folderId?: Id<"folders">; id: Id<"files"> },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: Id<"files"> }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      {
        folderId?: Id<"folders">;
        id: Id<"files">;
        metadata?: any;
        name?: string;
      },
      any
    >;
  };
  folders: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        name: string;
        parentId?: Id<"folders">;
        projectId?: Id<"projects">;
        userId?: string;
      },
      any
    >;
    get: FunctionReference<"query", "public", { id: Id<"folders"> }, any>;
    list: FunctionReference<
      "query",
      "public",
      { parentId?: Id<"folders">; projectId?: Id<"projects">; userId?: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: Id<"folders"> }, any>;
    update: FunctionReference<
      "mutation",
      "public",
      { id: Id<"folders">; name?: string; parentId?: Id<"folders"> },
      any
    >;
  };
  heartbeat: {
    addPendingTask: FunctionReference<
      "mutation",
      "public",
      { agentId: string; task: string; threadId?: Id<"threads"> },
      any
    >;
    generateContext: FunctionReference<
      "action",
      "public",
      { agentId: string; threadId: Id<"threads"> },
      any
    >;
    get: FunctionReference<
      "query",
      "public",
      { agentId: string; threadId?: Id<"threads"> },
      any
    >;
    getDueForCheck: FunctionReference<"query", "public", {}, any>;
    listActive: FunctionReference<
      "query",
      "public",
      { projectId?: Id<"projects">; userId?: string },
      any
    >;
    processCheck: FunctionReference<
      "action",
      "public",
      { agentId: string; threadId?: Id<"threads"> },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { agentId: string; threadId?: Id<"threads"> },
      any
    >;
    removePendingTask: FunctionReference<
      "mutation",
      "public",
      { agentId: string; task: string; threadId?: Id<"threads"> },
      any
    >;
    updateContext: FunctionReference<
      "mutation",
      "public",
      { agentId: string; context: string; threadId?: Id<"threads"> },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        currentTask?: string;
        status: string;
        threadId?: Id<"threads">;
      },
      any
    >;
    upsert: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        checkIntervalMs?: number;
        context: string;
        currentTask?: string;
        metadata?: any;
        pendingTasks: Array<string>;
        projectId?: Id<"projects">;
        status: string;
        threadId?: Id<"threads">;
      },
      any
    >;
  };
  logs: {
    add: FunctionReference<
      "mutation",
      "public",
      {
        agentId?: string;
        costUsd?: number;
        inputTokens?: number;
        level: "debug" | "info" | "warn" | "error";
        message: string;
        metadata?: any;
        model?: string;
        outputTokens?: number;
        projectId?: Id<"projects">;
        provider?: string;
        sessionId?: string;
        source: string;
        threadId?: Id<"threads">;
        totalTokens?: number;
        userId?: string;
      },
      any
    >;
    clearOld: FunctionReference<
      "mutation",
      "public",
      { olderThan: number },
      any
    >;
    getBySessionId: FunctionReference<
      "query",
      "public",
      { sessionId: string },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        level?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId?: Id<"projects">;
        source?: string;
      },
      any
    >;
  };
  mastra: {
    storage: {
      handle: FunctionReference<"mutation", "public", any, any>;
    };
  };
  mcpConnectionActions: {
    testConnection: FunctionReference<
      "action",
      "public",
      { id: Id<"mcpConnections"> },
      any
    >;
  };
  mcpConnections: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        capabilities?: any;
        credentials?: any;
        name: string;
        projectId?: Id<"projects">;
        protocol: string;
        serverUrl: string;
        userId?: string;
      },
      any
    >;
    executeToolCall: FunctionReference<
      "action",
      "public",
      { id: Id<"mcpConnections">; toolArgs?: any; toolName: string },
      any
    >;
    get: FunctionReference<
      "query",
      "public",
      { id: Id<"mcpConnections"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { isEnabled?: boolean; projectId?: Id<"projects">; userId?: string },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"mcpConnections"> },
      any
    >;
    toggleEnabled: FunctionReference<
      "mutation",
      "public",
      { id: Id<"mcpConnections"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        capabilities?: any;
        credentials?: any;
        id: Id<"mcpConnections">;
        isEnabled?: boolean;
        name?: string;
        serverUrl?: string;
      },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      { id: Id<"mcpConnections">; isConnected: boolean },
      any
    >;
  };
  messages: {
    add: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        projectId?: Id<"projects">;
        role: "user" | "assistant" | "system" | "tool";
        threadId: Id<"threads">;
        tool_calls?: any;
      },
      any
    >;
    clearThread: FunctionReference<
      "mutation",
      "public",
      { threadId: Id<"threads"> },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        content: string;
        projectId?: Id<"projects">;
        role: "user" | "assistant" | "system" | "tool";
        threadId: Id<"threads">;
        tool_calls?: any;
      },
      any
    >;
    getByThread: FunctionReference<
      "query",
      "public",
      { threadId: Id<"threads"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        threadId: Id<"threads">;
      },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"messages"> },
      any
    >;
  };
  projects: {
    assignAgent: FunctionReference<
      "mutation",
      "public",
      { agentId: string; id: Id<"projects"> },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      { description?: string; name: string; settings?: any; userId?: string },
      any
    >;
    get: FunctionReference<"query", "public", { id: Id<"projects"> }, any>;
    getAgents: FunctionReference<
      "query",
      "public",
      { id: Id<"projects"> },
      any
    >;
    getAllAgents: FunctionReference<"query", "public", {}, any>;
    list: FunctionReference<"query", "public", { userId?: string }, any>;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"projects"> },
      any
    >;
    unassignAgent: FunctionReference<
      "mutation",
      "public",
      { agentId: string; id: Id<"projects"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: Id<"projects">;
        name?: string;
        settings?: any;
      },
      any
    >;
    updateSettings: FunctionReference<
      "mutation",
      "public",
      {
        defaultModel?: string;
        defaultProvider?: string;
        id: Id<"projects">;
        systemPrompt?: string;
      },
      any
    >;
  };
  research: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        agentCount: number;
        depth: "shallow" | "medium" | "deep";
        projectId?: Id<"projects">;
        topic: string;
        userId?: string;
      },
      any
    >;
    createInternal: FunctionReference<
      "mutation",
      "public",
      {
        agentCount: number;
        depth: "shallow" | "medium" | "deep";
        projectId?: Id<"projects">;
        topic: string;
        userId?: string;
      },
      any
    >;
    get: FunctionReference<
      "query",
      "public",
      { jobId: Id<"researchJobs"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        projectId?: Id<"projects">;
        status?: "pending" | "running" | "completed" | "failed";
        userId?: string;
      },
      any
    >;
    start: FunctionReference<
      "action",
      "public",
      {
        depth: "shallow" | "medium" | "deep";
        projectId?: Id<"projects">;
        topic: string;
        userId?: string;
      },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        completedAt?: number;
        error?: string;
        findings?: Array<{
          answer: string;
          question: string;
          questionId: string;
        }>;
        jobId: Id<"researchJobs">;
        questions?: Array<{
          id: string;
          question: string;
          status: "pending" | "running" | "completed" | "failed";
        }>;
        results?: string;
        status?: "pending" | "running" | "completed" | "failed";
        synthesis?: string;
      },
      any
    >;
  };
  sessions: {
    bulkUpdateStatus: FunctionReference<
      "mutation",
      "public",
      { status: string },
      any
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        channel?: string;
        metadata?: any;
        projectId?: Id<"projects">;
        sessionId: string;
        threadId: Id<"threads">;
        userId?: string;
      },
      any
    >;
    endSession: FunctionReference<
      "mutation",
      "public",
      { sessionId: string },
      any
    >;
    get: FunctionReference<"query", "public", { sessionId?: string }, any>;
    getWithMessages: FunctionReference<
      "query",
      "public",
      { sessionId?: string },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        agentId?: string;
        projectId?: Id<"projects">;
        status?: string;
        userId?: string;
      },
      any
    >;
    listActive: FunctionReference<"query", "public", { userId?: string }, any>;
    remove: FunctionReference<
      "mutation",
      "public",
      { sessionId?: string },
      any
    >;
    updateActivity: FunctionReference<
      "mutation",
      "public",
      { metadata?: any; sessionId: string },
      any
    >;
    updateStatus: FunctionReference<
      "mutation",
      "public",
      {
        sessionId: string;
        status: "active" | "paused" | "completed" | "error";
      },
      any
    >;
  };
  settings: {
    get: FunctionReference<
      "query",
      "public",
      { key: string; userId: string },
      any
    >;
    list: FunctionReference<"query", "public", { userId?: string }, any>;
    remove: FunctionReference<
      "mutation",
      "public",
      { key: string; userId: string },
      any
    >;
    set: FunctionReference<
      "mutation",
      "public",
      { key: string; userId: string; value: any },
      any
    >;
  };
  skillMarketplace: {
    getFeaturedSkills: FunctionReference<"query", "public", {}, any>;
    getSkill: FunctionReference<"query", "public", { name: string }, any>;
    incrementDownloads: FunctionReference<
      "mutation",
      "public",
      { name: string },
      any
    >;
    install: FunctionReference<
      "mutation",
      "public",
      { skillName: string; version?: string },
      any
    >;
    listSkills: FunctionReference<
      "query",
      "public",
      { category?: string; query?: string },
      any
    >;
    publishSkill: FunctionReference<
      "mutation",
      "public",
      {
        author: string;
        category: string;
        description: string;
        name: string;
        readmeContent?: string;
        repositoryUrl?: string;
        skillMdContent: string;
        tags: Array<string>;
        version: string;
      },
      any
    >;
  };
  skills: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        author?: string;
        category: string;
        code: string;
        description: string;
        displayName: string;
        documentation?: string;
        name: string;
        repository?: string;
        schema?: any;
        userId?: string;
        version: string;
      },
      any
    >;
    get: FunctionReference<"query", "public", { id: Id<"skills"> }, any>;
    install: FunctionReference<"mutation", "public", { id: Id<"skills"> }, any>;
    list: FunctionReference<
      "query",
      "public",
      { category?: string; isInstalled?: boolean; userId?: string },
      any
    >;
    listInstalled: FunctionReference<
      "query",
      "public",
      { userId?: string },
      any
    >;
    remove: FunctionReference<"mutation", "public", { id: Id<"skills"> }, any>;
    toggleEnabled: FunctionReference<
      "mutation",
      "public",
      { id: Id<"skills"> },
      any
    >;
    uninstall: FunctionReference<
      "mutation",
      "public",
      { id: Id<"skills"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        code?: string;
        description?: string;
        displayName?: string;
        id: Id<"skills">;
        schema?: any;
        version?: string;
      },
      any
    >;
  };
  threads: {
    createThread: FunctionReference<
      "mutation",
      "public",
      { agentId: string; name?: string; projectId?: Id<"projects"> },
      any
    >;
    deleteThread: FunctionReference<
      "mutation",
      "public",
      { threadId: Id<"threads"> },
      any
    >;
    getThread: FunctionReference<
      "query",
      "public",
      { threadId: Id<"threads"> },
      any
    >;
    getThreadMessages: FunctionReference<
      "query",
      "public",
      { threadId: Id<"threads"> },
      any
    >;
    listThreads: FunctionReference<"query", "public", {}, any>;
    rename: FunctionReference<
      "mutation",
      "public",
      { name: string; threadId: Id<"threads"> },
      any
    >;
  };
  usage: {
    cleanup: FunctionReference<
      "mutation",
      "public",
      { olderThan: number },
      any
    >;
    getByTimePeriod: FunctionReference<
      "query",
      "public",
      { period: "day" | "week" | "month"; userId?: string },
      any
    >;
    getStats: FunctionReference<
      "query",
      "public",
      {
        agentId?: string;
        endTime?: number;
        startTime?: number;
        userId?: string;
      },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      {
        agentId?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        projectId?: Id<"projects">;
        provider?: string;
        userId?: string;
      },
      any
    >;
    record: FunctionReference<
      "mutation",
      "public",
      {
        agentId: string;
        completionTokens: number;
        cost?: number;
        model: string;
        projectId?: Id<"projects">;
        promptTokens: number;
        provider: string;
        sessionId?: string;
        totalTokens: number;
        userId?: string;
      },
      any
    >;
  };
  vault: {
    censorMessage: FunctionReference<
      "mutation",
      "public",
      { autoStore?: boolean; text: string; userId?: string },
      any
    >;
    detectSecrets: FunctionReference<"query", "public", { text: string }, any>;
    getAuditLog: FunctionReference<
      "query",
      "public",
      { limit?: number; vaultEntryId?: Id<"vault"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { category?: string; userId?: string },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"vault">; userId?: string },
      any
    >;
    store: FunctionReference<
      "mutation",
      "public",
      {
        category: string;
        expiresAt?: number;
        name: string;
        provider?: string;
        userId?: string;
        value: string;
      },
      any
    >;
    storeFromChat: FunctionReference<
      "mutation",
      "public",
      {
        category: string;
        name: string;
        provider?: string;
        userId?: string;
        value: string;
      },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        expiresAt?: number;
        id: Id<"vault">;
        isActive?: boolean;
        name?: string;
        userId?: string;
        value?: string;
      },
      any
    >;
  };
  workflows: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        inputSchema?: string;
        name: string;
        outputSchema?: string;
        projectId?: Id<"projects">;
        steps: string;
        triggers?: string;
        userId?: string;
      },
      any
    >;
    createRun: FunctionReference<
      "mutation",
      "public",
      {
        input?: string;
        projectId?: Id<"projects">;
        userId?: string;
        workflowId: Id<"workflowDefinitions">;
      },
      any
    >;
    createStep: FunctionReference<
      "mutation",
      "public",
      {
        input?: string;
        name: string;
        projectId?: Id<"projects">;
        runId: Id<"workflowRuns">;
        stepId: string;
      },
      any
    >;
    get: FunctionReference<
      "query",
      "public",
      { id: Id<"workflowDefinitions"> },
      any
    >;
    getRun: FunctionReference<
      "query",
      "public",
      { id: Id<"workflowRuns"> },
      any
    >;
    getRunSteps: FunctionReference<
      "query",
      "public",
      { runId: Id<"workflowRuns"> },
      any
    >;
    list: FunctionReference<
      "query",
      "public",
      { isActive?: boolean; projectId?: Id<"projects">; userId?: string },
      any
    >;
    listRuns: FunctionReference<
      "query",
      "public",
      {
        projectId?: Id<"projects">;
        status?: "pending" | "running" | "suspended" | "completed" | "failed";
        workflowId?: Id<"workflowDefinitions">;
      },
      any
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"workflowDefinitions"> },
      any
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        description?: string;
        id: Id<"workflowDefinitions">;
        inputSchema?: string;
        isActive?: boolean;
        name?: string;
        outputSchema?: string;
        projectId?: Id<"projects">;
        steps?: string;
        triggers?: string;
      },
      any
    >;
    updateRun: FunctionReference<
      "mutation",
      "public",
      {
        completedAt?: number;
        currentStepIndex?: number;
        error?: string;
        id: Id<"workflowRuns">;
        output?: string;
        status?: "pending" | "running" | "suspended" | "completed" | "failed";
        suspendPayload?: string;
        suspendedAt?: string;
      },
      any
    >;
    updateStep: FunctionReference<
      "mutation",
      "public",
      {
        completedAt?: number;
        error?: string;
        id: Id<"workflowSteps">;
        output?: string;
        startedAt?: number;
        status?:
          | "pending"
          | "running"
          | "completed"
          | "failed"
          | "skipped"
          | "suspended";
      },
      any
    >;
  };
};

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: {
  apiAccessTokens: {
    insertToken: FunctionReference<
      "mutation",
      "internal",
      { name: string; token: string },
      any
    >;
  };
  apiKeys: {
    getDecryptedForProvider: FunctionReference<
      "action",
      "internal",
      { provider: string },
      string | null
    >;
    getEncryptedKeyForProvider: FunctionReference<
      "query",
      "internal",
      { provider: string },
      any
    >;
  };
  apiKeysCrypto: {
    decryptApiKey: FunctionReference<
      "action",
      "internal",
      { ciphertext: string; iv: string; tag: string },
      string
    >;
    encryptApiKey: FunctionReference<
      "action",
      "internal",
      { plaintext: string },
      { ciphertext: string; iv: string; tag: string; version: "aes-gcm-v1" }
    >;
  };
  channelConnections: {
    getDecryptedBotToken: FunctionReference<
      "query",
      "internal",
      { connectionId: Id<"channelConnections"> },
      any
    >;
  };
  context: {
    summarizeAction: FunctionReference<
      "action",
      "internal",
      {
        apiKey: string;
        limit?: number;
        provider: string;
        threadId: Id<"threads">;
      },
      any
    >;
    summarizeContext: FunctionReference<
      "action",
      "internal",
      {
        apiKey: string;
        limit?: number;
        provider: string;
        threadId: Id<"threads">;
      },
      any
    >;
  };
  cronJobs: {
    executeDueJobs: FunctionReference<"mutation", "internal", {}, any>;
    executeJob: FunctionReference<
      "action",
      "internal",
      { jobId: Id<"cronJobs">; runId: Id<"cronJobRuns"> },
      any
    >;
  };
  heartbeatActions: {
    executeTask: FunctionReference<
      "action",
      "internal",
      { agentId: string; task: string; threadId?: Id<"threads"> },
      any
    >;
  };
  lib: {
    seedMarketplace: {
      seedMarketplace: FunctionReference<"mutation", "internal", {}, any>;
    };
  };
  migrations: {
    addProjectScoping: {
      backfillProjectIds: FunctionReference<"mutation", "internal", {}, any>;
      createDefaultProjects: FunctionReference<"mutation", "internal", {}, any>;
    };
    migrateProjectScoping: FunctionReference<"mutation", "internal", {}, any>;
    validateProjectScoping: FunctionReference<"mutation", "internal", {}, any>;
  };
  vault: {
    retrieveSecret: FunctionReference<
      "mutation",
      "internal",
      { id: Id<"vault">; userId?: string },
      any
    >;
  };
  workflowEngine: {
    executeWorkflow: FunctionReference<
      "action",
      "internal",
      { runId: Id<"workflowRuns"> },
      any
    >;
  };
};

export declare const components: {};
