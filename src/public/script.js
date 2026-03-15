const output = document.getElementById("output");
const input = document.getElementById("command");
const clearBtn = document.getElementById("clearBtn");
const themeBtn = document.getElementById("themeBtn");
const micBtn = document.getElementById("micBtn");
const statusEl = document.getElementById("status");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
}

const history = [];
let historyIndex = -1;
let currentTheme = 'dark';
let currentAbortController = null;

function setStatus(text, type = 'info') {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;

  if (type === 'info') {
    statusEl.style.opacity = 0.9;
  }
}

function speak(text) {
  if (!window.speechSynthesis) return;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'en-US';
  window.speechSynthesis.speak(speech);
}

function appendOutput(text, type = 'output') {
  const line = document.createElement('div');
  line.className = `output-line ${type}`;

  if (type === 'command') {
    line.innerHTML = `<span class="command-line">$ ${escapeHtml(text)}</span>`;
  } else if (type === 'error') {
    line.innerHTML = `<span class="error-text">${escapeHtml(text)}</span>`;
  } else if (type === 'success') {
    line.innerHTML = `<span class="success-text">${escapeHtml(text)}</span>`;
  } else if (text.startsWith('Run it with:')) {
    const cmd = text.replace('Run it with:', '').trim();
    const escaped = escapeHtml(cmd);
    line.innerHTML = `
      <span class="output-text">Run it with: </span>
      <span class="copy-command">${escaped}</span>
      <button class="copy-btn" type="button">Copy</button>
    `;
    line.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(cmd);
      setStatus('Copied command', 'success');
    });
  } else {
    line.innerHTML = `<span class="output-text">${escapeHtml(text)}</span>`;
  }

  output.appendChild(line);
  requestAnimationFrame(() => {
    output.scrollTop = output.scrollHeight;
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

async function sendCommand() {
  const command = input.value.trim();

  if (!command) return;

  if (handleLocalCommand(command)) return;

  runCommand(command);
}

function handleLocalCommand(command) {
  const lowered = command.toLowerCase();

  if (lowered === 'clear terminal' || lowered === 'clear' || lowered === 'cls') {
    clearOutput();
    return true;
  }

  if (lowered === 'show command history' || lowered === 'command history') {
    if (history.length === 0) {
      appendOutput('(history is empty)', 'output');
    } else {
      history.slice(0, 20).forEach((cmd, idx) => {
        appendOutput(`${idx + 1}. ${cmd}`, 'output');
      });
    }
    return true;
  }

  if (lowered === 'repeat last command' || lowered === 'repeat last') {
    if (history.length === 0) {
      appendOutput('(no command to repeat)', 'output');
      return true;
    }
    const last = history[0];
    appendOutput(`Repeating: ${last}`, 'output');
    runCommand(last);
    return true;
  }

  if (lowered === 'stop running process' || lowered === 'stop process') {
    if (currentAbortController) {
      currentAbortController.abort();
      appendOutput('(stopped current request)', 'output');
      setStatus('Stopped', 'error');
    } else {
      appendOutput('(no active request)', 'output');
      setStatus('Ready', 'info');
    }
    return true;
  }

  return false;
}

function runCommand(command) {
  // History tracking
  history.unshift(command);
  historyIndex = -1;

  appendOutput(command, 'command');
  input.value = '';
  input.classList.add('processing');
  setStatus('Running...', 'info');

  if (currentAbortController) {
    currentAbortController.abort();
  }

  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  fetch('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
    signal
  })
    .then(res => res.json())
    .then(data => {
      if (data.output) {
        const lines = data.output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            appendOutput(line, 'output');
          }
        });
        setStatus('Done', 'success');
        speak('Task completed.');
      } else {
        appendOutput('(no output)', 'output');
        setStatus('Done', 'success');
        speak('Task completed.');
      }
    })
    .catch(error => {
      if (error.name === 'AbortError') {
        appendOutput('(request canceled)', 'output');
        setStatus('Cancelled', 'error');
        return;
      }
      appendOutput(`Error: ${error.message}`, 'error');
      setStatus('Error', 'error');
      speak('There was an error.');
    })
    .finally(() => {
      input.classList.remove('processing');
      currentAbortController = null;
      setTimeout(() => setStatus('Ready', 'info'), 1200);
    });
}


function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = currentTheme;
  themeBtn.textContent = currentTheme === 'dark' ? 'Theme: Dark' : 'Theme: Light';
}

function clearOutput() {
  output.innerHTML = '';
  setStatus('Cleared', 'info');
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendCommand();
    return;
  }

  if (e.key === 'ArrowUp') {
    if (history.length === 0) return;
    historyIndex = Math.min(historyIndex + 1, history.length - 1);
    input.value = history[historyIndex];
  }

  if (e.key === 'ArrowDown') {
    if (history.length === 0) return;
    historyIndex = Math.max(historyIndex - 1, -1);
    input.value = historyIndex === -1 ? '' : history[historyIndex];
  }
});

clearBtn.addEventListener('click', clearOutput);
themeBtn.addEventListener('click', toggleTheme);

if (micBtn && recognition) {
  let isListening = false;
  let micTimeout = null;
  let finalTranscript = '';
  let commandRan = false;

  const stopListening = () => {
    if (!isListening) return;
    isListening = false;
    micBtn.classList.remove('listening');
    setStatus('Ready', 'info');
    clearTimeout(micTimeout);

    try {
      recognition.stop();
    } catch {
      // ignore
    }

    // Run the command once at the end of listening
    if (finalTranscript && !commandRan) {
      runCommand(finalTranscript);
      commandRan = true;
    }
  };

  micBtn.addEventListener('click', () => {
    if (isListening) return;
    isListening = true;
    commandRan = false;
    finalTranscript = '';
    micBtn.classList.add('listening');
    setStatus('Listening...', 'info');

    try {
      recognition.start();
    } catch (err) {
      appendOutput(`Voice error: ${err.message}`, 'error');
      stopListening();
      return;
    }

    // Stop listening after 10 seconds if no activity
    micTimeout = setTimeout(() => {
      stopListening();
    }, 10000);
  });

  recognition.onresult = (event) => {
    // Append all results (may come in multiple chunks)
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join(' ');

    finalTranscript = transcript;
    input.value = transcript;
  };

  recognition.onend = () => {
    stopListening();
  };

  recognition.onerror = (event) => {
    appendOutput(`Voice error: ${event.error}`, 'error');
    stopListening();
  };
} else if (micBtn) {
  micBtn.style.display = 'none';
}

// set initial theme label
themeBtn.textContent = 'Theme: Dark';

setStatus('Ready', 'info');
