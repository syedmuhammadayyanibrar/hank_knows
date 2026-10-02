import { searchDocuments } from './retrieval.js';
import { evaluateSafety } from './safetyGate.js';
import { generateWorkOrder } from './workOrder.js';
import {
  createKnowledgeBase,
  addKnowledgeItem,
  getAllItems,
  recordKnowledgeUsage,
  findBestMatch
} from './knowledgeBase.js';
import { STORY_STEPS } from './story.js';

const DEFAULT_SHOP_DATA = {
  shopName: "Acme Precision Stamping & CNC",
  phoneExtension: "EXT 4040 · LINE 4",
  workers: [
    { id: "dev", name: "Dev", role: "Apprentice Machinist", bay: "Press Line 4" },
    { id: "marco", name: "Marco", role: "CNC Operator", bay: "Mill Cell 2" },
    { id: "lena", name: "Lena", role: "Brake & Lathe Operator", bay: "Turning & Forming Bay" }
  ],
  veterans: [
    { id: "hank", name: "Hank", role: "Lead Toolmaker & Setup Specialist", extension: "4041" }
  ],
  machines: [
    { id: "Press 4", name: "Minster 200-Ton Mechanical Press 4", aliases: ["press 4", "press-4", "press4", "press", "ram", "la prensa 4"] },
    { id: "Lathe 3", name: "Mazak Quick Turn Lathe 3", aliases: ["lathe 3", "lathe-3", "lathe3", "lathe", "chuck"] },
    { id: "CNC Mill 2", name: "Haas VF-2 CNC Mill 2", aliases: ["cnc mill 2", "cnc mill", "mill 2", "cnc 2", "mill", "cnc"] },
    { id: "Compressor A", name: "Rotary Screw Air Compressor A", aliases: ["compressor a", "compressor-a", "compressor", "air compressor"] },
    { id: "Conveyor B", name: "Chip and Scrap Conveyor B", aliases: ["conveyor b", "conveyor-b", "conveyor", "belt"] },
    { id: "Tank 4", name: "Parts Washer and Vapor Degreaser Tank 4", aliases: ["tank 4", "tank-4", "tank4", "degreaser", "washer"] },
    { id: "Grinder", name: "Toolroom Pedestal Grinder", aliases: ["grinder", "pedestal grinder"] }
  ]
};

const DEFAULT_SOPS = [
  {
    id: "SOP-PRESS-01",
    title: "Press 4 Die Changeover Procedure",
    machineId: "Press 4",
    tag: "SOP · Press changeover",
    keywords: ["press", "press 4", "changeover", "change", "die", "chnage", "6 inch", "inch", "tooling", "ram", "clamp", "shut height", "bed pins", "torque"],
    summary: "Press 4 die changeover procedure: Stop press at top dead center (TDC), engage flywheel brake, and unclamp hydraulic die clamps. Roll out previous die onto cart. Align new 6-inch die on bed pins, torque clamp bolts to 120 ft-lbs, and verify shut height clearance before running.",
    gapNote: "Does not address abnormal mechanical grinding noise or dry ram bearings."
  },
  {
    id: "SOP-COOLANT-01",
    title: "CNC Mill 2 Coolant Refill and Concentration Protocol",
    machineId: "CNC Mill 2",
    tag: "SOP · Coolant refill",
    keywords: ["coolant", "refill", "low", "cnc", "mill", "cnc mill 2", "refractometer", "fill", "ratio", "water", "tank"],
    summary: "CNC Mill 2 coolant refill: Check optical refractometer reading (target 8% to 10%). If coolant level is low on CNC Mill 2, refill reservoir through top filter port with a 10:1 ratio of water to water-soluble synthetic coolant concentrate. Verify pump manifold pressure at 40 PSI.",
    gapNote: null
  },
  {
    id: "SOP-COMP-01",
    title: "Compressor A Pressure Fault Reset Procedure",
    machineId: "Compressor A",
    tag: "SOP · Compressor fault",
    keywords: ["compressor", "compressor a", "pressure", "fault", "reset", "air", "receiver", "discharge", "valve", "trip"],
    summary: "Compressor A pressure fault: Check main air receiver discharge valve and verify system pressure is below 125 PSI. Drain moisture condensation trap for 5 seconds. Press blue manual reset button on side control panel. If fault trips repeatedly, do not open high-voltage electrical enclosure.",
    gapNote: null
  },
  {
    id: "SOP-LOTO-01",
    title: "Lockout / Tagout (LOTO) and Tag Placement Protocol",
    machineId: "Lathe 3",
    tag: "SOP · Lockout/tagout",
    keywords: ["lockout", "tagout", "loto", "lathe", "tags", "tag", "lock", "padlock", "breaker", "hasp", "disconnect", "zero energy"],
    summary: "Mandatory zero-energy state isolation before servicing machinery: Turn main disconnect handle to OFF, apply red safety padlock with personal tag directly onto the breaker lockout hasp. To lockout the lathe, isolate main 480V disconnect and verify zero energy with test start before maintenance.",
    gapNote: null
  }
];

let shopData = DEFAULT_SHOP_DATA;
let sopsData = DEFAULT_SOPS;
let kb = createKnowledgeBase();
let workOrders = [];
let woCounter = 1;
let activeWorker = shopData.workers[0];
let isStoryRunning = false;
let pendingGapQuestion = null;

const chatStream = document.getElementById('chat-stream');
const chatEmpty = document.getElementById('chat-empty');
const typingIndicator = document.getElementById('typing-indicator');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const workerButtons = document.querySelectorAll('.seg-btn');
const replayBtn = document.getElementById('replay-btn');
const mobileReplayBtn = document.getElementById('mobile-replay-btn');
const resetBtn = document.getElementById('reset-btn');
const storyBanner = document.getElementById('story-banner');
const storyBannerText = document.getElementById('story-banner-text');
const storyBannerNudge = document.getElementById('story-banner-nudge');
const reusedBanner = document.getElementById('reused-banner');
const veteranBox = document.getElementById('veteran-capture-box');
const vetSuggestedBtn = document.getElementById('vet-suggested-btn');
const vetInput = document.getElementById('vet-input');
const vetSendBtn = document.getElementById('vet-send-btn');
const woCountBadge = document.getElementById('wo-count');
const woEmpty = document.getElementById('wo-empty');
const currentWoContainer = document.getElementById('current-wo-container');
const olderWoStack = document.getElementById('older-wo-stack');
const kbCountBadge = document.getElementById('kb-count');
const kbEmpty = document.getElementById('kb-empty');
const kbCardsContainer = document.getElementById('kb-cards-container');
const quickChips = document.querySelectorAll('.quick-chip');
const phoneClock = document.getElementById('phone-clock');

const evalCard = document.getElementById('eval-card');
const evalMetricSafety = document.getElementById('eval-metric-safety');
const evalMetricGap = document.getElementById('eval-metric-gap');
const evalMetricRetrieval = document.getElementById('eval-metric-retrieval');
const evalMetricWo = document.getElementById('eval-metric-wo');

async function loadData() {
  try {
    const shopRes = await fetch('./data/shop.json');
    if (shopRes.ok) {
      shopData = await shopRes.json();
    }
  } catch (e) {}

  try {
    const sopsRes = await fetch('./data/sops.json');
    if (sopsRes.ok) {
      sopsData = await sopsRes.json();
    }
  } catch (e) {}

  loadEvalResults();
}

async function loadEvalResults() {
  if (!evalCard) return;
  try {
    const res = await fetch('./eval/results.json');
    if (!res.ok) {
      evalCard.classList.add('hidden');
      return;
    }
    const data = await res.json();
    if (!data || !data.test) {
      evalCard.classList.add('hidden');
      return;
    }

    evalCard.classList.remove('hidden');
    const t = data.test;

    if (evalMetricSafety) {
      evalMetricSafety.textContent = `${t.safety_recall.percentage}% (${t.safety_recall.passed}/${t.safety_recall.total})`;
    }
    if (evalMetricGap) {
      evalMetricGap.textContent = `${t.gap_detection.percentage}% (${t.gap_detection.passed}/${t.gap_detection.total})`;
    }
    if (evalMetricRetrieval) {
      evalMetricRetrieval.textContent = `${t.retrieval_top1.percentage}% (${t.retrieval_top1.passed}/${t.retrieval_top1.total})`;
    }
    if (evalMetricWo) {
      evalMetricWo.textContent = `${t.work_order_overall.percentage}% (${t.work_order_overall.passed}/${t.work_order_overall.total})`;
    }
  } catch (err) {
    evalCard.classList.add('hidden');
  }
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  if (phoneClock) {
    phoneClock.textContent = `${h}:${m}`;
  }
}

function setWorker(workerId) {
  const found = (shopData.workers || DEFAULT_SHOP_DATA.workers).find(w => w.id === workerId);
  if (found) {
    activeWorker = found;
    workerButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.worker === workerId);
    });
  }
}

function setTyping(visible) {
  if (!typingIndicator) return;
  if (visible) {
    typingIndicator.style.display = 'inline-flex';
    chatStream.appendChild(typingIndicator);
    chatStream.scrollTop = chatStream.scrollHeight;
  } else {
    typingIndicator.style.display = 'none';
  }
}

function addMessage({ sender, text, sourceTag = null, isRefusal = false, isVeteran = false }) {
  if (chatEmpty) {
    chatEmpty.style.display = 'none';
  }

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = `bubble ${sender}-bubble`;

  if (isVeteran) {
    bubble.classList.add('veteran-sourced');
  }

  if (isRefusal) {
    bubble.classList.add('refusal-bubble');
    const badge = document.createElement('div');
    badge.className = 'refusal-badge';
    badge.textContent = 'REFUSED TO GUESS';
    bubble.appendChild(badge);
  }

  const textNode = document.createElement('div');
  textNode.textContent = text;
  bubble.appendChild(textNode);
  wrapper.appendChild(bubble);

  if (sourceTag) {
    const tag = document.createElement('span');
    tag.className = 'source-tag';
    if (isVeteran) tag.classList.add('veteran');
    if (isRefusal) tag.classList.add('safety');
    tag.textContent = sourceTag;
    wrapper.appendChild(tag);
  }

  chatStream.appendChild(wrapper);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function addWorkOrder(wo) {
  workOrders.unshift(wo);
  woCountBadge.textContent = String(workOrders.length);
  woEmpty.style.display = 'none';

  if (currentWoContainer.firstElementChild) {
    const prevWo = workOrders[1];
    if (prevWo) {
      const collapsed = document.createElement('div');
      collapsed.className = 'collapsed-wo';
      collapsed.innerHTML = `<span>${prevWo.id} · ${prevWo.machine}</span><span>${prevWo.severity} · ${prevWo.time}</span>`;
      olderWoStack.prepend(collapsed);
    }
    currentWoContainer.innerHTML = '';
  }

  const tag = document.createElement('div');
  tag.className = 'work-order-tag';
  if (wo.severity === 'HIGH') {
    tag.classList.add('is-high');
  }

  const sevClass = wo.severity.toLowerCase();

  tag.innerHTML = `
    <div class="hazard-strip"></div>
    <div class="tag-body">
      <div class="wo-field-row">
        <span class="wo-label">WO #</span>
        <span class="wo-val">${wo.id}</span>
      </div>
      <div class="wo-field-row">
        <span class="wo-label">Machine</span>
        <span class="wo-val">${wo.machine}</span>
      </div>
      <div class="wo-field-row">
        <span class="wo-label">Severity</span>
        <span class="severity-chip ${sevClass}">${wo.severity}</span>
      </div>
      <div class="wo-field-row">
        <span class="wo-label">Route</span>
        <span class="wo-val">${wo.route}</span>
      </div>
      <div class="wo-field-row">
        <span class="wo-label">Reported by</span>
        <span class="wo-val">${wo.reportedBy}</span>
      </div>
      <div class="wo-field-row">
        <span class="wo-label">Time</span>
        <span class="wo-val">${wo.time}</span>
      </div>
      <div class="wo-val issue-val">${wo.issue}</div>
    </div>
  `;

  currentWoContainer.appendChild(tag);
}

function renderKnowledgeBase() {
  const items = getAllItems(kb);
  kbCountBadge.textContent = String(items.length);

  if (items.length === 0) {
    kbEmpty.style.display = 'block';
    kbCardsContainer.innerHTML = '';
    return;
  }

  kbEmpty.style.display = 'none';
  kbCardsContainer.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kb-card';
    card.id = `kb-item-${item.id}`;

    card.innerHTML = `
      <div class="kb-card-top">
        <div class="kb-question">${item.question}</div>
        <div class="reused-stamp hidden">REUSED</div>
      </div>
      <div class="kb-answer">${item.answer}</div>
      <div class="kb-footer">
        <span>Captured from ${item.capturedFrom} · ${item.capturedAt}</span>
        <span>used ${item.usageCount}x</span>
      </div>
    `;

    kbCardsContainer.appendChild(card);
  });
}

function triggerReusedStamp(itemId) {
  const card = document.getElementById(`kb-item-${itemId}`);
  if (!card) return;

  card.classList.add('reused-highlight');
  const stamp = card.querySelector('.reused-stamp');
  if (stamp) {
    stamp.classList.remove('hidden');
  }

  reusedBanner.classList.remove('hidden');

  setTimeout(() => {
    reusedBanner.classList.add('hidden');
  }, 2400);
}

function showVeteranBox(question, suggestedAnswer = null) {
  pendingGapQuestion = question;
  veteranBox.classList.remove('hidden');
  if (suggestedAnswer) {
    vetSuggestedBtn.textContent = suggestedAnswer;
    vetInput.value = suggestedAnswer;
  } else {
    vetInput.value = '';
  }
  vetInput.focus();
}

function hideVeteranBox() {
  veteranBox.classList.add('hidden');
  pendingGapQuestion = null;
}

function captureVeteranAnswer(answerText) {
  if (!answerText || !answerText.trim()) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const questionText = pendingGapQuestion || 'press 4 is making a grinding noise, red light on';

  const newItem = addKnowledgeItem(kb, {
    question: questionText,
    answer: answerText.trim(),
    machineId: 'Press 4',
    capturedFrom: 'Hank',
    capturedAt: `Today ${timeStr}`
  });

  renderKnowledgeBase();
  hideVeteranBox();

  addMessage({
    sender: 'assistant',
    text: `Hank responded: ${answerText.trim()}`,
    sourceTag: `CAPTURED · Hank · ${timeStr}`,
    isVeteran: true
  });
}

function processWorkerQuery(rawQuery, customTimestamp = null) {
  if (typeof rawQuery !== 'string') return;
  const query = rawQuery.trim();
  if (!query) return;

  const now = new Date();
  const timeStr = customTimestamp || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanGreeting = query.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanGreeting === 'hi' || cleanGreeting === 'hello' || cleanGreeting === 'hey') {
    addMessage({ sender: 'worker', text: query });
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addMessage({
        sender: 'assistant',
        text: 'Hello. Please state the machine ID and the issue or question you have.'
      });
    }, 300);
    return;
  }

  addMessage({
    sender: 'worker',
    text: query
  });

  setTyping(true);

  setTimeout(() => {
    setTyping(false);

    const safetyResult = evaluateSafety(query);
    if (safetyResult.isRefusal) {
      woCounter++;
      const wo = generateWorkOrder({
        query,
        worker: activeWorker,
        shopData,
        counter: woCounter,
        timestamp: timeStr,
        safetyResult
      });
      addWorkOrder(wo);

      addMessage({
        sender: 'assistant',
        text: safetyResult.refusalMessage,
        sourceTag: `SAFETY GATE · ${safetyResult.ruleId}`,
        isRefusal: true
      });
      return;
    }

    const kbMatch = findBestMatch(query, kb, 0.28);
    const cleanLower = query.toLowerCase();
    const isGrindingContext = cleanLower.includes('grind') || cleanLower.includes('bearing noise') || cleanLower.includes('ram bearing');
    const isOtherProblem = cleanLower.includes('chuck') || cleanLower.includes('stuck') || cleanLower.includes('belt');

    if (kbMatch && kbMatch.item && isGrindingContext && !isOtherProblem) {
      recordKnowledgeUsage(kb, kbMatch.item.id);
      renderKnowledgeBase();
      triggerReusedStamp(kbMatch.item.id);

      addMessage({
        sender: 'assistant',
        text: `Known fix from Hank: ${kbMatch.item.answer}`,
        sourceTag: `CAPTURED · Hank · ${kbMatch.item.capturedAt}`,
        isVeteran: true
      });
      return;
    }

    const isGrindingGap = cleanLower.includes('press') && cleanLower.includes('grinding');
    if (isGrindingGap) {
      woCounter++;
      const wo = generateWorkOrder({
        query,
        worker: activeWorker,
        shopData,
        counter: woCounter,
        timestamp: timeStr
      });
      addWorkOrder(wo);

      addMessage({
        sender: 'assistant',
        text: 'Press 4 die changeover SOP does not cover grinding noise or bearing faults. Logging work order and routing to Hank.',
        sourceTag: 'SOP · Press changeover'
      });

      showVeteranBox(query, 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.');
      return;
    }

    const sopResults = searchDocuments(query, sopsData, { threshold: 0.22 });
    if (sopResults.length > 0) {
      const topMatch = sopResults[0].doc;
      addMessage({
        sender: 'assistant',
        text: topMatch.summary,
        sourceTag: topMatch.tag || `SOP · ${topMatch.id}`
      });
      return;
    }

    woCounter++;
    const wo = generateWorkOrder({
      query,
      worker: activeWorker,
      shopData,
      counter: woCounter,
      timestamp: timeStr
    });
    addWorkOrder(wo);

    addMessage({
      sender: 'assistant',
      text: `No matching standard operating procedure located. Logged ${wo.id} and routed to ${wo.route}.`,
      sourceTag: 'UNMAPPED · Routed to specialist'
    });
  }, 400);
}

function resetApplication() {
  chatStream.innerHTML = '';
  if (chatEmpty) {
    chatStream.appendChild(chatEmpty);
    chatEmpty.style.display = 'block';
  }
  if (typingIndicator) {
    chatStream.appendChild(typingIndicator);
    typingIndicator.style.display = 'none';
  }

  kb = createKnowledgeBase();
  workOrders = [];
  woCounter = 1;
  renderKnowledgeBase();

  currentWoContainer.innerHTML = '';
  olderWoStack.innerHTML = '';
  woCountBadge.textContent = '0';
  woEmpty.style.display = 'block';

  hideVeteranBox();
  reusedBanner.classList.add('hidden');
  storyBanner.classList.add('hidden');
  storyBanner.classList.remove('finished');
  isStoryRunning = false;

  setInputsDisabled(false);
  setWorker('dev');
}

function setInputsDisabled(disabled) {
  chatInput.disabled = disabled;
  chatSend.disabled = disabled;
  replayBtn.disabled = disabled;
  if (mobileReplayBtn) mobileReplayBtn.disabled = disabled;
  quickChips.forEach(chip => {
    chip.disabled = disabled;
  });
}

function runStorySequence() {
  if (isStoryRunning) return;
  resetApplication();
  isStoryRunning = true;
  setInputsDisabled(true);

  storyBanner.classList.remove('hidden', 'finished');
  storyBannerText.textContent = 'Playing story (1/5): Dev reports grinding noise on Press 4...';
  storyBannerNudge.textContent = '';

  const steps = STORY_STEPS;
  let currentStepIndex = 0;

  function executeStep() {
    if (!isStoryRunning) return;

    if (currentStepIndex >= steps.length) {
      isStoryRunning = false;
      setInputsDisabled(false);
      storyBanner.classList.add('finished');
      storyBannerText.textContent = 'Replay finished (5/5): 1 gap caught, 1 veteran fix captured, 1 reuse verified, 1 hazard blocked.';
      storyBannerNudge.textContent = 'Try it yourself: ask a question or click a chip below.';
      return;
    }

    const step = steps[currentStepIndex];
    setWorker(step.workerId);

    if (step.type === 'worker_ask') {
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): ${activeWorker.name} queries machine issue...`;
      chatInput.value = step.query;
      setTimeout(() => {
        chatInput.value = '';
        processWorkerQuery(step.query, step.timestamp);
        currentStepIndex++;
        setTimeout(executeStep, 2600);
      }, 700);
    } else if (step.type === 'veteran_reply') {
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): Hank inputs shop wisdom from the floor...`;
      setTimeout(() => {
        vetInput.value = step.suggestedAnswer;
        setTimeout(() => {
          captureVeteranAnswer(step.suggestedAnswer);
          currentStepIndex++;
          setTimeout(executeStep, 2400);
        }, 900);
      }, 600);
    } else if (step.type === 'worker_ask_reused') {
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): ${activeWorker.name} asks same issue -> instant knowledge reuse!`;
      chatInput.value = step.query;
      setTimeout(() => {
        chatInput.value = '';
        processWorkerQuery(step.query, step.timestamp);
        currentStepIndex++;
        setTimeout(executeStep, 2600);
      }, 700);
    } else if (step.type === 'worker_ask_sop') {
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): ${activeWorker.name} queries SOP parameters...`;
      chatInput.value = step.query;
      setTimeout(() => {
        chatInput.value = '';
        processWorkerQuery(step.query, step.timestamp);
        currentStepIndex++;
        setTimeout(executeStep, 2600);
      }, 700);
    } else if (step.type === 'worker_ask_safety') {
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): Safety-critical chemical spill query tested!`;
      chatInput.value = step.query;
      setTimeout(() => {
        chatInput.value = '';
        processWorkerQuery(step.query, step.timestamp);
        currentStepIndex++;
        setTimeout(executeStep, 2800);
      }, 700);
    }
  }

  setTimeout(executeStep, 400);
}

workerButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isStoryRunning) return;
    setWorker(btn.dataset.worker);
  });
});

chatForm.addEventListener('submit', e => {
  e.preventDefault();
  if (isStoryRunning) return;
  const val = chatInput.value;
  chatInput.value = '';
  processWorkerQuery(val);
});

quickChips.forEach(chip => {
  chip.addEventListener('click', () => {
    if (isStoryRunning) return;
    const query = chip.dataset.query;
    processWorkerQuery(query);
  });
});

vetSuggestedBtn.addEventListener('click', () => {
  vetInput.value = vetSuggestedBtn.textContent.trim();
  vetInput.focus();
});

vetSendBtn.addEventListener('click', () => {
  captureVeteranAnswer(vetInput.value);
});

replayBtn.addEventListener('click', () => {
  runStorySequence();
});

if (mobileReplayBtn) {
  mobileReplayBtn.addEventListener('click', () => {
    runStorySequence();
  });
}

resetBtn.addEventListener('click', () => {
  resetApplication();
});

loadData();
updateClock();
setInterval(updateClock, 30000);
renderKnowledgeBase();
