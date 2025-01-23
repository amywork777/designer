import { X } from 'lucide-react';

interface PricingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingDialog({ isOpen, onClose }: PricingDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold">Pricing</h2>
          <p className="text-gray-600 mt-2">Choose the plan that works for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {/* Hobbyist Plan */}
          <div className="border border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-all">
            <h3 className="text-xl font-semibold">Hobbyist</h3>
            <p className="text-gray-600 text-sm mt-1">Perfect for getting started with 3D design and printing</p>
            
            <div className="mt-6">
              <span className="text-5xl font-bold">Free</span>
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
                <span>Advanced Manufacturing Quotes</span>
                <span>1</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Professional CAD Files (.STEP)</span>
                <span>✕</span>
              </div>
            </div>

            <button className="w-full mt-8 bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity">
              Get Started
            </button>
          </div>

          {/* Pro Plan */}
          <div className="border border-gray-200 rounded-2xl p-6 bg-gradient-to-br from-teal-50 via-lime-50 to-amber-50">
            <h3 className="text-xl font-semibold">Pro</h3>
            <p className="text-gray-600 text-sm mt-1">Perfect for makers and designers who want more flexibility and manufacturing options</p>
            
            <div className="mt-6 flex items-baseline">
              <span className="text-5xl font-bold">$20</span>
              <span className="text-gray-600 ml-2">/month</span>
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
                <span>Advanced Manufacturing Quotes</span>
                <span>5</span>
              </div>
              <div className="flex justify-between">
                <span>Professional CAD Files (.STEP)</span>
                <span>3</span>
              </div>
            </div>

            <button className="w-full mt-8 bg-white text-black border border-gray-200 rounded-xl py-3 hover:bg-black hover:text-white hover:border-black transition-all">
              Get Started
            </button>
          </div>

          {/* Business Plan */}
          <div className="border border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition-all">
            <h3 className="text-xl font-semibold">Business</h3>
            <p className="text-gray-600 text-sm mt-1">Ideal for professionals who need full design and manufacturing capabilities</p>
            
            <div className="mt-6 flex items-baseline">
              <span className="text-5xl font-bold">$99</span>
              <span className="text-gray-600 ml-2">/month/user</span>
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
                <span>Unlimited</span>
              </div>
              <div className="flex justify-between">
                <span>Advanced Manufacturing Quotes</span>
                <span>10</span>
              </div>
              <div className="flex justify-between">
                <span>Professional CAD Files (.STEP)</span>
                <span>10</span>
              </div>
            </div>

            <button className="w-full mt-8 bg-black text-white rounded-xl py-3 hover:opacity-90 transition-opacity">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 