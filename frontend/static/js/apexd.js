"use strict";

// Copy literal source text, preserving case, whitespace, and missing markers.
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const target = document.getElementById(button.dataset.copy);
  if (!target) return;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(target.textContent);
      copied = true;
    } else {
      const buffer = document.createElement("textarea");
      buffer.value = target.textContent;
      buffer.className = "clipboard-buffer";
      buffer.setAttribute("aria-label", "Text to copy");
      document.body.appendChild(buffer);
      try {
        buffer.select();
        copied = document.execCommand("copy");
      } finally {
        buffer.remove();
        button.focus();
      }
    }
  } catch (_) {
    copied = false;
  }
  const status = document.querySelector(".copy-status");
  status.textContent = copied ? "Source text copied." : "Copy unavailable. Select the source text to copy it manually.";
  clearTimeout(window.apexdCopyTimer);
  window.apexdCopyTimer = setTimeout(() => { status.textContent = ""; }, 6000);
});

// Keep target-dependent ranges understandable without changing submitted values.
for (const [targetName, rangeStem] of [["species", "value"], ["toxicity", "toxicity"]]) {
  const target = document.querySelector(`.search-filters select[name="${targetName}"]`);
  if (!target) continue;
  const update = () => {
    for (const suffix of ["_min", "_max"]) {
      const input = document.getElementById(rangeStem + suffix);
      input.disabled = !target.value;
    }
  };
  target.addEventListener("change", update);
  update();
}
for (const group of document.querySelectorAll(".search-filters details")) {
  const active = [...group.querySelectorAll("input,select")].some((input) => {
    if (input.type === "checkbox") return input.checked;
    if (input.tagName === "SELECT") return input.selectedIndex > 0;
    return input.value !== "";
  });
  if (active) group.open = true;
}
const endpoint = document.querySelector('.search-filters select[name="kind"]');
const conditionClass = document.querySelector('.search-filters select[name="condition_class"]');
if (endpoint && conditionClass) {
  const updateClass = () => {
    conditionClass.disabled = endpoint.value !== "MIC";
  };
  endpoint.addEventListener("change", updateClass);
  updateClass();
}

// Compact navigation progressively enhances the always-accessible HTML links.
const menuToggle = document.querySelector('.menu-toggle');
const mainNavigation = document.getElementById('main-navigation');
if (menuToggle && mainNavigation) {
  const mobile = window.matchMedia('(max-width: 760px)');
  const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    mainNavigation.classList.toggle('is-open', open);
  };
  document.documentElement.classList.add('nav-ready');
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  mainNavigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
}

// In-page navigation follows the section being read. No source data is changed.
for (const navigation of document.querySelectorAll('.guide-nav, .record-nav')) {
  const entries = [...navigation.querySelectorAll('a[href^="#"]')].map(link => ({
    link, section: document.getElementById(link.hash.slice(1))
  })).filter(entry => entry.section);
  if (!entries.length) continue;
  const update = () => {
    const threshold = navigation.classList.contains('record-nav') ? 190 : 140;
    let current = entries[0];
    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= threshold) current = entry;
    }
    for (const entry of entries) {
      if (entry === current) entry.link.setAttribute('aria-current', 'location');
      else entry.link.removeAttribute('aria-current');
    }
  };
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => { update(); scheduled = false; });
    }
  }, {passive:true});
  window.addEventListener('resize', update);
  update();
}

// Make wide scientific tables scrollable with a keyboard as well as touch.
for (const container of document.querySelectorAll('.table-scroll')) {
  const update = () => {
    if (container.scrollWidth > container.clientWidth + 1) {
      container.tabIndex = 0;
      container.setAttribute('role', 'region');
      const caption = container.querySelector('caption');
      container.setAttribute('aria-label', (caption?.textContent.trim() || 'Data table') + ' · scroll horizontally');
    } else {
      container.removeAttribute('tabindex');
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
    }
  };
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(container);
  update();
}
