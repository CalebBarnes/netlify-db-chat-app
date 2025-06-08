import { useQuery } from '@tanstack/react-query'

// Fetch DM conversations function
export const fetchDMConversations = async (username) => {
  if (!username) {
    throw new Error("Username is required");
  }

  const response = await fetch(
    `/.netlify/functions/direct-messages?username=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch conversations: ${response.status}`);
  }

  const conversations = await response.json();
  return conversations;
};

// React Query hook for DM conversations
export const useDMConversations = (username) => {
  return useQuery({
    queryKey: ['dm-conversations', username],
    queryFn: () => fetchDMConversations(username),
    enabled: !!username, // Only run query if username exists
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    retry: 2, // Retry failed requests up to 2 times
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
};
