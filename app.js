document.addEventListener('DOMContentLoaded', () => {
  
  // --- DOM Elements ---
  const apiUrlInput = document.getElementById('api-url-input');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnConnect = document.getElementById('btn-connect');
  const connIndicator = document.getElementById('conn-indicator');
  const connStatusText = document.getElementById('conn-status-text');
  const autoDownloadInput = document.getElementById('auto-download-input');
  const labelAutoDownload = document.getElementById('label-auto-download');
  
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const formImage = document.getElementById('form-image');
  const formVideo = document.getElementById('form-video');
  const formEdit = document.getElementById('form-edit');
  
  const imgDropzone = document.getElementById('img-dropzone');
  const imgFileInput = document.getElementById('img-file');
  const imgPreviewGrid = document.getElementById('img-preview-grid');
  
  const editDropzone = document.getElementById('edit-dropzone');
  const editFileInput = document.getElementById('edit-file');
  const editPreviewGrid = document.getElementById('edit-preview-grid');
  
  const vidDropzone = document.getElementById('vid-dropzone');
  const vidFileInput = document.getElementById('vid-file');
  const vidPreviewGrid = document.getElementById('vid-preview-grid');
  
  const tasksListContainer = document.getElementById('tasks-list-container');
  const emptyTasksState = document.getElementById('empty-tasks-state');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnStopAll = document.getElementById('btn-stop-all');

  // --- State Variables ---
  let filesToUploadImage = [];
  let filesToUploadEdit = [];
  let filesToUploadVideo = [];
  let taskList = [];
  let pollingInterval = null;
  const downloadedTaskIds = new Set(JSON.parse(localStorage.getItem('10s_downloaded_tasks') || '[]'));
  const expandedTaskIds = new Set();
  const editingTaskPrompts = {};

  // --- Initialize Config and Connection ---
  function init() {
    // Load config from query parameters or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('apiUrl');
    const queryKey = urlParams.get('apiKey');

    if (queryUrl) {
      apiUrlInput.value = queryUrl;
      localStorage.setItem('10s_api_url', queryUrl);
    } else {
      const savedUrl = localStorage.getItem('10s_api_url');
      if (savedUrl) apiUrlInput.value = savedUrl;
    }

    if (queryKey) {
      apiKeyInput.value = queryKey;
      localStorage.setItem('10s_api_key', queryKey);
    } else {
      const savedKey = localStorage.getItem('10s_api_key');
      if (savedKey) apiKeyInput.value = savedKey;
    }

    // Load auto-download preference
    const savedAutoDownload = localStorage.getItem('10s_auto_download');
    if (autoDownloadInput) {
      autoDownloadInput.checked = savedAutoDownload !== 'false';
    }

    // Load Task List from localStorage
    const savedTasks = localStorage.getItem('10s_task_list');
    if (savedTasks) {
      try {
        taskList = JSON.parse(savedTasks);
        renderTaskList();
        // Start polling if there are pending/running tasks
        checkAndStartPolling();
      } catch (e) {
        taskList = [];
      }
    }

    const finalUrl = apiUrlInput.value.trim();
    const finalKey = apiKeyInput.value.trim();
    if (finalUrl && finalKey) {
      testConnection(finalUrl, finalKey);
    }
  }

  // Auto-download listener
  if (autoDownloadInput) {
    autoDownloadInput.addEventListener('change', () => {
      localStorage.setItem('10s_auto_download', autoDownloadInput.checked);
    });
  }
  if (labelAutoDownload && autoDownloadInput) {
    labelAutoDownload.addEventListener('click', () => {
      autoDownloadInput.checked = !autoDownloadInput.checked;
      localStorage.setItem('10s_auto_download', autoDownloadInput.checked);
    });
  }

  function triggerBrowserDownload(url) {
    const a = document.createElement('a');
    a.href = url;
    // Keep original filename
    a.download = url.split('/').pop().split('?')[0];
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Test API connection
  async function testConnection(url, key) {
    const cleanUrl = url.replace(/\/+$/, '');
    connIndicator.className = 'status-indicator offline';
    connStatusText.textContent = 'Đang kiểm tra...';

    try {
      // We will try calling the keys list or simple task list endpoint just to verify the key
      const response = await fetch(`${cleanUrl}/cloudfire/api/admin/keys`, {
        method: 'GET'
      });
      
      // If we get 200 or 401/403/404, we check connection
      if (response.ok) {
        // Admin or local connection works
        setConnected(true, 'Kết nối thành công (Admin)');
      } else {
        // Since admin keys endpoint is internal, let's call a mock task status to check auth
        const testAuthRes = await fetch(`${cleanUrl}/cloudfire/api/tasks/ping-test-auth`, {
          headers: { 'X-API-Key': key }
        });
        
        // 404 means route exists (endpoint pinged, key accepted but ID not found)
        // 401 / 403 means auth failure
        if (testAuthRes.status === 404 || testAuthRes.status === 200) {
          setConnected(true, 'Kết nối API thành công');
        } else if (testAuthRes.status === 401 || testAuthRes.status === 403) {
          setConnected(false, 'API Key không hợp lệ');
        } else {
          setConnected(false, `Lỗi kết nối (${testAuthRes.status})`);
        }
      }
    } catch (err) {
      setConnected(false, 'Không thể kết nối máy chủ');
    }
  }

  function setConnected(success, message) {
    if (success) {
      connIndicator.className = 'status-indicator online';
      connStatusText.textContent = message;
      connStatusText.style.color = 'var(--color-success)';
    } else {
      connIndicator.className = 'status-indicator offline';
      connStatusText.textContent = message;
      connStatusText.style.color = 'var(--color-danger)';
    }
  }

  btnConnect.addEventListener('click', () => {
    const url = apiUrlInput.value.trim();
    const key = apiKeyInput.value.trim();

    if (!url || !key) {
      alert('Vui lòng điền đầy đủ URL máy chủ và API Key!');
      return;
    }

    localStorage.setItem('10s_api_url', url);
    localStorage.setItem('10s_api_key', key);
    testConnection(url, key);
  });

  // --- Tabs Switching ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // --- Drag & Drop / File Select Helpers ---
  function setupDragAndDrop(dropzone, fileInput, fileArray, previewGrid) {
    // Click to select
    dropzone.addEventListener('click', (e) => {
      // Prevent recursion if click propagates
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    // Dragover effect
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    // Drop files
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      handleFiles(files, fileArray, previewGrid);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      handleFiles(files, fileArray, previewGrid);
    });
  }

  function handleFiles(files, fileArray, previewGrid) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Avoid duplicates
      if (fileArray.some(f => f.name === file.name && f.size === file.size)) continue;
      
      fileArray.push(file);
      renderFilePreview(file, fileArray, previewGrid);
    }
  }

  function renderFilePreview(file, fileArray, previewGrid) {
    const thumb = document.createElement('div');
    thumb.className = 'preview-thumb';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = fileArray.indexOf(file);
      if (index > -1) {
        fileArray.splice(index, 1);
      }
      thumb.remove();
    });

    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
      // Render simple video icon / helper
      const icon = document.createElement('div');
      icon.style.width = '100%';
      icon.style.height = '100%';
      icon.style.display = 'flex';
      icon.style.alignItems = 'center';
      icon.style.justifyContent = 'center';
      icon.style.background = 'rgba(239, 68, 68, 0.1)';
      icon.style.color = '#f87171';
      icon.style.fontSize = '1.2rem';
      icon.innerHTML = '<i class="fa-solid fa-file-video"></i>';
      thumb.appendChild(icon);
    } else {
      // Render image thumbnail
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      thumb.appendChild(img);
    }

    thumb.appendChild(removeBtn);
    previewGrid.appendChild(thumb);
  }

  setupDragAndDrop(imgDropzone, imgFileInput, filesToUploadImage, imgPreviewGrid);
  setupDragAndDrop(editDropzone, editFileInput, filesToUploadEdit, editPreviewGrid);
  setupDragAndDrop(vidDropzone, vidFileInput, filesToUploadVideo, vidPreviewGrid);

  // --- API Form Submissions ---
  async function submitTask(prompt, files) {
    const baseUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl || !apiKey) {
      alert('Vui lòng cấu hình URL máy chủ và API Key ở góc trên trước khi tạo tác vụ!');
      return;
    }

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('autoDownload', 'false');

    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${baseUrl}/cloudfire/api/generate`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Lỗi HTTP ${response.status}`);

      // Add task to state list
      const newTask = {
        id: result.taskId,
        prompt: prompt,
        status: result.status || 'pending',
        outputFiles: [],
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasRef: files.length > 0
      };

      taskList.unshift(newTask);
      saveTasks();
      renderTaskList();
      
      // Start polling
      checkAndStartPolling();
    } catch (error) {
      alert(`Không thể gửi yêu cầu tạo: ${error.message}`);
    }
  }

  formImage.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('img-prompt').value.trim();
    if (!prompt) return;

    const lines = prompt.split('\n').map(l => l.trim()).filter(Boolean);
    const btnSubmit = formImage.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    
    try {
      btnSubmit.disabled = true;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const hasKeyword = /tạo ảnh|tạo video|tao anh|tao video|generate image|generate video|create image|create video/i.test(line);
        if (!hasKeyword) {
          line = `tạo ảnh ${line}`;
        }
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi ${i + 1}/${lines.length}...`;
        await submitTask(line, filesToUploadImage);
      }
      
      // Clear form
      document.getElementById('img-prompt').value = '';
      filesToUploadImage.length = 0;
      imgPreviewGrid.innerHTML = '';
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  });

  formVideo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('vid-prompt').value.trim();
    if (!prompt) return;

    const lines = prompt.split('\n').map(l => l.trim()).filter(Boolean);
    const btnSubmit = formVideo.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    
    try {
      btnSubmit.disabled = true;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const hasKeyword = /tạo ảnh|tạo video|tao anh|tao video|generate image|generate video|create image|create video/i.test(line);
        if (!hasKeyword) {
          line = `tạo video ${line}`;
        }
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi ${i + 1}/${lines.length}...`;
        await submitTask(line, filesToUploadVideo);
      }
      
      // Clear form
      document.getElementById('vid-prompt').value = '';
      filesToUploadVideo.length = 0;
      vidPreviewGrid.innerHTML = '';
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  });

  formEdit.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('edit-prompt').value.trim();
    if (!prompt) return;

    const lines = prompt.split('\n').map(l => l.trim()).filter(Boolean);
    const btnSubmit = formEdit.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    
    try {
      btnSubmit.disabled = true;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const hasKeyword = /tạo ảnh|tạo video|tao anh|tao video|generate image|generate video|create image|create video/i.test(line);
        if (!hasKeyword) {
          line = `tạo video ${line}`;
        }
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi ${i + 1}/${lines.length}...`;
        await submitTask(line, filesToUploadEdit);
      }
      
      // Clear form
      document.getElementById('edit-prompt').value = '';
      filesToUploadEdit.length = 0;
      editPreviewGrid.innerHTML = '';
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  });

  // --- Task History Management & Rendering ---
  function saveTasks() {
    localStorage.setItem('10s_task_list', JSON.stringify(taskList));
  }

  function renderTaskList() {
    const hasActiveTasks = taskList.some(t => t.status === 'pending' || t.status === 'running');
    if (btnStopAll) {
      btnStopAll.style.display = hasActiveTasks ? 'inline-flex' : 'none';
    }

    if (taskList.length === 0) {
      emptyTasksState.style.display = 'flex';
      // Remove any rendered cards
      const cards = tasksListContainer.querySelectorAll('.task-card');
      cards.forEach(c => c.remove());
      return;
    }

    emptyTasksState.style.display = 'none';
    
    // Get existing cards in DOM to do smart updates
    const existingCards = {};
    tasksListContainer.querySelectorAll('.task-card').forEach(card => {
      existingCards[card.id] = card;
    });

    taskList.forEach((task, index) => {
      const cardId = `task-card-${task.id}`;
      const statusTextMap = {
        pending: 'Chờ xử lý',
        running: 'Đang chạy',
        completed: 'Hoàn thành',
        failed: 'Thất bại'
      };

      const statusText = statusTextMap[task.status] || task.status;
      const progressWidth = task.status === 'completed' ? '100%' : (task.status === 'running' ? '60%' : '5%');
      const progressClass = task.status === 'running' ? 'progress-fill running' : 'progress-fill';
      
      const timeStr = new Date(task.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Construct Results markup
      let resultsMarkup = '';
      if (task.status === 'completed' && task.outputFiles && task.outputFiles.length > 0) {
        const fileUrl = task.outputFiles[0];
        const isVideo = fileUrl.toLowerCase().match(/\.(mp4|webm|avi|mov)$/);
        
        resultsMarkup = `
          <div class="task-results">
            ${isVideo 
              ? `<video src="${fileUrl}" controls loop muted preload="metadata"></video>` 
              : `<img src="${fileUrl}" alt="Kết quả tạo AI">`
            }
            <div class="result-actions">
              <span>Định dạng: ${isVideo ? 'Video' : 'Hình ảnh'}</span>
              <a href="${fileUrl}" target="_blank">
                <i class="fa-solid fa-circle-down"></i> Tải file gốc
              </a>
            </div>
          </div>
        `;
      }

      const isCancelable = task.status === 'pending' || task.status === 'running';
      const cancelBtnHtml = isCancelable 
        ? `<button class="btn-cancel-task" onclick="cancelClientTask('${task.id}')" title="Hủy tác vụ này" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 0.68rem; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;"><i class="fa-solid fa-ban"></i> Hủy</button>` 
        : '';

      // Xử lý rút gọn prompt dài
      const isExpanded = expandedTaskIds.has(task.id);
      const isExpandedStr = isExpanded ? 'true' : 'false';
      const promptLimit = 80;
      const isLongPrompt = task.prompt.length > promptLimit;
      
      let isEditing = editingTaskPrompts[task.id] !== undefined;
      let promptHtml = '';
      if (isEditing) {
        promptHtml = `
          <div class="task-prompt-edit-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px; width: 100%;">
            <textarea class="form-control-textarea edit-prompt-textarea" style="width: 100%; font-size: 0.85rem; padding: 0.4rem; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--border-radius-sm); color: #fff; background: rgba(0,0,0,0.25); font-family: inherit; resize: vertical;" rows="2" id="edit-prompt-input-${task.id}">${editingTaskPrompts[task.id]}</textarea>
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.72rem; border-radius: 4px;" onclick="cancelEditPrompt('${task.id}')">Hủy</button>
              <button class="btn btn-primary btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.72rem; border-radius: 4px;" onclick="savePromptText('${task.id}')">Lưu</button>
              <button class="btn btn-success btn-sm" style="padding: 0.2rem 0.6rem; font-size: 0.72rem; border-radius: 4px;" onclick="recreateTaskWithPrompt('${task.id}', false)"><i class="fa-solid fa-arrows-rotate"></i> Tạo lại</button>
            </div>
          </div>
        `;
      } else {
        if (isLongPrompt) {
          const displayPrompt = isExpanded 
            ? task.prompt 
            : (task.prompt.substring(0, promptLimit) + '...');
          const btnText = isExpanded ? 'Thu gọn' : 'Đọc thêm';
          promptHtml = `
            <div class="task-prompt">
              <span class="prompt-text">${displayPrompt}</span>
              <button type="button" class="btn-toggle-prompt" onclick="togglePromptText('${task.id}')" style="background: none; border: none; color: var(--color-primary); font-size: 0.78rem; font-weight: 600; cursor: pointer; padding: 0; margin-left: 6px; outline: none; text-decoration: underline; display: inline;">${btnText}</button>
            </div>
          `;
        } else {
          promptHtml = `<div class="task-prompt">${task.prompt}</div>`;
        }
      }

      const editBtnHtml = !isEditing
        ? `<button class="btn-edit-task" onclick="startEditPrompt('${task.id}')" title="Sửa prompt" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #e0e0e0; font-size: 0.68rem; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;"><i class="fa-solid fa-pen"></i> Sửa</button>`
        : '';
      const recreateBtnHtml = !isEditing
        ? `<button class="btn-recreate-task" onclick="recreateTaskWithPrompt('${task.id}', true)" title="Tạo lại tác vụ này" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 0.68rem; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;"><i class="fa-solid fa-arrows-rotate"></i> Tạo lại</button>`
        : '';

      const cardHtml = `
        <div class="task-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="task-id">ID: ${task.id.substring(0, 8)}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="status-badge ${task.status}">${statusText}</span>
            ${cancelBtnHtml}
            ${editBtnHtml}
            ${recreateBtnHtml}
          </div>
        </div>
        ${promptHtml}
        ${task.hasRef ? `
          <div class="task-input-ref">
            <i class="fa-solid fa-paperclip"></i> Có đính kèm file tham chiếu
          </div>
        ` : ''}
        
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="${progressClass}" style="width: ${progressWidth}"></div>
          </div>
        </div>

        ${task.error ? `<div class="task-error"><i class="fa-solid fa-triangle-exclamation"></i> ${task.error}</div>` : ''}
        ${resultsMarkup}

        <div class="task-info-footer">
          <span>Thời gian tạo: ${timeStr}</span>
          <span>Cập nhật: ${new Date(task.updatedAt).toLocaleTimeString('vi-VN')}</span>
        </div>
      `;

      if (existingCards[cardId]) {
        // Update existing card
        const prevStatus = existingCards[cardId].getAttribute('data-status');
        const prevUpdated = existingCards[cardId].getAttribute('data-updated');
        const prevExpanded = existingCards[cardId].getAttribute('data-expanded');
        
        if (prevStatus !== task.status || prevUpdated !== task.updatedAt || prevExpanded !== isExpandedStr) {
          existingCards[cardId].innerHTML = cardHtml;
          existingCards[cardId].setAttribute('data-status', task.status);
          existingCards[cardId].setAttribute('data-updated', task.updatedAt);
          existingCards[cardId].setAttribute('data-expanded', isExpandedStr);
        }
        // Move to correct position index
        if (tasksListContainer.children[index] !== existingCards[cardId]) {
          tasksListContainer.insertBefore(existingCards[cardId], tasksListContainer.children[index]);
        }
        delete existingCards[cardId];
      } else {
        // Create new card
        const card = document.createElement('div');
        card.id = cardId;
        card.className = 'task-card';
        card.setAttribute('data-status', task.status);
        card.setAttribute('data-updated', task.updatedAt);
        card.setAttribute('data-expanded', isExpandedStr);
        card.innerHTML = cardHtml;
        
        if (tasksListContainer.children[index]) {
          tasksListContainer.insertBefore(card, tasksListContainer.children[index]);
        } else {
          tasksListContainer.appendChild(card);
        }
      }
    });

    // Remove any leftover old cards
    Object.values(existingCards).forEach(card => card.remove());
  }

  btnClearHistory.addEventListener('click', () => {
    if (taskList.some(t => t.status === 'pending' || t.status === 'running')) {
      if (!confirm('Có một số tác vụ đang chạy. Bạn có chắc muốn xóa lịch sử không? (Các tác vụ đang chạy vẫn sẽ tiếp tục chạy trên server)')) return;
    } else {
      if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử tác vụ khỏi trình duyệt này không?')) return;
    }

    taskList = [];
    saveTasks();
    renderTaskList();
    stopPolling();
  });

  if (btnStopAll) {
    btnStopAll.addEventListener('click', async () => {
      const activeTasks = taskList.filter(t => t.status === 'pending' || t.status === 'running');
      if (activeTasks.length === 0) return;

      if (!confirm(`Bạn có chắc chắn muốn dừng và hủy toàn bộ ${activeTasks.length} tác vụ đang chạy/chờ không?`)) {
        return;
      }

      const baseUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
      const apiKey = apiKeyInput.value.trim();

      if (!baseUrl || !apiKey) {
        alert('Vui lòng kết nối máy chủ ở Header trước khi thực hiện.');
        return;
      }

      const originalText = btnStopAll.innerHTML;
      btnStopAll.disabled = true;
      btnStopAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang dừng...`;

      try {
        await Promise.all(activeTasks.map(async (task) => {
          try {
            const response = await fetch(`${baseUrl}/cloudfire/api/tasks/${task.id}/cancel`, {
              method: 'POST',
              headers: { 'X-API-Key': apiKey }
            });
            if (response.ok) {
              task.status = 'failed';
              task.error = '❌ Tác vụ đã bị dừng và hủy bởi người dùng.';
              task.updatedAt = new Date().toISOString();
            }
          } catch (err) {
            console.error(`Lỗi khi dừng task ${task.id}:`, err.message);
          }
        }));

        saveTasks();
        renderTaskList();
        alert('✅ Đã yêu cầu dừng toàn bộ tác vụ thành công.');
      } catch (err) {
        alert(`Lỗi khi dừng: ${err.message}`);
      } finally {
        btnStopAll.disabled = false;
        btnStopAll.innerHTML = originalText;
        pollActiveTasks();
      }
    });
  }

  // --- Task Polling Mechanics ---
  function checkAndStartPolling() {
    const hasActiveTasks = taskList.some(t => t.status === 'pending' || t.status === 'running');
    if (hasActiveTasks && !pollingInterval) {
      console.log('🔄 Bắt đầu polling tìm trạng thái task mới...');
      pollingInterval = setInterval(pollActiveTasks, 4000);
    }
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('⏹ Dừng polling.');
    }
  }

  async function pollActiveTasks() {
    const activeTasks = taskList.filter(t => t.status === 'pending' || t.status === 'running');
    if (activeTasks.length === 0) {
      stopPolling();
      return;
    }

    const baseUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl || !apiKey) {
      stopPolling();
      return;
    }

    let updatedAny = false;

    for (const task of activeTasks) {
      try {
        const response = await fetch(`${baseUrl}/cloudfire/api/tasks/${task.id}`, {
          headers: { 'X-API-Key': apiKey }
        });
        
        if (!response.ok) {
          // If 404, the task might have been deleted on the server or incorrect server config
          if (response.status === 404) {
            task.status = 'failed';
            task.error = 'Không tìm thấy Task trên server (Có thể đã bị xóa)';
            task.updatedAt = new Date().toISOString();
            updatedAny = true;
          }
          continue;
        }

        const serverTask = await response.json();
        
        if (serverTask.status !== task.status) {
          task.status = serverTask.status;
          task.error = serverTask.error;
          task.outputFiles = serverTask.outputFiles;
          task.updatedAt = serverTask.updatedAt || new Date().toISOString();
          updatedAny = true;

          // Auto-download if completed
          if (task.status === 'completed' && autoDownloadInput && autoDownloadInput.checked) {
            if (!downloadedTaskIds.has(task.id)) {
              if (task.outputFiles && task.outputFiles.length > 0) {
                task.outputFiles.forEach(fileUrl => {
                  triggerBrowserDownload(fileUrl);
                });
              }
              downloadedTaskIds.add(task.id);
              localStorage.setItem('10s_downloaded_tasks', JSON.stringify(Array.from(downloadedTaskIds)));
            }
          }
        }
      } catch (err) {
        console.error(`Lỗi khi polling task ${task.id}:`, err.message);
      }
    }

    if (updatedAny) {
      saveTasks();
      renderTaskList();
    }
  }

  // Hủy tác vụ từ client
  window.cancelClientTask = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn dừng và hủy tác vụ này không?')) return;
    
    const baseUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
    const apiKey = apiKeyInput.value.trim();
    
    if (!baseUrl || !apiKey) {
      alert('Vui lòng kết nối máy chủ ở Header trước khi thực hiện.');
      return;
    }
    
    try {
      const response = await fetch(`${baseUrl}/cloudfire/api/tasks/${id}/cancel`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey }
      });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Không thể hủy tác vụ');
      
      alert('✅ Đã dừng và hủy tác vụ thành công.');
      
      // Update local state status and poll immediately
      const task = taskList.find(t => t.id === id);
      if (task) {
        task.status = 'failed';
        task.error = '❌ Tác vụ đã bị dừng và hủy bởi người dùng.';
        task.updatedAt = new Date().toISOString();
        saveTasks();
        renderTaskList();
      }
      
      pollActiveTasks();
    } catch (error) {
      alert(`Lỗi: ${error.message}`);
    }
  };

  // Toggle rút gọn/đọc thêm prompt
  window.togglePromptText = (id) => {
    if (expandedTaskIds.has(id)) {
      expandedTaskIds.delete(id);
    } else {
      expandedTaskIds.add(id);
    }
    renderTaskList();
  };

  // --- Prompt inline editing & recreation ---
  window.startEditPrompt = (id) => {
    const task = taskList.find(t => t.id === id);
    if (task) {
      editingTaskPrompts[id] = task.prompt;
      renderTaskList();
    }
  };

  window.cancelEditPrompt = (id) => {
    delete editingTaskPrompts[id];
    renderTaskList();
  };

  window.savePromptText = (id) => {
    const textarea = document.getElementById(`edit-prompt-input-${id}`);
    if (textarea) {
      const newPrompt = textarea.value.trim();
      if (!newPrompt) {
        alert('Prompt không được để trống!');
        return;
      }
      const task = taskList.find(t => t.id === id);
      if (task) {
        task.prompt = newPrompt;
        task.updatedAt = new Date().toISOString();
        saveTasks();
        delete editingTaskPrompts[id];
        renderTaskList();
      }
    }
  };

  window.recreateTaskWithPrompt = async (id, useCurrentText = false) => {
    const task = taskList.find(t => t.id === id);
    if (!task) return;

    let prompt = task.prompt;
    if (!useCurrentText) {
      const textarea = document.getElementById(`edit-prompt-input-${id}`);
      if (textarea) {
        prompt = textarea.value.trim();
      }
    }

    if (!prompt) {
      alert('Prompt không được để trống!');
      return;
    }

    // Determine files to upload based on current active tab
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    let files = [];
    if (activeTab === 'tab-image') files = filesToUploadImage;
    else if (activeTab === 'tab-video') files = filesToUploadVideo;
    else if (activeTab === 'tab-edit') files = filesToUploadEdit;

    if (task.hasRef && files.length === 0) {
      if (!confirm('Tác vụ gốc có tệp tham chiếu, nhưng hiện tại bạn chưa chọn tệp mới ở bảng bên trái. Bạn có muốn tiếp tục tạo lại tác vụ CHỈ với câu chữ prompt không?')) {
        return;
      }
    }

    // Submit
    const btnSubmit = document.querySelector('.tab-content.active form button[type="submit"]');
    const originalText = btnSubmit ? btnSubmit.innerHTML : '';
    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...`;
      }
      await submitTask(prompt, files);
      delete editingTaskPrompts[id];
      renderTaskList();
    } catch (err) {
      alert(`Lỗi khi tạo lại: ${err.message}`);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }
    }
  };

  // --- Initialize Page ---
  init();
});
