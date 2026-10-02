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
  phoneExtension: "EXT 4040 · LINE 2",
  workers: [
    { id: "dev", name: "Dev", role: "Apprentice Machinist", bay: "Stamping Line 2" },
    { id: "marco", name: "Marco", role: "CNC Operator", bay: "Mill Cell B" },
    { id: "lena", name: "Lena", role: "Brake Press Operator", bay: "Forming Bay" }
  ],
  veterans: [
    { id: "hank", name: "Hank", role: "Lead Toolmaker & Setup Specialist", extension: "4041" }
  ],
  machines: [
    { id: "Press-03", name: "Minster 200-Ton Mechanical Press", aliases: ["press-03", "press", "minster"] },
    { id: "Brake-02", name: "Amada HFE-1003 Hydraulic Press Brake", aliases: ["brake-02", "brake", "amada"] },
    { id: "CNC-08", name: "Haas VF-4 4-Axis Vertical Machining Center", aliases: ["cnc-08", "haas", "mill", "cnc"] },
    { id: "Lathe-01", name: "Mazak Quick Turn 250 CNC Lathe", aliases: ["lathe-01", "lathe", "mazak"] },
    { id: "Degreaser-01", name: "Safety-Kleen Heated Parts Washer", aliases: ["degreaser-01", "degreaser", "washer"] }
  ]
};

const DEFAULT_SOPS = [
  {
    id: "SOP-101",
    title: "Minster 200T Mechanical Press Feed Clearing",
    machineId: "Press-03",
    tag: "SOP · Press changeover",
    keywords: ["press", "minster", "feed", "jam", "coil", "aluminum", "probe", "clear", "die", "clearance"],
    summary: "Standard feed jam clearing requires stopping the press at top dead center (TDC), engaging the flywheel brake, and verifying zero mechanical motion. Operators must use only an aluminum probe tool to release jammed strip material. Never use hardened steel pry bars inside carbide dies. Reset the pneumatic stock feeder to index stroke and verify feed pitch before cycle restart. If feed continues to bind under normal stroke pitch, log maintenance ticket.",
    gapNote: "Does not address recurring 5052 aluminum strip galling on feed guide pins caused by shop ambient humidity."
  },
  {
    id: "SOP-102",
    title: "Amada Press Brake Hydraulic Temperature and Backgauge Calibration",
    machineId: "Brake-02",
    tag: "SOP · Press brake hydraulics",
    keywords: ["brake", "amada", "hydraulic", "temp", "temperature", "oil", "reservoir", "limit", "backgauge", "fluid"],
    summary: "Hydraulic oil operating range is 110°F to 130°F. If oil temperature exceeds 145°F, suspend operation and verify heat exchanger water valve is open. Reservoir capacity is 45 gallons ISO VG 46 anti-wear hydraulic oil. Check sight glass before morning cycle. Backgauge calibration requires homing all four axes (X1, X2, R, Z) through AMNC-PC manual jog screen prior to production runs.",
    gapNote: null
  },
  {
    id: "SOP-103",
    title: "Haas VF-4 Coolant Concentration and Chip Auger Protocol",
    machineId: "CNC-08",
    tag: "SOP · CNC coolant & auger",
    keywords: ["cnc", "haas", "vf-4", "coolant", "refractometer", "ratio", "concentration", "auger", "chips", "pressure"],
    summary: "Maintain water-soluble synthetic coolant concentration at 8% to 10% measured with optical refractometer. Fill water first, then add concentrate. Minimum flood coolant manifold pressure is 40 PSI. Chip conveyor auger must be toggled reverse for 3 seconds if chip buildup trips current limiter. Empty chip bin at 75% fill capacity.",
    gapNote: null
  },
  {
    id: "SOP-104",
    title: "Zero Energy State Lockout / Tagout (LOTO) Protocol",
    machineId: "Press-03",
    tag: "SOP · LOTO safety",
    keywords: ["loto", "lockout", "tagout", "electrical", "480v", "cabinet", "power", "disconnect", "breaker"],
    summary: "Prior to any servicing, electrical cabinet access, or mechanical disassembly, equipment must be isolated from all energy sources. Turn main 480V disconnect handle to OFF, apply red safety padlock with personal tag, and verify zero voltage using an NFPA 70E rated meter. Only licensed maintenance technicians are authorized to open electrical enclosures.",
    gapNote: null
  },
  {
    id: "SOP-105",
    title: "Optical Light Curtain and Guard Interlock Integrity",
    machineId: "Brake-02",
    tag: "SOP · Interlock guard",
    keywords: ["interlock", "light curtain", "curtain", "guard", "sensor", "bypass", "jump", "safety", "flange"],
    summary: "Category 4 optical guarding and mechanical interlocks are mandatory safety barriers. Interlock circuits and light curtains must never be bypassed, jumped, taped, or modified. Any intentional defeat of safety devices results in immediate equipment lockout and disciplinary review.",
    gapNote: null
  },
  {
    id: "SOP-106",
    title: "Mazak Quick Turn 250 Chuck Pressure and Collet Maintenance",
    machineId: "Lathe-01",
    tag: "SOP · Lathe chuck pressure",
    keywords: ["lathe", "mazak", "chuck", "pressure", "collet", "hydraulic", "turning", "jaw"],
    summary: "Set hydraulic chuck gripping pressure between 2.0 and 2.5 MPa for standard round bar stock. For thin-walled tubing, reduce pressure to 1.2 MPa to prevent distortion. Grease master chuck jaws every 20 hours of spindle runtime with high-pressure molybdenum disulfide grease.",
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
    const previous = currentWoContainer.firstElementChild;
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
  const questionText = pendingGapQuestion || 'Press-03 aluminum coil feed sticking every 40 strokes';

  const newItem = addKnowledgeItem(kb, {
    question: questionText,
    answer: answerText.trim(),
    machineId: 'Press-03',
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
  const query = rawQuery.trim();
  if (!query) return;

  const now = new Date();
  const timeStr = customTimestamp || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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

    const kbMatch = findBestMatch(query, kb, 0.12);
    if (kbMatch && kbMatch.item) {
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

    const cleanLower = query.toLowerCase();
    const isAluminumGap = cleanLower.includes('press') && cleanLower.includes('aluminum') && (cleanLower.includes('jam') || cleanLower.includes('stick') || cleanLower.includes('coil'));

    if (isAluminumGap) {
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
        text: 'SOP-101 covers clearing feed jams at TDC with aluminum probes, but does not provide recurring root-cause fixes for 5052 aluminum strip galling. Logging work order and routing to Hank.',
        sourceTag: 'SOP · Press changeover'
      });

      showVeteranBox(query, 'Aluminum 5052 galls on the feed guide pins when humidity is high. Wipe the guide rollers with dry lube spray (do not use oil—oil collects grit) and back off feed roll tension 1/4 turn.');
      return;
    }

    const sopResults = searchDocuments(query, sopsData, { threshold: 0.1 });
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
  }, 450);
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
  storyBannerText.textContent = 'Playing story (1/5): Dev faces recurring aluminum coil jam...';
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
      storyBannerText.textContent = `Playing story (${step.stepIndex}/5): Safety-critical bypass query tested!`;
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
