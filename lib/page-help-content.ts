// Help content for the `<PageHelp>` drawer. Keys map to PageHeader.helpKey
// props. Keep prose tight — one or two sentences per section.

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
    whatItIsFor: 'Your daily home base for the warehouse — checklist, KPIs, and attention items.',
    howItWorks: [
      'The onboarding checklist guides first-time setup. It collapses once every step is done.',
      'KPI cards count active state across your tenant. Click any card to jump to the matching queue.',
      "Needs attention surfaces orders stuck in AWAITING_STOCK, ON_HOLD, or EXCEPTION — they won't move without action.",
    ],
    commonTasks: [
      'Use Quick actions to start common workflows',
      'Load demo data to explore the product before setup',
    ],
  },
  'warehouse.clients': {
    title: 'Clients',
    whatItIsFor: 'The brands whose goods you store and ship.',
    howItWorks: [
      'Each client is its own tenant — products, inventory, orders, and portal users are scoped per client.',
      'You can invite a portal user when you create the client so they can submit orders themselves.',
    ],
    commonTasks: [
      'Add a new client with the "Add client" button',
      'Click a client row to manage their products, SKUs, and personalization fields',
    ],
  },
  'warehouse.warehouses': {
    title: 'Warehouses',
    whatItIsFor: 'Physical locations where you receive and store inventory.',
    howItWorks: [
      'Each warehouse contains zones, aisles, and bins — bins are where stock actually lives.',
      'Bin labels (e.g. "A1-01") are what pickers scan-confirm during pick.',
    ],
    commonTasks: ['Create a warehouse', 'Add zones, aisles, and bins inside a warehouse'],
  },
  'warehouse.inbound': {
    title: 'Inbound shipments',
    whatItIsFor: 'Incoming inventory from clients that staff checks into bins.',
    howItWorks: [
      'Clients notify you from their portal. A shipment lands here as NOTIFIED.',
      'Staff opens it, marks "Start receiving" (NOTIFIED → RECEIVING), and checks in each line with quantity + bin.',
      'When all lines are received, mark complete — stock becomes available in inventory.',
    ],
    commonTasks: ['Click a shipment to start receiving', 'Receive a line into a specific bin'],
    related: [
      { label: 'Inventory', href: '/warehouse/inventory' },
      { label: 'Warehouses (set up bins)', href: '/warehouse/warehouses' },
    ],
  },
  'warehouse.inventory': {
    title: 'Inventory',
    whatItIsFor: 'Stock on hand across all clients, summed per SKU.',
    howItWorks: [
      "Inventory updates automatically — when an inbound is received, stock goes AVAILABLE. When an order's lines allocate, stock moves to RESERVED. When picked, it leaves inventory.",
      "Damaged goods land in a separate row so they're not pickable.",
    ],
    commonTasks: ['Receive an inbound shipment to add stock', 'View per-SKU totals across bins'],
  },
  'warehouse.orders': {
    title: 'Orders',
    whatItIsFor: 'Outbound orders across all clients — submission through ship.',
    howItWorks: [
      'Each order has a status from Submitted to Shipped. The timeline on order detail shows where it is.',
      'Orders submitted with enough stock auto-allocate to bins and move to READY_TO_PICK.',
      'AWAITING_STOCK means the order tried to allocate but not enough inventory was available.',
    ],
    commonTasks: [
      'Create a new order manually for a client',
      'Import a CSV of orders',
      'Open an order to see its timeline, allocations, and assign it',
    ],
  },
  'warehouse.pick': {
    title: 'Pick queue',
    whatItIsFor: 'Orders that have been allocated and are ready to pick from bins.',
    howItWorks: [
      'Each order shows one row per allocation — the per-bin breakdown computed when the order was allocated.',
      'Pickers scan or type the bin label to confirm each pick. The order flips to PICKED when all rows are done.',
    ],
    commonTasks: ['Click an order to walk its bins', 'Scan-confirm each allocation'],
  },
  'warehouse.pack': {
    title: 'Pack queue',
    whatItIsFor: 'Picked orders ready to box up.',
    howItWorks: [
      'Packers enter box dimensions (length, width, height) in inches and weight in ounces.',
      'Any personalization values on the order line surface here, so the packer can engrave, monogram, or add gift notes.',
      'Once submitted, the order flips to PACKED.',
    ],
    commonTasks: ['Click an order to enter box dimensions and weight'],
  },
  'warehouse.ship': {
    title: 'Ship queue',
    whatItIsFor: 'Packed orders ready to hand off to the carrier.',
    howItWorks: [
      'Pick the carrier (USPS, UPS, FedEx, DHL, or Other) and enter the tracking number after generating the label outside the system. Phase 3 will buy labels inside the app.',
      "Known carriers render the tracking number as a clickable link to the carrier's tracking page.",
    ],
    commonTasks: ['Click an order to record carrier + tracking', 'Mark the order shipped'],
  },
  'warehouse.team': {
    title: 'Team',
    whatItIsFor: 'Manage staff: invite, change roles, and view all-time productivity.',
    howItWorks: [
      'Invite a staff member by email; they sign up via Clerk and the row is claimed by their email.',
      'Roles gate which workflows they can perform: PICKER picks, PACKER packs, etc. ADMIN does everything.',
      "The last active ADMIN can't be disabled or demoted — protects against accidental lockout.",
    ],
    commonTasks: [
      'Invite a new staff member',
      "Change a user's role or suspend them",
      'See per-staff inbound / picks / packs / ships counts',
    ],
  },
  'warehouse.personalization': {
    title: 'Personalization',
    whatItIsFor: 'Per-client custom fields captured on every order line.',
    howItWorks: [
      'Define fields like "engraving" or "monogram" — text only.',
      'When an order line is submitted for this client, every active field appears as an input. Required fields block submission.',
      'Disabled fields stop appearing on new orders but historical values are preserved.',
    ],
    commonTasks: ['Add a new field with a key + label', 'Disable a field you no longer use'],
  },
  'warehouse.order-detail': {
    title: 'Order detail',
    whatItIsFor: 'See everything about one order — status, timeline, lines, assignment, shipping.',
    howItWorks: [
      "The status timeline at the top shows where the order is and what's next.",
      'The activity feed below lists every event with the staff member who did it.',
      'ADMINs can assign the order to a specific staff member as a hint to workers (not a hard fence).',
    ],
    commonTasks: [
      'Try allocation if the order is SUBMITTED',
      'Cancel the order before pick starts',
    ],
  },

  // --- Portal shell ---
  'portal.dashboard': {
    title: 'Dashboard',
    whatItIsFor: 'Your overview of in-flight orders, inventory, and quick actions.',
    howItWorks: [
      'KPI cards count your active orders, SKUs, pending inbounds, and any orders awaiting stock.',
      'Recent orders show your last 5 — click to see status.',
    ],
    commonTasks: ['Submit a new order', 'Notify your 3PL of incoming inventory', 'Check inventory'],
  },
  'portal.products': {
    title: 'Products',
    whatItIsFor: 'Your catalog of products and SKU variants.',
    howItWorks: [
      'Each product can have many SKU variants (size, color, style).',
      'Inventory is tracked per SKU, not per product.',
    ],
    commonTasks: ['Add a product', 'Add SKU variants under a product'],
  },
  'portal.inbound': {
    title: 'Inbound shipments',
    whatItIsFor: 'Notify your 3PL when stock is on its way so they can prepare to receive it.',
    howItWorks: [
      "A notification lands in your 3PL's queue as NOTIFIED.",
      'When they start checking it in it becomes RECEIVING; when done, COMPLETED.',
    ],
    commonTasks: ['Click "Notify of incoming" to start one'],
  },
  'portal.orders': {
    title: 'Orders',
    whatItIsFor: 'Outbound shipments your 3PL is fulfilling for you.',
    howItWorks: [
      'Submit an order with a ship-to address, lines (SKU + quantity), and any personalization values.',
      'If stock is available, the order auto-allocates and progresses through pick → pack → ship.',
      "If stock isn't available it goes to AWAITING_STOCK and waits for the next inbound.",
    ],
    commonTasks: [
      'Submit a new order',
      'Import a CSV of orders',
      'Track a shipped order via tracking link',
    ],
  },
};
