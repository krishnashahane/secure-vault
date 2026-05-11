"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Download,
  FileAudio,
  FileCode,
  FileImage,
  FileKey2,
  FileText,
  FileVideo,
  HardDrive,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { EncryptedVaultFile, VaultFileSummary } from "@/lib/files";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/limits";

type VaultClientProps = {
  initialFiles: VaultFileSummary[];
  maxFileBytes: number;
  vaultCapacityBytes: number;
  userEmail: string;
  userAvatarUrl: string | null;
};

type Status = {
  kind: "idle" | "success" | "error";
  text: string;
};

async function safeJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return { error: `Server error (${response.status})` } as T;
  }
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  // Method 1: Response API — creates internal blob copy, best for macOS permission issues
  try {
    const buf = await new Response(file).arrayBuffer();
    if (buf.byteLength > 0) return buf;
  } catch { /* fall through */ }

  // Method 2: Direct arrayBuffer
  try {
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 0) return buf;
  } catch { /* fall through */ }

  // Method 3: FileReader
  try {
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    if (buf.byteLength > 0) return buf;
  } catch { /* fall through */ }

  throw new Error(`Cannot read "${file.name}". The file may be locked, in iCloud, or permissions expired. Please re-select it.`);
}

function fileTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage size={18} />;
  if (mimeType.startsWith("video/")) return <FileVideo size={18} />;
  if (mimeType.startsWith("audio/")) return <FileAudio size={18} />;
  if (mimeType === "application/pdf" || mimeType === "text/plain") return <FileText size={18} />;
  if (mimeType.startsWith("text/") || mimeType.includes("javascript") || mimeType.includes("json")) return <FileCode size={18} />;
  return <FileKey2 size={18} />;
}

export function VaultClient({ initialFiles, maxFileBytes, vaultCapacityBytes, userEmail, userAvatarUrl }: VaultClientProps) {
  const [files, setFiles] = useState(initialFiles);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadPassphrase, setUploadPassphrase] = useState("");
  const [downloadPassphrase, setDownloadPassphrase] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.sizeBytes, 0), [files]);
  const usedPercent = Math.min(100, Math.round((totalBytes / vaultCapacityBytes) * 100));
  const filteredFiles = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [files, searchQuery]
  );

  function handleFileSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setSelectedFiles(Array.from(fileList));
    setStatus({ kind: "idle", text: "" });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "idle", text: "" });

    if (selectedFiles.length === 0) {
      setStatus({ kind: "error", text: "Choose at least one file." });
      return;
    }

    for (const f of selectedFiles) {
      if (f.size > maxFileBytes) {
        setStatus({ kind: "error", text: `"${f.name}" exceeds ${formatBytes(maxFileBytes)} limit.` });
        return;
      }
    }

    if (uploadPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      setStatus({ kind: "error", text: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.` });
      return;
    }

    setBusyAction("upload");
    const uploaded: VaultFileSummary[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const sf = selectedFiles[i];
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}...`);

        setUploadProgress(`Encrypting ${sf.name}...`);
        const plainBytes = await readFileBytes(sf);
        let encrypted: Awaited<ReturnType<typeof encryptFile>>;
        try {
          encrypted = await encryptFile(sf.name, sf.type, sf.size, plainBytes, uploadPassphrase);
        } catch {
          throw new Error(`Encryption failed for "${sf.name}". Try a different file.`);
        }
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}...`);
        const response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encrypted),
        });

        const payload = await safeJson<{ file?: VaultFileSummary; error?: string }>(response);

        if (!response.ok || !payload.file) {
          throw new Error(payload.error ?? `Upload failed for "${sf.name}".`);
        }

        uploaded.push(payload.file);
      }

      setFiles((current) => [...uploaded.reverse(), ...current]);
      setSelectedFiles([]);
      setUploadPassphrase("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus({ kind: "success", text: `${uploaded.length} file${uploaded.length > 1 ? "s" : ""} encrypted and uploaded.` });
    } catch (error) {
      if (uploaded.length > 0) {
        setFiles((current) => [...uploaded.reverse(), ...current]);
      }
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusyAction(null);
      setUploadProgress("");
    }
  }

  async function refreshFiles() {
    setBusyAction("refresh");
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch("/api/files");
      const payload = await safeJson<{ files?: VaultFileSummary[]; error?: string }>(response);

      if (!response.ok || !payload.files) {
        throw new Error(payload.error ?? "Refresh failed.");
      }

      setFiles(payload.files);
      setStatus({ kind: "success", text: "Vault refreshed." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Refresh failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadFile(fileId: string) {
    if (downloadPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      setStatus({ kind: "error", text: `Enter a ${MIN_PASSPHRASE_LENGTH}+ character passphrase to decrypt.` });
      return;
    }

    setBusyAction(fileId);
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch(`/api/files/${fileId}`);
      const payload = await safeJson<{ file?: EncryptedVaultFile; error?: string }>(response);

      if (!response.ok || !payload.file) {
        throw new Error(payload.error ?? "Download failed.");
      }

      let decrypted: ArrayBuffer;
      try {
        decrypted = await decryptFile(payload.file, downloadPassphrase);
      } catch {
        throw new Error("Wrong passphrase or corrupted file.");
      }
      const blob = new Blob([decrypted], { type: payload.file.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.file.name;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", text: "File decrypted and downloaded." });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Decryption failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function removeFile(fileId: string) {
    setBusyAction(`delete-${fileId}`);
    setStatus({ kind: "idle", text: "" });

    try {
      const response = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      const payload = await safeJson<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed.");
      }

      setFiles((current) => current.filter((file) => file.id !== fileId));
      setStatus({ kind: "success", text: "File deleted." });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Delete failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const selectedTotalSize = selectedFiles.reduce((t, f) => t + f.size, 0);

  return (
    <section className="vault-layout" aria-labelledby="vault-title">
      <header className="vault-header">
        <div className="vault-brand">
          <div className="vault-brand-mark">
            <Lock size={20} />
          </div>
          <div>
            <p className="eyebrow">SecureVault</p>
            <h1 id="vault-title">My Vault</h1>
          </div>
        </div>
        <div className="header-actions">
          {userAvatarUrl && (
            <img className="avatar" src={userAvatarUrl} alt="avatar" width={36} height={36} referrerPolicy="no-referrer" />
          )}
          <span className="account-pill">{userEmail}</span>
          <button className="icon-button" onClick={logout} title="Sign out" type="button">
            {busyAction === "logout" ? <Loader2 className="spin" size={18} /> : <LogOut size={18} />}
          </button>
        </div>
      </header>

      <div className="storage-bar-section">
        <div className="storage-header">
          <HardDrive size={16} />
          <span className="storage-label">Storage</span>
          <span className="storage-stats">
            {formatBytes(totalBytes)} <span className="storage-sep">/</span> {formatBytes(vaultCapacityBytes)}
          </span>
          <span className="storage-percent">{usedPercent}%</span>
        </div>
        <div className="storage-track">
          <div
            className={`storage-fill ${usedPercent > 90 ? "danger" : usedPercent > 70 ? "warn" : ""}`}
            style={{ width: `${usedPercent || 0}%` }}
          />
        </div>
        <div className="storage-meta">
          <span>{files.length} encrypted file{files.length !== 1 ? "s" : ""}</span>
          <span>{formatBytes(vaultCapacityBytes - totalBytes)} free</span>
        </div>
      </div>

      <div className="vault-grid">
        <form className="upload-panel" onSubmit={handleUpload}>
          <div className="panel-heading">
            <ShieldCheck size={22} />
            <h2>Encrypt Upload</h2>
          </div>

          <label
            className="file-drop"
            htmlFor="vault-file-input"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFileSelect(e.dataTransfer.files);
            }}
          >
            <UploadCloud size={22} />
            <span>
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                : "Click or drag files here"}
            </span>
            <input
              id="vault-file-input"
              ref={fileInputRef}
              multiple
              onChange={(event) => {
                handleFileSelect(event.target.files);
              }}
              type="file"
              style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
            />
          </label>

          <label className="field">
            <span>Encryption passphrase</span>
            <input
              autoComplete="new-password"
              minLength={MIN_PASSPHRASE_LENGTH}
              onChange={(event) => setUploadPassphrase(event.target.value)}
              type="password"
              value={uploadPassphrase}
            />
          </label>

          <div className="metric-row">
            <span>Limit per file</span>
            <strong>{formatBytes(maxFileBytes)}</strong>
          </div>
          <div className="metric-row">
            <span>Selected</span>
            <strong>
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} (${formatBytes(selectedTotalSize)})`
                : "0 B"}
            </strong>
          </div>

          {uploadProgress && (
            <p className="upload-progress">{uploadProgress}</p>
          )}

          <button className="primary-action" disabled={busyAction === "upload"} type="submit">
            {busyAction === "upload" ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
            Upload encrypted file{selectedFiles.length > 1 ? "s" : ""}
          </button>
        </form>

        <section className="files-panel">
          <div className="panel-toolbar">
            <div>
              <div className="panel-heading compact">
                <FileKey2 size={20} />
                <h2>Encrypted Files</h2>
              </div>
              <p className="panel-stat">
                {files.length} item{files.length !== 1 ? "s" : ""} · {formatBytes(totalBytes)}
              </p>
            </div>
            <button className="icon-button" onClick={refreshFiles} title="Refresh" type="button">
              {busyAction === "refresh" ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            </button>
          </div>

          <label className="field compact-field">
            <span>Decrypt passphrase</span>
            <input
              autoComplete="current-password"
              minLength={MIN_PASSPHRASE_LENGTH}
              onChange={(event) => setDownloadPassphrase(event.target.value)}
              type="password"
              value={downloadPassphrase}
            />
          </label>

          <div className="search-bar">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="file-list">
            {filteredFiles.length ? (
              filteredFiles.map((file) => (
                <article className="file-row" key={file.id}>
                  <div className="file-icon" aria-hidden="true">
                    {fileTypeIcon(file.mimeType ?? "")}
                  </div>
                  <div className="file-main">
                    <h3>{file.name}</h3>
                    <p>
                      {formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString()}
                      <span className="enc-badge">AES-256</span>
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      onClick={() => downloadFile(file.id)}
                      title="Decrypt and download"
                      type="button"
                    >
                      {busyAction === file.id ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => removeFile(file.id)}
                      title="Delete"
                      type="button"
                    >
                      {busyAction === `delete-${file.id}` ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <ShieldCheck size={32} />
                <p>{searchQuery ? "No files match your search." : "Your vault is empty."}</p>
                {!searchQuery && <span className="empty-hint">Upload a file to get started</span>}
              </div>
            )}
          </div>
        </section>
      </div>

      {status.text ? <p className={`toast ${status.kind}`}>{status.text}</p> : null}
    </section>
  );
}

async function encryptFile(name: string, type: string, size: number, plainBytes: ArrayBuffer, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipherBytes = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);

  return {
    name,
    mimeType: type || "application/octet-stream",
    sizeBytes: size,
    encryptedSizeBytes: cipherBytes.byteLength,
    cipherText: arrayBufferToBase64(cipherBytes),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  };
}

async function decryptFile(file: EncryptedVaultFile, passphrase: string) {
  const salt = base64ToArrayBuffer(file.salt);
  const iv = base64ToArrayBuffer(file.iv);
  const cipherBytes = base64ToArrayBuffer(file.cipherText);
  const key = await deriveKey(passphrase, new Uint8Array(salt));

  return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, cipherBytes);
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations: 310_000,
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
