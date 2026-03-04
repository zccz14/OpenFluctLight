import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * 灵魂表
 */
export const souls = sqliteTable('souls', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata', { mode: 'json' }),
});

/**
 * 记忆表
 */
export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  soulId: text('soul_id').notNull().references(() => souls.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').notNull(), // 'experience' | 'knowledge' | 'conversation' | 'relationship_note'
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata', { mode: 'json' }),
});

/**
 * 灵魂拷问表
 */
export const interrogations = sqliteTable('interrogations', {
  id: text('id').primaryKey(),
  soulId: text('soul_id').notNull().references(() => souls.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer'),
  source: text('source').notNull(), // 'predefined' | 'auto_discovered'
  confidence: real('confidence').notNull().default(0),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
  relatedMemoryIds: text('related_memory_ids', { mode: 'json' }).notNull(), // string[]
});

/**
 * 人际关系表
 */
export const relationships = sqliteTable('relationships', {
  id: text('id').primaryKey(),
  soulId: text('soul_id').notNull().references(() => souls.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull(),
  targetType: text('target_type').notNull(), // 'soul' | 'external'
  lastInteraction: integer('last_interaction', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata', { mode: 'json' }),
});
