import { useQuery } from "@tanstack/react-query";

// Fetch user avatar function
export const fetchUserAvatar = async (username) => {
  if (!username) {
    throw new Error("Username is required");
  }

  const response = await fetch(
    `/.netlify/functions/user-avatar?username=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch avatar: ${response.status}`);
  }

  const result = await response.json();

  return {
    hasAvatar: result.hasAvatar,
    avatarUrl: result.hasAvatar ? result.avatar.avatarUrl : null,
    username: username,
  };
};

// Custom hook for user avatar with React Query caching
export const useUserAvatar = (username) => {
  return useQuery({
    // Unique query key for each username
    queryKey: ["avatar", username],

    // Query function
    queryFn: () => fetchUserAvatar(username),

    // Only run query if username exists
    enabled: !!username,

    // Cache settings optimized for avatars
    staleTime: 5 * 60 * 1000, // 5 minutes - avatars don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer

    // Retry settings
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Don't refetch on window focus for avatars
    refetchOnWindowFocus: false,

    // Don't refetch on reconnect unless data is stale
    refetchOnReconnect: true,

    // Error handling
    onError: (error) => {
      console.warn(`Failed to fetch avatar for ${username}:`, error);
    },
  });
};

export default useUserAvatar;
