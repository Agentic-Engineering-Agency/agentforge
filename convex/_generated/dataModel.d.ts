/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  DocumentByName,
  TableNamesInDataModel,
  SystemTableNames,
  AnyDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";

/**
 * A type describing your Convex data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */

export type DataModel = {
  a2aTasks: {
    document: {
      artifacts?: Array<{
        content: string;
        mimeType?: string;
        name?: string;
        type: "text" | "code" | "file" | "data";
      }>;
      callbackUrl?: string;
      completedAt?: number;
      constraints?: {
        maxCost?: number;
        maxTokens?: number;
        timeoutMs?: number;
      };
      context?: any;
      createdAt: number;
      durationMs?: number;
      fromAgentId: string;
      instruction: string;
      output?: string;
      projectId?: Id<"projects">;
      status: "pending" | "running" | "success" | "error" | "timeout";
      taskId: string;
      toAgentId: string;
      usage?: { cost: number; inputTokens: number; outputTokens: number };
      _id: Id<"a2aTasks">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "artifacts"
      | "callbackUrl"
      | "completedAt"
      | "constraints"
      | "constraints.maxCost"
      | "constraints.maxTokens"
      | "constraints.timeoutMs"
      | "context"
      | "createdAt"
      | "durationMs"
      | "fromAgentId"
      | "instruction"
      | "output"
      | "projectId"
      | "status"
      | "taskId"
      | "toAgentId"
      | "usage"
      | "usage.cost"
      | "usage.inputTokens"
      | "usage.outputTokens";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byFromAgentId: ["fromAgentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
      byTaskId: ["taskId", "_creationTime"];
      byToAgentId: ["toAgentId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  agents: {
    document: {
      createdAt: number;
      description?: string;
      failoverModels?: Array<{ model: string; provider: string }>;
      id: string;
      instructions: string;
      isActive: boolean;
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
      updatedAt: number;
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
      _id: Id<"agents">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "description"
      | "failoverModels"
      | "id"
      | "instructions"
      | "isActive"
      | "maxTokens"
      | "model"
      | "name"
      | "projectId"
      | "provider"
      | "sandboxEnabled"
      | "sandboxImage"
      | "temperature"
      | "tools"
      | "topP"
      | "updatedAt"
      | "userId"
      | "workspaceStorage"
      | "workspaceStorage.accessKeyId"
      | "workspaceStorage.basePath"
      | "workspaceStorage.bucket"
      | "workspaceStorage.endpoint"
      | "workspaceStorage.region"
      | "workspaceStorage.secretAccessKey"
      | "workspaceStorage.type";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byActiveUser: ["isActive", "userId", "_creationTime"];
      byAgentId: ["id", "_creationTime"];
      byIsActive: ["isActive", "_creationTime"];
      byProjectAndActive: ["projectId", "isActive", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  apiAccessTokens: {
    document: {
      createdAt: number;
      expiresAt?: number;
      isActive: boolean;
      name: string;
      token: string;
      _id: Id<"apiAccessTokens">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "expiresAt"
      | "isActive"
      | "name"
      | "token";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byToken: ["token", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  apiKeys: {
    document: {
      createdAt: number;
      encryptedKey: string;
      isActive: boolean;
      iv: string;
      keyName: string;
      lastUsedAt?: number;
      provider: string;
      tag?: string;
      userId?: string;
      version?: string;
      _id: Id<"apiKeys">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "encryptedKey"
      | "isActive"
      | "iv"
      | "keyName"
      | "lastUsedAt"
      | "provider"
      | "tag"
      | "userId"
      | "version";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byIsActive: ["isActive", "_creationTime"];
      byProvider: ["provider", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  channelConnections: {
    document: {
      agentId: string;
      channel: string;
      config: {
        botToken?: string;
        botUsername?: string;
        iv?: string;
        salt?: string;
        teamId?: string;
        webhookSecret?: string;
      };
      createdAt: number;
      lastActivity?: number;
      messageCount?: number;
      projectId?: Id<"projects">;
      status: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"channelConnections">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "channel"
      | "config"
      | "config.botToken"
      | "config.botUsername"
      | "config.iv"
      | "config.salt"
      | "config.teamId"
      | "config.webhookSecret"
      | "createdAt"
      | "lastActivity"
      | "messageCount"
      | "projectId"
      | "status"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgent: ["agentId", "_creationTime"];
      byChannel: ["channel", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  channels: {
    document: {
      configuration?: any;
      createdAt: number;
      isEnabled: boolean;
      name: string;
      projectId?: Id<"projects">;
      type: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"channels">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "configuration"
      | "createdAt"
      | "isEnabled"
      | "name"
      | "projectId"
      | "type"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byIsEnabled: ["isEnabled", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byType: ["type", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  cronJobRuns: {
    document: {
      completedAt?: number;
      cronJobId: Id<"cronJobs">;
      error?: string;
      output?: string;
      projectId?: Id<"projects">;
      startedAt: number;
      status: "success" | "failed" | "running";
      _id: Id<"cronJobRuns">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "completedAt"
      | "cronJobId"
      | "error"
      | "output"
      | "projectId"
      | "startedAt"
      | "status";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byCronJobId: ["cronJobId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  cronJobs: {
    document: {
      agentId: string;
      createdAt: number;
      description?: string;
      isEnabled: boolean;
      lastRun?: number;
      metadata?: any;
      name: string;
      nextRun?: number;
      projectId?: Id<"projects">;
      prompt: string;
      schedule: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"cronJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "createdAt"
      | "description"
      | "isEnabled"
      | "lastRun"
      | "metadata"
      | "name"
      | "nextRun"
      | "projectId"
      | "prompt"
      | "schedule"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byIsEnabled: ["isEnabled", "_creationTime"];
      byNextRun: ["nextRun", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  files: {
    document: {
      folderId?: Id<"folders">;
      metadata?: any;
      mimeType: string;
      name: string;
      originalName: string;
      projectId?: Id<"projects">;
      size: number;
      storageId?: string;
      uploadedAt: number;
      url: string;
      userId?: string;
      _id: Id<"files">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "folderId"
      | "metadata"
      | "mimeType"
      | "name"
      | "originalName"
      | "projectId"
      | "size"
      | "storageId"
      | "uploadedAt"
      | "url"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byFolderId: ["folderId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  folders: {
    document: {
      createdAt: number;
      name: string;
      parentId?: Id<"folders">;
      projectId?: Id<"projects">;
      updatedAt: number;
      userId?: string;
      _id: Id<"folders">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "name"
      | "parentId"
      | "projectId"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byParentId: ["parentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  heartbeats: {
    document: {
      agentId: string;
      context: string;
      currentTask?: string;
      lastCheck: number;
      metadata?: any;
      nextCheck: number;
      pendingTasks: Array<string>;
      projectId?: Id<"projects">;
      status: string;
      threadId?: Id<"threads">;
      _id: Id<"heartbeats">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "context"
      | "currentTask"
      | "lastCheck"
      | "metadata"
      | "nextCheck"
      | "pendingTasks"
      | "projectId"
      | "status"
      | "threadId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byNextCheck: ["nextCheck", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  instances: {
    document: {
      agentId: string;
      configuration?: any;
      instanceId: string;
      projectId?: Id<"projects">;
      startedAt: number;
      status: "running" | "stopped" | "error";
      stoppedAt?: number;
      userId?: string;
      _id: Id<"instances">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "configuration"
      | "instanceId"
      | "projectId"
      | "startedAt"
      | "status"
      | "stoppedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byInstanceId: ["instanceId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  logs: {
    document: {
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
      timestamp: number;
      totalTokens?: number;
      userId?: string;
      _id: Id<"logs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "costUsd"
      | "inputTokens"
      | "level"
      | "message"
      | "metadata"
      | "model"
      | "outputTokens"
      | "projectId"
      | "provider"
      | "sessionId"
      | "source"
      | "threadId"
      | "timestamp"
      | "totalTokens"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byLevel: ["level", "_creationTime"];
      byProjectAndTimestamp: ["projectId", "timestamp", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      bySessionId: ["sessionId", "_creationTime"];
      bySource: ["source", "_creationTime"];
      byTimestamp: ["timestamp", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_documents: {
    document: {
      primaryKey: string;
      record: any;
      table: string;
      _id: Id<"mastra_documents">;
      _creationTime: number;
    };
    fieldPaths: "_creationTime" | "_id" | "primaryKey" | "record" | "table";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_table: ["table", "_creationTime"];
      by_table_primary: ["table", "primaryKey", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_messages: {
    document: {
      content: any;
      createdAt: string;
      id?: string;
      resourceId?: string;
      role?: string;
      thread_id?: string;
      type?: string;
      _id: Id<"mastra_messages">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "content"
      | "createdAt"
      | "id"
      | "resourceId"
      | "role"
      | "thread_id"
      | "type";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_record_id: ["id", "_creationTime"];
      by_resource: ["resourceId", "_creationTime"];
      by_thread: ["thread_id", "_creationTime"];
      by_thread_created: ["thread_id", "createdAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_resources: {
    document: {
      createdAt: string;
      id?: string;
      metadata?: string;
      updatedAt: string;
      workingMemory?: string;
      _id: Id<"mastra_resources">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "id"
      | "metadata"
      | "updatedAt"
      | "workingMemory";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_record_id: ["id", "_creationTime"];
      by_updated: ["updatedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_scorers: {
    document: {
      additionalContext?: any;
      analyzePrompt?: string;
      analyzeStepResult?: any;
      createdAt: string;
      entity?: any;
      entityId?: string;
      entityType?: string;
      extractPrompt?: string;
      extractStepResult?: any;
      generateReasonPrompt?: string;
      generateScorePrompt?: string;
      id?: string;
      input?: any;
      metadata?: any;
      output?: any;
      preprocessPrompt?: string;
      preprocessStepResult?: any;
      reason?: string;
      reasonPrompt?: string;
      requestContext?: any;
      resourceId?: string;
      runId?: string;
      score?: number;
      scorer?: any;
      scorerId?: string;
      source?: string;
      spanId?: string;
      threadId?: string;
      traceId?: string;
      updatedAt: string;
      _id: Id<"mastra_scorers">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "additionalContext"
      | "analyzePrompt"
      | "analyzeStepResult"
      | "createdAt"
      | "entity"
      | "entityId"
      | "entityType"
      | "extractPrompt"
      | "extractStepResult"
      | "generateReasonPrompt"
      | "generateScorePrompt"
      | "id"
      | "input"
      | "metadata"
      | "output"
      | "preprocessPrompt"
      | "preprocessStepResult"
      | "reason"
      | "reasonPrompt"
      | "requestContext"
      | "resourceId"
      | "runId"
      | "score"
      | "scorer"
      | "scorerId"
      | "source"
      | "spanId"
      | "threadId"
      | "traceId"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_created: ["createdAt", "_creationTime"];
      by_entity: ["entityId", "entityType", "_creationTime"];
      by_record_id: ["id", "_creationTime"];
      by_run: ["runId", "_creationTime"];
      by_scorer: ["scorerId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_threads: {
    document: {
      createdAt: string;
      id?: string;
      metadata?: string;
      resourceId?: string;
      title?: string;
      updatedAt: string;
      _id: Id<"mastra_threads">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "id"
      | "metadata"
      | "resourceId"
      | "title"
      | "updatedAt";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_created: ["createdAt", "_creationTime"];
      by_record_id: ["id", "_creationTime"];
      by_resource: ["resourceId", "_creationTime"];
      by_updated: ["updatedAt", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_vector_indexes: {
    document: {
      createdAt: string;
      dimension: number;
      id: string;
      indexName: string;
      metric: string;
      _id: Id<"mastra_vector_indexes">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "dimension"
      | "id"
      | "indexName"
      | "metric";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_name: ["indexName", "_creationTime"];
      by_record_id: ["id", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_vectors: {
    document: {
      embedding: Array<number>;
      id: string;
      indexName: string;
      metadata?: any;
      _id: Id<"mastra_vectors">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "embedding"
      | "id"
      | "indexName"
      | "metadata";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_index: ["indexName", "_creationTime"];
      by_index_id: ["indexName", "id", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mastra_workflow_snapshots: {
    document: {
      createdAt: string;
      id?: string;
      resourceId?: string;
      run_id: string;
      snapshot: any;
      updatedAt: string;
      workflow_name: string;
      _id: Id<"mastra_workflow_snapshots">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "id"
      | "resourceId"
      | "run_id"
      | "snapshot"
      | "updatedAt"
      | "workflow_name";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_created: ["createdAt", "_creationTime"];
      by_record_id: ["id", "_creationTime"];
      by_resource: ["resourceId", "_creationTime"];
      by_workflow: ["workflow_name", "_creationTime"];
      by_workflow_run: ["workflow_name", "run_id", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  mcpConnections: {
    document: {
      capabilities?: any;
      createdAt: number;
      credentials?: any;
      isConnected: boolean;
      isEnabled: boolean;
      lastConnectedAt?: number;
      name: string;
      projectId?: Id<"projects">;
      protocol: string;
      serverUrl: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"mcpConnections">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "capabilities"
      | "createdAt"
      | "credentials"
      | "isConnected"
      | "isEnabled"
      | "lastConnectedAt"
      | "name"
      | "projectId"
      | "protocol"
      | "serverUrl"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byIsEnabled: ["isEnabled", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  memoryConsolidations: {
    document: {
      agentId: string;
      createdAt: number;
      projectId?: Id<"projects">;
      resultMemoryId: Id<"memoryEntries">;
      sourceMemoryIds: Array<Id<"memoryEntries">>;
      strategy: "summarize" | "merge" | "deduplicate";
      _id: Id<"memoryConsolidations">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "createdAt"
      | "projectId"
      | "resultMemoryId"
      | "sourceMemoryIds"
      | "strategy";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  memoryEntries: {
    document: {
      accessCount: number;
      agentId: string;
      content: string;
      createdAt: number;
      embedding?: Array<number>;
      expiresAt?: number;
      importance: number;
      lastAccessedAt?: number;
      metadata?: any;
      projectId?: Id<"projects">;
      threadId?: Id<"threads">;
      type: "conversation" | "fact" | "summary" | "episodic";
      updatedAt: number;
      userId?: string;
      _id: Id<"memoryEntries">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessCount"
      | "agentId"
      | "content"
      | "createdAt"
      | "embedding"
      | "expiresAt"
      | "importance"
      | "lastAccessedAt"
      | "metadata"
      | "projectId"
      | "threadId"
      | "type"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentAndProject: ["agentId", "projectId", "_creationTime"];
      byAgentAndType: ["agentId", "type", "_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byCreatedAt: ["createdAt", "_creationTime"];
      byImportance: ["importance", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byThreadId: ["threadId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {
      byEmbedding: {
        vectorField: "embedding";
        dimensions: number;
        filterFields: "agentId" | "projectId" | "type";
      };
    };
  };
  messages: {
    document: {
      content: string;
      createdAt: number;
      metadata?: any;
      projectId?: Id<"projects">;
      role: "user" | "assistant" | "system" | "tool";
      threadId: Id<"threads">;
      tool_calls?: any;
      tool_results?: any;
      _id: Id<"messages">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "content"
      | "createdAt"
      | "metadata"
      | "projectId"
      | "role"
      | "threadId"
      | "tool_calls"
      | "tool_results";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byThread: ["threadId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projectMembers: {
    document: {
      acceptedAt?: number;
      invitedAt: number;
      projectId: Id<"projects">;
      role: "owner" | "editor" | "viewer";
      userId: string;
      _id: Id<"projectMembers">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "acceptedAt"
      | "invitedAt"
      | "projectId"
      | "role"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byProjectAndUser: ["projectId", "userId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  projects: {
    document: {
      agentIds?: Array<string>;
      createdAt: number;
      defaultModel?: string;
      defaultProvider?: string;
      deletedAt?: number;
      description?: string;
      isDefault?: boolean;
      name: string;
      settings?: any;
      systemPrompt?: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"projects">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentIds"
      | "createdAt"
      | "defaultModel"
      | "defaultProvider"
      | "deletedAt"
      | "description"
      | "isDefault"
      | "name"
      | "settings"
      | "systemPrompt"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byUserAndDefault: ["userId", "isDefault", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  researchJobs: {
    document: {
      agentCount: number;
      completedAt?: number;
      createdAt: number;
      depth: "shallow" | "medium" | "deep";
      error?: string;
      findings?: Array<{
        answer: string;
        question: string;
        questionId: string;
      }>;
      projectId?: Id<"projects">;
      questions?: Array<{
        id: string;
        question: string;
        status: "pending" | "running" | "completed" | "failed";
      }>;
      results?: string;
      status: "pending" | "running" | "completed" | "failed";
      synthesis?: string;
      topic: string;
      userId?: string;
      _id: Id<"researchJobs">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentCount"
      | "completedAt"
      | "createdAt"
      | "depth"
      | "error"
      | "findings"
      | "projectId"
      | "questions"
      | "results"
      | "status"
      | "synthesis"
      | "topic"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byCreatedAt: ["createdAt", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  sessions: {
    document: {
      agentId: string;
      channel?: string;
      completedAt?: number;
      lastActivityAt: number;
      metadata?: any;
      projectId?: Id<"projects">;
      sessionId: string;
      startedAt: number;
      status: "active" | "paused" | "completed" | "error";
      threadId: Id<"threads">;
      userId?: string;
      _id: Id<"sessions">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "channel"
      | "completedAt"
      | "lastActivityAt"
      | "metadata"
      | "projectId"
      | "sessionId"
      | "startedAt"
      | "status"
      | "threadId"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      bySessionId: ["sessionId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
      byThreadId: ["threadId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  settings: {
    document: {
      key: string;
      updatedAt: number;
      userId: string;
      value: any;
      _id: Id<"settings">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "key"
      | "updatedAt"
      | "userId"
      | "value";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byUserId: ["userId", "_creationTime"];
      byUserIdAndKey: ["userId", "key", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  skillMarketplace: {
    document: {
      author: string;
      category: string;
      createdAt: number;
      description: string;
      downloads: number;
      featured: boolean;
      name: string;
      readmeContent?: string;
      references?: Array<{ content: string; name: string }>;
      repositoryUrl?: string;
      skillMdContent?: string;
      tags: Array<string>;
      updatedAt: number;
      version: string;
      _id: Id<"skillMarketplace">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "author"
      | "category"
      | "createdAt"
      | "description"
      | "downloads"
      | "featured"
      | "name"
      | "readmeContent"
      | "references"
      | "repositoryUrl"
      | "skillMdContent"
      | "tags"
      | "updatedAt"
      | "version";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      by_category: ["category", "_creationTime"];
      by_downloads: ["downloads", "_creationTime"];
      by_name: ["name", "_creationTime"];
    };
    searchIndexes: {
      search_skills: {
        searchField: "description";
        filterFields: "category";
      };
    };
    vectorIndexes: {};
  };
  skills: {
    document: {
      author?: string;
      category: string;
      code: string;
      createdAt: number;
      description: string;
      displayName: string;
      documentation?: string;
      installedAt?: number;
      isEnabled: boolean;
      isInstalled: boolean;
      name: string;
      projectId?: Id<"projects">;
      repository?: string;
      schema?: any;
      updatedAt: number;
      userId?: string;
      version: string;
      _id: Id<"skills">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "author"
      | "category"
      | "code"
      | "createdAt"
      | "description"
      | "displayName"
      | "documentation"
      | "installedAt"
      | "isEnabled"
      | "isInstalled"
      | "name"
      | "projectId"
      | "repository"
      | "schema"
      | "updatedAt"
      | "userId"
      | "version";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byCategory: ["category", "_creationTime"];
      byIsInstalled: ["isInstalled", "_creationTime"];
      byProjectAndInstalled: ["projectId", "isInstalled", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  threads: {
    document: {
      agentId: string;
      createdAt: number;
      metadata?: any;
      name?: string;
      projectId?: Id<"projects">;
      updatedAt: number;
      userId?: string;
      _id: Id<"threads">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "createdAt"
      | "metadata"
      | "name"
      | "projectId"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  usage: {
    document: {
      agentId: string;
      completionTokens: number;
      cost?: number;
      model: string;
      projectId?: Id<"projects">;
      promptTokens: number;
      provider: string;
      sessionId?: string;
      timestamp: number;
      totalTokens: number;
      userId?: string;
      _id: Id<"usage">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "completionTokens"
      | "cost"
      | "model"
      | "projectId"
      | "promptTokens"
      | "provider"
      | "sessionId"
      | "timestamp"
      | "totalTokens"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byProvider: ["provider", "_creationTime"];
      byTimestamp: ["timestamp", "_creationTime"];
      byUserAndTimestamp: ["userId", "timestamp", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  usageEvents: {
    document: {
      agentId: string;
      costUsd: number;
      inputTokens: number;
      latencyMs?: number;
      metadata?: any;
      model: string;
      outputTokens: number;
      projectId?: string;
      threadId?: string;
      timestamp: number;
      _id: Id<"usageEvents">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "agentId"
      | "costUsd"
      | "inputTokens"
      | "latencyMs"
      | "metadata"
      | "model"
      | "outputTokens"
      | "projectId"
      | "threadId"
      | "timestamp";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byAgentId: ["agentId", "_creationTime"];
      byModel: ["model", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byTimestamp: ["timestamp", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  vault: {
    document: {
      accessCount: number;
      category: string;
      createdAt: number;
      encryptedValue: string;
      expiresAt?: number;
      isActive: boolean;
      iv: string;
      lastAccessedAt?: number;
      maskedValue: string;
      name: string;
      provider?: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"vault">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "accessCount"
      | "category"
      | "createdAt"
      | "encryptedValue"
      | "expiresAt"
      | "isActive"
      | "iv"
      | "lastAccessedAt"
      | "maskedValue"
      | "name"
      | "provider"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byCategory: ["category", "_creationTime"];
      byIsActive: ["isActive", "_creationTime"];
      byProvider: ["provider", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  vaultAuditLog: {
    document: {
      action: string;
      ipAddress?: string;
      source: string;
      timestamp: number;
      userId?: string;
      vaultEntryId: Id<"vault">;
      _id: Id<"vaultAuditLog">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "action"
      | "ipAddress"
      | "source"
      | "timestamp"
      | "userId"
      | "vaultEntryId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byTimestamp: ["timestamp", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
      byVaultEntryId: ["vaultEntryId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  workflowDefinitions: {
    document: {
      createdAt: number;
      description?: string;
      inputSchema?: string;
      isActive: boolean;
      name: string;
      outputSchema?: string;
      projectId?: Id<"projects">;
      steps: string;
      triggers?: string;
      updatedAt: number;
      userId?: string;
      _id: Id<"workflowDefinitions">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "createdAt"
      | "description"
      | "inputSchema"
      | "isActive"
      | "name"
      | "outputSchema"
      | "projectId"
      | "steps"
      | "triggers"
      | "updatedAt"
      | "userId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byIsActive: ["isActive", "_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  workflowRuns: {
    document: {
      completedAt?: number;
      currentStepIndex: number;
      error?: string;
      input?: string;
      output?: string;
      projectId?: Id<"projects">;
      startedAt: number;
      status: "pending" | "running" | "suspended" | "completed" | "failed";
      suspendPayload?: string;
      suspendedAt?: string;
      userId?: string;
      workflowId: Id<"workflowDefinitions">;
      _id: Id<"workflowRuns">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "completedAt"
      | "currentStepIndex"
      | "error"
      | "input"
      | "output"
      | "projectId"
      | "startedAt"
      | "status"
      | "suspendedAt"
      | "suspendPayload"
      | "userId"
      | "workflowId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
      byUserId: ["userId", "_creationTime"];
      byWorkflowId: ["workflowId", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  workflowSteps: {
    document: {
      completedAt?: number;
      error?: string;
      input?: string;
      name: string;
      output?: string;
      projectId?: Id<"projects">;
      runId: Id<"workflowRuns">;
      startedAt?: number;
      status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
        | "suspended";
      stepId: string;
      _id: Id<"workflowSteps">;
      _creationTime: number;
    };
    fieldPaths:
      | "_creationTime"
      | "_id"
      | "completedAt"
      | "error"
      | "input"
      | "name"
      | "output"
      | "projectId"
      | "runId"
      | "startedAt"
      | "status"
      | "stepId";
    indexes: {
      by_id: ["_id"];
      by_creation_time: ["_creationTime"];
      byProjectId: ["projectId", "_creationTime"];
      byRunId: ["runId", "_creationTime"];
      byStatus: ["status", "_creationTime"];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

/**
 * The names of all of your Convex tables.
 */
export type TableNames = TableNamesInDataModel<DataModel>;

/**
 * The type of a document stored in Convex.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/using/document-ids).
 *
 * Documents can be loaded using `db.get(tableName, id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 */
export type Id<TableName extends TableNames | SystemTableNames> =
  GenericId<TableName>;
