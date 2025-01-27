import { X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';

// Initialize Stripe once at the top level
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingDialog({ isOpen, onClose }: PricingDialogProps) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const handleSubscription = async (priceId?: string) => {
    if (!session?.user) {
      console.log('Subscription attempted without session');
      toast({
        title: "Sign in required",
        description: "Please sign in to continue with subscription",
        variant: "destructive",
      });
      return;
    }

    if (!priceId) {
      console.log('Free tier selected, closing dialog');
      onClose();
      return;
    }

    try {
      console.log('Starting subscription process:', {
        priceId,
        userId: session.user.id,
        email: session.user.email
      });

      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: session.user.id,
          email: session.user.email,
        }),
      });

      console.log('Subscription API response status:', response.status);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Subscription creation failed:', {
          status: response.status,
          data
        });
        throw new Error(data.error || 'Failed to create subscription');
      }

      if (!data.sessionId) {
        console.error('Missing session ID in response:', data);
        throw new Error('No session ID returned from server');
      }

      console.log('Successfully created checkout session:', data.sessionId);

      const stripe = await stripePromise;
      if (!stripe) {
        console.error('Stripe failed to initialize');
        throw new Error('Failed to initialize Stripe');
      }

      console.log('Redirecting to Stripe checkout...');
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      });
      
      if (error) {
        console.error('Stripe redirect error:', {
          type: error.type,
          message: error.message
        });
        throw error;
      }
    } catch (error: any) {
      console.error('Subscription error:', {
        message: error.message,
        stack: error.stack,
        type: error.type
      });
      toast({
        title: "Error",
        description: error.message || "Failed to start subscription",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-6xl sm:w-full p-4 sm:p-8 relative min-h-screen sm:min-h-0">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 sm:-right-3 sm:-top-3 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center mb-4 sm:mb-6 pt-4 sm:pt-0">
          <h2 className="text-2xl sm:text-3xl font-bold">Pricing</h2>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Choose the plan that works for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 mt-4 sm:mt-8">
          {/* Hobbyist Plan */}
          <div className="border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-gray-300 transition-all">
            <div className="flex justify-between items-start md:block mb-6 md:mb-0">
              <div>
                <h3 className="text-xl font-semibold">Hobbyist</h3>
                <p className="text-gray-600 text-sm mt-1">Perfect for getting started with 3D design and printing</p>
              </div>
              <div className="text-right md:text-left md:mt-6">
                <span className="text-4xl sm:text-5xl font-bold">Free</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <span>3D Model Generations</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span>3D Printing Orders</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span>STL File Downloads</span>
                <span>10</span>
              </div>
              <div className="flex justify-between">
                <span>Advanced Mfg Quotes</span>
                <span>1</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Professional CAD Files (.STEP)</span>
                <span>✕</span>
              </div>
            </div>

            <button 
              onClick={() => handleSubscription()}
              className="w-full mt-6 sm:mt-8 bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>

          {/* Pro Plan */}
          <div className="border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-teal-50 via-lime-50 to-amber-50">
            <div className="flex justify-between items-start md:block mb-6 md:mb-0">
              <div>
                <h3 className="text-xl font-semibold">Pro</h3>
                <p className="text-gray-600 text-sm mt-1">Perfect for makers and designers who want more flexibility</p>
              </div>
              <div className="text-right md:text-left md:mt-6">
                <span className="text-4xl sm:text-5xl font-bold">$20</span>
                <span className="text-gray-600 text-sm ml-1">/month</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <span>3D Model Generations</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span>3D Printing Orders</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span>STL File Downloads</span>
                <span>30</span>
              </div>
              <div className="flex justify-between">
                <span>Advanced Mfg Quotes</span>
                <span>5</span>
              </div>
              <div className="flex justify-between">
                <span>Professional CAD Files (.STEP)</span>
                <span>3</span>
              </div>
            </div>

            <button 
              onClick={() => handleSubscription('price_1QkuRJCLoBz9jXRlN4dr0KfA')}
              className="w-full mt-6 sm:mt-8 bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>

          {/* Business Plan */}
          <div className="border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-gray-300 transition-all">
            <div className="flex justify-between items-start md:block mb-6 md:mb-0">
              <div>
                <h3 className="text-xl font-semibold">Business</h3>
                <p className="text-gray-600 text-sm mt-1">Ideal for professionals who need full capabilities</p>
              </div>
              <div className="text-right md:text-left md:mt-6">
                <span className="text-4xl sm:text-5xl font-bold">Contact Us</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="whitespace-nowrap">3D Model Generations</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="whitespace-nowrap">3D Printing Orders</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="whitespace-nowrap">STL File Downloads</span>
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="whitespace-nowrap">Advanced Mfg Quotes</span>
                <span>Custom</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="whitespace-nowrap">CAD Files (.STEP)</span>
                <span>Custom</span>
              </div>
            </div>

            <button className="w-full mt-6 sm:mt-8 bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 