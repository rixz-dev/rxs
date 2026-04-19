'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── marked lazy-loaded on client ────────────────────────────────
let markedInstance = null;
async function getMarked() {
  if (markedInstance) return markedInstance;
  const { marked } = await import('marked');
  marked.use({ breaks: true, gfm: true });
  markedInstance = marked;
  return marked;
}

// ─── Constants ───────────────────────────────────────────────────
const MODELS = [
  'minimaxai/minimax-m2.5',
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'mistralai/mistral-large-2-instruct',
  'deepseek-ai/deepseek-r1',
  'deepseek-ai/deepseek-r1-0528',
  'qwen/qwq-32b',
  'google/gemma-3-27b-it',
  'microsoft/phi-4',
  'nvidia/mistral-nemo-minitron-8b-8k-instruct',
];

const DEFAULT_CFG = {
  model: 'minimaxai/minimax-m2.5',
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 8192,
  apiKey: '',
  systemPrompt: 'You are a helpful, knowledgeable AI assistant. Be concise and clear.',
};

const STARTER_PROMPTS = [
  'Explain HTTP request smuggling',
  'Write a Python port scanner',
  'How does SQL injection work?',
  'Create a basic XSS payload list',
];

const TEXT_EXTENSIONS = /\.(js|ts|jsx|tsx|py|php|go|rb|java|c|cpp|h|cs|css|html|json|xml|yaml|yml|md|txt|sh|sql|env|toml|ini|cfg|rs|swift|kt|r|lua|vim|conf|log|csv|tf|dockerfile)$/i;

// ─── Helpers ─────────────────────────────────────────────────────
function parseThink(content) {
  const regex = /<think>([\s\S]*?)<\/think>/g;
  const thinks = [];
  let m;
  while ((m = regex.exec(content)) !== null) thinks.push(m[1].trim());
  const clean = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return { thinks, clean };
}

function fmtSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}

function downloadText(text, lang) {
  const extMap = { js: 'js', javascript: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', bash: 'sh', sh: 'sh', php: 'php', go: 'go', ruby: 'rb', sql: 'sql', rust: 'rs', cpp: 'cpp', c: 'c' };
  const ext = extMap[lang?.toLowerCase()] || lang || 'txt';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rxs_${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Icon components ──────────────────────────────────────────────
const IconMenu = () => (
  <svg width="19" height="14" viewBox="0 0 19 14" fill="none">
    <rect y="0" width="19" height="1.5" rx="0.75" fill="currentColor"/>
    <rect y="6" width="14" height="1.5" rx="0.75" fill="currentColor"/>
    <rect y="12" width="19" height="1.5" rx="0.75" fill="currentColor"/>
  </svg>
);
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
);
const IconAttach = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
);
const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);
const IconLoader = () => (
  <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/>
  </svg>
);
const IconThink = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconCode = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconCopy = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

// ─── Markdown renderer with code blocks ───────────────────────────
function MdContent({ raw, toolsMode }) {
  const ref = useRef(null);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!raw) return;
    getMarked().then(marked => {
      // Custom renderer for code blocks
      const renderer = new marked.Renderer();
      renderer.code = ({ text, lang }) => {
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
        const dlBtn = toolsMode
          ? `<button class="code-dl-btn" data-lang="${lang || 'txt'}" data-code="${encodeURIComponent(text)}">SAVE</button>`
          : '';
        return `<div class="code-block-wrap">${langLabel}${dlBtn}<pre><code class="language-${lang || ''}">${escaped}</code></pre></div>`;
      };
      marked.use({ renderer });
      setHtml(marked.parse(raw));
    });
  }, [raw, toolsMode]);

  // Delegate download button clicks
  useEffect(() => {
    if (!ref.current) return;
    const handler = (e) => {
      const btn = e.target.closest('.code-dl-btn');
      if (btn) {
        const lang = btn.dataset.lang;
        const code = decodeURIComponent(btn.dataset.code);
        downloadText(code, lang);
      }
      const copyBtn = e.target.closest('.code-copy-btn');
      if (copyBtn) {
        const code = decodeURIComponent(copyBtn.dataset.code);
        navigator.clipboard?.writeText(code).catch(() => {});
        copyBtn.textContent = 'COPIED';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
      }
    };
    ref.current.addEventListener('click', handler);
    return () => ref.current?.removeEventListener('click', handler);
  }, [html]);

  if (!html) return null;
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Think block ─────────────────────────────────────────────────
function ThinkBlock({ thinks }) {
  const [open, setOpen] = useState(false);
  if (!thinks.length) return null;
  const tokens = Math.round(thinks.join('').length / 3.5);
  return (
    <div className="think-wrap">
      <button className="think-toggle" onClick={() => setOpen(o => !o)}>
        <span className="think-arrow">{open ? '▼' : '▶'}</span>
        reasoning chain · ~{tokens} tokens
      </button>
      {open && (
        <div className="think-body">{thinks.join('\n\n')}</div>
      )}
    </div>
  );
}

// ─── Message ─────────────────────────────────────────────────────
function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-role">you</div>
        <div className="msg-bubble">
          {msg.content}
          {msg.files?.length > 0 && (
            <div className="msg-files">
              {msg.files.map(f => <span key={f} className="file-chip">{f}</span>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'error') {
    return (
      <div className="msg error">
        <div className="msg-role">error</div>
        <div className="msg-bubble">{msg.content}</div>
      </div>
    );
  }

  const { thinks, clean } = parseThink(msg.content);
  const modelShort = msg.model ? msg.model.split('/').pop() : 'ai';

  return (
    <div className="msg assistant">
      <div className="msg-role">
        {modelShort.slice(0, 24)}
        {msg.isThinking && ' · thinking'}
        {msg.isTools && ' · tools'}
      </div>
      <div className="msg-bubble">
        <ThinkBlock thinks={thinks} />
        <MdContent raw={clean} toolsMode={msg.isTools} />
      </div>
    </div>
  );
}

// ─── Streaming message ────────────────────────────────────────────
function StreamMsg({ content, model }) {
  const { thinks, clean } = parseThink(content);
  const modelShort = model ? model.split('/').pop() : 'ai';

  return (
    <div className="msg streaming">
      <div className="msg-role">{modelShort.slice(0, 24)} · streaming</div>
      <div className="msg-bubble">
        {thinks.length > 0 && (
          <div className="think-wrap" style={{ marginBottom: '10px' }}>
            <button className="think-toggle">
              <span className="think-arrow">▶</span>
              reasoning in progress...
            </button>
          </div>
        )}
        <MdContent raw={clean} toolsMode={false} />
        <span className="cursor-blink" />
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────
function Sidebar({ open, onClose, config, setConfig, history, onNewChat, onLoadChat, onDeleteHistory }) {
  const update = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-logo">RXS-AI</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>

      <div className="sidebar-body">
        {/* New chat */}
        <div className="sidebar-section">
          <button className="new-chat-btn" onClick={onNewChat}>
            <IconPlus /> New Chat
          </button>
        </div>

        {/* History */}
        <div className="sidebar-section">
          <div className="section-label">History</div>
          {history.length === 0 ? (
            <div className="empty-state">No sessions saved yet.</div>
          ) : (
            <div className="history-list">
              {history.map(h => (
                <div key={h.id} className="history-row">
                  <div className="history-item" onClick={() => onLoadChat(h)}>{h.title}</div>
                  <button className="history-del" onClick={() => onDeleteHistory(h.id)} title="Delete">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model */}
        <div className="sidebar-section">
          <div className="section-label">Model</div>
          <div className="cfg-field">
            <div className="cfg-label">Select preset</div>
            <select
              className="cfg-select"
              value={config.model}
              onChange={e => update('model', e.target.value)}
            >
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <div className="cfg-label">Custom model ID</div>
            <input
              className="cfg-input"
              type="text"
              placeholder="provider/model-name"
              value={config.model}
              onChange={e => update('model', e.target.value)}
            />
          </div>
        </div>

        {/* Parameters */}
        <div className="sidebar-section">
          <div className="section-label">Parameters</div>

          <div className="cfg-field">
            <div className="cfg-label">Temperature <span className="cfg-val">{Number(config.temperature).toFixed(2)}</span></div>
            <input className="cfg-range" type="range" min="0" max="2" step="0.05" value={config.temperature} onChange={e => update('temperature', e.target.value)} />
          </div>

          <div className="cfg-field">
            <div className="cfg-label">Top P <span className="cfg-val">{Number(config.topP).toFixed(2)}</span></div>
            <input className="cfg-range" type="range" min="0" max="1" step="0.05" value={config.topP} onChange={e => update('topP', e.target.value)} />
          </div>

          <div className="cfg-field">
            <div className="cfg-label">Max Tokens <span className="cfg-val">{config.maxTokens}</span></div>
            <input className="cfg-range" type="range" min="256" max="8192" step="256" value={config.maxTokens} onChange={e => update('maxTokens', e.target.value)} />
          </div>
        </div>

        {/* API Key */}
        <div className="sidebar-section">
          <div className="section-label">API Key (optional)</div>
          <div className="cfg-field">
            <div className="cfg-label">NVIDIA Build API Key</div>
            <input
              className="cfg-input"
              type="password"
              placeholder="nvapi-xxxxxxxxxxxxxxxx"
              value={config.apiKey}
              onChange={e => update('apiKey', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="cfg-hint">Stored in localStorage. Falls back to server NVIDIA_API_KEY env if empty.</div>
        </div>

        {/* Personalization */}
        <div className="sidebar-section">
          <div className="section-label">Personalization</div>
          <div className="cfg-field">
            <div className="cfg-label">System Prompt</div>
            <textarea
              className="cfg-textarea"
              value={config.systemPrompt}
              onChange={e => update('systemPrompt', e.target.value)}
              placeholder="You are a helpful AI assistant..."
            />
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        RXS-AI · NVIDIA BUILD API · STREAMING
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [thinkMode, setThinkMode] = useState(false);
  const [toolsMode, setToolsMode] = useState(false);
  const [files, setFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CFG);
  const [history, setHistory] = useState([]);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const abortRef = useRef(null);

  // Load persisted state
  useEffect(() => {
    try {
      const cfg = localStorage.getItem('rxs_cfg');
      if (cfg) setConfig({ ...DEFAULT_CFG, ...JSON.parse(cfg) });
      const hist = localStorage.getItem('rxs_hist');
      if (hist) setHistory(JSON.parse(hist));
    } catch {}
  }, []);

  // Persist config
  useEffect(() => {
    try { localStorage.setItem('rxs_cfg', JSON.stringify(config)); } catch {}
  }, [config]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  // ── File upload ───────────────────────────────────────────────
  const handleFiles = useCallback((e) => {
    Array.from(e.target.files).forEach(file => {
      const isText = file.type.startsWith('text/') || TEXT_EXTENSIONS.test(file.name);
      const isImg = file.type.startsWith('image/');

      if (isText) {
        const reader = new FileReader();
        reader.onload = ev => {
          setFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            type: 'text',
            content: ev.target.result.slice(0, 12000),
          }]);
        };
        reader.readAsText(file);
      } else if (isImg) {
        const reader = new FileReader();
        reader.onload = ev => {
          setFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            type: 'image',
            content: ev.target.result,
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: 'binary',
          content: null,
        }]);
      }
    });
    e.target.value = '';
  }, []);

  // ── Send message ─────────────────────────────────────────────
  const send = useCallback(async (overrideInput) => {
    const text = (overrideInput ?? input).trim();
    if ((!text && files.length === 0) || loading) return;

    // Build user content with files
    let userContent = text;
    for (const f of files) {
      if (f.type === 'text') {
        userContent += `\n\n<file name="${f.name}">\n${f.content}\n</file>`;
      } else if (f.type === 'image') {
        userContent += `\n\n[Image attached: ${f.name}]`;
      } else {
        userContent += `\n\n[Binary file: ${f.name}]`;
      }
    }

    // System prompt
    let sysContent = config.systemPrompt;
    if (thinkMode) sysContent += '\n\nThink through problems step by step. Show your reasoning before the final answer.';
    if (toolsMode) sysContent += '\n\nWhen generating code or file contents, always use proper fenced code blocks with the correct language identifier (e.g. ```python ... ```). This allows the user to download the files.';

    // Build API messages array
    const apiMsgs = [
      { role: 'system', content: sysContent },
      ...messages
        .filter(m => m.role !== 'error')
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      files: files.map(f => f.name),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setFiles([]);
    setLoading(true);
    setStreaming('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiMsgs,
          model: config.model,
          temperature: Number(config.temperature),
          topP: Number(config.topP),
          maxTokens: Number(config.maxTokens),
          apiKey: config.apiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status} — ${err.slice(0, 300)}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = '';
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const j = JSON.parse(t.slice(6));
              const delta = j.choices?.[0]?.delta?.content || '';
              full += delta;
              setStreaming(full);
            } catch {}
          }
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: full,
        model: config.model,
        isThinking: thinkMode,
        isTools: toolsMode,
      }]);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'error',
        content: err.message,
      }]);
    } finally {
      setLoading(false);
      setStreaming('');
    }
  }, [input, files, messages, config, thinkMode, toolsMode, loading]);

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  // ── Chat history management ───────────────────────────────────
  const newChat = useCallback(() => {
    if (messages.length > 0) {
      const first = messages.find(m => m.role === 'user');
      const item = {
        id: Date.now(),
        title: (first?.content || 'Session').slice(0, 50),
        messages: [...messages],
        model: config.model,
        ts: new Date().toISOString(),
      };
      const updated = [item, ...history.slice(0, 49)];
      setHistory(updated);
      try { localStorage.setItem('rxs_hist', JSON.stringify(updated)); } catch {}
    }
    setMessages([]);
    setStreaming('');
    setSidebarOpen(false);
  }, [messages, history, config.model]);

  const loadChat = (chat) => {
    setMessages(chat.messages);
    setSidebarOpen(false);
  };

  const deleteHistory = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try { localStorage.setItem('rxs_hist', JSON.stringify(updated)); } catch {}
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Overlay */}
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        config={config}
        setConfig={setConfig}
        history={history}
        onNewChat={newChat}
        onLoadChat={loadChat}
        onDeleteHistory={deleteHistory}
      />

      {/* Main */}
      <div className="main">
        {/* Header */}
        <header className="header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>

          <span className="header-title">RX<em>S</em>-AI</span>

          <div className="header-right">
            {thinkMode && <span className="mode-pill">THINK</span>}
            {toolsMode && <span className="mode-pill">TOOLS</span>}
            <span className="model-pill">{config.model.split('/').pop()}</span>
          </div>
        </header>

        {/* Messages */}
        <div className="messages-wrap">
          <div className="messages-inner">
            {messages.length === 0 && !streaming ? (
              <div className="welcome">
                <div className="welcome-wordmark">RX<em>S</em></div>
                <div className="welcome-rule" />
                <div className="welcome-tag">AI Chat Interface</div>
                <div className="welcome-chip">{config.model}</div>
                <div className="welcome-hints">
                  {STARTER_PROMPTS.map(p => (
                    <button key={p} className="welcome-hint" onClick={() => send(p)}>{p}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => <Message key={msg.id} msg={msg} />)}
                {loading && streaming && (
                  <StreamMsg content={streaming} model={config.model} />
                )}
                {loading && !streaming && (
                  <div className="msg assistant">
                    <div className="msg-role">{config.model.split('/').pop().slice(0, 24)}</div>
                    <div className="msg-bubble">
                      <div className="loading-dots"><span /><span /><span /></div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={endRef} style={{ height: '1px' }} />
          </div>
        </div>

        {/* Input area */}
        <div className="input-area">
          {/* Attachments */}
          {files.length > 0 && (
            <div className="attachments-row">
              {files.map(f => (
                <div key={f.name} className="attach-chip">
                  <span className="attach-chip-name">{f.name} · {fmtSize(f.size)}</span>
                  <button className="attach-chip-del" onClick={() => setFiles(prev => prev.filter(x => x.name !== f.name))}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className="input-box">
            <textarea
              ref={taRef}
              className="input-ta"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message... (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={loading}
            />

            <div className="input-actions">
              <div className="input-left">
                {/* Attach file */}
                <button
                  className="tool-btn icon-only"
                  onClick={() => fileRef.current?.click()}
                  title="Attach file"
                  disabled={loading}
                >
                  <IconAttach />
                </button>

                {/* Thinking mode */}
                <button
                  className={`tool-btn ${thinkMode ? 'on' : ''}`}
                  onClick={() => setThinkMode(v => !v)}
                  title="Toggle thinking mode"
                >
                  <IconThink />
                  Think
                </button>

                {/* Tools mode */}
                <button
                  className={`tool-btn ${toolsMode ? 'on' : ''}`}
                  onClick={() => setToolsMode(v => !v)}
                  title="Toggle tools mode (file generation + save)"
                >
                  <IconCode />
                  Tools
                </button>
              </div>

              {/* Send / Stop */}
              {loading ? (
                <button className="send-btn" onClick={stopGeneration} title="Stop generation">
                  <IconLoader />
                  Stop
                </button>
              ) : (
                <button
                  className="send-btn"
                  onClick={() => send()}
                  disabled={!input.trim() && files.length === 0}
                >
                  Send
                  <IconSend />
                </button>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="*/*"
            style={{ display: 'none' }}
            onChange={handleFiles}
          />
        </div>
      </div>
    </div>
  );
}
