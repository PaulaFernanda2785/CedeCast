/* script.js
   Melhorias:
   - Toggle de episódios via classes (checked/unchecked)
   - Persistência no localStorage
   - Abre o episódio no iframe player (target)
   - Fecha menu mobile quando necessário
*/

document.addEventListener('DOMContentLoaded', function () {
  const episodeLinks = Array.from(document.querySelectorAll('.episode-link'));
  const player = document.getElementById('player-frame');
  const storageKey = 'cedecast_checked_episodes';

  // inicializa estado salvamento
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');

  function setCheckedState(link, checked) {
    if (checked) {
      link.classList.add('checked');
      link.classList.remove('unchecked');
      link.setAttribute('aria-pressed', 'true');
    } else {
      link.classList.remove('checked');
      link.classList.add('unchecked');
      link.setAttribute('aria-pressed', 'false');
    }
  }

  // aplica estado salvo
  episodeLinks.forEach(link => {
    const id = link.dataset.episode || link.href;
    setCheckedState(link, saved.includes(id));

    // clique: alterna checked + abre no iframe (se tiver href)
    link.addEventListener('click', function (evt) {
      // evitar comportamento padrão só para marcação; mas permitir abrir se houver href válido
      const id = link.dataset.episode || link.href;
      const isChecked = link.classList.contains('checked');
      setCheckedState(link, !isChecked);

      // atualiza localStorage
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!isChecked) {
        if (!current.includes(id)) current.push(id);
      } else {
        const idx = current.indexOf(id);
        if (idx > -1) current.splice(idx, 1);
      }
      localStorage.setItem(storageKey, JSON.stringify(current));

      // se link tem href e target (player), carregue no iframe
      const href = link.getAttribute('href');
      const target = link.getAttribute('target');
      if (href && href !== '#') {
        if (target === 'episodio' && player) {
          // carrega no iframe por src (melhor que deixar target no <a>)
          player.src = href;
        } else {
          // fallback: seguir link
          // permite navegação padrão (não prevenimos)
          return;
        }
      }

      // prevenir navegação padrão quando usamos '#'
      evt.preventDefault();
    });
  });

  // mobile menu: fechar ao clicar na overlay
  const menuToggle = document.getElementById('menu-toggle');
  const overlay = document.querySelector('[data-overlay]');
  if (overlay && menuToggle) {
    overlay.addEventListener('click', () => { menuToggle.checked = false; });
  }

  // acessibilidade: garantir foco nos links do menu ao abrir
  if (menuToggle) {
    menuToggle.addEventListener('change', () => {
      const panel = document.querySelector('.mobile-panel');
      if (menuToggle.checked && panel) {
        const first = panel.querySelector('a');
        if (first) first.focus();
      }
    });
  }
});
