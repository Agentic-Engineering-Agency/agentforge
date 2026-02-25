import { z } from 'zod';

// =====================================================
// Slack Configuration
// =====================================================

export const slackConfigSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required').startsWith('xoxb-', 'Bot token must start with xoxb-'),
  appToken: z.string().min(1, 'App token is required').startsWith('xapp-', 'App token must start with xapp-'),
  signingSecret: z.string().min(1, 'Signing secret is required'),
  socketMode: z.boolean().default(true),
  port: z.number().int().min(1).max(65535).default(3002),
});

export type SlackConfig = z.infer<typeof slackConfigSchema>;

// =====================================================
// Slack Message Types
// =====================================================

export interface SlackMessage {
  type: string;
  subtype?: string;
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  blocks?: SlackBlock[];
  files?: SlackFile[];
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
  size: number;
}

// =====================================================
// Slack Event Types
// =====================================================

export interface SlackEvent {
  type: string;
  event_ts: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
  command?: string;
}

// =====================================================
// Slack Block Kit Types
// =====================================================

export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackActionsBlock
  | SlackHeaderBlock
  | SlackContextBlock
  | SlackImageBlock;

export interface SlackSectionBlock {
  type: 'section';
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackBlockElement;
  block_id?: string;
}

export interface SlackDividerBlock {
  type: 'divider';
  block_id?: string;
}

export interface SlackActionsBlock {
  type: 'actions';
  elements: SlackBlockElement[];
  block_id?: string;
}

export interface SlackHeaderBlock {
  type: 'header';
  text: SlackTextObject;
  block_id?: string;
}

export interface SlackContextBlock {
  type: 'context';
  elements: (SlackTextObject | SlackImageElement)[];
  block_id?: string;
}

export interface SlackImageBlock {
  type: 'image';
  image_url: string;
  alt_text: string;
  title?: SlackTextObject;
  block_id?: string;
}

export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export type SlackBlockElement =
  | SlackButtonElement
  | SlackImageElement
  | SlackOverflowElement;

export interface SlackButtonElement {
  type: 'button';
  text: SlackTextObject;
  action_id: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
}

export interface SlackImageElement {
  type: 'image';
  image_url: string;
  alt_text: string;
}

export interface SlackOverflowElement {
  type: 'overflow';
  action_id: string;
  options: Array<{
    text: SlackTextObject;
    value: string;
  }>;
}
