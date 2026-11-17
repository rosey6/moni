export const onboardingSteps = ['currency', 'budget', 'rent', 'transport', 'groceries', 'unexpected'];

export const onboardingState = {
  currency: 'XOF',
  onboardingCompleted: false,
  validatedSteps: [],
  budget: 0,
  subscriptions: [],
  allocations: {
    rent: 0,
    transport: 0,
    groceries: 0,
    unexpected: 0,
  },
};

export function resetOnboardingState() {
  onboardingState.currency = 'XOF';
  onboardingState.onboardingCompleted = false;
  onboardingState.validatedSteps = [];
  onboardingState.budget = 0;
  onboardingState.subscriptions = [];
  onboardingState.allocations = { rent: 0, transport: 0, groceries: 0, unexpected: 0 };
}

export function getStepIndex(step) {
  return onboardingSteps.indexOf(step);
}

export function serializeOnboarding() {
  return {
    currency: onboardingState.currency,
    budget: onboardingState.budget,
    plannedAllocations: Object.entries(onboardingState.allocations).map(([category, amount]) => ({ category, amount })),
    subscriptions: onboardingState.subscriptions.map((item) => ({ ...item })),
  };
}
