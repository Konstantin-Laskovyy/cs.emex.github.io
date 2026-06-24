import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { ChatConversationPublic, ChatMessagePublic, UserPublic } from "../api/types";

function initials(user: Pick<UserPublic, "first_name" | "last_name">) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState<UserPublic | null>(null);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [conversations, setConversations] = useState<ChatConversationPublic[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessagePublic[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const requestedUserId = useMemo(() => {
    const value = Number(searchParams.get("user"));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);

  const conversationByUserId = useMemo(() => {
    return new Map(conversations.map((item) => [item.user.id, item]));
  }, [conversations]);

  const chatUsers = useMemo(() => {
    return conversations.map((item) => item.user);
  }, [conversations]);

  const availableUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users
      .filter((user) => user.id !== me?.id && user.access_enabled)
      .filter((user) => {
        if (!query) return true;
        return `${user.first_name} ${user.last_name} ${user.email} ${user.title ?? ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "ru"));
  }, [me?.id, userSearch, users]);

  const selectedUser =
    chatUsers.find((user) => user.id === selectedUserId) ??
    users.find((user) => user.id === selectedUserId) ??
    null;

  async function loadConversations() {
    const data = await apiFetch<ChatConversationPublic[]>("/chat/conversations");
    setConversations(data);
  }

  async function loadMessages(userId: number, showLoading = true) {
    if (showLoading) setMessagesLoading(true);
    try {
      const data = await apiFetch<ChatMessagePublic[]>(`/chat/conversations/${userId}/messages`);
      setMessages(data);
      await loadConversations();
    } finally {
      if (showLoading) setMessagesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<UserPublic>("/users/me"),
      apiFetch<UserPublic[]>("/users"),
      apiFetch<ChatConversationPublic[]>("/chat/conversations"),
    ])
      .then(([meData, usersData, conversationData]) => {
        if (cancelled) return;
        setMe(meData);
        setUsers(usersData);
        setConversations(conversationData);
        const initialUserId =
          requestedUserId && requestedUserId !== meData.id
            ? requestedUserId
            : conversationData[0]?.user.id ?? null;
        setSelectedUserId(initialUserId);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить чат.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (requestedUserId && requestedUserId !== me?.id) {
      setSelectedUserId(requestedUserId);
    }
  }, [me?.id, requestedUserId]);

  useEffect(() => {
    if (selectedUserId) {
      setSearchParams({ user: String(selectedUserId) }, { replace: true });
      void loadMessages(selectedUserId);
    } else {
      setMessages([]);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    const intervalId = window.setInterval(() => {
      void loadMessages(selectedUserId, false);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [selectedUserId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId || !draft.trim()) return;

    const content = draft.trim();
    setDraft("");
    const created = await apiFetch<ChatMessagePublic>(`/chat/conversations/${selectedUserId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    setMessages((current) => [...current, created]);
    await loadConversations();
  }

  return (
    <section className="chatPage">
      <div className="card pageHero">
        <div className="cardInner">
          <span className="newsBadge">Внутренний чат</span>
          <h1>Сообщения между сотрудниками</h1>
          <p className="muted">Выберите сотрудника и напишите ему личное сообщение.</p>
        </div>
      </div>

      <div className="chatLayout">
        <aside className="card chatSidebar">
          <div className="cardInner">
            <div className="chatSectionTitle">Сотрудники</div>
            {loading && <div className="muted">Загрузка...</div>}
            {error && <div className="errorBox">{error}</div>}
            <div className="chatUserList">
              {chatUsers.map((user) => {
                const conversation = conversationByUserId.get(user.id);
                return (
                  <button
                    className={`chatUser ${selectedUserId === user.id ? "chatUserActive" : ""}`}
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setSearchParams({ user: String(user.id) });
                      setNewChatOpen(false);
                    }}
                  >
                    <span className="avatar chatAvatar">{initials(user)}</span>
                    <span className="chatUserText">
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <small>{conversation?.last_message?.content || user.title || "Нет сообщений"}</small>
                    </span>
                    {Boolean(conversation?.unread_count) && <b className="chatUnread">{conversation?.unread_count}</b>}
                  </button>
                );
              })}
              {!loading && chatUsers.length === 0 && (
                <div className="chatEmpty">Диалогов пока нет. Начните новый чат.</div>
              )}
            </div>
            <div className="chatSidebarFooter">
              <button className="btn btnPrimary" type="button" onClick={() => setNewChatOpen(true)}>
                Новый чат
              </button>
            </div>
          </div>
        </aside>

        <section className="card chatPanel">
          <div className="cardInner">
            {selectedUser ? (
              <>
                <div className="chatPanelHeader">
                  <div>
                    <h2>
                      {selectedUser.first_name} {selectedUser.last_name}
                    </h2>
                    <p className="muted">{selectedUser.title || "Сотрудник"}</p>
                  </div>
                  <button className="btn" type="button" onClick={() => selectedUserId && loadMessages(selectedUserId)}>
                    Обновить
                  </button>
                </div>

                <div className="chatMessages">
                  {messagesLoading && <div className="muted">Загрузка сообщений...</div>}
                  {!messagesLoading && messages.length === 0 && (
                    <div className="chatEmpty">Сообщений пока нет. Начните диалог.</div>
                  )}
                  {messages.map((message) => {
                    const mine = message.sender_id === me?.id;
                    return (
                      <div className={`chatBubbleRow ${mine ? "chatBubbleMine" : ""}`} key={message.id}>
                        <div className="chatBubble">
                          <p>{message.content}</p>
                          <span>{formatChatTime(message.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form className="chatComposer" onSubmit={sendMessage}>
                  <textarea
                    className="input"
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Напишите сообщение..."
                  />
                  <button className="btn btnPrimary" type="submit" disabled={!draft.trim()}>
                    Отправить
                  </button>
                </form>
              </>
            ) : (
              <div className="chatEmpty">Нет сотрудников для переписки.</div>
            )}
          </div>
        </section>
      </div>

      {newChatOpen && (
        <div className="chatModalBackdrop" role="presentation" onMouseDown={() => setNewChatOpen(false)}>
          <div className="chatModal card" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="cardInner">
              <div className="chatPanelHeader">
                <div>
                  <h2>Новый чат</h2>
                  <p className="muted">Найдите сотрудника или выберите из списка.</p>
                </div>
                <button className="btn" type="button" onClick={() => setNewChatOpen(false)}>
                  Закрыть
                </button>
              </div>
              <input
                className="input chatSearchInput"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Поиск по имени, email или должности"
                autoFocus
              />
              <div className="chatUserList chatUserPickerList">
                {availableUsers.map((user) => (
                  <button
                    className="chatUser"
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setSearchParams({ user: String(user.id) });
                      setNewChatOpen(false);
                      setUserSearch("");
                    }}
                  >
                    <span className="avatar chatAvatar">{initials(user)}</span>
                    <span className="chatUserText">
                      <strong>
                        {user.first_name} {user.last_name}
                      </strong>
                      <small>{user.title || user.email}</small>
                    </span>
                  </button>
                ))}
                {availableUsers.length === 0 && <div className="chatEmpty">Сотрудники не найдены.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
