(() => {
  const rankContent = [
    {
      name: "Origin",
      description: "Every meaningful change begins with a deliberate first step. This is where your progression starts.",
      caption: "THE BEGINNING OF PROGRESS"
    },
    {
      name: "Ember",
      description: "Small actions begin to form a pattern. A commitment becomes something you return to.",
      caption: "CONSISTENCY TAKES SHAPE"
    },
    {
      name: "Surge",
      description: "Repeated effort creates momentum. Your progress becomes visible through what you keep doing.",
      caption: "MOMENTUM BECOMES VISIBLE"
    },
    {
      name: "Vector",
      description: "Your effort has direction. Commitments become deliberate, focused and increasingly reliable.",
      caption: "EFFORT FINDS DIRECTION"
    },
    {
      name: "Apex",
      description: "Strong performance becomes dependable. You sustain meaningful progress across your commitments.",
      caption: "PERFORMANCE BECOMES DEPENDABLE"
    },
    {
      name: "Zenith",
      description: "A high standard is no longer occasional. It is supported by sustained discipline over time.",
      caption: "SUSTAINED EXCELLENCE"
    },
    {
      name: "Continuum",
      description: "The rarest stage in this proposed progression: long-term discipline maintained without losing direction.",
      caption: "DISCIPLINE WITHOUT DRIFT"
    }
  ];

  const cards = Array.from(document.querySelectorAll(".rank-card"));
  const detailNumber = document.getElementById("detail-number");
  const detailName = document.getElementById("detail-name");
  const detailDescription = document.getElementById("detail-description");
  const detailCaption = document.getElementById("detail-caption");
  const detailPanel = document.querySelector(".rank-detail");
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const header = document.querySelector(".site-header");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function selectRank(index, animate = true) {
    const data = rankContent[index];
    if (!data) return;

    cards.forEach((card, cardIndex) => {
      const selected = cardIndex === index;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });

    const update = () => {
      detailNumber.textContent = String(index + 1).padStart(2, "0");
      detailName.textContent = data.name;
      detailDescription.textContent = data.description;
      detailCaption.textContent = data.caption;
    };

    if (!animate || reducedMotion || !window.gsap || !detailPanel) {
      update();
      return;
    }

    window.gsap.to(detailPanel, {
      opacity: 0.45,
      y: 5,
      duration: 0.12,
      onComplete: () => {
        update();
        window.gsap.to(detailPanel, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
      }
    });
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => selectRank(Number(card.dataset.rank)));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const current = Number(card.dataset.rank);
      const next = event.key === "ArrowRight"
        ? Math.min(cards.length - 1, current + 1)
        : Math.max(0, current - 1);
      cards[next].focus();
      selectRank(next);
    });
  });

  menuToggle?.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    mainNav?.classList.toggle("is-open", !expanded);
  });

  mainNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
    });
  });

  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 30);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  // Progressive enhancement: content remains visible if GSAP/CDN is unavailable.
  if (reducedMotion) return;
  document.documentElement.classList.add("js-motion");

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    const introTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
    introTimeline
      .from(".hero-eyebrow", { y: 18, opacity: 0, duration: 0.65 })
      .from(".hero h1", { y: 34, opacity: 0, duration: 0.9 }, "-=0.38")
      .from(".hero-copy", { y: 20, opacity: 0, duration: 0.7 }, "-=0.52")
      .from(".hero-actions .button", { y: 16, opacity: 0, stagger: 0.12, duration: 0.55 }, "-=0.4")
      .from(".hero-bottom", { opacity: 0, duration: 0.6 }, "-=0.2");

    gsap.to(".hero-shadow--one", {
      xPercent: 8, yPercent: 14, rotation: -11, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.2 }
    });
    gsap.to(".hero-shadow--two", {
      xPercent: -10, yPercent: -15, rotation: 8, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.5 }
    });
    gsap.to(".hero-orbit--one", {
      yPercent: 24, rotation: 10, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.4 }
    });

    gsap.utils.toArray(".reveal-up").forEach((element) => {
      gsap.to(element, {
        opacity: 1, y: 0, duration: 0.85, ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 88%", toggleActions: "play none none reverse" }
      });
    });

    gsap.to(".shadow-ribbon--a", {
      xPercent: 9, yPercent: 15, rotation: -12, ease: "none",
      scrollTrigger: { trigger: ".rank-section", start: "top bottom", end: "bottom top", scrub: 1.5 }
    });
    gsap.to(".shadow-ribbon--b", {
      xPercent: -8, yPercent: -10, rotation: 10, ease: "none",
      scrollTrigger: { trigger: ".rank-section", start: "top bottom", end: "bottom top", scrub: 1.8 }
    });
    gsap.to(".shadow-ribbon--c", {
      xPercent: 11, yPercent: -16, rotation: -8, ease: "none",
      scrollTrigger: { trigger: ".rank-section", start: "top bottom", end: "bottom top", scrub: 1.3 }
    });

    gsap.to(".rank-track-fill", {
      width: "100%", ease: "none",
      scrollTrigger: { trigger: ".rank-grid", start: "top 76%", end: "bottom 52%", scrub: 0.8 }
    });

    gsap.to(cards, {
      opacity: 1, y: 0, scale: 1, stagger: 0.13, duration: 0.72, ease: "power3.out",
      scrollTrigger: { trigger: ".rank-grid", start: "top 78%", toggleActions: "play none none reverse" }
    });

    // A restrained glow travels across the selected emblem as the rank section enters view.
    cards.forEach((card, index) => {
      const emblem = card.querySelector(".rank-emblem");
      gsap.fromTo(emblem, { y: 12, opacity: 0.55 }, {
        y: 0, opacity: 1, duration: 0.65, delay: index * 0.11, ease: "power2.out",
        scrollTrigger: { trigger: card, start: "top 88%", toggleActions: "play none none reverse" }
      });
    });
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "none";
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal-up, .rank-card").forEach((element) => observer.observe(element));
  }

  // Keep initial selected stage synchronized with its permanent receipt panel.
  selectRank(0, false);
})();
