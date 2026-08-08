let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function b64ToUtf8(str) {
  try {
    const binary = atob(str.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('UTF-8 b64 decode error:', e);
    return '';
  }
}

function utf8ToB64(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error('UTF-8 b64 encode error:', e);
    return '';
  }
}

async function getPosts() {
  const cfg = await loadConfig();
  const rawToken = cfg.github_token || '';
  const token = String(rawToken).replace(/\s+/g, '');

  if (token && token !== 'YOUR_GITHUB_TOKEN' && cfg.github_owner && cfg.github_repo) {
    try {
      const url = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${cfg.data_file_path}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const contentStr = b64ToUtf8(data.content);
        if (contentStr) {
          const posts = JSON.parse(contentStr);
          localStorage.setItem('posts_cache', JSON.stringify(posts));
          return posts;
        }
      }
    } catch (e) {
      console.warn('GitHub API fetch error:', e);
    }
  }

  const cache = localStorage.getItem('posts_cache');
  if (cache) {
    try { return JSON.parse(cache); } catch(e) {}
  }

  try {
    const r = await fetch(cfg.data_file_path || 'data/posts.json');
    if (r.ok) {
      const posts = await r.json();
      localStorage.setItem('posts_cache', JSON.stringify(posts));
      return posts;
    }
  } catch(e) {}

  return [];
}

async function getPostById(id) {
  const posts = await getPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

async function savePost(postData) {
  const cfg = await loadConfig();
  const posts = await getPosts();

  if (!postData.id) {
    postData.id = 'post-' + Date.now();
  }

  const idx = posts.findIndex(p => String(p.id) === String(postData.id));
  if (idx >= 0) {
    posts[idx] = { ...posts[idx], ...postData };
  } else {
    posts.unshift(postData);
  }

  localStorage.setItem('posts_cache', JSON.stringify(posts));

  const rawToken = cfg.github_token || '';
  const token = String(rawToken).replace(/\s+/g, '');

  if (token && token !== 'YOUR_GITHUB_TOKEN' && cfg.github_owner && cfg.github_repo) {
    const path = cfg.data_file_path || 'data/posts.json';
    const apiUrl = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${path}`;

    let sha = null;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
    } catch(e) {}

    const jsonStr = JSON.stringify(posts, null, 2);
    const base64Content = utf8ToB64(jsonStr);

    const bodyObj = {
      message: 'feat: update posts data via CMS',
      content: base64Content
    };
    if (sha) bodyObj.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyObj)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub 저장 실패 (${putRes.status}): 페이지를 새로고침 후 다시 시도해주세요. 상세내용: ${errText}`);
    }
  }

  return postData;
}

async function deletePost(id) {
  const cfg = await loadConfig();
  let posts = await getPosts();
  posts = posts.filter(p => String(p.id) !== String(id));

  localStorage.setItem('posts_cache', JSON.stringify(posts));

  const rawToken = cfg.github_token || '';
  const token = String(rawToken).replace(/\s+/g, '');

  if (token && token !== 'YOUR_GITHUB_TOKEN' && cfg.github_owner && cfg.github_repo) {
    const path = cfg.data_file_path || 'data/posts.json';
    const apiUrl = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${path}`;

    let sha = null;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
    } catch(e) {}

    const jsonStr = JSON.stringify(posts, null, 2);
    const base64Content = utf8ToB64(jsonStr);

    const bodyObj = {
      message: 'feat: delete post via CMS',
      content: base64Content
    };
    if (sha) bodyObj.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyObj)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub 삭제 실패 (${putRes.status}): ${errText}`);
    }
  }

  return true;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(src) {
  if (!src) return '';

  let escaped = escapeHtml(src);

  const codeBlocks = [];
  escaped = escaped.replace(/```([\s\S]*?)```/g, (match, code) => {
    const id = `___CODEBLOCK_${codeBlocks.length}___`;
    codeBlocks.push(`<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm my-4 font-mono"><code>${code.trim()}</code></pre>`);
    return id;
  });

  const parts = escaped.split('`');
  for (let i = 1; i < parts.length; i += 2) {
    parts[i] = `<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-primary">${parts[i]}</code>`;
  }
  escaped = parts.join('');

  escaped = escaped.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3 text-on-surface">$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4 text-on-surface border-b pb-2">$1</h2>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4 text-on-surface border-b pb-2">$1</h1>');

  escaped = escaped.replace(/^&gt;\s?(.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 italic text-text-secondary bg-surface-container-low rounded-r">$1</blockquote>');

  escaped = escaped.replace(/^---$/gim, '<hr class="my-6 border-outline-variant/40">');

  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  escaped = escaped.replace(/~~(.*?)~~/g, '<del class="line-through">$1</del>');

  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|mailto:[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">$1</a>');

  const lines = escaped.split('\n');
  let inList = false;
  let listType = null;
  const processedLines = [];

  for (let line of lines) {
    const unorderedMatch = line.match(/^[\s]*[-\*]\s+(.*)$/);
    const orderedMatch = line.match(/^[\s]*\d+\.\s+(.*)$/);

    if (unorderedMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        processedLines.push('<ul class="list-disc list-inside space-y-1 my-3 pl-2">');
        inList = true;
        listType = 'ul';
      }
      processedLines.push(`<li>${unorderedMatch[1]}</li>`);
    } else if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        processedLines.push('<ol class="list-decimal list-inside space-y-1 my-3 pl-2">');
        inList = true;
        listType = 'ol';
      }
      processedLines.push(`<li>${orderedMatch[1]}</li>`);
    } else {
      if (inList) {
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      processedLines.push(line);
    }
  }
  if (inList) {
    processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  escaped = processedLines.join('\n');

  escaped = escaped.split('\n\n').map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<ul') || p.trim().startsWith('<ol') || p.trim().startsWith('<blockquote') || p.trim().startsWith('<pre') || p.trim().startsWith('<hr')) {
      return p;
    }
    return `<p class="mb-4 leading-relaxed">${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  codeBlocks.forEach((cb, i) => {
    escaped = escaped.replace(`___CODEBLOCK_${i}___`, cb);
  });

  return escaped;
}

function markdownToText(src) {
  if (!src) return '';
  return String(src)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^&gt;\s+/gm, '')
    .replace(/^[\s]*[-\*\d\.]+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

window.loadConfig = loadConfig;
window.isAdmin = isAdmin;
window.requireAdmin = requireAdmin;
window.getPosts = getPosts;
window.getPostById = getPostById;
window.savePost = savePost;
window.deletePost = deletePost;
window.escapeHtml = escapeHtml;
window.renderMarkdown = renderMarkdown;
window.markdownToText = markdownToText;
