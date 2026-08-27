export function buildStyles(primaryColor: string, buttonColor: string): string {
  return `
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }

.aiwa-launcher {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: ${buttonColor};
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  z-index: 2147483000;
  transition: transform 0.15s ease;
}
.aiwa-launcher:hover { transform: scale(1.06); }
.aiwa-launcher svg { width: 28px; height: 28px; }

.aiwa-panel {
  position: fixed;
  bottom: 92px;
  right: 20px;
  width: 380px;
  max-width: calc(100vw - 32px);
  height: min(600px, calc(100dvh - 120px));
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483000;
  opacity: 0;
  transform: translateY(16px) scale(0.98);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.aiwa-panel.aiwa-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.aiwa-header {
  background: ${primaryColor};
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.aiwa-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; overflow: hidden; flex-shrink: 0;
}
.aiwa-avatar img { width: 100%; height: 100%; object-fit: cover; }
.aiwa-header-text { flex: 1; min-width: 0; }
.aiwa-header-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aiwa-header-subtitle { font-size: 12px; opacity: 0.85; }
.aiwa-close {
  background: transparent; border: none; color: #fff; cursor: pointer;
  font-size: 20px; line-height: 1; padding: 4px; opacity: 0.9;
}
.aiwa-close:hover { opacity: 1; }

.aiwa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #F7F8FA;
}
.aiwa-msg {
  max-width: 82%;
  padding: 10px 13px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  animation: aiwa-fade-in 0.15s ease;
}
@keyframes aiwa-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.aiwa-msg-bot {
  align-self: flex-start;
  background: #fff;
  color: #1a1a1a;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.aiwa-msg-user {
  align-self: flex-end;
  background: ${primaryColor};
  color: #fff;
  border-bottom-right-radius: 4px;
}

.aiwa-typing {
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 14px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.aiwa-typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: #b3b8c2;
  animation: aiwa-bounce 1.1s infinite ease-in-out;
}
.aiwa-typing span:nth-child(2) { animation-delay: 0.15s; }
.aiwa-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes aiwa-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.aiwa-quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 12px;
  background: #F7F8FA;
}
.aiwa-quick-reply {
  border: 1px solid ${primaryColor};
  color: ${primaryColor};
  background: #fff;
  border-radius: 999px;
  padding: 7px 13px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.aiwa-quick-reply:hover { background: ${primaryColor}15; }

.aiwa-handoff-btn {
  align-self: flex-start;
  margin-top: -4px;
  border: 1px solid #d9dce1;
  background: #fff;
  color: #1a1a1a;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.aiwa-handoff-btn:hover { background: #f0f1f3; }

.aiwa-handoff-panel {
  padding: 14px 16px;
  background: #fff;
  border-top: 1px solid #ececec;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.aiwa-handoff-panel-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 2px; }
.aiwa-handoff-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e3e5e9;
  background: #fafafa;
  text-decoration: none;
  color: #1a1a1a;
  font-size: 13px;
  cursor: pointer;
}
.aiwa-handoff-option:hover { background: #f0f1f3; }

.aiwa-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #ececec;
  background: #fff;
  flex-shrink: 0;
}
.aiwa-input {
  flex: 1;
  border: 1px solid #dfe2e7;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 14px;
  outline: none;
  min-width: 0;
}
.aiwa-input:focus { border-color: ${primaryColor}; }
.aiwa-send {
  width: 38px; height: 38px; flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background: ${buttonColor};
  color: #fff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.aiwa-send:disabled { opacity: 0.5; cursor: default; }
.aiwa-footer-link {
  text-align: center;
  font-size: 11px;
  color: #9aa0a8;
  padding: 4px 0 8px;
  background: #fff;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .aiwa-panel {
    right: 8px;
    left: 8px;
    bottom: 8px;
    width: auto;
    max-width: none;
    height: min(88dvh, 640px);
    border-radius: 14px;
  }
  .aiwa-launcher { bottom: 16px; right: 16px; }
}
`;
}
