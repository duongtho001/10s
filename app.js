document.addEventListener('DOMContentLoaded', () => {
  
  // --- DOM Elements ---
  const apiUrlInput = document.getElementById('api-url-input');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnConnect = document.getElementById('btn-connect');
  const connIndicator = document.getElementById('conn-indicator');
  const connStatusText = document.getElementById('conn-status-text');
  
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
  
  const tasksListContainer = document.getElementById('tasks-list-container');
  const emptyTasksState = document.getElementById('empty-tasks-state');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // --- State Variables ---
  let filesToUploadImage = [];
  let filesToUploadEdit = [];
  let taskList = [];
  let pollingInterval = null;

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

    if (savedUrl && savedKey) {
      testConnection(savedUrl, savedKey);
    }
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

    await submitTask(prompt, filesToUploadImage);
    
    // Clear form
    document.getElementById('img-prompt').value = '';
    filesToUploadImage.length = 0;
    imgPreviewGrid.innerHTML = '';
  });

  formVideo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('vid-prompt').value.trim();
    if (!prompt) return;

    await submitTask(prompt, []);
    
    // Clear form
    document.getElementById('vid-prompt').value = '';
  });

  formEdit.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('edit-prompt').value.trim();
    if (!prompt) return;

    await submitTask(prompt, filesToUploadEdit);

    // Clear form
    document.getElementById('edit-prompt').value = '';
    filesToUploadEdit.length = 0;
    editPreviewGrid.innerHTML = '';
  });

  // --- Task History Management & Rendering ---
  function saveTasks() {
    localStorage.setItem('10s_task_list', JSON.stringify(taskList));
  }

  function renderTaskList() {
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

      const cardHtml = `
        <div class="task-header">
          <span class="task-id">ID: ${task.id.substring(0, 8)}</span>
          <span class="status-badge ${task.status}">${statusText}</span>
        </div>
        <div class="task-prompt">${task.prompt}</div>
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
        if (existingCards[cardId].getAttribute('data-status') !== task.status || existingCards[cardId].getAttribute('data-updated') !== task.updatedAt) {
          existingCards[cardId].innerHTML = cardHtml;
          existingCards[cardId].setAttribute('data-status', task.status);
          existingCards[cardId].setAttribute('data-updated', task.updatedAt);
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

  // --- Initialize Page ---
  init();
});
