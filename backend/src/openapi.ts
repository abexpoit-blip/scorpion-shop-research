// OpenAPI 3.0 spec for cruzercc backend.
// Served at /api/docs (Swagger UI) and /api/docs.json (raw spec).

const bearer = [{ bearerAuth: [] }];

const ok = (description = "OK") => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});

const path = (
  method: string,
  summary: string,
  opts: {
    auth?: boolean;
    role?: "admin" | "seller" | "buyer";
    params?: any[];
    body?: any;
    tag: string;
  }
) => ({
  [method]: {
    tags: [opts.tag],
    summary: opts.role ? `${summary} (requires role: ${opts.role})` : summary,
    security: opts.auth ? bearer : [],
    parameters: opts.params ?? [],
    ...(opts.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: opts.body } },
          },
        }
      : {}),
    responses: {
      "200": ok(),
      ...(opts.auth ? { "401": ok("Unauthorized") } : {}),
      ...(opts.role ? { "403": ok("Forbidden") } : {}),
    },
  },
});

const queryParam = (name: string, description = "") => ({
  name,
  in: "query",
  required: false,
  schema: { type: "string" },
  description,
});

const pathParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" },
});

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "cruzercc API",
    version: "1.0.0",
    description:
      "Backend API for cruzercc.shop. Use POST /api/auth/admin-login or /api/auth/login to obtain a JWT, then click **Authorize** below and paste the token.",
  },
  servers: [
    { url: "https://cruzercc.shop", description: "Production" },
    { url: "http://localhost:8080", description: "Local" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Profile" },
    { name: "Seller Applications" },
    { name: "Admin" },
    { name: "Cards" },
    { name: "Cart" },
    { name: "Orders" },
    { name: "Wallet" },
    { name: "Deposits" },
    { name: "Payouts" },
    { name: "Tickets" },
    { name: "Announcements" },
  ],
  paths: {
    "/api/health": path("get", "Liveness check", { tag: "Health" }),

    "/api/auth/register": path("post", "Register a buyer account", {
      tag: "Auth",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
        },
      },
    }),
    "/api/auth/login": path("post", "Login (buyer/seller)", {
      tag: "Auth",
      body: {
        type: "object",
        required: ["identifier", "password"],
        properties: {
          identifier: { type: "string" },
          password: { type: "string" },
        },
      },
    }),
    "/api/auth/admin-login": path("post", "Admin login", {
      tag: "Auth",
      body: {
        type: "object",
        required: ["identifier", "password"],
        properties: {
          identifier: { type: "string" },
          password: { type: "string" },
        },
      },
    }),

    "/api/profile": {
      ...path("get", "Get my profile", { tag: "Profile", auth: true }),
      ...path("patch", "Update my profile", {
        tag: "Profile",
        auth: true,
        body: { type: "object" },
      }),
    },

    "/api/seller-applications": {
      ...path("post", "Submit seller application", {
        tag: "Seller Applications",
        auth: true,
        body: { type: "object" },
      }),
      ...path("get", "List my applications", {
        tag: "Seller Applications",
        auth: true,
      }),
    },

    "/api/admin/users": path("get", "List users", {
      tag: "Admin",
      auth: true,
      role: "admin",
      params: [queryParam("q", "search by email/username")],
    }),
    "/api/admin/stats": path("get", "Platform stats", {
      tag: "Admin",
      auth: true,
      role: "admin",
    }),
    "/api/admin/routes": path(
      "get",
      "List all mounted routers + paths (introspection)",
      { tag: "Admin", auth: true, role: "admin" }
    ),

    "/api/cards": {
      ...path("get", "List cards (seller=own, buyer=marketplace)", {
        tag: "Cards",
        auth: true,
      }),
      ...path("post", "Create card listing", {
        tag: "Cards",
        auth: true,
        role: "seller",
        body: { type: "object" },
      }),
    },
    "/api/cards/{id}": path("get", "Get card details", {
      tag: "Cards",
      auth: true,
      params: [pathParam("id")],
    }),
    "/api/cards/{id}/reveal": path("post", "Reveal full PAN/CVV after purchase", {
      tag: "Cards",
      auth: true,
      params: [pathParam("id")],
    }),

    "/api/cart": {
      ...path("get", "Get my cart", { tag: "Cart", auth: true }),
      ...path("post", "Add item to cart", {
        tag: "Cart",
        auth: true,
        body: { type: "object" },
      }),
    },
    "/api/cart/checkout": path("post", "Atomic checkout (debit wallet)", {
      tag: "Cart",
      auth: true,
    }),

    "/api/orders": path("get", "List my orders", { tag: "Orders", auth: true }),
    "/api/orders/{id}": path("get", "Get order", {
      tag: "Orders",
      auth: true,
      params: [pathParam("id")],
    }),

    "/api/wallet": path("get", "Get my wallet balance", {
      tag: "Wallet",
      auth: true,
    }),
    "/api/wallet/transactions": path("get", "Wallet ledger", {
      tag: "Wallet",
      auth: true,
    }),

    "/api/deposits": {
      ...path("get", "List deposits (admin: all, user: own)", {
        tag: "Deposits",
        auth: true,
        params: [queryParam("status", "pending|approved|rejected")],
      }),
      ...path("post", "Submit deposit request", {
        tag: "Deposits",
        auth: true,
        body: { type: "object" },
      }),
    },
    "/api/deposits/{id}/approve": path("post", "Approve deposit", {
      tag: "Deposits",
      auth: true,
      role: "admin",
      params: [pathParam("id")],
    }),
    "/api/deposits/{id}/reject": path("post", "Reject deposit", {
      tag: "Deposits",
      auth: true,
      role: "admin",
      params: [pathParam("id")],
    }),

    "/api/payouts": {
      ...path("get", "List payouts", { tag: "Payouts", auth: true }),
      ...path("post", "Request payout", {
        tag: "Payouts",
        auth: true,
        role: "seller",
        body: { type: "object" },
      }),
    },

    "/api/tickets": {
      ...path("get", "List tickets", {
        tag: "Tickets",
        auth: true,
        params: [queryParam("status", "open|closed")],
      }),
      ...path("post", "Open new ticket", {
        tag: "Tickets",
        auth: true,
        body: { type: "object" },
      }),
    },
    "/api/tickets/{id}/messages": {
      ...path("get", "Ticket messages", {
        tag: "Tickets",
        auth: true,
        params: [pathParam("id")],
      }),
      ...path("post", "Reply to ticket", {
        tag: "Tickets",
        auth: true,
        params: [pathParam("id")],
        body: { type: "object" },
      }),
    },

    "/api/announcements": {
      ...path("get", "List announcements", { tag: "Announcements" }),
      ...path("post", "Create announcement", {
        tag: "Announcements",
        auth: true,
        role: "admin",
        body: { type: "object" },
      }),
    },
  },
};
