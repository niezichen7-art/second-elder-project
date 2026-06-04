(function () {
  const questions = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  const buildReport = window.QUESTION_BUILD_REPORT || {};
  const storageKey = "elderAbilityQuizState.v1";

  const typeLabels = {
    judgement: "判断题",
    single: "单选题",
    multiple: "多选题"
  };

  const els = {
    buildStatus: document.getElementById("buildStatus"),
    answeredCount: document.getElementById("answeredCount"),
    accuracyRate: document.getElementById("accuracyRate"),
    wrongCount: document.getElementById("wrongCount"),
    wrongPanelCount: document.getElementById("wrongPanelCount"),
    allTab: document.getElementById("allTab"),
    wrongTab: document.getElementById("wrongTab"),
    questionJump: document.getElementById("questionJump"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    randomBtn: document.getElementById("randomBtn"),
    resetBtn: document.getElementById("resetBtn"),
    emptyState: document.getElementById("emptyState"),
    questionCard: document.getElementById("questionCard"),
    questionType: document.getElementById("questionType"),
    questionProgress: document.getElementById("questionProgress"),
    sourceBtn: document.getElementById("sourceBtn"),
    questionTitle: document.getElementById("questionTitle"),
    answerForm: document.getElementById("answerForm"),
    submitBtn: document.getElementById("submitBtn"),
    clearBtn: document.getElementById("clearBtn"),
    resultPanel: document.getElementById("resultPanel"),
    resultText: document.getElementById("resultText"),
    answerText: document.getElementById("answerText"),
    explanationText: document.getElementById("explanationText"),
    resultNextBtn: document.getElementById("resultNextBtn"),
    warningPanel: document.getElementById("warningPanel"),
    wrongList: document.getElementById("wrongList"),
    sourceDialog: document.getElementById("sourceDialog"),
    sourceTitle: document.getElementById("sourceTitle"),
    closeSourceBtn: document.getElementById("closeSourceBtn"),
    sourceImage: document.getElementById("sourceImage")
  };

  const state = loadState();

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return {
        currentId: Number(parsed.currentId) || 1,
        filter: parsed.filter === "wrong" ? "wrong" : "all",
        answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {}
      };
    } catch {
      return { currentId: 1, filter: "all", answers: {} };
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function questionById(id) {
    return questions.find((question) => question.id === Number(id));
  }

  function activeQuestions() {
    if (state.filter !== "wrong") return questions;
    return questions.filter((question) => state.answers[question.id]?.correct === false);
  }

  function currentQuestion() {
    const active = activeQuestions();
    if (!active.length) return null;
    return questionById(state.currentId) && active.some((q) => q.id === state.currentId)
      ? questionById(state.currentId)
      : active[0];
  }

  function setCurrent(question) {
    if (!question) return;
    state.currentId = question.id;
    saveState();
    render();
  }

  function sorted(values) {
    return [...values].map(String).sort();
  }

  function sameAnswer(a, b) {
    const left = sorted(a);
    const right = sorted(b);
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function selectedValues() {
    return Array.from(els.answerForm.querySelectorAll("input:checked")).map((input) => input.value);
  }

  function render() {
    renderHeader();
    renderTabs();

    const question = currentQuestion();
    if (!question) {
      els.emptyState.hidden = false;
      els.questionCard.hidden = true;
      renderWrongList();
      return;
    }

    if (state.currentId !== question.id) {
      state.currentId = question.id;
      saveState();
    }

    els.emptyState.hidden = true;
    els.questionCard.hidden = false;
    els.questionType.textContent = typeLabels[question.type] || question.type || "题型";
    els.questionProgress.textContent = `${question.id}/${questions.length}`;
    els.questionTitle.textContent = question.title || "题干识别为空";
    els.questionJump.value = question.id;
    els.questionJump.max = String(questions.length);
    els.sourceBtn.hidden = !question.sourceImage;

    renderOptions(question);
    renderResult(question);
    renderWarnings(question);
    renderNavigation(question);
    renderWrongList();
  }

  function renderHeader() {
    const records = Object.values(state.answers);
    const answered = records.length;
    const correct = records.filter((record) => record.correct).length;
    const wrong = records.filter((record) => record.correct === false).length;
    const warnings = Number(buildReport.warningCount) || 0;
    els.answeredCount.textContent = answered;
    els.accuracyRate.textContent = answered ? `${Math.round((correct / answered) * 100)}%` : "0%";
    els.wrongCount.textContent = wrong;
    els.wrongPanelCount.textContent = String(wrong);
    els.buildStatus.textContent = questions.length
      ? `共 ${questions.length} 题${warnings ? `，${warnings} 条识别提示` : ""}`
      : "未生成题库";
  }

  function renderTabs() {
    const wrongActive = state.filter === "wrong";
    els.allTab.classList.toggle("active", !wrongActive);
    els.wrongTab.classList.toggle("active", wrongActive);
    els.allTab.setAttribute("aria-selected", String(!wrongActive));
    els.wrongTab.setAttribute("aria-selected", String(wrongActive));
  }

  function renderOptions(question) {
    const existing = state.answers[question.id]?.selected || [];
    const inputType = question.type === "multiple" ? "checkbox" : "radio";
    els.answerForm.innerHTML = "";

    for (const option of question.options || []) {
      const id = `option-${question.id}-${option.key}`;
      const label = document.createElement("label");
      label.className = "option";
      label.htmlFor = id;

      const input = document.createElement("input");
      input.type = inputType;
      input.name = `answer-${question.id}`;
      input.id = id;
      input.value = option.key;
      input.checked = existing.includes(option.key);

      const text = document.createElement("span");
      const prefix = question.type === "judgement" ? "" : `<strong>${escapeHtml(option.key)}.</strong> `;
      text.innerHTML = `${prefix}${escapeHtml(option.text || option.key)}`;

      label.append(input, text);
      els.answerForm.append(label);
    }

    updateActionState(question);
  }

  function renderResult(question) {
    const record = state.answers[question.id];
    if (!record) {
      els.resultPanel.hidden = true;
      els.resultPanel.className = "result-panel";
      els.resultText.textContent = "";
      els.answerText.textContent = "";
      els.explanationText.textContent = "";
      els.resultNextBtn.hidden = true;
      return;
    }

    els.resultPanel.hidden = false;
    els.resultPanel.className = `result-panel ${record.correct ? "correct" : "wrong"}`;
    els.resultText.textContent = record.correct ? "回答正确" : "回答错误";
    els.answerText.textContent = `正确答案：${formatAnswer(question)}`;
    els.explanationText.textContent = question.explanation || "";
    els.resultNextBtn.hidden = false;
  }

  function updateActionState(question) {
    const selected = selectedValues();
    const hasSelection = selected.length > 0;
    const record = question ? state.answers[question.id] : null;
    els.submitBtn.disabled = !hasSelection;
    els.clearBtn.disabled = !hasSelection;
    els.submitBtn.textContent = record ? "重新提交答案" : "提交答案";
  }

  function handleAnswerChange() {
    const question = currentQuestion();
    if (!question) return;
    updateActionState(question);

    const record = state.answers[question.id];
    if (!record) return;

    const selected = selectedValues();
    if (sameAnswer(selected, record.selected || [])) {
      renderResult(question);
      return;
    }

    els.resultPanel.hidden = false;
    els.resultPanel.className = "result-panel pending";
    els.resultText.textContent = "已修改选择";
    els.answerText.textContent = "重新提交后更新判定";
    els.explanationText.textContent = "";
    els.resultNextBtn.hidden = true;
  }

  function renderWarnings(question) {
    const warnings = question.warnings || [];
    if (!warnings.length) {
      els.warningPanel.hidden = true;
      els.warningPanel.textContent = "";
      return;
    }
    els.warningPanel.hidden = false;
    els.warningPanel.textContent = `识别提示：${warnings.join("；")}`;
  }

  function renderNavigation(question) {
    const active = activeQuestions();
    const position = active.findIndex((item) => item.id === question.id);
    els.prevBtn.disabled = active.length <= 1;
    els.nextBtn.disabled = active.length <= 1;
    els.randomBtn.disabled = active.length <= 1;
    els.prevBtn.dataset.position = String(position);
    els.nextBtn.dataset.position = String(position);
  }

  function renderWrongList() {
    const wrongQuestions = questions.filter((question) => state.answers[question.id]?.correct === false);
    els.wrongList.innerHTML = "";
    if (!wrongQuestions.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "暂无错题";
      els.wrongList.append(empty);
      return;
    }

    for (const question of wrongQuestions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${question.id}. ${question.title}`;
      button.addEventListener("click", () => {
        state.filter = "wrong";
        setCurrent(question);
      });
      els.wrongList.append(button);
    }
  }

  function formatAnswer(question) {
    const optionsByKey = new Map((question.options || []).map((option) => [option.key, option]));
    return (question.answer || [])
      .map((key) => {
        const option = optionsByKey.get(key);
        if (!option) return key;
        return question.type === "judgement" ? option.text : `${key}. ${option.text}`;
      })
      .join("；");
  }

  function goByOffset(offset) {
    const active = activeQuestions();
    const current = currentQuestion();
    if (!current || active.length < 2) return;
    const index = active.findIndex((question) => question.id === current.id);
    const next = active[(index + offset + active.length) % active.length];
    setCurrent(next);
  }

  function goRandom() {
    const active = activeQuestions();
    const current = currentQuestion();
    if (!current || active.length < 2) return;
    let next = current;
    while (next.id === current.id) {
      next = active[Math.floor(Math.random() * active.length)];
    }
    setCurrent(next);
  }

  function submitCurrent() {
    const question = currentQuestion();
    if (!question) return;
    const selected = selectedValues();
    if (!selected.length) return;
    const correct = sameAnswer(selected, question.answer || []);
    state.answers[question.id] = {
      selected,
      correct,
      answeredAt: new Date().toISOString()
    };
    saveState();
    render();
  }

  function clearSelection() {
    for (const input of els.answerForm.querySelectorAll("input")) {
      input.checked = false;
    }
    handleAnswerChange();
  }

  function resetProgress() {
    if (!confirm("重置全部答题记录？")) return;
    state.answers = {};
    state.filter = "all";
    state.currentId = 1;
    saveState();
    render();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  els.allTab.addEventListener("click", () => {
    state.filter = "all";
    saveState();
    render();
  });

  els.wrongTab.addEventListener("click", () => {
    state.filter = "wrong";
    saveState();
    render();
  });

  els.questionJump.addEventListener("change", () => {
    const target = questionById(Number(els.questionJump.value));
    if (target) {
      state.filter = "all";
      setCurrent(target);
    }
  });

  els.prevBtn.addEventListener("click", () => goByOffset(-1));
  els.nextBtn.addEventListener("click", () => goByOffset(1));
  els.randomBtn.addEventListener("click", goRandom);
  els.submitBtn.addEventListener("click", submitCurrent);
  els.clearBtn.addEventListener("click", clearSelection);
  els.resultNextBtn.addEventListener("click", () => goByOffset(1));
  els.answerForm.addEventListener("change", handleAnswerChange);
  els.resetBtn.addEventListener("click", resetProgress);

  els.sourceBtn.addEventListener("click", () => {
    const question = currentQuestion();
    if (!question) return;
    els.sourceTitle.textContent = `第 ${question.id} 题原截图`;
    els.sourceImage.src = question.sourceImage || "";
    if (typeof els.sourceDialog.showModal === "function") {
      els.sourceDialog.showModal();
    } else {
      window.open(question.sourceImage, "_blank");
    }
  });

  els.closeSourceBtn.addEventListener("click", () => els.sourceDialog.close());

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goByOffset(-1);
    if (event.key === "ArrowRight") goByOffset(1);
  });

  render();
})();
