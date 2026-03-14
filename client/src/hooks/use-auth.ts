import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

type UserWithSpotify = User & { spotifyProduct?: string; spotifyConnected?: boolean };

async function fetchUser(): Promise<UserWithSpotify | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isFetching } = useQuery<UserWithSpotify | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: 2,
    retryDelay: 500,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading: isLoading || (isFetching && user === undefined),
    isAuthenticated: !!user,
    spotifyConnected: !!user?.spotifyConnected,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
