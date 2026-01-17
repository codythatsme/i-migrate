import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queries } from "./queries";
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  setPassword,
  clearPassword,
  testConnection,
  retrySingleRow,
  enablePasswordStorage,
  disablePasswordStorage,
  verifyMasterPassword,
  changeMasterPassword,
  lockPasswords,
  setVerboseLogging,
  type Environment,
  type CreateEnvironment,
} from "@/api/client";

// Types for mutation inputs
type UpdateEnvironmentInput = {
  id: string;
  updates: Partial<
    Pick<
      Environment,
      "name" | "baseUrl" | "username" | "version" | "queryConcurrency" | "insertConcurrency"
    >
  >;
};

// Create environment mutation
export const useCreateEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEnvironment) => createEnvironment(data),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Update environment mutation
export const useUpdateEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: UpdateEnvironmentInput) => updateEnvironment({ id, ...updates }),
    onSuccess: (data) => {
      // Invalidate both queries to refresh with hasPassword status
      queryClient.invalidateQueries(queries.environments.all());
      queryClient.invalidateQueries(queries.environments.byId(data.id));
    },
  });
};

// Delete environment mutation
export const useDeleteEnvironment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEnvironment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries(queries.environments.all());
      queryClient.removeQueries(queries.environments.byId(id));
    },
  });
};

// ============================================
// Password Mutations (server-side storage)
// ============================================

// Set password for an environment (stored server-side in memory)
export const useSetPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ environmentId, password }: { environmentId: string; password: string }) =>
      setPassword(environmentId, password),
    onSuccess: () => {
      // Invalidate environments query to refresh hasPassword status from server
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Clear password for an environment
export const useClearPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (environmentId: string) => clearPassword(environmentId),
    onSuccess: () => {
      // Invalidate environments query to refresh hasPassword status from server
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// ============================================
// Connection Test Mutations
// ============================================

// Test connection to an IMIS environment
export const useTestConnection = () => {
  return useMutation({
    mutationFn: (environmentId: string) => testConnection(environmentId),
  });
};

// ============================================
// Job Mutations
// ============================================

// Retry a single failed row
export const useRetrySingleRow = (jobId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowId: string) => retrySingleRow(rowId),
    onSuccess: (_, rowId) => {
      // Invalidate rows query to refresh the list
      queryClient.invalidateQueries(queries.jobs.rows(jobId));
      // Invalidate attempt history for this specific row
      queryClient.invalidateQueries(queries.jobs.rowAttempts(rowId));
      // Also invalidate the job itself to update counts
      queryClient.invalidateQueries(queries.jobs.byId(jobId));
      queryClient.invalidateQueries(queries.jobs.all());
    },
  });
};

// ============================================
// Settings Mutations
// ============================================

// Enable password storage with master password
export const useEnablePasswordStorage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (masterPassword: string) => enablePasswordStorage(masterPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Disable password storage (clears all stored passwords)
export const useDisablePasswordStorage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disablePasswordStorage(),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Verify master password and unlock stored passwords
export const useVerifyMasterPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (masterPassword: string) => verifyMasterPassword(masterPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Change master password (re-encrypts all stored passwords)
export const useChangeMasterPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changeMasterPassword(currentPassword, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
    },
  });
};

// Lock stored passwords
export const useLockPasswords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => lockPasswords(),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
      queryClient.invalidateQueries(queries.environments.all());
    },
  });
};

// Set verbose logging
export const useSetVerboseLogging = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (verboseLogging: boolean) => setVerboseLogging(verboseLogging),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.settings.current());
    },
  });
};
