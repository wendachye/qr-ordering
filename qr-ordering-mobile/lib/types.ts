// Shared types mirroring the backend API contract (Public/customer endpoints).

export type Store = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  themeColor?: string | null;
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

// Combos / set meals. A combo is a fixed base `price` plus exactly ONE pick per
// group; a premium option adds its `priceDelta`. The server recomputes + charges
// the total authoritatively — the client only displays an estimate.
export type PublicComboOption = {
  id: string;
  menuItemId: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
};

export type PublicComboGroup = {
  id: string;
  name: string;
  options: PublicComboOption[];
};

export type PublicCombo = {
  id: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  price: number;
  isAvailable: boolean;
  posOnly: boolean;
  sortOrder: number;
  groups: PublicComboGroup[];
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
  // Combos / set meals, shown as their own "Set meals" section.
  combos: PublicCombo[];
  // Curated "featured" strip (available items only), shown at the top.
  featured?: MenuItem[];
  featuredTitle?: string;
  banner?: MenuBannerConfig;
};

// GET /public/tables/:tableCode/tab — the table's current open tab (orders so far).
export type OpenTabItem = {
  id: string;
  name: string;
  quantity: number;
  totalPrice: number;
  note: string | null;
};
export type OpenTabRound = {
  id: string;
  roundNumber: number;
  createdAt: string;
  items: OpenTabItem[];
};
export type OpenTab = {
  tableName: string;
  hasOpenTab: boolean;
  sessionNumber: number | null;
  openedAt: string | null;
  rounds: OpenTabRound[];
  itemCount: number;
  total: number;
};

// POST /orders request
// A line is either a menu item (menuItemId + optionChoiceIds) OR a combo
// (comboId + comboSelections) — the two are mutually exclusive. The server
// validates and prices either shape.
export type CreateOrderComboSelection = {
  groupId: string;
  optionId: string;
};

export type CreateOrderItem = {
  menuItemId?: string;
  quantity: number;
  note?: string;
  optionChoiceIds?: string[];
  comboId?: string;
  comboSelections?: CreateOrderComboSelection[];
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

// A single combo pick (one per group), kept for display + the order submit.
export type CartComboPick = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

// Cart line shapes (client-side / persisted in localStorage). A line is a
// discriminated union on `kind`: a regular menu item or a combo. Both carry a
// stable `lineId`, an EFFECTIVE unit `price`, quantity and optional note.

// A regular menu-item line.
export type CartMenuLine = {
  kind: "item";
  lineId: string; // stable unique id for this cart line
  menuItemId: string;
  name: string;
  price: number; // EFFECTIVE unit price = base price + sum(selected priceDelta)
  quantity: number;
  note?: string;
  options: CartSelectedOption[]; // selected options, for display
  optionChoiceIds: string[]; // selected choice ids, for the order submit
};

// A combo / set-meal line.
export type CartComboLine = {
  kind: "combo";
  lineId: string;
  comboId: string;
  name: string;
  price: number; // EFFECTIVE unit price = base price + sum(selected priceDelta)
  quantity: number;
  note?: string;
  picks: CartComboPick[]; // one per group, for display + the order submit
};

export type CartItem = CartMenuLine | CartComboLine;
