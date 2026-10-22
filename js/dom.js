// A small helper for building page elements, shared by the game and the Encyclopedia.

// el('p', { class: 'x' }, 'text', child) builds <p class="x">text<child></p>.
// Text is always added as text, never as HTML, so data can't break the page.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}
