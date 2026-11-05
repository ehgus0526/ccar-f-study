import SharedBoard from "@/components/SharedBoard";
import { pageMember } from "@/lib/auth";
import { listComments, listPosts } from "@/lib/store";
import { postPhotoPath } from "@/lib/photos";

export default async function SharedPage() {
  const member = await pageMember();
  const [posts, comments] = await Promise.all([listPosts(), listComments()]);
  return (
    <SharedBoard
      member={member}
      posts={posts.map((post) => ({
        ...post,
        photo_url: postPhotoPath(post.photo_key),
      }))}
      comments={comments}
    />
  );
}
