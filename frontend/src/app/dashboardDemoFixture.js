const DASHBOARD_DEMO_MARKER = 'moni-dashboard-demo-v1';

const demoTransactions = [
  { id: 'demo-income', type: 'income', amount: 250000, category: 'income', date: '2026-11-12', description: 'Salaire', dashboardSubtitle: 'Salaire' },
  { id: 'demo-transport', type: 'expense', amount: 12000, category: 'transport', date: '2026-11-12', description: 'Transport' },
  { id: 'demo-groceries', type: 'expense', amount: 28000, category: 'groceries', date: '2026-11-11', description: 'Courses' },
  { id: 'demo-rent', type: 'expense', amount: 79000, category: 'rent', date: '2026-11-10', description: 'Loyer' },
  { id: 'demo-unexpected', type: 'expense', amount: 4500, category: 'unexpected', date: '2026-11-10', description: 'Imprévu' },
];

export const dashboardDemoFixture = Object.freeze({
  demoFixture: DASHBOARD_DEMO_MARKER,
  currency: 'XOF',
  budget: 250000,
  dashboardBalance: 126500,
  dashboardBudgetProgress: 81,
  dashboardVisibleTransactionIds: ['demo-transport', 'demo-groceries', 'demo-rent', 'demo-unexpected', 'demo-income'],
  profile: { name: 'Utilisateur Démo', email: 'demo@example.test' },
  dashboardDemoProfileName: 'Utilisateur Démo',
  dashboardDemoBudgetRows: [
    { category: 'rent', limit: 120000, spent: 79000 },
    { category: 'transport', limit: 20000, spent: 12000 },
    { category: 'groceries', limit: 45000, spent: 28000 },
    { category: 'unexpected', limit: 15000, spent: 4500 },
  ],
  dashboardDemoTotalSpent: 123500,
  dashboardDemoRemaining: 126500,
  dashboardDemoSavingsTotal: 85000,
  allocations: { rent: 120000, transport: 20000, groceries: 45000, unexpected: 15000 },
  subscriptions: [{ name: 'Spotify', amount: 3000, billingDay: 15, includedIn: null }],
  transactions: demoTransactions,
  goals: [
    { id: 'demo-voyage', mode: 'goal', name: 'Voyage', target: 150000, date: '2027-06-30', contributions: [{ id: 'demo-voyage-saving', amount: 30000 }] },
    { id: 'demo-computer', mode: 'goal', name: 'Ordinateur', target: 300000, date: '2027-12-31', contributions: [{ id: 'demo-computer-saving', amount: 30000 }] },
    { id: 'demo-free', mode: 'free', name: 'Épargne libre', target: null, date: null, contributions: [{ id: 'demo-free-saving', amount: 25000 }] },
  ],
  dashboardDemoTitle: 'Vue d’ensemble',
  dashboardDemoSubtitle: 'Budget de novembre',
});

export function createDashboardDemoState(source) {
  const state = JSON.parse(JSON.stringify(source));
  Object.assign(state, JSON.parse(JSON.stringify(dashboardDemoFixture)), {
    dashboardAmountsVisible: true,
    readNotifications: [],
    preferences: { language: 'fr', alerts: { budget: false, subscriptions: false, savings: false } },
  });
  return state;
}

export function isDashboardDemoState(state) {
  return state?.demoFixture === DASHBOARD_DEMO_MARKER;
}
