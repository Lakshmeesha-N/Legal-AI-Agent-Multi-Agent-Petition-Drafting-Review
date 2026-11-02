"use client";

import React, { useState, useEffect, useRef } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from "@/contexts/AuthContext";
import {
  authApi,
  templateRegistryApi,
  setupAgentApi,
  caseIntakeApi,
  documentEditApi,
  generatedDocumentsApi,
  pollJob,
  API_BASE_URL
} from "@/lib/api";
import {
  Folder,
  FileText,
  History as HistoryIcon,
  User as UserIcon,
  LogOut,
  Plus,
  Sparkles,
  MessageSquare,
  Eye,
  Download,
  PlusCircle,
  X,
  Send,
  Check,
  RotateCcw,
  ArrowRight,
  Loader2,
  FileCode,
  AlertTriangle,
  ChevronLeft,
  Settings as SettingsIcon,
  HelpCircle,
  Play,
  Paperclip,
  Upload
} from "lucide-react";

export default function WorkspacePage() {
  const { user, token, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, mockSignIn } = useAuth();

  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Sidebar navigation selection: "vaults" | "history" | "settings"
  const [sidebarSelection, setSidebarSelection] = useState<"vaults" | "history" | "settings">("vaults");

  // Sub-views inside the main area: "vaults_list" | "folder_detail" | "intake" | "document"
  const [currentView, setCurrentView] = useState<"vaults_list" | "folder_detail" | "intake" | "document">("vaults_list");

  // Workspace lists & caches
  const [vaults, setVaults] = useState<string[]>([]);
  const [isLoadingVaults, setIsLoadingVaults] = useState(true);
  const [selectedVaultName, setSelectedVaultName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Array<{ template_id: string; template_name: string }>>>({});
  const [historyItems, setHistoryItems] = useState<Array<{ id: string; name: string; templateId: string; created: string }>>([]);
  const [historyDocIds, setHistoryDocIds] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null);

  // Intake State
  const [intakeSessionId, setIntakeSessionId] = useState<string>("");
  const [intakeHistory, setIntakeHistory] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [intakeProgress, setIntakeProgress] = useState(0);
  const [intakeMessage, setIntakeMessage] = useState("");
  const [intakeFiles, setIntakeFiles] = useState<File[]>([]);
  const [intakeUploadProgress, setIntakeUploadProgress] = useState<number | null>(null);
  const [isIntakeLoading, setIsIntakeLoading] = useState(false);
  const intakeFileInputRef = useRef<HTMLInputElement>(null);

  // Setup Blueprint Modal State
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupVaultName, setSetupVaultName] = useState("");
  const [setupBlueprintName, setSetupBlueprintName] = useState("");
  const [setupFile, setSetupFile] = useState<File | null>(null);
  const [setupUploadProgress, setSetupUploadProgress] = useState<number | null>(null);
  const [setupIsSubmitting, setSetupIsSubmitting] = useState(false);
  const [setupError, setSetupError] = useState("");
  const setupFileInputRef = useRef<HTMLInputElement>(null);

  // Document Editor State
  const [docxjsCode, setDocxjsCode] = useState<string>("");
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [isCompilingDoc, setIsCompilingDoc] = useState(false);
  const [editHistory, setEditHistory] = useState<Array<{ sender: "user" | "ai"; text: string }>>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editUploadProgress, setEditUploadProgress] = useState<number | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [selectedPage, setSelectedPage] = useState(1);
  const [editorError, setEditorError] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Premium Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-clear Toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const triggerToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ text, type });
  };

  // Fetch initial profile and load vaults
  useEffect(() => {
    if (user && token) {
      authApi.me(token)
        .then(() => {
          loadVaults();
          // Load local history if any
          const savedHist = localStorage.getItem(`history_${user.uid}`);
          if (savedHist) {
            setHistoryItems(JSON.parse(savedHist));
          }
        })
        .catch(err => {
          console.error("Backend auth me failed", err);
          triggerToast("Failed to connect to backend user profile", "error");
        });
    }
  }, [user, token]);

  // Load vaults list
  const loadVaults = async () => {
    setIsLoadingVaults(true);
    try {
      const data = await templateRegistryApi.getVaults(token);
      setVaults(data.vaults || []);
    } catch (err) {
      console.error(err);
      triggerToast("Could not load vaults from template registry", "error");
    } finally {
      setIsLoadingVaults(false);
    }
  };

  const loadLawyerHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const data = await generatedDocumentsApi.getDocumentsByLawyer(user.uid, token);
      setHistoryDocIds(data.document_ids || []);
    } catch (err) {
      console.error(err);
      triggerToast("Could not load history from backend", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Open Vault Folder and switch view
  const handleOpenFolder = async (vaultName: string) => {
    setSelectedVaultName(vaultName);
    setCurrentView("folder_detail");
    try {
      const data = await templateRegistryApi.getTemplatesInVault(vaultName, token);
      setTemplates(prev => ({
        ...prev,
        [vaultName]: data.templates || []
      }));
    } catch (err) {
      console.error(err);
      triggerToast(`Could not fetch blueprints in vault ${vaultName}`, "error");
    }
  };

  // Auth Handling
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        triggerToast("Account created successfully", "success");
      } else {
        await signInWithEmail(email, password);
        triggerToast("Logged in successfully", "success");
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    }
  };

  const handleSetupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSetupError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      setSetupError("Only DOCX and PDF files are supported for Blueprint Creation.");
      setSetupFile(null);
      if (setupFileInputRef.current) setupFileInputRef.current.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setSetupError("The selected document exceeds the maximum supported size (20 MB).");
      setSetupFile(null);
      if (setupFileInputRef.current) setupFileInputRef.current.value = "";
      return;
    }

    setSetupFile(file);
  };

  // Setup Blueprint Action
  const handleCreateBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");

    if (!setupBlueprintName || !setupVaultName || !setupFile) {
      setSetupError("All fields are required, including the blueprint document file.");
      return;
    }

    setSetupIsSubmitting(true);
    setSetupUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("vault_name", setupVaultName);
      formData.append("template_name", setupBlueprintName);
      formData.append("file", setupFile);


      const response = await setupAgentApi.startSetup(formData, token, (percent) => {
        setSetupUploadProgress(percent);
      });

      const jobId = response.job_id;
      triggerToast("Blueprint setup started. Compiling blueprint...", "info");

      // Poll setup status
      await pollJob(async () => {
        return await setupAgentApi.getStatus(jobId, token);
      });

      triggerToast("Blueprint successfully setup!", "success");
      setIsSetupOpen(false);

      // Reload list and switch to target folder details
      await loadVaults();
      handleOpenFolder(setupVaultName);

      // Reset inputs
      setSetupBlueprintName("");
      setSetupVaultName("");
      setSetupFile(null);
      setSetupUploadProgress(null);
      if (setupFileInputRef.current) setupFileInputRef.current.value = "";
    } catch (err: any) {
      if (err.status === 403) {
        setUpgradeModalMessage(err.message || "Your plan limit has been exceeded. Please upgrade to Premium.");
        setIsUpgradeModalOpen(true);
      } else {
        setSetupError(err.message || "Failed to setup blueprint");
        triggerToast("Blueprint compilation failed", "error");
      }
    } finally {
      setSetupIsSubmitting(false);
      setSetupUploadProgress(null);
    }
  };

  // Start Case Intake Action
  const handleStartIntake = (templateId: string, templateName: string) => {
    const sessionId = `session_${Date.now()}`;
    setSelectedTemplate({ id: templateId, name: templateName });
    setIntakeSessionId(sessionId);
    setIntakeHistory([
      { sender: "ai", text: "Upload a relevant information PDFs or documents or give me a brief description." }
    ]);
    setIntakeProgress(0);
    setIntakeFiles([]);
    setIntakeUploadProgress(null);
    setWorkspaceMode("intake");
  };

  // Send Intake Message Action
  const handleSendIntakeMessage = async () => {
    if (!intakeMessage.trim() && intakeFiles.length === 0) return;

    const userMsg = intakeMessage;
    const filesToSend = [...intakeFiles];

    setIntakeMessage("");
    setIntakeFiles([]);
    setIsIntakeLoading(true);
    if (filesToSend.length > 0) {
      setIntakeUploadProgress(0);
    } else {
      setIntakeUploadProgress(null);
    }

    if (userMsg.trim()) {
      setIntakeHistory(prev => [...prev, { sender: "user", text: userMsg }]);
    }

    try {
      const formData = new FormData();
      formData.append("session_id", intakeSessionId);
      formData.append("template_id", selectedTemplate?.id || "");
      formData.append("user_message", userMsg);
      formData.append("chat_history", JSON.stringify(intakeHistory.map(h => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text
      }))));

      filesToSend.forEach(file => {
        formData.append("files", file);
      });

      const response = await caseIntakeApi.startIntake(formData, token, (percent) => {
        setIntakeUploadProgress(percent);
      });

      const jobId = response.job_id;

      const pollResult = await pollJob(async () => {
        return await caseIntakeApi.getStatus(jobId, token);
      });

      const result = pollResult.result;

      if (result) {
        setIntakeProgress(result.completion_percentage || 0);

        if (result.next_question) {
          setIntakeHistory(prev => [...prev, { sender: "ai", text: result.next_question }]);
        }

        if (result.ready_to_generate || pollResult.ready_to_generate) {
          triggerToast("Intake complete! Compiling document...", "success");

          const documentId = result?.document_id || pollResult?.document_id || pollResult?.result?.document_id || result?.result?.document_id;
          
          if (!documentId) {
            triggerToast("Error: Document ID not returned from backend.", "error");
            setIsCompilingDoc(false);
            return;
          }

          setSelectedDocumentId(documentId);
          setWorkspaceMode("document");
          setIsCompilingDoc(true);

          try {
            // Poll for the generated document code (up to 30 attempts, 2 sec interval = 60s max)
            let docxjsCodeResult = "";
            const intervalMs = 2000;
            const maxAttempts = 30;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              try {
                const docData = await generatedDocumentsApi.getDocument(documentId, token);
                if (docData && docData.generated_docxjs_code) {
                  docxjsCodeResult = docData.generated_docxjs_code;
                  break;
                }
              } catch (err) {
                console.log(`Document not ready yet, retrying... (attempt ${attempt + 1}/${maxAttempts})`);
              }
              await new Promise(resolve => setTimeout(resolve, intervalMs));
            }

            if (!docxjsCodeResult) {
              throw new Error("Document compilation timed out on the backend.");
            }

            setDocxjsCode(docxjsCodeResult);
            setIsCompilingDoc(false);

            // Add to History
            const newHistoryItem = {
              id: documentId,
              name: `${selectedTemplate?.name} (Draft)`,
              templateId: selectedTemplate?.id || "",
              created: new Date().toLocaleString()
            };
            const updatedHistory = [newHistoryItem, ...historyItems];
            setHistoryItems(updatedHistory);
            localStorage.setItem(`history_${user?.uid}`, JSON.stringify(updatedHistory));

            setTimeout(() => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                  type: "RENDER_DOC",
                  code: docxjsCodeResult
                }, "*");
              }
            }, 500);

          } catch (docErr) {
            console.error(docErr);
            setIsCompilingDoc(false);
            triggerToast("Document generated, loading fallback view", "error");

            const mockCode = `
              export function buildDocument(docx) {
                return new docx.Document({
                  sections: [{
                    children: [
                      new docx.Paragraph({
                        heading: "Heading1",
                        children: [new docx.TextRun("PETITION FOR COMPENSATORY RELIEF")]
                      }),
                      new docx.Paragraph({
                        children: [new docx.TextRun("The Claimant submits that an accident occurred due to reckless driving.")]
                      })
                    ]
                  }]
                });
              }
            `;
            setDocxjsCode(mockCode);
            setWorkspaceMode("document");
          }
        }
      }
    } catch (err: any) {
      if (err.status === 403) {
        setUpgradeModalMessage(err.message || "Your plan limit has been exceeded. Please upgrade to Premium.");
        setIsUpgradeModalOpen(true);
      } else {
        triggerToast(err.message || "Failed to update case details", "error");
        setIntakeHistory(prev => [...prev, { sender: "ai", text: `I encountered an error processing that message: ${err.message}. Please try again.` }]);
      }
    } finally {
      setIsIntakeLoading(false);
      setIntakeUploadProgress(null);
    }
  };

  const handleAddIntakeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];

    for (const file of newFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isDoc = ext === "pdf" || ext === "docx";
      const isImg = ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp";
      if (!isDoc && !isImg) {
        triggerToast("Only PDF, DOCX, and images (PNG, JPG, JPEG, WEBP) are supported.", "error");
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        triggerToast("The selected document exceeds the maximum supported size (20 MB).", "error");
        continue;
      }

      if (intakeFiles.some(f => f.name === file.name && f.size === file.size)) {
        triggerToast(`File "${file.name}" is already attached.`, "info");
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setIntakeFiles(prev => [...prev, ...validFiles]);
    }
    if (intakeFileInputRef.current) intakeFileInputRef.current.value = "";
  };

  // Load from History Action
  const handleLoadHistory = async (documentId: string, docName: string) => {
    setSelectedDocumentId(documentId);
    setSelectedTemplate({ id: "", name: docName });
    triggerToast("Loading document from history...", "info");

    try {
      const docData = await generatedDocumentsApi.getDocument(documentId, token);
      setDocxjsCode(docData.generated_docxjs_code || "");
      setWorkspaceMode("document");

      setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "RENDER_DOC",
            code: docData.generated_docxjs_code
          }, "*");
        }
      }, 500);
    } catch (err) {
      console.error(err);
      triggerToast("Could not find generated document. Loading mock...", "error");
      setDocxjsCode(`
        export function buildDocument(docx) {
          return new docx.Document({
            sections: [{
              children: [
                new docx.Paragraph({
                  heading: "Heading1",
                  children: [new docx.TextRun("GENERATED CASE PETITION")]
                }),
                new docx.Paragraph({
                  children: [new docx.TextRun("This is a previously compiled historical petition loaded from local memory.")]
                })
              ]
            }]
          });
        }
      `);
      setWorkspaceMode("document");
    }
  };

  const handleAddEditFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];

    for (const file of newFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isDoc = ext === "pdf" || ext === "docx";
      const isImg = ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp";
      if (!isDoc && !isImg) {
        triggerToast("Only PDF, DOCX, and images (PNG, JPG, JPEG, WEBP) are supported.", "error");
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        triggerToast("The selected document exceeds the maximum supported size (20 MB).", "error");
        continue;
      }

      if (editFiles.some(f => f.name === file.name && f.size === file.size)) {
        triggerToast(`File "${file.name}" is already attached.`, "info");
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setEditFiles(prev => [...prev, ...validFiles]);
    }
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  // AI Edit Document Action
  const handleSendEditInstruction = async () => {
    if (!editInstruction.trim() && editFiles.length === 0) return;

    const instruction = editInstruction;
    const filesToSend = [...editFiles];

    setEditHistory(prev => [...prev, { sender: "user", text: instruction }]);
    setEditInstruction("");
    setEditFiles([]);
    setIsEditLoading(true);
    if (filesToSend.length > 0) {
      setEditUploadProgress(0);
    } else {
      setEditUploadProgress(null);
    }
    setEditorError("");

    try {
      const formData = new FormData();
      formData.append("document_id", selectedDocumentId || "");
      if (selectedTemplate?.id) {
        formData.append("template_id", selectedTemplate.id);
      }
      formData.append("user_message", instruction);

      filesToSend.forEach(file => {
        formData.append("files", file);
      });

      const response = await documentEditApi.startEdit(formData, token, (percent) => {
        setEditUploadProgress(percent);
      });

      const jobId = response.job_id;
      triggerToast("Triggered conversational edit. Recompiling...", "info");

      const pollResult = await pollJob(async () => {
        return await documentEditApi.getStatus(jobId, token);
      });

      if (pollResult.generated_docxjs_code) {
        setDocxjsCode(pollResult.generated_docxjs_code);
        setHasUnsavedEdits(true);
        const aiMessage = pollResult.result?.agent_output || pollResult.agent_output || "I have updated the document code with your edits.";
        setEditHistory(prev => [...prev, { sender: "ai", text: aiMessage }]);

        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: "RENDER_DOC",
            code: pollResult.generated_docxjs_code
          }, "*");
        }
        triggerToast("Document preview updated!", "success");
      }
    } catch (err: any) {
      if (err.status === 403) {
        setUpgradeModalMessage(err.message || "Your plan limit has been exceeded. Please upgrade to Premium.");
        setIsUpgradeModalOpen(true);
      } else {
        setEditorError(err.message || "Failed to execute edit");
        setEditHistory(prev => [...prev, { sender: "ai", text: `Sorry, I failed to compile those changes: ${err.message}` }]);
      }
    } finally {
      setIsEditLoading(false);
      setEditUploadProgress(null);
    }
  };

  // Accept Document Action
  const handleAcceptDocument = async () => {
    if (!selectedDocumentId) return;
    try {
      // Save the edited document code to Firestore
      await generatedDocumentsApi.saveDocument(selectedDocumentId, { generated_docxjs_code: docxjsCode }, token);
      
      setHasUnsavedEdits(false);
      triggerToast("Document approved and saved to database!", "success");
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Failed to accept document", "error");
    }
  };

  // Reject Document Action
  const handleRejectDocument = async () => {
    if (!selectedDocumentId) return;
    try {
      await generatedDocumentsApi.deleteDocument(selectedDocumentId, token);
      setHasUnsavedEdits(false);
      triggerToast("Document rejected and discarded", "info");
      setWorkspaceMode("idle");
    } catch (err) {
      console.error(err);
      setHasUnsavedEdits(false);
      triggerToast("Document rejected successfully (local fallback)", "info");
      setWorkspaceMode("idle");
    }
  };

  // Request download from sandbox
  const handleDownloadDocument = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: "REQUEST_DOWNLOAD",
        code: docxjsCode
      }, "*");
      triggerToast("Requesting document compilation...", "info");
    }
  };

  // Listen to sandbox messages
  useEffect(() => {
    const handleSandboxMessages = (event: MessageEvent) => {
      const { type, pageCount, arrayBuffer, mimeType, error } = event.data;

      if (type === "SANDBOX_READY") {
        if (iframeRef.current?.contentWindow && docxjsCode) {
          iframeRef.current.contentWindow.postMessage({
            type: "RENDER_DOC",
            code: docxjsCode
          }, "*");
        }
      } else if (type === "RENDER_COMPLETE") {
        setPreviewPageCount(pageCount || 1);
        setSelectedPage(1);
      } else if (type === "RENDER_ERROR") {
        triggerToast(`Rendering failed: ${error}`, "error");
      } else if (type === "DOWNLOAD_READY" && arrayBuffer) {
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedTemplate?.name || "opandz-document"}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        triggerToast("Download started!", "success");
      } else if (type === "DOWNLOAD_ERROR") {
        triggerToast(`Download compilation failed: ${error}`, "error");
      }
    };

    window.addEventListener("message", handleSandboxMessages);
    return () => window.removeEventListener("message", handleSandboxMessages);
  }, [selectedTemplate, docxjsCode]);

  // Helper to change view mode when starting workspace task
  const setWorkspaceMode = (mode: "idle" | "intake" | "document") => {
    setCurrentView(mode === "idle" ? "vaults_list" : mode);
  };

  const getWorkspaceMode = (): "idle" | "intake" | "document" => {
    if (currentView === "intake") return "intake";
    if (currentView === "document") return "document";
    return "idle";
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col justify-center items-center bg-[#0a0b0d] text-slate-400 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="font-sans text-sm tracking-wider uppercase">Loading Workspace Session...</span>
      </div>
    );
  }

  // Auth / Login Interface
  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#07080a] relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md p-8 rounded-xl glass shadow-2xl relative border border-white/5 mx-4">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-2xl shadow-lg glow-blue mb-4">
              O
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Opandzai</h1>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="w-full bg-[#12131a] border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#12131a] border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white transition-colors"
                required
              />
            </div>

            {authError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2 text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95 animate-pulse-slow"
            >
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <span className="relative bg-[#0d0e12] px-3 text-xs text-slate-500 uppercase tracking-widest">or continue with</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={signInWithGoogle}
              className="w-full border border-white/5 hover:bg-white/5 bg-[#12131a] py-2.5 rounded-lg text-sm text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.8 0 3.42.62 4.69 1.83l3.51-3.51C18.06 1.57 15.27.75 12 .75c-4.97 0-9 4.03-9 9s4.03 9 9 9c5.18 0 9.25-4.22 9.25-9.25 0-.62-.05-1.22-.16-1.8H12v3.6h5.36c-.23 1.22-.92 2.25-1.95 2.95l3.02 2.34c1.77-1.63 2.82-4.04 2.82-6.94 0-.48-.04-.95-.12-1.4H12v3.6z"
                />
              </svg>
              Login with Google
            </button>

          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Lightweight Sidebar Workspace
  return (
    <div className="h-screen w-full flex bg-[#0a0b0d] overflow-hidden font-sans relative">

      {/* 1. Left Sidebar (Very Lightweight) */}
      <aside className="w-64 flex flex-col bg-[#0b0c10] border-r border-white/5 relative z-10 shrink-0 justify-between">

        {/* Workspace Brand & Profile */}
        <div className="flex flex-col">
          {/* Brand */}
          <div className="p-5 flex items-center gap-3 border-b border-white/5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-md shadow-lg">
              O
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Opandz AI</span>
          </div>

          {/* User Card */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#141620] border border-white/5">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow shrink-0">
                {user.displayName ? user.displayName.charAt(0) : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user.displayName || "User"}</div>
                <div className="text-[10px] text-slate-400 truncate">{user.email || "noemail@firm.com"}</div>
              </div>
            </div>
          </div>

          {/* Lightweight Menu Items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => {
                setSidebarSelection("vaults");
                setCurrentView("vaults_list");
                setSelectedVaultName(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${sidebarSelection === "vaults" && getWorkspaceMode() === "idle" ? "bg-blue-600/10 text-blue-400 border-l-2 border-blue-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
            >
              <Folder className="h-4 w-4" />
              <span>Vaults</span>
            </button>

            <button
              onClick={() => {
                setSidebarSelection("history");
                setCurrentView("vaults_list"); // History replaces vaults list in main
                setSelectedVaultName(null);
                loadLawyerHistory();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${sidebarSelection === "history" && getWorkspaceMode() === "idle" ? "bg-blue-600/10 text-blue-400 border-l-2 border-blue-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
            >
              <HistoryIcon className="h-4 w-4" />
              <span>History</span>
            </button>

            <button
              onClick={() => {
                setSidebarSelection("settings");
                setSelectedVaultName(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${sidebarSelection === "settings" && getWorkspaceMode() === "idle" ? "bg-blue-600/10 text-blue-400 border-l-2 border-blue-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 p-2 bg-red-600/10 hover:bg-red-600 text-xs font-semibold text-red-400 hover:text-white rounded-lg transition-all"
          >
            <LogOut className="h-4 w-4" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* 2. Main Large Workspace Area */}
      <main className="flex-1 flex flex-col bg-[#08090b] relative overflow-hidden">

        {/* Toast Alert */}
        {toastMessage && (
          <div className={`absolute top-4 right-4 z-50 p-4 rounded-lg shadow-xl border text-sm flex items-center gap-3 transition-all animate-bounce ${toastMessage.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : toastMessage.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"}`}>
            {toastMessage.type === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#0b0c10]/40 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {currentView === "vaults_list" && <span>{sidebarSelection === "vaults" ? "Vaults Explorer" : sidebarSelection === "history" ? "Compilation History" : "Workspace Settings"}</span>}
            {currentView === "folder_detail" && (
              <>
                <button
                  onClick={() => setCurrentView("vaults_list")}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors mr-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Back to Vaults
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-white ml-2">📁 {selectedVaultName}</span>
              </>
            )}
            {getWorkspaceMode() !== "idle" && (
              <>
                <button
                  onClick={() => {
                    setCurrentView(selectedVaultName ? "folder_detail" : "vaults_list");
                  }}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors mr-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Close Workspace
                </button>
                <span className="text-slate-600">/</span>
                <span className="text-blue-400 ml-2">📄 {selectedTemplate?.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider animate-pulse-slow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            System Online
          </div>
        </header>

        {/* Workspace Display Area */}
        <div className="flex-1 overflow-y-auto relative flex flex-col">

          {/* SETTINGS VIEW */}
          {sidebarSelection === "settings" && getWorkspaceMode() === "idle" && (
            <div className="p-8 max-w-2xl mx-auto w-full space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-blue-500" />
                Workspace Settings
              </h2>
              <p className="text-slate-400 text-sm">Configure your professional legal AI compiler and credentials.</p>

              <div className="p-5 rounded-lg border border-white/5 bg-[#101118]/50 space-y-4">
                <h3 className="text-sm font-semibold text-white">Workspace Plan</h3>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Current Plan:</span>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">Enterprise Free Tier</span>
                </div>
              </div>
            </div>
          )}

          {/* VAULTS LIST VIEW */}
          {sidebarSelection === "vaults" && currentView === "vaults_list" && (
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">Your Vaults</h2>
                  <p className="text-slate-400 text-xs mt-1">Browse and manage blueprints inside secure workspace vaults.</p>
                </div>
                <button
                  onClick={() => setIsSetupOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  New Blueprint
                </button>
              </div>

              {isLoadingVaults ? (
                <div className="p-24 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="text-xs uppercase tracking-wider text-slate-400">Loading secure workspace vaults...</span>
                </div>
              ) : vaults.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-slate-500 max-w-md mx-auto mt-8">
                  <Folder className="h-10 w-10 text-slate-600 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-400 mb-1">No Vaults Available</h3>
                  <p className="text-xs text-slate-500 mb-6">Create a blueprint templates to start organizing templates in vaults.</p>
                  <button onClick={() => setIsSetupOpen(true)} className="bg-[#12141c] hover:bg-[#181a24] text-xs font-semibold px-4 py-2 rounded-lg border border-white/5 text-white">
                    Setup First Blueprint
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vaults.map((vaultName) => (
                    <button
                      key={vaultName}
                      onClick={() => handleOpenFolder(vaultName)}
                      className="p-6 rounded-xl glass glass-hover text-left flex items-start gap-4 cursor-pointer"
                    >
                      <div className="p-3 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 shrink-0">
                        <Folder className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vault</div>
                        <div className="text-sm font-bold text-white truncate uppercase mt-1">{vaultName}</div>
                        <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                          Browse Blueprints →
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FOLDER DETAILS VIEW */}
          {sidebarSelection === "vaults" && currentView === "folder_detail" && (
            <div className="p-8 space-y-6 max-w-4xl w-full mx-auto">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
                    <Folder className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase">{selectedVaultName}</h2>
                    <p className="text-[10px] text-slate-400 tracking-wider">Select a blueprint to begin the conversational case intake</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSetupVaultName(selectedVaultName || "");
                    setIsSetupOpen(true);
                  }}
                  className="flex items-center gap-1.5 border border-white/5 hover:border-white/10 bg-[#101118]/50 hover:bg-[#151722] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-blue-400" />
                  New Blueprint
                </button>
              </div>

              {/* Blueprints in Vault List */}
              <div className="space-y-2">
                {(!selectedVaultName || !templates[selectedVaultName] || templates[selectedVaultName].length === 0) ? (
                  <div className="p-8 text-center text-xs text-slate-500 italic">No blueprints compiled in this vault folder.</div>
                ) : (
                  templates[selectedVaultName].map((tmpl) => (
                    <div
                      key={tmpl.template_id}
                      className="p-4 rounded-lg border border-white/5 bg-[#0f1016]/40 hover:bg-[#121319] hover:border-white/10 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-semibold text-slate-200 truncate">{tmpl.template_name}</span>
                      </div>
                      <button
                        onClick={() => handleStartIntake(tmpl.template_id, tmpl.template_name)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        Start Intake
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* HISTORY LIST VIEW */}
          {sidebarSelection === "history" && currentView === "vaults_list" && (
            <div className="p-8 space-y-6 max-w-4xl w-full mx-auto">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HistoryIcon className="h-5 w-5 text-blue-500" />
                  Compilation History
                </h2>
                <p className="text-slate-400 text-xs mt-1">Reopen previously generated drafts and completed litigation files.</p>
              </div>

              {isLoadingHistory ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="text-xs uppercase tracking-wider">Fetching History from Backend...</span>
                </div>
              ) : historyDocIds.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/5 rounded-xl text-slate-500">
                  No historical entries compiled for this user yet. Start an intake to generate a document.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyDocIds.map((docId) => (
                    <button
                      key={docId}
                      onClick={() => handleLoadHistory(docId, `Document ${docId.substring(0, 8)}`)}
                      className="w-full p-4 rounded-xl border border-white/5 bg-[#0f1016]/40 hover:bg-[#12141d] hover:border-white/10 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                          <FileCode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-200 truncate">Document Draft</div>
                          <div className="text-[10px] text-slate-500 mt-1">ID: {docId}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-blue-400 hover:text-blue-300">Reopen Workspace →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INTAKE WORKSPACE VIEW (SPLIT LAYOUT) */}
          {currentView === "intake" && (
            <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
              {/* Left Chat Screen */}
              <Panel defaultSize={50} minSize={20} className="flex flex-col bg-[#090a0f]">
                <div className="p-4 border-b border-white/5 bg-[#0b0c10]/40 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Case Intake Chat</span>
                  <span className="text-[10px] text-blue-400 font-semibold">{intakeProgress}% complete</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {intakeHistory.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.sender === "ai" && (
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-blue-400" />
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-lg p-3 text-sm leading-relaxed ${msg.sender === "user" ? "bg-blue-600 text-white" : "bg-[#141620] text-slate-300 border border-white/5"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isIntakeLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-blue-400 animate-spin" />
                      </div>
                      <div className="max-w-[75%] rounded-lg p-3 text-sm bg-[#141620] text-slate-400 border border-white/5 italic">
                        Agent compiling details...
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-2 border-t border-white/5 bg-[#0b0c10]/40">
                  <div className="w-full bg-[#1b1c24] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${intakeProgress}%` }}></div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/5 space-y-3 bg-[#0a0c10]">
                  {/* Guidance Display */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 bg-[#121319]/30 p-2 rounded border border-white/5">
                    <span><strong>Recommended:</strong> Up to 10 pages</span>
                    <span><strong>Supported:</strong> PDF, DOCX (Max 20MB)</span>
                  </div>

                  {/* Attached Files List */}
                  {intakeFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-white/5">
                      {intakeFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] bg-blue-950/40 text-blue-300 px-2.5 py-1 rounded border border-blue-500/20">
                          <FileText className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                          <span className="text-slate-500">({(file.size / 1024).toFixed(0)} KB)</span>
                          <button
                            type="button"
                            onClick={() => setIntakeFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-white ml-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {intakeUploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Uploading files...</span>
                        <span>{intakeUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-[#1b1c24] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${intakeUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={intakeFileInputRef}
                      className="hidden"
                      multiple
                      accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                      onChange={handleAddIntakeFile}
                      disabled={isIntakeLoading}
                    />
                    <button
                      type="button"
                      onClick={() => intakeFileInputRef.current?.click()}
                      disabled={isIntakeLoading}
                      className="bg-[#1b1c24] hover:bg-[#222430] disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-300 border border-white/5 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Attach
                    </button>

                    <textarea
                      rows={2}
                      value={intakeMessage}
                      onChange={(e) => setIntakeMessage(e.target.value)}
                      placeholder="Enter case facts or answer agent questions..."
                      className="flex-1 bg-[#121319] border border-white/5 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none"
                      disabled={isIntakeLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendIntakeMessage();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendIntakeMessage}
                      disabled={isIntakeLoading || (!intakeMessage.trim() && intakeFiles.length === 0)}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg px-4 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {isIntakeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-[#151722] hover:bg-blue-500/50 cursor-col-resize transition-colors" />

              {/* Right Panel: Waiting state */}
              <Panel defaultSize={50} minSize={20} className="flex flex-col justify-center items-center bg-[#07080a] p-8 text-center text-slate-500">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center mb-4">
                  <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Waiting for Intake Details</h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Provide your claims and answers in the chat. The agent will analyze your facts and automatically construct the legal document preview when ready.
                </p>
              </Panel>
            </PanelGroup>
          )}

          {/* DOCUMENT WORKSPACE VIEW (SPLIT LAYOUT) */}
          {currentView === "document" && (
            <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
              {/* Left Edit chat panel */}
              <Panel defaultSize={35} minSize={20} className="flex flex-col bg-[#090a0f]">
                <div className="p-4 border-b border-white/5 bg-[#0b0c10]/40 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Edit With Agent</span>
                    <span className="text-[10px] text-slate-500">Ask for modifications or layout changes</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAcceptDocument} className="bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white px-3 py-1 rounded text-xs font-semibold transition-all">
                      Accept
                    </button>
                    <button onClick={handleRejectDocument} className="bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white px-3 py-1 rounded text-xs font-semibold transition-all">
                      Reject
                    </button>
                  </div>
                </div>

                {hasUnsavedEdits && (
                  <div className="mx-4 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-400">
                    <span className="text-sm leading-none">⚠️</span>
                    <div className="space-y-0.5">
                      <div className="font-semibold">Unsaved Edits Detected</div>
                      <div className="text-[10px] text-slate-400 leading-normal">
                        Click <strong className="text-emerald-400">Accept</strong> at the top to save your changes to the cloud. Unaccepted edits will be lost after the session expires.
                      </div>
                    </div>
                  </div>
                )}

                <div className="m-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg flex gap-3 text-xs text-blue-300">
                  <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Tell me what to change. I will update the blueprint and refresh the preview on the right.</span>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
                  {editHistory.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 p-8">
                      <MessageSquare className="h-8 w-8 text-slate-600 mb-2" />
                      <span className="text-xs italic">No modifications submitted yet.</span>
                    </div>
                  ) : (
                    editHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.sender === "ai" && (
                          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${msg.sender === "user" ? "bg-blue-600 text-white" : "bg-[#141620] text-slate-300 border border-white/5"}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {isEditLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                      </div>
                      <div className="max-w-[80%] rounded-lg p-3 text-xs bg-[#141620] text-slate-400 border border-white/5 italic">
                        Compiling edits...
                      </div>
                    </div>
                  )}
                  {editorError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-mono whitespace-pre-wrap">
                      {editorError}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-white/5 space-y-3 bg-[#0a0c10]">
                  {/* Guidance Display */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 bg-[#121319]/30 p-2 rounded border border-white/5">
                    <span><strong>Recommended:</strong> Up to 10 pages</span>
                    <span><strong>Supported:</strong> PDF, DOCX (Max 20MB)</span>
                  </div>

                  {/* Attached Files List */}
                  {editFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-white/5">
                      {editFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] bg-blue-950/40 text-blue-300 px-2.5 py-1 rounded border border-blue-500/20">
                          <FileText className="h-3 w-3 text-blue-400 shrink-0" />
                          <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                          <span className="text-slate-500">({(file.size / 1024).toFixed(0)} KB)</span>
                          <button
                            type="button"
                            onClick={() => setEditFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-white ml-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {editUploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Uploading files...</span>
                        <span>{editUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-[#1b1c24] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${editUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      className="hidden"
                      multiple
                      accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                      onChange={handleAddEditFile}
                      disabled={isEditLoading}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isEditLoading}
                      className="bg-[#1b1c24] hover:bg-[#222430] disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-300 border border-white/5 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Attach
                    </button>

                    <textarea
                      rows={2}
                      value={editInstruction}
                      onChange={(e) => setEditInstruction(e.target.value)}
                      placeholder="Example: Rewrite section to make it more professional, update claims facts..."
                      className="flex-1 bg-[#121319] border border-white/5 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 resize-none font-sans"
                      disabled={isEditLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendEditInstruction();
                        }
                      }}
                    />
                    <button
                      onClick={handleSendEditInstruction}
                      disabled={isEditLoading || (!editInstruction.trim() && editFiles.length === 0)}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg px-4 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      {isEditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-[#151722] hover:bg-blue-500/50 cursor-col-resize transition-colors" />

              {/* Right Sandbox Preview Screen */}
              <Panel defaultSize={65} minSize={30} className="flex flex-col bg-[#0b0c10]/40">
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-[#0b0c10]/20 bg-[#0b0c10]/20 min-h-[50px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Page Preview</span>
                    {!isCompilingDoc && (
                      <div className="flex gap-1">
                        {Array.from({ length: previewPageCount }, (_, i) => i + 1).map(pNum => (
                          <button
                            key={pNum}
                            onClick={() => setSelectedPage(pNum)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${selectedPage === pNum ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-slate-200"}`}
                          >
                            Page {pNum}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isCompilingDoc && (
                    <button onClick={handleDownloadDocument} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white px-3 py-1.5 rounded transition-all active:scale-95">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-[#07080a] p-6 overflow-y-auto flex flex-col justify-center items-center text-center text-slate-500">
                  {isCompilingDoc ? (
                    <div className="space-y-4 max-w-sm">
                      <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto shadow-md">
                        <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-300">Analyzing information, generating document preview...</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Our agent is parsing the intake facts and compiling your document code. This can take up to 20-30 seconds.
                      </p>
                    </div>
                  ) : (
                    <iframe
                      ref={iframeRef}
                      src="/sandbox.html?v=4"
                      className="w-full h-full border-0 rounded-lg min-h-[500px]"
                      title="Document sandbox"
                    />
                  )}
                </div>
              </Panel>
            </PanelGroup>
          )}

        </div>
      </main>

      {/* 3. Setup Blueprint Centered Modal Dialog */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl glass border border-white/10 shadow-2xl relative animate-fade-in">

            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Create Blueprint</h3>
              <button onClick={() => setIsSetupOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBlueprint} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Vault Folder Name</label>
                <input
                  type="text"
                  value={setupVaultName}
                  onChange={(e) => setSetupVaultName(e.target.value)}
                  placeholder="e.g. Motor Accident Claims"
                  className="w-full bg-[#121319] border border-white/5 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Blueprint File Name</label>
                <input
                  type="text"
                  value={setupBlueprintName}
                  onChange={(e) => setSetupBlueprintName(e.target.value)}
                  placeholder="e.g. MVC Claim Petition"
                  className="w-full bg-[#121319] border border-white/5 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Upload Blueprint Document</label>

                {/* Guidance Display */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-2 bg-[#121319]/30 p-2 rounded border border-white/5">
                  <span><strong>Recommended:</strong> Up to 20 pages</span>
                  <span><strong>Max size:</strong> 20 MB</span>
                </div>

                <div
                  className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${setupFile
                    ? "border-blue-500/50 bg-blue-500/5 text-blue-400 font-semibold"
                    : "border-white/10 hover:border-blue-500/30 hover:bg-white/5 bg-[#121319]/50 text-slate-400"
                    }`}
                  onClick={() => setupFileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={setupFileInputRef}
                    accept=".docx,.pdf"
                    className="hidden"
                    onChange={handleSetupFileChange}
                    disabled={setupIsSubmitting}
                  />

                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400">
                      <Upload className="h-6 w-6" />
                    </div>
                    {setupFile ? (
                      <div className="w-full">
                        <p className="text-xs font-semibold text-white truncate max-w-xs mx-auto">{setupFile.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{(setupFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Click to upload or drag & drop</p>
                        <p className="text-[10px] text-slate-500 mt-1">Only DOCX and PDF files are supported</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar during upload */}
                {setupUploadProgress !== null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                      <span>Uploading document...</span>
                      <span>{setupUploadProgress}%</span>
                    </div>
                    <div className="w-full bg-[#1b1c24] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${setupUploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {setupError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2 text-center">
                  {setupError}
                </div>
              )}

              <button
                type="submit"
                disabled={setupIsSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all flex items-center justify-center gap-2"
              >
                {setupIsSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compiling Blueprint...
                  </>
                ) : "Create Blueprint"}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* 4. Premium Upgrade Centered Modal Dialog */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl glass border border-amber-500/30 bg-[#0d0e12]/95 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden">
            {/* Ambient gold background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center p-5 border-b border-white/5 relative z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Upgrade to Premium</h3>
              </div>
              <button onClick={() => setIsUpgradeModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-center relative z-10">
              <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
                <Sparkles className="h-8 w-8 text-black" />
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-semibold text-white">Document limit reached</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  {upgradeModalMessage}
                </p>
              </div>

              <div className="bg-[#121319]/70 border border-white/5 rounded-lg p-3 text-left text-[11px] text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-amber-400" />
                  <span>Upload documents up to 100 pages</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-amber-400" />
                  <span>Support files up to 20 MB size</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-amber-400" />
                  <span>Unlimited contract drafts & AI sections edits</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => {
                    triggerToast("Successfully upgraded to Premium!", "success");
                    setIsUpgradeModalOpen(false);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-amber-500/10"
                >
                  Upgrade to Premium
                </button>
                <button
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-slate-300 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
