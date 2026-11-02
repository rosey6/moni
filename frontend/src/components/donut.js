export function createDonut({ segments, centerLabel, centerValue, currency, description, previous }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'donut-wrap';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('donut');
  svg.setAttribute('viewBox', '0 0 220 220');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', description);
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  segments.forEach((segment) => {
    const ratio = segment.value / total;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.classList.add('donut-segment');
    circle.dataset.segment = segment.key;
    circle.setAttribute('cx', '110');
    circle.setAttribute('cy', '110');
    circle.setAttribute('r', String(radius));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', segment.color);
    circle.setAttribute('stroke-width', '28');
    circle.setAttribute('stroke-linecap', 'butt');
    circle.setAttribute('stroke-dasharray', String(ratio * circumference) + ' ' + circumference);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', 'rotate(-90 110 110)');
    svg.append(circle);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const oldCircle = previous?.querySelector('[data-segment="' + segment.key + '"]');
      circle.animate([
        { strokeDasharray: oldCircle ? getComputedStyle(oldCircle).strokeDasharray : '0 ' + circumference, strokeDashoffset: oldCircle ? getComputedStyle(oldCircle).strokeDashoffset : String(-offset) },
        { strokeDasharray: String(ratio * circumference) + ' ' + circumference, strokeDashoffset: String(-offset) },
      ], { duration: 350, easing: 'ease-out' });
    }
    offset += ratio * circumference;
  });
  const text = document.createElement('div');
  text.className = 'donut-center';
  const value = document.createElement('strong');
  value.textContent = centerValue;
  const unit = document.createElement('span');
  unit.textContent = currency;
  text.append(value, unit);
  if (centerLabel) {
    const label = document.createElement('small');
    label.textContent = centerLabel;
    text.append(label);
  }
  wrapper.append(svg, text);
  return wrapper;
}
