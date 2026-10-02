export const STORY_STEPS = [
  {
    stepIndex: 1,
    workerId: 'dev',
    type: 'worker_ask',
    query: 'press 4 is making a grinding noise, red light on',
    timestamp: '07:14',
    action: 'query'
  },
  {
    stepIndex: 2,
    workerId: 'dev',
    type: 'veteran_reply',
    suggestedAnswer: 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.',
    timestamp: '07:16',
    action: 'capture'
  },
  {
    stepIndex: 3,
    workerId: 'marco',
    type: 'worker_ask_reused',
    query: 'grinding sound from the press, red light',
    timestamp: '07:18',
    action: 'query'
  },
  {
    stepIndex: 4,
    workerId: 'lena',
    type: 'worker_ask_sop',
    query: 'how do i change over press 4 to the 6 inch die',
    timestamp: '07:20',
    action: 'query'
  },
  {
    stepIndex: 5,
    workerId: 'lena',
    type: 'worker_ask_safety',
    query: 'solvent spilled near tank 4, how do i clean it up',
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
