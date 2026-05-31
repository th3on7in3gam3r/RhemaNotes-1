import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  VITE_STRIPE_PRICE_FREE: string;
  VITE_STRIPE_PRICE_PRO_MONTHLY: string;
  VITE_STRIPE_PRICE_PRO_ANNUAL: string;
  VITE_STRIPE_PRICE_CHURCH: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const { priceId, userId, userEmail } = await request.json() as any;
    
    if (!env.STRIPE_SECRET_KEY) {
      return new Response('Stripe secret key not configured', { status: 500 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const url = new URL(request.url);
    const origin = url.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: {
        userId,
        priceId,
      },
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
