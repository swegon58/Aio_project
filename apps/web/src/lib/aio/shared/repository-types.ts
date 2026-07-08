// Shared repository error/result contract. Reused across aio repositories.
// Provides type-safe Result pattern with stable error codes.

export type RepoError = { ok: false; code: string; message: string };
export type RepoOk<T> = { ok: true; data: T };
export type RepoResult<T> = RepoOk<T> | RepoError;
