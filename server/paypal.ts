// PayPal Integration - Replit Blueprint (modified for server-side price enforcement)
import PayPalSDK from "@paypal/paypal-server-sdk";
const { Client, Environment, LogLevel, OAuthAuthorizationController, OrdersController } = PayPalSDK as any;
import { Request, Response } from "express";

const TIER_PRICES: Record<string, string> = {
  silver: "1.99",
  bronze: "3.99",
  gold: "6.99",
  artist: "19.99",
};

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

if (!PAYPAL_CLIENT_ID) {
  throw new Error("Missing PAYPAL_CLIENT_ID");
}
if (!PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PAYPAL_CLIENT_SECRET");
}
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment:
    process.env.NODE_ENV === "production"
      ? Environment.Production
      : Environment.Sandbox,
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
            description: `AITIFY ${tier.charAt(0).toUpperCase() + tier.slice(1)} Membership`,
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
    res.json({ clientToken });
  } catch (error) {
    console.error("Failed to get PayPal client token:", error);
    res.status(500).json({ error: "Failed to initialize PayPal" });
  }
}
