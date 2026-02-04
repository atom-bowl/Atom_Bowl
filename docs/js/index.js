    const nav = document.getElementById('nav');
    const overlay = document.getElementById('overlay');
    const hamburger = document.getElementById('hamburger');

    function toggleNav() {
      const isOpen = nav.classList.toggle('open');
      overlay.classList.toggle('show');
      hamburger.classList.toggle('open');
      hamburger.textContent = isOpen ? '✕' : '☰';
    }

    hamburger.onclick = toggleNav;
    overlay.onclick = toggleNav;

    function go(page) {
      if (window.atomNavigate) {
        window.atomNavigate(page);
        return;
      }
      window.location.href = page;
    }
  
