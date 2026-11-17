import {
  House, ArrowLeftRight, ChartPie, PiggyBank, UserRound, Bell, Eye, EyeOff,
  TrendingUp, TrendingDown, CalendarDays, Search, SlidersHorizontal, Plus,
  ChevronRight, ArrowLeft, ShoppingCart, BusFront, Wifi, WalletCards, Target,
  ShieldCheck, Settings, Globe, LogOut, Cloud, Pencil, FileText, Laptop, Mail,
  LockKeyhole, Coins, List, ChartNoAxesColumnIncreasing, CircleDollarSign,
  Check, X, TriangleExclamationPoint, Info,
} from '../../vendor/lucide-icons.mjs';

const ICONS = Object.freeze({
  house: House, 'arrow-left-right': ArrowLeftRight, 'chart-pie': ChartPie,
  'piggy-bank': PiggyBank, 'user-round': UserRound, bell: Bell, eye: Eye, 'eye-off': EyeOff,
  'trending-up': TrendingUp, 'trending-down': TrendingDown, 'calendar-days': CalendarDays,
  search: Search, 'sliders-horizontal': SlidersHorizontal, plus: Plus,
  'chevron-right': ChevronRight, 'arrow-left': ArrowLeft, 'shopping-cart': ShoppingCart,
  'bus-front': BusFront, wifi: Wifi, 'wallet-cards': WalletCards, target: Target,
  'shield-check': ShieldCheck, settings: Settings, globe: Globe, 'log-out': LogOut,
  cloud: Cloud, pencil: Pencil, 'file-text': FileText, laptop: Laptop, mail: Mail,
  'lock-keyhole': LockKeyhole, coins: Coins, list: List,
  'chart-no-axes-column-increasing': ChartNoAxesColumnIncreasing,
  'circle-dollar-sign': CircleDollarSign, check: Check, x: X,
  'check-double': [
    ['polyline', { points: '18 6 7 17 2 12' }],
    ['polyline', { points: '22 10 14.5 17.5 13 16' }],
  ],
  'triangle-alert': TriangleExclamationPoint, info: Info,
});

export function createIcon(name, { className = '', size, color, label, decorative = !label } = {}) {
  const definition = ICONS[name];
  if (!definition) throw new Error(`Icône Lucide inconnue : ${name}`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) svg.classList.add(...className.split(/\s+/).filter(Boolean));
  if (size) {
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
  }
  if (color) svg.style.color = color;
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else if (decorative) svg.setAttribute('aria-hidden', 'true');
  definition.forEach(([tag, attributes]) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    svg.append(element);
  });
  return svg;
}

export function hasIcon(name) {
  return Boolean(ICONS[name]);
}
