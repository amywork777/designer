import { DollarSign, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { signIn, useSession } from "next-auth/react";

interface DesignFeeSectionProps {
  onProceed: () => void;
  designData: any;
  userEmail: string;
  userId: string;
  designId: string;
}

export function DesignFeeSection({ 
  onProceed,
  designData,
  userEmail,
  userId,
  designId
}: DesignFeeSectionProps) {
  const { data: session } = useSession();

  const handlePayment = async () => {
    try {
      if (!session?.user) {
        await signIn("google", {
          callbackUrl: window.location.href,
          redirect: true,
          prompt: "select_account"
        });
        return;
      }

      // Now we know the user is logged in, proceed with payment
      console.log('Initiating payment with:', {
        designId,
        userEmail: session.user.email,
        userId: session.user.id,
        designData: {
          analysis: designData.analysis,
          quantity: designData.quantity,
          dimensions: designData.dimensions
        }
      });

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          designData,
          userEmail: session.user.email,
          userId: session.user.id,
          designId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Payment API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error('Payment initiation failed');
      }

      const data = await response.json();
      console.log('Payment session created:', data);

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No payment URL received');
      }
    } catch (error) {
      console.error('Payment/Auth error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Authentication failed. Please try again."
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 shadow-sm">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-800">Ready to Make Your Design Real?</h3>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700 text-lg">
            Take the first step to holding your product in your hands. Our team will handle everything from here:
          </p>
          <ul className="space-y-3">
            {[
              'Expert review of your design for manufacturability',
              'Best material selection for your needs',
              'Manufacturing cost optimization',
              'Direct support through the entire process'
            ].map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4">
          <button
            onClick={handlePayment}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 
              hover:to-indigo-700 text-white rounded-lg transition-all transform hover:scale-[1.02] 
              shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg"
          >
            <DollarSign className="w-5 h-5" />
            {!session?.user ? 'Sign in to Continue' : 'Start Production with $50 Design Fee'}
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="text-center space-y-2 mt-3">
            <p className="text-sm text-gray-500">
              {session?.user ? 'Secure payment powered by Stripe' : 'Sign in required to proceed'}
            </p>
            <p className="text-sm font-medium text-blue-600">
              Let's turn your design into reality today!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 