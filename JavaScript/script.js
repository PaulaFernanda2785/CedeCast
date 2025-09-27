function toggleCheck(link) {
    // Troca entre caixa vazia (☐) e caixa marcada (✅)
    if (link.innerHTML.startsWith('&#x2610;') || link.innerHTML.startsWith('☐')) {
        link.innerHTML = link.innerHTML.replace('&#x2610;', '✅').replace('☐', '✅');
    } else {
        link.innerHTML = link.innerHTML.replace('✅', '☐');
    }
    // Evita que o link navegue
    return false;
}