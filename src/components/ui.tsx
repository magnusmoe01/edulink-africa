import { useEffect, useRef, useState } from "react";
import { Bold, ChevronRight, Heading2, ImagePlus, Italic, List, ListOrdered, Quote } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Guardian } from "../types";
import { navigate } from "../lib/navigate";

const MAX_IMAGE_UPLOAD_BYTES = 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "1MB";

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function prepareImageUpload(
  file: File,
  {
    maxWidth,
    maxHeight,
    quality,
    cropSquare = false,
    requireSquare = false,
    format = "jpeg",
  }: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    cropSquare?: boolean;
    requireSquare?: boolean;
    format?: "jpeg" | "png";
  },
) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      reject(new Error(`Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        if (requireSquare && image.width !== image.height) {
          reject(new Error("Logo image must be square."));
          return;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Could not resize image"));
          return;
        }

        if (cropSquare) {
          const size = Math.min(maxWidth, maxHeight);
          const sourceSize = Math.min(image.width, image.height);
          const sourceX = (image.width - sourceSize) / 2;
          const sourceY = (image.height - sourceSize) / 2;

          canvas.width = size;
          canvas.height = size;
          context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
          resolve(canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", quality));
          return;
        }

        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", quality));
      };
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

export function AboutBackButton({ schoolId }: { schoolId: string }) {
  return (
    <button className="about-back-button" type="button" onClick={() => navigate(`/${schoolId}/about`)}>
      <ChevronRight size={18} />
      Back to about
    </button>
  );
}

export function ContentSection({ title, action, actionHref, children }: { title: string; action?: string; actionHref?: string; children: React.ReactNode }) {
  return (
    <section className="content-section" id={title.toLowerCase().split(" ")[0]}>
      <div className="section-heading">
        <h2>{title}</h2>
        {action ? (
          <button type="button" onClick={() => actionHref ? navigate(actionHref) : undefined}>
            {action}
            <ChevronRight size={18} />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-panel" id={title.toLowerCase()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="contact-line">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function EditorPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="editor-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TextInput({ label, value, onChange, icon, disabled }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="field-label">
      {label}
      <span className="input-shell">
        {icon}
        <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </label>
  );
}

export function CheckboxInput({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function CheckboxGroup({
  label,
  options,
  values,
  onChange,
  allowSelectAll = false,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  allowSelectAll?: boolean;
}) {
  const valueSet = new Set(values);
  const optionValues = options.map((option) => option.value);
  const allSelected = optionValues.length > 0 && optionValues.every((value) => valueSet.has(value));

  return (
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
      {allowSelectAll ? (
        <div className="checkbox-group-actions">
          <CheckboxInput
            label="Select all"
            checked={allSelected}
            onChange={(checked) => onChange(checked ? mergeUnique([...values, ...optionValues]) : values.filter((value) => !optionValues.includes(value)))}
          />
        </div>
      ) : null}
      <div>
        {options.map((option) => (
          <CheckboxInput
            key={option.value}
            label={option.label}
            checked={valueSet.has(option.value)}
            onChange={(checked) => {
              onChange(checked ? mergeUnique([...values, option.value]) : values.filter((value) => value !== option.value));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function GuardianEditor({ guardians, onChange }: { guardians: Guardian[]; onChange: (guardians: Guardian[]) => void }) {
  return (
    <section className="guardian-editor">
      <div className="guardian-editor-heading">
        <h3>Guardians</h3>
        <button
          className="secondary-action"
          type="button"
          onClick={() => onChange([...guardians, { id: `guardian-${Date.now()}`, name: "", email: "", phone: "", relationship: "" }])}
        >
          Add guardian
        </button>
      </div>
      {guardians.length === 0 ? (
        <p>No guardians registered yet.</p>
      ) : (
        <div className="guardian-list">
          {guardians.map((guardian, index) => (
            <div className="guardian-card" key={guardian.id}>
              <TextInput
                label="Guardian name"
                value={guardian.name}
                onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, name: value } : item))}
              />
              <div className="split-fields">
                <TextInput
                  label="Relationship"
                  value={guardian.relationship ?? ""}
                  onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, relationship: value } : item))}
                />
                <TextInput
                  label="Phone"
                  value={guardian.phone ?? ""}
                  onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, phone: value } : item))}
                />
              </div>
              <TextInput
                label="Email"
                value={guardian.email ?? ""}
                onChange={(value) => onChange(guardians.map((item, currentIndex) => currentIndex === index ? { ...item, email: value } : item))}
              />
              <button className="remove-button" type="button" onClick={() => onChange(guardians.filter((_, currentIndex) => currentIndex !== index))}>
                Remove guardian
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RegistrationModal({
  title,
  eyebrow,
  submitLabel,
  wide = false,
  onClose,
  onSubmit,
  onRemove,
  children,
}: {
  title: string;
  eyebrow: string;
  submitLabel: string;
  wide?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className={`staff-modal ${wide ? "wide-staff-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
        <div className="staff-modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="staff-modal-title">{title}</h2>
          </div>
        </div>
        <div className="staff-modal-body">
          {children}
        </div>
        <div className="staff-modal-actions">
          {onRemove ? (
            <button className="remove-button modal-remove-button" type="button" onClick={onRemove}>
              Remove
            </button>
          ) : null}
          <div className="staff-modal-actions-right">
            <button className="secondary-action" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-action" type="button" onClick={onSubmit}>
              {submitLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ImageUpload({
  label,
  value,
  onChange,
  variant = "wide",
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "wide" | "square" | "hero" | "logo" | "strictSquare";
  hideLabel?: boolean;
}) {
  const [status, setStatus] = useState(
    variant === "logo"
      ? `Choose a square logo up to ${MAX_IMAGE_UPLOAD_LABEL}.`
      : variant === "strictSquare"
        ? `Choose a square image up to ${MAX_IMAGE_UPLOAD_LABEL}.`
        : `Choose an image up to ${MAX_IMAGE_UPLOAD_LABEL}.`,
  );

  const uploadImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setStatus("Preparing image...");
    try {
      const nextImage = await prepareImageUpload(file,
        variant === "logo" || variant === "strictSquare"
          ? { requireSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.88, format: "png" as const }
          : variant === "square"
            ? { cropSquare: true, maxWidth: 512, maxHeight: 512, quality: 0.82 }
            : { maxWidth: 1600, maxHeight: 900, quality: 0.84 });
      onChange(nextImage);
      setStatus("Image uploaded successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  return (
    <div className="field-label image-upload-field">
      {hideLabel ? null : <span>{label}</span>}
      <div className="image-upload-control">
        <div className={`image-upload-preview ${variant === "square" || variant === "logo" || variant === "strictSquare" ? "square-image-preview" : ""} ${variant === "hero" ? "hero-image-preview" : ""}`}>
          {value ? <img src={value} alt="" /> : <ImagePlus size={24} />}
        </div>
        <div>
          <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <p>{status}</p>
          {value ? (
            <button className="remove-button" type="button" onClick={() => onChange("")}>
              Remove image
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RichTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageStatus, setImageStatus] = useState("");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) {
      return;
    }
    editor.innerHTML = value;
  }, [value]);

  const syncValue = () => {
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setImageStatus("Preparing image...");
    try {
      const imageUrl = await prepareImageUpload(file, { maxWidth: 1200, maxHeight: 900, quality: 0.84 });
      runCommand("insertHTML", `<figure><img src="${escapeHtmlAttribute(imageUrl)}" alt="" /></figure><p><br></p>`);
      setImageStatus("Image inserted.");
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  return (
    <div className="field-label rich-text-field">
      <span>{label}</span>
      <div className="rich-text-toolbar" aria-label={`${label} formatting controls`}>
        <button type="button" onClick={() => runCommand("formatBlock", "h2")} title="Heading">
          <Heading2 size={18} />
        </button>
        <button type="button" onClick={() => runCommand("bold")} title="Bold">
          <Bold size={18} />
        </button>
        <button type="button" onClick={() => runCommand("italic")} title="Italic">
          <Italic size={18} />
        </button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")} title="Bullet list">
          <List size={18} />
        </button>
        <button type="button" onClick={() => runCommand("insertOrderedList")} title="Numbered list">
          <ListOrdered size={18} />
        </button>
        <button type="button" onClick={() => runCommand("formatBlock", "blockquote")} title="Quote">
          <Quote size={18} />
        </button>
        <button type="button" onClick={() => runCommand("formatBlock", "p")} title="Paragraph">
          P
        </button>
        <button type="button" onClick={() => imageInputRef.current?.click()} title="Image">
          <ImagePlus size={18} />
        </button>
        <input
          ref={imageInputRef}
          className="rich-text-image-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            void insertImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {imageStatus ? <p className="rich-text-status">{imageStatus}</p> : null}
      <div
        ref={editorRef}
        className="rich-text-editor"
        contentEditable
        suppressContentEditableWarning
        onBlur={syncValue}
        onInput={syncValue}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminCardTitle({ icon, title }: { icon: IconDefinition; title: string }) {
  return (
    <strong className="admin-card-title">
      <FontAwesomeIcon icon={icon} fixedWidth />
      <span>{title}</span>
    </strong>
  );
}

export function Repeater<T>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (item: T) => void) => React.ReactNode;
  createItem: () => T;
  addLabel: string;
}) {
  return (
    <div className="repeater">
      <button className="secondary-action repeater-add-button" type="button" onClick={() => onChange([...items, createItem()])}>
        {addLabel}
      </button>
      {items.map((item, index) => (
        <div className="repeater-item" key={index}>
          {renderItem(item, (nextItem) => onChange(items.map((current, currentIndex) => (currentIndex === index ? nextItem : current))))}
          <button className="remove-button" type="button" onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
