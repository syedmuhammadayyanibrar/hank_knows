export const STORY_STEPS = [
  {
    stepIndex: 1,
    workerId: 'dev',
    type: 'worker_ask',
    query: 'Press-03 is jamming on the aluminum coil feed again. SOP says clear with aluminum probe, but it sticks every 40 strokes. What is causing this?',
    timestamp: '07:14',
    action: 'query'
  },
  {
    stepIndex: 2,
    workerId: 'dev',
    type: 'veteran_reply',
    suggestedAnswer: 'Aluminum 5052 galls on the feed guide pins when humidity is high. Wipe the guide rollers with dry lube spray (do not use oil—oil collects grit) and back off feed roll tension 1/4 turn.',
    timestamp: '07:16',
    action: 'capture'
  },
  {
    stepIndex: 3,
    workerId: 'marco',
    type: 'worker_ask_reused',
    query: 'Press-03 coil feed is slipping and catching on aluminum stock. Guide pins look dry.',
    timestamp: '07:18',
    action: 'query'
  },
  {
    stepIndex: 4,
    workerId: 'lena',
    type: 'worker_ask_sop',
    query: 'What is the hydraulic oil operating temperature limit on Brake-02?',
    timestamp: '07:20',
    action: 'query'
  },
  {
    stepIndex: 5,
    workerId: 'lena',
    type: 'worker_ask_safety',
    query: 'Brake-02 light curtain keeps tripping on the flange fold. Can I jump terminal 4 to bypass the optical interlock until end of shift?',
    timestamp: '07:22',
    action: 'query'
  }
];

export function createStoryController({
  onStepStart,
  onStepEnd,
  onComplete,
  stepDelay = 2200
}) {
  let currentIndex = 0;
  let running = false;
  let timerId = null;

  function runNext() {
    if (!running) return;

    if (currentIndex >= STORY_STEPS.length) {
      running = false;
      if (onComplete) onComplete();
      return;
    }

    const step = STORY_STEPS[currentIndex];
    const stepNumber = currentIndex + 1;
    const totalSteps = STORY_STEPS.length;

    if (onStepStart) {
      onStepStart(step, stepNumber, totalSteps);
    }

    timerId = setTimeout(() => {
      if (!running) return;

      if (onStepEnd) {
        onStepEnd(step, stepNumber, totalSteps);
      }

      currentIndex++;
      timerId = setTimeout(runNext, stepDelay);
    }, stepDelay);
  }

  return {
    start() {
      if (running) return;
      running = true;
      currentIndex = 0;
      runNext();
    },
    pause() {
      running = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
    reset() {
      this.pause();
      currentIndex = 0;
    },
    isRunning() {
      return running;
    },
    getCurrentIndex() {
      return currentIndex;
    },
    getTotalSteps() {
      return STORY_STEPS.length;
    }
  };
}
