(() => {
  function handleSameWindowNavigation(event) {
    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.target === '_blank') {
      link.target = '_self';
    }
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      event.preventDefault();
      window.location.assign(url.href);
    }
  }

  document.addEventListener('click', handleSameWindowNavigation);
})();
