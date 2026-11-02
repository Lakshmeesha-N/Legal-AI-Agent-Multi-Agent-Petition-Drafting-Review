export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  token?: string | null;
  json?: any;
}

async function apiFetch(path: string, options: RequestOptions = {}) {
  const { token, json, headers: customHeaders, ...rest } = options;
  
  const headers = new Headers(customHeaders);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (json) {
    headers.set("Content-Type", "application/json");
    rest.body = JSON.stringify(json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...rest,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorDetail = parsed.detail || errorText;
    } catch {}
    const error = new Error(errorDetail || `Request failed with status ${response.status}`) as any;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

interface UploadOptions {
  token?: string | null;
  formData: FormData;
  onProgress?: (percent: number) => void;
}

async function apiUpload(path: string, options: UploadOptions): Promise<any> {
  const { token, formData, onProgress } = options;
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    
    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });
    }
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        let errorDetail = xhr.responseText;
        try {
          const parsed = JSON.parse(xhr.responseText);
          errorDetail = parsed.detail || xhr.responseText;
        } catch {}
        const error = new Error(errorDetail || `Upload failed with status ${xhr.status}`) as any;
        error.status = xhr.status;
        reject(error);
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error during file upload"));
    };
    
    xhr.send(formData);
  });
}

// Complete API contract functions:

export const authApi = {
  me: (token: string | null) => 
    apiFetch("/auth/me", { method: "POST", token }),
};

export const templateRegistryApi = {
  getVaults: (token: string | null) => 
    apiFetch("/template-registry/vaults", { method: "GET", token }),
    
  getTemplatesInVault: (vaultName: string, token: string | null) => 
    apiFetch(`/template-registry/vaults/${encodeURIComponent(vaultName)}`, { method: "GET", token }),
    
  getTemplate: (templateId: string, token: string | null) => 
    apiFetch(`/template-registry/templates/${encodeURIComponent(templateId)}`, { method: "GET", token }),
};

export const setupAgentApi = {
  startSetup: (
    formData: FormData,
    token: string | null,
    onProgress?: (percent: number) => void
  ) => apiUpload("/agents/setup/", { formData, token, onProgress }),

  getStatus: (jobId: string, token: string | null) => 
    apiFetch(`/agents/setup/status/${jobId}`, { method: "GET", token }),
};

export const caseIntakeApi = {
  startIntake: (
    formData: FormData,
    token: string | null,
    onProgress?: (percent: number) => void
  ) => apiUpload("/agents/intake/", { formData, token, onProgress }),

  getStatus: (jobId: string, token: string | null) => 
    apiFetch(`/agents/intake/status/${jobId}`, { method: "GET", token }),
};

export const documentEditApi = {
  startEdit: (
    formData: FormData,
    token: string | null,
    onProgress?: (percent: number) => void
  ) => apiUpload("/agents/document-edit/", { formData, token, onProgress }),

  getStatus: (jobId: string, token: string | null) => 
    apiFetch(`/agents/document-edit/status/${jobId}`, { method: "GET", token }),
};

export const generatedDocumentsApi = {
  getDocument: (documentId: string, token: string | null) => 
    apiFetch(`/generated-documents/${encodeURIComponent(documentId)}`, { method: "GET", token }),

  getDocumentsByLawyer: (lawyerId: string, token: string | null) => 
    apiFetch(`/generated-documents/lawyer/${encodeURIComponent(lawyerId)}`, { method: "GET", token }),

  saveDocument: (documentId: string, jsonBody: { generated_docxjs_code: string }, token: string | null) => 
    apiFetch(`/generated-documents/${encodeURIComponent(documentId)}`, { method: "PUT", json: jsonBody, token }),

  deleteDocument: (documentId: string, token: string | null) => 
    apiFetch(`/generated-documents/${encodeURIComponent(documentId)}`, { method: "DELETE", token }),
};

// Generic poll helper
export async function pollJob<T extends { status: string; error?: string | null }>(
  fetchStatusFn: () => Promise<T>,
  intervalMs = 2000,
  maxAttempts = 150
): Promise<T> {
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;
      try {
        const result = await fetchStatusFn();
        
        if (result.status === "completed") {
          clearInterval(interval);
          resolve(result);
        } else if (result.status === "failed") {
          clearInterval(interval);
          reject(new Error(result.error || "Job execution failed on backend"));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error("Job polling timed out"));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
}
