import Stripe from 'stripe';

export type DbTier = 'free' | 'pro' | 'church';

const CHURCH_PRICES = new Set(['price_1TSmOfDaUBBsjt5mjrJLVLLK']);
const PRO_PRICES = new Set([
  'price_1TSmMiDaUBBsjt5mTa3DfYfA',
  'price_1TSmNbDaUBBsjt5mBXm985Y8',
]);
const FREE_PRICES = new Set(['price_1TSmM0DaUBBsjt5mlh09smbe']);

export function tierFromPriceId(priceId: string | undefined | null): DbTier {
  if (!priceId) return 'pro';
  if (CHURCH_PRICES.has(priceId)) return 'church';
  if (FREE_PRICES.has(priceId)) return 'free';
  if (PRO_PRICES.has(priceId)) return 'pro';
  if (priceId.startsWith('price_')) return 'pro';
  return 'free';
}

export async function upsertUserTier(
  db: D1Database,
  userId: string,
  tier: DbTier,
  email: string,
  stripeCustomerId?: string | null,
  stripeSubscriptionId?: string | null,
): Promise<void> {
  await db
    .prepare(
      `
    INSERT INTO users (id, email, tier, stripe_customer_id, stripe_subscription_id, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      tier = excluded.tier,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE users.email END,
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, users.stripe_customer_id),
      stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, users.stripe_subscription_id),
      updated_at = CURRENT_TIMESTAMP
  `,
    )
    .bind(userId, email || '', tier, stripeCustomerId || null, stripeSubscriptionId || null)
    .run();
}

export async function syncUserTierFromStripe(
  stripe: Stripe,
  db: D1Database,
  userId: string,
  email: string,
  sessionId?: string | null,
): Promise<DbTier> {
  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price', 'subscription'],
    });
    const sessionUserId = session.client_reference_id || session.metadata?.userId;
    if (sessionUserId && sessionUserId !== userId) {
      throw new Error('This checkout belongs to a different account. Sign in with the account you used to pay.');
    }
    const priceId =
      session.metadata?.priceId ||
      (typeof session.line_items?.data?.[0]?.price === 'object'
        ? session.line_items.data[0].price.id
        : '') ||
      '';
    const tier = tierFromPriceId(priceId);
    if (session.status === 'complete' || session.payment_status === 'paid') {
      await upsertUserTier(
        db,
        userId,
        tier,
        email || session.customer_email || session.customer_details?.email || '',
        typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || null,
      );
      return tier;
    }
  }

  if (!email) {
    const row = await db.prepare('SELECT tier FROM users WHERE id = ?').bind(userId).first<{ tier: string }>();
    if (row?.tier === 'pro' || row?.tier === 'church') return row.tier;
    return 'free';
  }

  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'],
    });
    if (subs.data.length > 0) {
      const sub = subs.data[0];
      const priceId = sub.items.data[0]?.price?.id;
      const tier = tierFromPriceId(priceId);
      await upsertUserTier(db, userId, tier, email, customer.id, sub.id);
      return tier;
    }
  }

  const row = await db.prepare('SELECT tier FROM users WHERE id = ?').bind(userId).first<{ tier: string }>();
  if (row?.tier === 'pro' || row?.tier === 'church') return row.tier;
  return 'free';
}
