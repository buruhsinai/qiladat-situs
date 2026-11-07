/* =========================================================
   JAZMI — Dien: Pondok (C05)
   pondok.js
   Vanilla JavaScript, berdiri sendiri (tidak memuat main.js/
   dien.js) — mengikuti konvensi js/main.js dan dien/dien.js.
   Menangani: 1) navigasi mobile, 2) reveal-on-scroll,
   3) berbagi halaman (WhatsApp/Facebook/Telegram/X/Salin).
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. Navigasi mobile (disalin dari dien/dien.js)
     --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     2. Reveal on scroll (sama seperti js/main.js, menghormati
        prefers-reduced-motion)
     --------------------------------------------------------- */

  function initRevealOnScroll() {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelectorAll(".identity, .section");

    if (prefersReduced || !("IntersectionObserver" in window)) {
      return;
    }

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

  /* ---------------------------------------------------------
     3. Bagikan Halaman Pondok — pakai URL halaman sungguhan
        (window.location.href), bukan URL yang dikarang.
     --------------------------------------------------------- */

  function initBagikan() {
    const wrap = document.getElementById("pondokShare");
    if (!wrap) return;

    const waLink = document.getElementById("shareWa");
    const fbLink = document.getElementById("shareFb");
    const tgLink = document.getElementById("shareTg");
    const xLink = document.getElementById("shareX");
    const copyBtn = document.getElementById("shareCopy");

    const urlHalaman = window.location.href;
    const judulHalaman = document.title;
    const teksBagikan = `${judulHalaman} — JAZMI`;

    if (waLink) {
      waLink.href = `https://wa.me/?text=${encodeURIComponent(teksBagikan + " " + urlHalaman)}`;
    }
    if (fbLink) {
      fbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlHalaman)}`;
    }
    if (tgLink) {
      tgLink.href = `https://t.me/share/url?url=${encodeURIComponent(urlHalaman)}&text=${encodeURIComponent(teksBagikan)}`;
    }
    if (xLink) {
      xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(teksBagikan)}&url=${encodeURIComponent(urlHalaman)}`;
    }

    if (copyBtn) {
      const labelAsli = copyBtn.textContent;
      copyBtn.addEventListener("click", async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(urlHalaman);
          } else {
            // Fallback untuk browser tanpa Clipboard API
            const area = document.createElement("textarea");
            area.value = urlHalaman;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.focus();
            area.select();
            document.execCommand("copy");
            document.body.removeChild(area);
          }
          copyBtn.textContent = "Tersalin ✓";
          copyBtn.classList.add("is-copied");
          setTimeout(() => {
            copyBtn.textContent = labelAsli;
            copyBtn.classList.remove("is-copied");
          }, 2000);
        } catch (err) {
          console.error("[JAZMI] Gagal menyalin tautan:", err);
          copyBtn.textContent = "Gagal menyalin";
          setTimeout(() => { copyBtn.textContent = labelAsli; }, 2000);
        }
      });
    }
  }

  /* ---------------------------------------------------------
     init
     --------------------------------------------------------- */

  function init() {
    initNavigasiMobile();
    initRevealOnScroll();
    initBagikan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
