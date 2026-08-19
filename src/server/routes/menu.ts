import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'postCreate',
        form: {
          title: 'Create a Valcordia Space post',
          description: 'Each post is its own galaxy — stars, economy, and leaderboard are per-post.',
          acceptLabel: 'Create',
          fields: [
            {
              type: 'string',
              name: 'title',
              label: 'Post title',
              defaultValue: 'spacehunt',
              required: true,
            },
          ],
        },
      },
    },
    200
  );
});
