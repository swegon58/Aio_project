"use client";

import { Bot, PenLine, Plus, Trash2, X } from "lucide-react";
import { SettingsModal } from "@/components/app/SettingsModal";
import { ScheduledTasksModal } from "@/components/app/ScheduledTasksModal";
import { NotificationsPanel } from "@/components/app/NotificationsPanel";
import { useAccountData, useWorkspace } from "@/components/app/app-home/context";

interface AppModalsProps {
  email: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
  currentPlanTier: string | null;
  confirmDeleteId: string | null;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsInitialTab: "general" | "plan" | "data" | "connections";
  setSettingsInitialTab: (tab: "general" | "plan" | "data" | "connections") => void;
  scheduledTasksOpen: boolean;
  setScheduledTasksOpen: (open: boolean) => void;
  chatsPopoverOpen: boolean;
  setChatsPopoverOpen: (open: boolean) => void;
}

export function AppModals({
  email,
  userName,
  userAvatarUrl,
  currentPlanTier,
  confirmDeleteId,
  settingsOpen,
  setSettingsOpen,
  settingsInitialTab,
  setSettingsInitialTab,
  scheduledTasksOpen,
  setScheduledTasksOpen,
  chatsPopoverOpen,
  setChatsPopoverOpen,
}: AppModalsProps) {
  const { lightboxImage, setLightboxImage, handleGalleryDelete } = useWorkspace();
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    connections,
    connectionsError,
    tokenPlatform,
    setTokenPlatform,
    tokenValue,
    setTokenValue,
    tokenSubmitting,
    handleTokenRemove,
    tokenMessage,
    handleTokenSubmit,
    googleCalendarStatus,
    googleCalendarError,
    googleCalendarDisconnecting,
    handleGoogleCalendarDisconnect,
    credentials,
    credentialsError,
    credentialId,
    setCredentialId,
    credentialValue,
    setCredentialValue,
    credentialSubmitting,
    credentialMessage,
    handleCredentialSubmit,
    handleExportData,
    exportLoading,
    exportStatus,
    handleDeleteAccount,
    deleteLoading,
    deleteStatus,
    cronJobs,
    cronError,
    cronLocked,
    cronActionPending,
    cronName,
    setCronName,
    cronSchedule,
    setCronSchedule,
    cronPrompt,
    setCronPrompt,
    cronNotifyDiscord,
    setCronNotifyDiscord,
    cronCreating,
    cronCreateMessage,
    handleCronCreate,
    handleCronDelete,
    handleCronAction,
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    notificationsUnread,
    notificationsError,
    handleNotificationRead,
    handleMarkAllNotificationsRead,
    conversations,
    conversationsError,
    activeConversationId,
    renamingConversationId,
    setRenamingConversationId,
    renameValue,
    setRenameValue,
    handleNewChat,
    handleLoadConversation,
    handleDeleteConversation,
    handleStartRename,
    handleRenameConversation,
  } = useAccountData();

  return (
    <>
      {lightboxImage && lightboxImage.bare && (
        <div className="modal-overlay" onClick={() => setLightboxImage(null)}>
          {lightboxImage.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightboxImage.url} alt={lightboxImage.caption ?? "Generated image"} className="lightbox-bare-img" />
          )}
        </div>
      )}

      {lightboxImage && !lightboxImage.bare && (
        <div className="modal-overlay" onClick={() => setLightboxImage(null)}>
          <div className="modal gallery-lightbox" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{lightboxImage.caption ?? "Saved image"}</h2>
              <button type="button" className="modal-close" onClick={() => setLightboxImage(null)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {lightboxImage.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightboxImage.url} alt={lightboxImage.caption ?? "Saved image"} className="gallery-lightbox-img" />
            )}
            <button
              type="button"
              className="mcp-add-btn"
              style={
                confirmDeleteId === lightboxImage.id
                  ? { marginTop: 14, background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                  : { marginTop: 14 }
              }
              onClick={() => handleGalleryDelete(lightboxImage.id)}
            >
              {confirmDeleteId === lightboxImage.id ? "Click again to confirm" : "Delete from Gallery"}
            </button>
          </div>
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsInitialTab("general");
        }}
        initialTab={settingsInitialTab}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        email={email}
        theme={theme}
        onThemeChange={setTheme}
        accent={accent}
        onAccentChange={setAccent}
        connections={connections}
        connectionsError={connectionsError}
        tokenPlatform={tokenPlatform}
        onTokenPlatformChange={setTokenPlatform}
        tokenValue={tokenValue}
        onTokenValueChange={setTokenValue}
        tokenSubmitting={tokenSubmitting}
        onTokenRemove={handleTokenRemove}
        tokenMessage={tokenMessage}
        onTokenSubmit={handleTokenSubmit}
        googleCalendarStatus={googleCalendarStatus}
        googleCalendarError={googleCalendarError}
        googleCalendarDisconnecting={googleCalendarDisconnecting}
        onGoogleCalendarDisconnect={handleGoogleCalendarDisconnect}
        credentials={credentials}
        credentialsError={credentialsError}
        credentialId={credentialId}
        onCredentialIdChange={setCredentialId}
        credentialValue={credentialValue}
        onCredentialValueChange={setCredentialValue}
        credentialSubmitting={credentialSubmitting}
        credentialMessage={credentialMessage}
        onCredentialSubmit={handleCredentialSubmit}
        onExportData={handleExportData}
        exportLoading={exportLoading}
        exportStatus={exportStatus}
        onDeleteAccount={handleDeleteAccount}
        deleteLoading={deleteLoading}
        deleteStatus={deleteStatus}
        currentPlanTier={currentPlanTier}
      />

      <ScheduledTasksModal
        open={scheduledTasksOpen}
        onClose={() => setScheduledTasksOpen(false)}
        jobs={cronJobs}
        error={cronError}
        locked={cronLocked}
        actionPending={cronActionPending}
        confirmDeleteId={confirmDeleteId}
        name={cronName}
        onNameChange={setCronName}
        schedule={cronSchedule}
        onScheduleChange={setCronSchedule}
        prompt={cronPrompt}
        onPromptChange={setCronPrompt}
        notifyDiscord={cronNotifyDiscord}
        onNotifyDiscordChange={setCronNotifyDiscord}
        discordConnected={connections?.some((c) => c.id === "discord" && c.connected) ?? false}
        creating={cronCreating}
        createMessage={cronCreateMessage}
        onCreate={handleCronCreate}
        onDelete={handleCronDelete}
        onAction={handleCronAction}
      />

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        unreadCount={notificationsUnread}
        error={notificationsError}
        onRead={handleNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {chatsPopoverOpen && (
        <div className="modal-overlay" onClick={() => setChatsPopoverOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chats</h2>
              <button type="button" className="modal-close" onClick={() => setChatsPopoverOpen(false)} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              className="new-chat-btn"
              onClick={() => {
                handleNewChat();
                setChatsPopoverOpen(false);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
            <div className="sidebar-section-title" style={{ marginTop: 12 }}>Recent Chats</div>
            <div className="chat-list">
              {conversationsError && (
                <div className="chat-item-time" style={{ padding: "6px 4px" }}>
                  Failed to load history
                </div>
              )}
              {conversations !== null && conversations.length === 0 && !conversationsError && (
                <div className="chat-item-time" style={{ padding: "6px 4px" }}>
                  No conversations yet
                </div>
              )}
              {(conversations ?? []).map((c) => (
                <div
                  key={c.id}
                  className={`chat-item${c.id === activeConversationId ? " active" : ""}`}
                  onClick={() => {
                    handleLoadConversation(c.id);
                    setChatsPopoverOpen(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleLoadConversation(c.id);
                      setChatsPopoverOpen(false);
                    }
                  }}
                >
                  <div className="chat-item-icon">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="chat-item-info">
                    {renamingConversationId === c.id ? (
                      <input
                        autoFocus
                        className="chat-item-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => handleRenameConversation(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameConversation(c.id);
                          } else if (e.key === "Escape") {
                            setRenamingConversationId(null);
                          }
                        }}
                      />
                    ) : (
                      <div className="chat-item-title">{c.title}</div>
                    )}
                    <div className="chat-item-time">
                      {new Date(c.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chat-item-delete"
                    onClick={(e) => handleStartRename(c.id, c.title, e)}
                    aria-label="Rename conversation"
                    title="Rename conversation"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className={`chat-item-delete${confirmDeleteId === c.id ? " confirming" : ""}`}
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    aria-label={confirmDeleteId === c.id ? "Confirm delete conversation" : "Delete conversation"}
                    title={confirmDeleteId === c.id ? "Click again to delete" : "Delete conversation"}
                  >
                    {confirmDeleteId === c.id ? <Trash2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
