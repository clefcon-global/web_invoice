export const today = () => new Date().toISOString().slice(0, 10);

export const makeItem = () => ({
  id: crypto.randomUUID(),
  description: '',
  unitPrice: '',
  qty: '1',
});

export const asLines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);
