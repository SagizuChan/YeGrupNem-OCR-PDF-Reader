(function (w) {
  function ensureStructure(root) {
    if (!root) {
      root = document.createElement('div');
      root.className = 'loading_area';
      document.body.appendChild(root);
    }
    if (!root.querySelector('#wrapper')) {
      root.innerHTML = `
        <div id="wrapper">
          <div class="loading-bar">
            <div class="progress-bar"></div>
          </div>
          <div class="status">
            <div class="state">Starting...</div>
            <div class="percentage">0%</div>
          </div>
        </div>`;
    }
    return {
      root,
      progressBar: root.querySelector('.progress-bar'),
      stateText: root.querySelector('.state'),
      percentageText: root.querySelector('.percentage'),
    };
  }

  function createLoading(root) {
    const refs = ensureStructure(root);
    function show() { refs.root.style.display = 'flex'; }
    function hide() { refs.root.style.display = 'none'; }
    function setProgress(pct) {
      const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      if (refs.progressBar) refs.progressBar.style.width = v + '%';
      if (refs.percentageText) refs.percentageText.textContent = v + '%';
    }
    function setStatus(text) {
      if (refs.stateText) refs.stateText.textContent = text || '';
    }
    function reset() {
      setStatus('Starting...');
      setProgress(0);
      hide();
    }
    return { show, hide, setProgress, setStatus, reset, el: refs.root };
  }

  w.createLoading = createLoading;
})(window);