import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateUserSubscription } from '@/lib/firebase/subscriptions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  console.log('🔥🔥🔥 WEBHOOK RECEIVED 🔥🔥🔥');
  
  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');
    
    console.log('🔑 Got signature:', signature?.slice(0, 20) + '...');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
      console.log('✅ Webhook verified, event type:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    if (event.type === 'customer.subscription.created' || 
        event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      
      // Log the full subscription object to debug
      console.log('📦 Full subscription data:', JSON.stringify(subscription, null, 2));
      
      // Get userId from metadata
      const userId = subscription.metadata?.userId;
      if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return NextResponse.json(
          { error: 'Missing userId in metadata' },
          { status: 400 }
        );
      }

      console.log('💳 Processing subscription:', {
        userId,
        subscriptionId: subscription.id,
        currentPeriodEnd: subscription.current_period_end
      });

      try {
        await updateUserSubscription(
          userId,
          'pro',
          subscription.id,
          subscription.current_period_end
        );
        console.log('✅ Subscription updated in Firebase for user:', userId);
      } catch (error) {
        console.error('❌ Failed to update subscription in Firebase:', error);
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('🚨 Webhook handler failed:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 