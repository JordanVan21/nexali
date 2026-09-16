import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Click-to-upload and drag-and-drop receipt image intake, supporting
 * multiple files in one go. No file leaves the browser here -- selected
 * files are handed to the caller, which runs them through
 * lib/receiptParser.ts (see useSplitExpensesState.ts).
 */
export function ReceiptUploadArea({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList).filter((f) => f.type.startsWith("image/")));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    // Reset so selecting the exact same file again still fires onChange.
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "nexali-panel flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-outline-variant/60"
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <UploadCloud className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <label
          htmlFor="split-receipt-upload"
          className="cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
        >
          Click to upload
        </label>
        <span className="text-muted-foreground"> or drag and drop receipt photos</span>
      </div>
      <p className="text-xs text-muted-foreground">Add one or more receipts (JPG, PNG, HEIC)</p>
      <input
        ref={inputRef}
        id="split-receipt-upload"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  );
}
