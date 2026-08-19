import { reddit } from '@devvit/web/server';

export const createPost = async (title?: string) => {
  const trimmed = title?.trim();
  return await reddit.submitCustomPost({
    title: trimmed && trimmed.length > 0 ? trimmed : 'spacehunt',
  });
};
