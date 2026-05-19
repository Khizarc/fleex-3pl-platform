// Help content for the `<PageHelp>` drawer. Keys map to PageHeader.helpKey
// props. Tight on purpose — one sentence per item, no walls of text.

export type PageHelpContent = {
  title: string;
  whatItIsFor: string;
  howItWorks: string[];
  commonTasks: string[];
  related?: { label: string; href: string }[];
};

export const PAGE_HELP: Record<string, PageHelpContent> = {
  // --- Warehouse shell ---
  'warehouse.dashboard': {
    title: 'Dashboard',
    whatItIsFor: 'Your daily home base — KPIs, checklist, and attention items.',
    howItWorks: [
      'Click any KPI card to jump to its queue.',
      'Needs attention surfaces stuck orders (AWAITING_STOCK, ON_HOLD, EXCEPTION).',
    ],
    commonTasks: ['Use Quick actions to start common workflows', 'Load demo data to explore'],
  },
  'warehouse.clients': {
    title: 'Clients',
    whatItIsFor: 'The brands whose goods you store and ship.',
    howItWorks: [
      'Each client has its own products, inventory, orders, and portal users.',
      'Invite a portal user during client creation so they can submit orders themselves.',
    ],
    commonTasks: ['Add a client', 'Click a row to manage products and personalization'],
  },
  'warehouse.warehouses': {
    title: 'Warehouses',
    whatItIsFor: 'Physical locations where you store inventory.',
    howItWorks: [
      'Each warehouse contains zones, aisles, and bins. Stock lives in bins.',
      'Bin labels (e.g. "A1-01") are what pickers scan-confirm during pick.',
    ],
    commonTasks: ['Create a warehouse', 'Add zones, aisles, and bins'],
  },
  'warehouse.inbound': {
    title: 'Inbound shipments',
    whatItIsFor: 'Incoming inventory from clients — staff checks it into bins.',
    howItWorks: [
      'Clients notify from their portal. Status: NOTIFIED → RECEIVING → COMPLETED.',
      'Receive each line into a specific bin. Stock becomes available when complete.',
    ],
    commonTasks: ['Start receiving a shipment', 'Receive a line into a bin'],
    related: [
      { label: 'Inventory', href: '/warehouse/inventory' },
      { label: 'Warehouses', href: '/warehouse/warehouses' },
    ],
  },
  'warehouse.inventory': {
    title: 'Inventory',
    whatItIsFor: 'Stock on hand across all clients, summed per SKU.',
    howItWorks: [
      'AVAILABLE on receive → RESERVED on allocation → leaves on pick.',
      "Damaged goods are tracked separately and aren't pickable.",
    ],
    commonTasks: ['Receive an inbound to add stock'],
  },
  'warehouse.orders': {
    title: 'Orders',
    whatItIsFor: 'Outbound orders — submission through ship.',
    howItWorks: [
      'Auto-allocates on submit if stock is available; otherwise AWAITING_STOCK.',
      'Click any order to see its timeline, lines, and activity feed.',
    ],
    commonTasks: ['Create a manual order', 'Import a CSV', 'Open an order to assign it'],
  },
  'warehouse.pick': {
    title: 'Pick queue',
    whatItIsFor: 'Orders allocated and ready to pick from bins.',
    howItWorks: [
      'One row per allocation — the per-bin breakdown.',
      'Scan or type the bin label to confirm each pick.',
    ],
    commonTasks: ['Click an order to walk its bins'],
  },
  'warehouse.pack': {
    title: 'Pack queue',
    whatItIsFor: 'Picked orders ready to box up.',
    howItWorks: [
      'Enter box dimensions in inches and weight in ounces.',
      'Any personalization values on the order surface here for the packer.',
    ],
    commonTasks: ['Click an order to enter box dimensions'],
  },
  'warehouse.ship': {
    title: 'Ship queue',
    whatItIsFor: 'Packed orders ready to hand off to the carrier.',
    howItWorks: [
      'Pick the carrier and enter the tracking number after generating the label.',
      'Known carriers render tracking numbers as clickable links.',
    ],
    commonTasks: ['Record carrier + tracking', 'Mark the order shipped'],
  },
  'warehouse.team': {
    title: 'Team',
    whatItIsFor: 'Manage staff: invite, change roles, view productivity.',
    howItWorks: [
      'Invite by email; staff signs up via Clerk and the row is claimed by their email.',
      "Roles gate which workflows they can perform. Last active ADMIN can't be removed.",
    ],
    commonTasks: ['Invite a staff member', 'Change role or status'],
  },
  'warehouse.personalization': {
    title: 'Personalization',
    whatItIsFor: 'Per-client custom fields on every order line.',
    howItWorks: [
      'Define fields like "engraving" — text only.',
      'Required fields block order submission. Disabled fields hide on new orders but historical values remain.',
    ],
    commonTasks: ['Add a field', 'Disable an unused field'],
  },
  'warehouse.order-detail': {
    title: 'Order detail',
    whatItIsFor: 'Status, timeline, lines, assignment, shipping — one view.',
    howItWorks: [
      "The timeline shows where the order is and what's next.",
      'Activity feed lists every event with the staff member who did it.',
    ],
    commonTasks: ['Try allocation if SUBMITTED', 'Cancel before pick starts'],
  },

  // --- Portal shell ---
  'portal.dashboard': {
    title: 'Dashboard',
    whatItIsFor: 'Overview of in-flight orders, inventory, and quick actions.',
    howItWorks: ['KPI cards count your active orders, SKUs, and pending inbounds.'],
    commonTasks: ['Submit an order', 'Notify your 3PL of incoming stock'],
  },
  'portal.products': {
    title: 'Products',
    whatItIsFor: 'Your catalog and SKU variants.',
    howItWorks: ['Each product can have many SKU variants. Inventory tracks per SKU.'],
    commonTasks: ['Add a product', 'Add SKU variants'],
  },
  'portal.inbound': {
    title: 'Inbound shipments',
    whatItIsFor: 'Tell your 3PL when stock is on the way.',
    howItWorks: ['Status: NOTIFIED → RECEIVING → COMPLETED.'],
    commonTasks: ['Click "Notify of incoming" to start one'],
  },
  'portal.orders': {
    title: 'Orders',
    whatItIsFor: 'Outbound shipments your 3PL is fulfilling.',
    howItWorks: [
      'Submit with ship-to, lines, and personalization values.',
      'Auto-allocates if stock is available; otherwise AWAITING_STOCK.',
    ],
    commonTasks: ['Submit an order', 'Import a CSV', 'Track via tracking link'],
  },
};
