import { useState } from "react";
import { Plus } from "lucide-react";
import type { School, SchoolChatMessage, StaffMember, SubjectClass } from "../types";

type SchoolWorkIdentity =
  | { role: "admin"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "teacher"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "viewer"; label: string; subjectClasses: SubjectClass[]; studentId?: undefined }
  | { role: "student"; label: string; subjectClasses: SubjectClass[]; studentId: string };

type ChatParticipant = {
  id: string;
  name: string;
  role: "admin" | "teacher" | "staff" | "student";
};

export function SchoolChatPopup({
  school,
  identity,
  messages,
  onClose,
  onMessagesChange,
}: {
  school: School;
  identity: SchoolWorkIdentity;
  messages: SchoolChatMessage[];
  onClose: () => void;
  onMessagesChange: (messages: SchoolChatMessage[]) => void;
}) {
  const currentUser = getCurrentChatParticipant(school, identity);
  const participants = getSchoolChatParticipants(school);
  const recipients = participants.filter((participant) => canMessageParticipant(currentUser, participant, Boolean(school.schoolWorkSettings?.allowStudentMessaging)));
  const conversationRecipients = recipients.filter((participant) => messages.some((message) =>
    (message.fromId === currentUser.id && message.toId === participant.id) ||
    (message.fromId === participant.id && message.toId === currentUser.id)));
  const [recipientId, setRecipientId] = useState(() => conversationRecipients[0]?.id ?? "");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [body, setBody] = useState("");
  const activeRecipient = recipients.find((participant) => participant.id === recipientId) ?? conversationRecipients[0] ?? null;
  const searchableRecipients = recipients.filter((participant) =>
    `${participant.name} ${participant.role}`.toLowerCase().includes(recipientSearch.trim().toLowerCase()));
  const threadMessages = activeRecipient
    ? messages
      .filter((message) =>
        (message.fromId === currentUser.id && message.toId === activeRecipient.id) ||
        (message.fromId === activeRecipient.id && message.toId === currentUser.id))
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
    : [];
  const selectChatRecipient = (participantId: string) => {
    setRecipientId(participantId);
    setRecipientPickerOpen(false);
    setRecipientSearch("");
  };

  const sendMessage = () => {
    const trimmedBody = body.trim();
    if (!trimmedBody || !activeRecipient) {
      return;
    }
    onMessagesChange([
      ...messages,
      {
        id: `message-${Date.now()}`,
        fromId: currentUser.id,
        fromName: currentUser.name,
        toId: activeRecipient.id,
        toName: activeRecipient.name,
        body: trimmedBody,
        createdAt: new Date().toISOString(),
      },
    ]);
    setBody("");
  };

  return (
    <div className="modal-backdrop chat-popup-backdrop" role="presentation">
      <section className="chat-popup" role="dialog" aria-modal="true" aria-labelledby="chat-popup-title">
        <div className="chat-popup-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h2 id="chat-popup-title">School chat</h2>
          </div>
          <button className="secondary-action" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="chat-popup-layout">
          <aside className="chat-recipient-list">
            <div className="chat-recipient-heading">
              <strong>Conversations</strong>
              <button className="icon-action" type="button" onClick={() => setRecipientPickerOpen((open) => !open)} aria-label="Start conversation">
                <Plus size={16} />
              </button>
            </div>
            {conversationRecipients.length === 0 ? (
              <p>No conversations yet.</p>
            ) : conversationRecipients.map((participant) => (
              <button
                className={participant.id === activeRecipient?.id ? "active-chat-recipient" : ""}
                key={participant.id}
                type="button"
                onClick={() => selectChatRecipient(participant.id)}
              >
                <strong>{participant.name}</strong>
                <span>{participant.role}</span>
              </button>
            ))}
          </aside>
          <section className="chat-thread">
            {recipientPickerOpen ? (
              <div className="chat-recipient-picker chat-recipient-picker-main">
                <div className="chat-thread-heading">
                  <div>
                    <h3>Start a new chat</h3>
                    <span>Choose a recipient</span>
                  </div>
                  <button className="secondary-action" type="button" onClick={() => setRecipientPickerOpen(false)}>Cancel</button>
                </div>
                <input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Search users" />
                <div className="chat-recipient-picker-list">
                  {searchableRecipients.length === 0 ? <p>No matching users.</p> : searchableRecipients.map((participant) => (
                    <button
                      className="chat-recipient-picker-option"
                      key={participant.id}
                      type="button"
                      onClick={() => selectChatRecipient(participant.id)}
                    >
                      <strong>{participant.name}</strong>
                      <span>{participant.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : activeRecipient ? (
              <>
                <div className="chat-thread-heading">
                  <h3>{activeRecipient.name}</h3>
                  <span>{activeRecipient.role}</span>
                </div>
                <div className="chat-message-list">
                  {threadMessages.length === 0 ? (
                    <div className="empty-editor-state">
                      <h3>No messages yet</h3>
                      <p>Start the conversation below.</p>
                    </div>
                  ) : threadMessages.map((message) => (
                    <article className={message.fromId === currentUser.id ? "chat-message own-chat-message" : "chat-message"} key={message.id}>
                      <strong>{message.fromName}</strong>
                      <p>{message.body}</p>
                      <time>{formatDateTime(message.createdAt)}</time>
                    </article>
                  ))}
                </div>
                <form
                  className="chat-compose"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                >
                  <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Write a message" />
                  <button className="primary-action" type="submit">Send</button>
                </form>
              </>
            ) : (
              <div className="empty-editor-state">
                <h3>No recipients available</h3>
                <p>Messaging is limited by the school chat settings.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function getCurrentChatParticipant(school: School, identity: SchoolWorkIdentity): ChatParticipant {
  if (identity.role === "student") {
    const student = school.students.find((item) => item.id === identity.studentId);
    return {
      id: `student:${identity.studentId}`,
      name: student ? `${student.firstName} ${student.lastName}` : identity.label,
      role: "student",
    };
  }
  if (identity.role === "admin") {
    return { id: `admin:${school.id}`, name: identity.label || "School admin", role: "admin" };
  }
  const staffMember = school.staff.find((member) => member.name === identity.label);
  return {
    id: `staff:${staffMember?.email || identity.label}`,
    name: staffMember?.name || identity.label,
    role: identity.role === "teacher" ? "teacher" : "staff",
  };
}

function getSchoolChatParticipants(school: School): ChatParticipant[] {
  return [
    { id: `admin:${school.id}`, name: "School admin", role: "admin" },
    ...school.staff.map((member) => ({
      id: `staff:${member.email || member.name}`,
      name: member.name,
      role: hasStaffCategory(member, "Teacher") ? "teacher" as const : "staff" as const,
    })),
    ...school.students.map((student) => ({
      id: `student:${student.id}`,
      name: `${student.firstName} ${student.lastName}`,
      role: "student" as const,
    })),
  ];
}

function canMessageParticipant(currentUser: ChatParticipant, recipient: ChatParticipant, allowStudentMessaging: boolean) {
  if (currentUser.id === recipient.id) {
    return false;
  }
  if (currentUser.role === "student" && recipient.role === "student") {
    return allowStudentMessaging;
  }
  return true;
}

function hasStaffCategory(member: StaffMember, category: NonNullable<StaffMember["categories"]>[number]) {
  const categories = member.categories?.length ? member.categories : [member.category ?? "Other"];
  return categories.includes(category);
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
