// Shared types mirroring the backend API contract (Public/customer endpoints).

export type Store = {
  id: string;
  name: string;
  slug: string;
};

export type Table = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

// Item options (modifiers) attached to a menu item.
export type OptionChoice = {
  id: string;
  name: string;
  priceDelta: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  choices: OptionChoice[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  tag: string | null;
  tags: string[];
  price: number;
  // Sale (discounted) price when the item has a standing menu discount, else
  // null. The customer is charged this; the menu shows was/now.
  salePrice: number | null;
  isAvailable: boolean;
  sortOrder: number;
  categoryId: string;
  optionGroups: OptionGroup[];
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

// GET /public/tables/:tableCode
export type TableValidation = {
  table: Table;
  store: Store;
};

// GET /public/menu?tableCode=...
// Customer-menu hero banner config. An empty image list / null copy falls back
// to defaults; multiple images rotate as a slideshow.
export type MenuBannerConfig = {
  imageUrls: string[];
  title: string | null;
  subtitle: string | null;
};

export type MenuResponse = {
  store: Store;
  table: Table;
  categories: MenuCategory[];
  // Curated "featured" strip (available items only), shown at the top.
  featured?: MenuItem[];
  featuredTitle?: string;
  banner?: MenuBannerConfig;
};

// POST /orders request
export type CreateOrderItem = {
  menuItemId: string;
  quantity: number;
  note?: string;
  optionChoiceIds?: string[];
};

export type CreateOrderRequest = {
  tableCode: string;
  note?: string;
  items: CreateOrderItem[];
};

// POST /orders response (HTTP 201)
export type CreatedOrder = {
  id: string;
  orderNumber: number;
  status: string;
  tableName: string;
  subtotal: number;
  total: number;
  totalItems: number;
  createdAt: string;
};

// A single selected option on a cart line, kept for display.
export type CartSelectedOption = {
  group: string;
  choice: string;
  priceDelta: number;
};

// Cart item shape (client-side / persisted in localStorage)
export type CartItem = {
  lineId: string; // stable unique id for this cart line
  menuItemId: string;
  name: string;
  price: number; // EFFECTIVE unit price = base price + sum(selected priceDelta)
  quantity: number;
  note?: string;
  options: CartSelectedOption[]; // selected options, for display
  optionChoiceIds: string[]; // selected choice ids, for the order submit
};
