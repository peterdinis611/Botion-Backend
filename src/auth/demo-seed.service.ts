import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.provider';
import type { DrizzleDB } from '../drizzle/drizzle.provider';
import { notebooks, notes, notesToTags, notifications, tags } from '../drizzle/schema';
import * as crypto from 'crypto';

const BLOCK_PREFIX = '__BOTION_BLOCKS:v1__';

function blockContent(
  blocks: Array<{
    type: string;
    content?: string;
    props?: Record<string, unknown>;
  }>,
): string {
  return BLOCK_PREFIX + JSON.stringify(blocks);
}

@Injectable()
export class DemoSeedService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  seedWorkspace(userId: string): void {
    const researchId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const welcomeNoteId = crypto.randomUUID();
    const meetingNoteId = crypto.randomUUID();
    const briefNoteId = crypto.randomUUID();
    const ideasTagId = crypto.randomUUID();
    const launchTagId = crypto.randomUUID();

    this.db
      .insert(notebooks)
      .values([
        {
          id: researchId,
          name: 'Research',
          userId,
          color: '#e8f5f3',
          sortOrder: 0,
          folderId: null,
        },
        {
          id: productId,
          name: 'Product',
          userId,
          color: '#f5e6d8',
          sortOrder: 1,
          folderId: null,
        },
      ])
      .run();

    this.db
      .insert(tags)
      .values([
        {
          id: ideasTagId,
          name: 'ideas',
          userId,
          color: '#b8860b',
          notebookId: null,
          sortOrder: 0,
        },
        {
          id: launchTagId,
          name: 'launch',
          userId,
          color: '#0d9488',
          notebookId: productId,
          sortOrder: 0,
        },
      ])
      .run();

    this.db
      .insert(notes)
      .values([
        {
          id: welcomeNoteId,
          title: '👋 Welcome to Botion',
          userId,
          notebookId: null,
          color: '#ffffff',
          isArchived: false,
          isPinned: true,
          sortOrder: 0,
          content: blockContent([
            {
              type: 'heading',
              props: { level: 2 },
              content: 'Your demo workspace',
            },
            {
              type: 'paragraph',
              content:
                'This account is pre-filled with sample pages so you can explore notes, tags, and the Snaps panel right away.',
            },
            {
              type: 'heading',
              props: { level: 2 },
              content: 'Try this',
            },
            { type: 'bulletListItem', content: 'Edit this page or create a new one' },
            { type: 'bulletListItem', content: 'Open Snaps on the right to pin references' },
            { type: 'bulletListItem', content: 'Use ⌘K to search across your workspace' },
          ]),
        },
        {
          id: meetingNoteId,
          title: 'Meeting notes',
          userId,
          notebookId: researchId,
          color: '#ffffff',
          isArchived: false,
          isPinned: false,
          sortOrder: 0,
          content: blockContent([
            { type: 'heading', props: { level: 2 }, content: 'Agenda' },
            { type: 'bulletListItem', content: 'Review product roadmap' },
            { type: 'bulletListItem', content: 'Discuss launch timeline' },
            { type: 'heading', props: { level: 2 }, content: 'Action items' },
            { type: 'bulletListItem', content: 'You — share brief with team' },
          ]),
        },
        {
          id: briefNoteId,
          title: 'Product brief',
          userId,
          notebookId: productId,
          color: '#ffffff',
          isArchived: false,
          isPinned: false,
          sortOrder: 0,
          content: blockContent([
            { type: 'heading', props: { level: 2 }, content: 'Problem' },
            {
              type: 'paragraph',
              content:
                'Teams juggle docs, research, and tasks across too many tools.',
            },
            { type: 'heading', props: { level: 2 }, content: 'Success' },
            {
              type: 'paragraph',
              content: 'One calm workspace for writing, planning, and references.',
            },
          ]),
        },
      ])
      .run();

    this.db
      .insert(notesToTags)
      .values([
        { noteId: welcomeNoteId, tagId: ideasTagId },
        { noteId: briefNoteId, tagId: launchTagId },
        { noteId: briefNoteId, tagId: ideasTagId },
      ])
      .run();

    this.db
      .insert(notifications)
      .values({
        id: crypto.randomUUID(),
        userId,
        type: 'SYSTEM',
        message:
          'Welcome to your demo workspace — sample pages are ready. Sign up anytime to keep your work.',
        metadata: JSON.stringify({ demo: true }),
        isRead: false,
      })
      .run();
  }
}
