(() => {
  'use strict';

  const STANDARD_DISTANCES = [
    { label: '1 Mile', meters: 1609.344 },
    { label: '2 Mile', meters: 3218.688 },
    { label: '3K', meters: 3000 },
    { label: '3200m', meters: 3200 },
    { label: '5K', meters: 5000 }
  ];
  const CLOSE_TOLERANCE = 0.05;

  function parseDistance(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const compact = raw.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();

    const exact = STANDARD_DISTANCES.find((item) => item.label.toLowerCase() === compact);
    if (exact) return { label: exact.label, meters: exact.meters };

    const match = compact.match(/^(\d+(?:\.\d+)?)\s*(km|k|kilometers?|kilometres?|mi|mile|miles|m|meters?|metres?)$/);
    if (!match) return { label: raw, meters: null };

    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    let meters = amount;
    if (['km', 'k', 'kilometer', 'kilometers', 'kilometre', 'kilometres'].includes(unit)) meters = amount * 1000;
    if (['mi', 'mile', 'miles'].includes(unit)) meters = amount * 1609.344;

    let label;
    if (meters >= 1000 && ['km', 'k', 'kilometer', 'kilometers', 'kilometre', 'kilometres'].includes(unit)) {
      label = `${Number(amount.toFixed(3))}K`;
    } else if (['mi', 'mile', 'miles'].includes(unit)) {
      label = `${Number(amount.toFixed(3))} Mile${Math.abs(amount - 1) < 0.0001 ? '' : 's'}`;
    } else {
      label = `${Math.round(meters)}m`;
    }

    return { label, meters };
  }

  function closestStandard(meters) {
    if (!Number.isFinite(meters)) return null;
    const ranked = STANDARD_DISTANCES
      .map((item) => ({ ...item, difference: Math.abs(meters - item.meters) / item.meters }))
      .sort((a, b) => a.difference - b.difference);
    return ranked[0] || null;
  }

  function ensureOption(select, value) {
    let option = [...select.options].find((row) => row.value === value);
    if (!option) {
      option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.dataset.customDistance = 'true';
      select.appendChild(option);
    }
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function installCustomDistance(selectId, inputId, labelText) {
    const select = document.getElementById(selectId);
    if (!select || document.getElementById(inputId)) return;

    STANDARD_DISTANCES.forEach((item) => {
      if (![...select.options].some((option) => option.value === item.label)) {
        const option = document.createElement('option');
        option.value = item.label;
        option.textContent = item.label;
        select.appendChild(option);
      }
    });

    const field = select.closest('.field');
    if (!field?.parentElement) return;

    const customField = document.createElement('div');
    customField.className = 'field';
    customField.innerHTML = `
      <label for="${inputId}">${labelText}</label>
      <input id="${inputId}" inputmode="decimal" autocomplete="off" data-no-speech="true" placeholder="Examples: 2.9K, 4.8K, 4900m, 3.05 miles">
      <div class="sub" id="${inputId}Help">Exact course distance is saved. Courses within 5% of 3K, 3200m, 2 miles, or 5K are marked as close.</div>
    `;
    field.insertAdjacentElement('afterend', customField);

    const input = customField.querySelector('input');
    const helper = customField.querySelector('.sub');

    const apply = () => {
      const parsed = parseDistance(input.value);
      if (!parsed) {
        helper.textContent = 'Enter a positive distance with a unit, such as 2.9K, 4900m, or 3.05 miles.';
        return;
      }
      ensureOption(select, parsed.label);
      const closest = closestStandard(parsed.meters);
      if (closest && closest.difference <= CLOSE_TOLERANCE) {
        const percent = (closest.difference * 100).toFixed(1);
        helper.textContent = `${parsed.label} saved as the exact distance. It is ${percent}% from ${closest.label}, so it is close enough for comparison context.`;
      } else if (parsed.meters) {
        helper.textContent = `${parsed.label} saved as a custom distance. Pace and results remain tied to that exact course length.`;
      } else {
        helper.textContent = `${parsed.label} saved as entered. Add meters, kilometers, or miles for automatic comparison context.`;
      }
    };

    input.addEventListener('change', apply);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        apply();
      }
    });
  }

  function install() {
    installCustomDistance('resultDistance', 'resultCustomDistance', 'Type a custom distance');
    installCustomDistance('resultsImportDistance', 'resultsImportCustomDistance', 'Type imported course distance');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
