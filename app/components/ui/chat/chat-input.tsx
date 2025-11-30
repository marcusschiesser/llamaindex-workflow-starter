"use client";

import { ChatInput, useChatUI, useFile } from "@llamaindex/chat-ui";
import { DocumentInfo, ImagePreview } from "@llamaindex/chat-ui/widgets";

export default function CustomChatInput() {
  const { requestData, isLoading, input } = useChatUI();
  const uploadAPI = "/api/upload";
  const {
    image,
    setImage,
    uploadFile,
    files,
    removeDoc,
    reset,
    getAttachments,
  } = useFile({ uploadAPI });

  /**
   * Handles file uploads. Overwrite to hook into the file upload behavior.
   * @param file The file to upload
   */
  const handleUploadFile = async (file: File) => {
    // There's already an image uploaded, only allow one image at a time
    if (image) {
      alert("You can only upload one image at a time.");
      return;
    }

    try {
      // Upload the file and send with it the current request data
      await uploadFile(file, requestData);
    } catch (error: unknown) {
      // Show error message if upload fails
      alert(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    }
  };

  // Get references to the upload files in message annotations format, see https://github.com/run-llama/chat-ui/blob/main/packages/chat-ui/src/hook/use-file.tsx#L56
  const attachments = getAttachments();

  return (
    <ChatInput resetUploadedFiles={reset} attachments={attachments}>
      {/* Image preview section */}
      {image && (
        <ImagePreview url={image.url} onRemove={() => setImage(null)} />
      )}
      {/* Document previews section */}
      {files.length > 0 && (
        <div className="flex w-full gap-4 overflow-auto py-2">
          {files.map((file) => (
            <DocumentInfo
              key={file.id}
              document={{ url: file.url, sources: [] }}
              className="mt-2 mb-2"
              onRemove={() => removeDoc(file)}
            />
          ))}
        </div>
      )}
      <ChatInput.Form>
        <ChatInput.Field />
        {uploadAPI && <ChatInput.Upload onUpload={handleUploadFile} />}
        <ChatInput.Submit
          disabled={
            isLoading || (!input.trim() && files.length === 0 && !image)
          }
        />
      </ChatInput.Form>
    </ChatInput>
  );
}
