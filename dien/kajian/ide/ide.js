/* =========================================================
   JAZMI — Dien · Kajian · Ide (daftar lengkap)
   ide.js
   Memuat SELURUH daftar ide kajian dari ../data/ide.json
   (bukan hanya 2 teratas seperti preview di dien/kajian/kajian.js).
   ========================================================= */
(function () {
  "use strict";

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatTanggalIndonesia(isoDate) {
    try {
      const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      const d = new Date(isoDate + "T00:00:00");
      if (isNaN(d.getTime())) return isoDate;
      return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return isoDate;
    }
  }

  async function muatSemuaIde() {
    const list = document.getElementById("kajianIdeList");
    if (!list) return;

    try {
      const res = await fetch("../data/ide.json");
      if (!res.ok) throw new Error("Gagal memuat ide.json: " + res.status);
      const data = await res.json();
      const ide = (data.ide || []).slice();
      ide.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      if (!ide.length) {
        list.innerHTML = `<p class="access-note">Belum ada ide kajian untuk ditampilkan. Tambahkan entri baru di dien/kajian/data/ide.json.</p>`;
        return;
      }

      list.innerHTML = ide.map((it) => `
        <li class="article-item">
          <span class="article-date">${escapeHTML(formatTanggalIndonesia(it.tanggal))}</span>
          <div class="article-body">
            <a class="article-title" href="${escapeHTML(it.tautan || "#")}">${escapeHTML(it.judul)}</a>
            ${it.tag ? `<span class="article-category">${escapeHTML(it.tag)}</span>` : ""}
          </div>
        </li>
      `).join("");
    } catch (err) {
      console.error("[JAZMI] Gagal memuat daftar Ide Kajian:", err);
      list.innerHTML = `<p class="access-note">Daftar ide kajian belum dapat dimuat saat ini.</p>`;
    }
  }

  function initNavigasiMobile() {
    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    function bukaMenu() {
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    }
    function tutupMenu() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    function toggleMenu() {
      const sedangTerbuka = toggle.getAttribute("aria-expanded") === "true";
      if (sedangTerbuka) tutupMenu(); else bukaMenu();
    }

    toggle.addEventListener("click", toggleMenu);
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => tutupMenu());
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupMenu();
    });

    let lebarSebelumnya = window.innerWidth;
    window.addEventListener("resize", () => {
      const lebarSekarang = window.innerWidth;
      if (lebarSekarang >= 860 && lebarSebelumnya < 860) tutupMenu();
      lebarSebelumnya = lebarSekarang;
    });
  }

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".identity, .section");
    if (prefersReduced || !("IntersectionObserver" in window)) return;

    target.forEach((el) => el.classList.add("reveal"));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    target.forEach((el) => observer.observe(el));
  }

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    muatSemuaIde();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
