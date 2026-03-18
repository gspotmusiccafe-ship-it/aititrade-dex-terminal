// PayPal Integration - Replit Blueprint (modified for server-side price enforcement)
import PayPalSDK from "@paypal/paypal-server-sdk";
const { Client, Environment, LogLevel, OAuthAuthorizationController, OrdersController } = PayPalSDK as any;
import { Request, Response } from "express";

const TIER_PRICES: Record<string, string> = {
  silver: "1.99",
  bronze: "3.99",
  gold: "49.99",
  gold_monthly: "9.99",
  trade_position: "0.99",
};

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

if (!PAYPAL_CLIENT_ID) {
  throw new Error("Missing PAYPAL_CLIENT_ID");
}
if (!PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PAYPAL_CLIENT_SECRET");
}
const useProductionPaypal = process.env.PAYPAL_ENVIRONMENT === "production";

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: useProductionPaypal ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Error,
    logRequest: { logBody: false },
    logResponse: { logHeaders: false },
  },
});
const ordersController = new OrdersController(client);
const oAuthAuthorizationController = new OAuthAuthorizationController(client);

export async function getClientToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const { result } = await oAuthAuthorizationController.requestToken(
    { authorization: `Basic ${auth}` },
    { intent: "sdk_init", response_type: "client_token" },
  );

  return result.accessToken;
}

export async function createPaypalOrder(req: Request, res: Response) {
  try {
    const { tier } = req.body;

    const amount = TIER_PRICES[tier];
    if (!amount) {
      return res.status(400).json({ error: "Invalid membership tier." });
    }

    const collect = {
      body: {
        intent: "CAPTURE",
        purchaseUnits: [
          {
            amount: {
              currencyCode: "USD",
              value: amount,
            },
            description: tier === "trade_position"
              ? "AITIFY Sovereign Exchange — Position Acquisition"
              : `AITIFY ${tier.charAt(0).toUpperCase() + tier.slice(1)} Membership`,
          },
        ],
      },
      prefer: "return=minimal",
    };

    const { body, ...httpResponse } = await ordersController.createOrder(collect);
    const jsonResponse = JSON.parse(String(body));
    res.status(httpResponse.statusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
}

export async function capturePaypalOrder(req: Request, res: Response) {
  try {
    const { orderID } = req.params;
    const collect = { id: orderID, prefer: "return=minimal" };

    const { body, ...httpResponse } = await ordersController.captureOrder(collect);
    const jsonResponse = JSON.parse(String(body));
    res.status(httpResponse.statusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
}

export async function verifyPaypalOrder(orderId: string, expectedTier: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const expectedAmount = TIER_PRICES[expectedTier];
    if (!expectedAmount) {
      return { valid: false, error: "Invalid tier" };
    }

    const { body } = await ordersController.getOrder({ id: orderId });
    const order = JSON.parse(String(body));

    if (order.status !== "COMPLETED") {
      return { valid: false, error: `Order status is ${order.status}, expected COMPLETED` };
    }

    const purchaseUnit = order.purchase_units?.[0];
    const capturedAmount = purchaseUnit?.payments?.captures?.[0]?.amount;

    if (!capturedAmount) {
      return { valid: false, error: "No captured payment found" };
    }

    if (capturedAmount.value !== expectedAmount || capturedAmount.currency_code !== "USD") {
      return { valid: false, error: `Amount mismatch: expected $${expectedAmount} USD, got $${capturedAmount.value} ${capturedAmount.currency_code}` };
    }

    return { valid: true };
  } catch (error) {
    console.error("Failed to verify PayPal order:", error);
    return { valid: false, error: "Failed to verify payment with PayPal" };
  }
}

export async function loadPaypalDefault(req: Request, res: Response) {
  try {
    const clientToken = await getClientToken();
    res.json({ clientToken, sandbox: !useProductionPaypal });
  } catch (error: any) {
    console.error(`Failed to get PayPal client token (env=${useProductionPaypal ? "production" : "sandbox"}):`, error?.message || error);
    res.status(500).json({ error: "Failed to initialize PayPal. Please try again later." });
  }
}

export { ordersController as __ordersController };

const PAYPAL_API_BASE = useProductionPaypal
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getPaypalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as any;
  return data.access_token;
}

let cachedGoldPlanId: string | null = null;

async function ensureGoldSubscriptionPlan(): Promise<string> {
  if (cachedGoldPlanId) return cachedGoldPlanId;

  const token = await getPaypalAccessToken();

  const productRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "AITIFY Gold Artist Pro Monthly",
      description: "Monthly subscription for AITIFY Gold Artist Pro members",
      type: "SERVICE",
      category: "ENTERTAINMENT_AND_MEDIA",
    }),
  });
  const product = await productRes.json() as any;

  const planRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: product.id,
      name: "AITIFY Gold $9.99/month",
      description: "Monthly recurring fee for AITIFY Gold Artist Pro membership",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });
  const plan = await planRes.json() as any;
  cachedGoldPlanId = plan.id;
  console.log("[PayPal] Gold subscription plan created:", plan.id);
  return plan.id;
}

export async function createGoldSubscription(returnUrl: string, cancelUrl: string): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const planId = await ensureGoldSubscriptionPlan();
  const token = await getPaypalAccessToken();

  const startTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: planId,
      start_time: startTime,
      application_context: {
        brand_name: "AITIFY Music Radio",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  const subscription = await subRes.json() as any;

  const approvalLink = subscription.links?.find((l: any) => l.rel === "approve");
  if (!approvalLink) {
    console.error("[PayPal] No approval link in subscription response:", subscription);
    throw new Error("Failed to create subscription — no approval link");
  }

  return { subscriptionId: subscription.id, approvalUrl: approvalLink.href };
}

export async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  return res.json();
}

export async function cancelSubscription(subscriptionId: string, reason: string): Promise<boolean> {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return res.status === 204;
}

export async function createTipOrder(amount: string, artistName: string) {
  const collect = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [{
        amount: { currencyCode: "USD", value: amount },
        description: `Tip for ${artistName} on AITIFY`,
      }],
    },
    prefer: "return=minimal",
  };
  const { body, ...httpResponse } = await ordersController.createOrder(collect);
  const jsonResponse = JSON.parse(String(body));
  return { jsonResponse, statusCode: httpResponse.statusCode };
}

export async function captureTipOrder(orderID: string) {
  const { body, ...httpResponse } = await ordersController.captureOrder({ id: orderID, prefer: "return=minimal" });
  const jsonResponse = JSON.parse(String(body));
  return { jsonResponse, statusCode: httpResponse.statusCode };
}
