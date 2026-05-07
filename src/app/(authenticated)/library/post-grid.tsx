// Server component — renders a responsive grid of PostCards.
// Used for both initial server render and appended client-side rows.

import type { LibraryPost } from '@/lib/queries/library-posts';
import { PostCard } from './post-card';

interface PostGridProps {
  posts: LibraryPost[];
}

export function PostGrid({ posts }: PostGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
