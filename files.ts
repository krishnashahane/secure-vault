import { getSql } from "@/lib/db";
import { MAX_FILE_BYTES } from "@/lib/limits";
import { ensureSchema } from "@/lib/schema";
import { randomUUID } from "node:crypto";

export type VaultFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  encryptedSizeBytes: number;
  algorithm: string;
  createdAt: string;
};

export type EncryptedVaultFile = VaultFileSummary & {
  cipherText: string;
  salt: string;
  iv: string;
};

export type CreateEncryptedFileInput = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  encryptedSizeBytes: number;
  cipherText: string;
  salt: string;
  iv: string;
};

type FileRow = {
  id: string;
  name: string;
  mimeType?: string;
  mime_type?: string;
  sizeBytes?: number | string;
  size_bytes?: number | string;
  encryptedSizeBytes?: number | string;
  encrypted_size_bytes?: number | string;
  algorithm: string;
  createdAt?: string;
  created_at?: string;
  cipherText?: string;
  cipher_text?: string;
  salt?: string;
  iv?: string;
};

export async function listFiles(userId: string) {
  await ensureSchema();

  const rows = (await getSql()`
    SELECT
      id,
      name,
      mime_type AS "mimeType",
      size_bytes AS "sizeBytes",
      encrypted_size_bytes AS "encryptedSizeBytes",
      algorithm,
      created_at AS "createdAt"
    FROM vault_files
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as FileRow[];

  return rows.map(mapSummary);
}

export async function getEncryptedFile(userId: string, fileId: string) {
  await ensureSchema();

  const rows = (await getSql()`
    SELECT
      id,
      name,
      mime_type AS "mimeType",
      size_bytes AS "sizeBytes",
      encrypted_size_bytes AS "encryptedSizeBytes",
      cipher_text AS "cipherText",
      salt,
      iv,
      algorithm,
      created_at AS "createdAt"
    FROM vault_files
    WHERE id = ${fileId} AND user_id = ${userId}
    LIMIT 1
  `) as FileRow[];

  if (!rows[0]) {
    return null;
  }

  return {
    ...mapSummary(rows[0]),
    cipherText: rows[0].cipherText ?? rows[0].cipher_text ?? "",
    salt: rows[0].salt ?? "",
    iv: rows[0].iv ?? "",
  } satisfies EncryptedVaultFile;
}

export async function createEncryptedFile(userId: string, input: CreateEncryptedFileInput) {
  validateEncryptedFile(input);
  await ensureSchema();

  const rows = (await getSql()`
    INSERT INTO vault_files (
      id,
      user_id,
      name,
      mime_type,
      size_bytes,
      encrypted_size_bytes,
      cipher_text,
      salt,
      iv
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${input.name.trim()},
      ${input.mimeType || "application/octet-stream"},
      ${input.sizeBytes},
      ${input.encryptedSizeBytes},
      ${input.cipherText},
      ${input.salt},
      ${input.iv}
    )
    RETURNING
      id,
      name,
      mime_type AS "mimeType",
      size_bytes AS "sizeBytes",
      encrypted_size_bytes AS "encryptedSizeBytes",
      algorithm,
      created_at AS "createdAt"
  `) as FileRow[];

  return mapSummary(rows[0]);
}

export async function deleteFile(userId: string, fileId: string) {
  await ensureSchema();
  await getSql()`DELETE FROM vault_files WHERE id = ${fileId} AND user_id = ${userId}`;
}

function validateEncryptedFile(input: CreateEncryptedFileInput) {
  if (!input.name?.trim()) {
    throw new Error("File name is required.");
  }

  if (input.name.trim().length > 180) {
    throw new Error("File name is too long.");
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_BYTES) {
    throw new Error(`Files must be larger than 0 bytes and no more than ${formatBytes(MAX_FILE_BYTES)}.`);
  }

  if (!Number.isFinite(input.encryptedSizeBytes) || input.encryptedSizeBytes <= 0) {
    throw new Error("Encrypted file size is invalid.");
  }

  if (!isBase64(input.cipherText) || !isBase64(input.salt) || !isBase64(input.iv)) {
    throw new Error("Encrypted payload is invalid.");
  }

  const decodedCipherBytes = Buffer.from(input.cipherText, "base64").byteLength;

  if (decodedCipherBytes !== input.encryptedSizeBytes || decodedCipherBytes > MAX_FILE_BYTES + 512) {
    throw new Error("Encrypted payload size is invalid.");
  }
}

function isBase64(value: string) {
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

function mapSummary(row: FileRow): VaultFileSummary {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType ?? row.mime_type ?? "application/octet-stream",
    sizeBytes: Number(row.sizeBytes ?? row.size_bytes ?? 0),
    encryptedSizeBytes: Number(row.encryptedSizeBytes ?? row.encrypted_size_bytes ?? 0),
    algorithm: row.algorithm,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

function formatBytes(bytes: number) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
