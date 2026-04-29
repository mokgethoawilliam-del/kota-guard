const cartKey = (vendorId) => `vulahub_cart_${vendorId}`;
const draftKey = (vendorId) => `vulahub_draft_cart_${vendorId}`;
const openCheckoutKey = (vendorId) => `vulahub_cart_open_${vendorId}`;

function sanitizeItem(item) {
  if (!item?.id || !item?.name) return null;
  const price = Number(item.price);
  const qty = Math.max(1, Number(item.qty) || 1);
  return {
    id: item.id,
    name: item.name,
    price: Number.isFinite(price) ? price : 0,
    qty,
  };
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emitCartUpdate(vendorId, items) {
  window.dispatchEvent(
    new CustomEvent("vulahub-cart-updated", {
      detail: {
        vendorId,
        count: items.reduce((sum, item) => sum + item.qty, 0),
      },
    }),
  );
}

export function getSavedCart(vendorId) {
  if (!vendorId) return [];
  return readJson(cartKey(vendorId))
    .map(sanitizeItem)
    .filter(Boolean);
}

export function saveCart(vendorId, items) {
  if (!vendorId) return;
  const cleanItems = (items || []).map(sanitizeItem).filter(Boolean);
  if (cleanItems.length === 0) {
    localStorage.removeItem(cartKey(vendorId));
  } else {
    writeJson(cartKey(vendorId), cleanItems);
  }
  emitCartUpdate(vendorId, cleanItems);
}

export function getCartCount(vendorId) {
  return getSavedCart(vendorId).reduce((sum, item) => sum + item.qty, 0);
}

export function mergeDraftCart(vendorId) {
  if (!vendorId) return getSavedCart(vendorId);
  const existing = getSavedCart(vendorId);
  const draftItems = readJson(draftKey(vendorId))
    .map((item) =>
      sanitizeItem({
        id: item.menu_item_id || item.id,
        name: item.name || "",
        price: item.price,
        qty: item.quantity || item.qty,
      }),
    )
    .filter(Boolean);

  if (draftItems.length === 0) return existing;

  const merged = [...existing];
  for (const item of draftItems) {
    const index = merged.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      merged[index] = { ...merged[index], qty: merged[index].qty + item.qty };
    } else {
      merged.push(item);
    }
  }

  localStorage.removeItem(draftKey(vendorId));
  saveCart(vendorId, merged);
  return merged;
}

export function saveDraftCart(vendorId, items) {
  if (!vendorId) return;
  const cleanItems = (items || [])
    .map((item) =>
      item?.menu_item_id
        ? {
            menu_item_id: item.menu_item_id,
            quantity: Math.max(1, Number(item.quantity) || 1),
          }
        : sanitizeItem(item),
    )
    .filter(Boolean);

  if (cleanItems.length === 0) {
    localStorage.removeItem(draftKey(vendorId));
    return;
  }
  writeJson(draftKey(vendorId), cleanItems);
}

export function requestCheckoutOpen(vendorId) {
  if (!vendorId) return;
  localStorage.setItem(openCheckoutKey(vendorId), "1");
}

export function consumeCheckoutOpen(vendorId) {
  if (!vendorId) return false;
  const shouldOpen = localStorage.getItem(openCheckoutKey(vendorId)) === "1";
  if (shouldOpen) {
    localStorage.removeItem(openCheckoutKey(vendorId));
  }
  return shouldOpen;
}

export function clearCart(vendorId) {
  if (!vendorId) return;
  localStorage.removeItem(cartKey(vendorId));
  localStorage.removeItem(draftKey(vendorId));
  localStorage.removeItem(openCheckoutKey(vendorId));
  emitCartUpdate(vendorId, []);
}
