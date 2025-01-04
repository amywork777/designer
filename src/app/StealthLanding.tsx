'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, MessageSquare, Camera, PenTool, Package, Hammer, Rocket, Send, Users } from 'lucide-react';
import ImageGenerator from '@/components/ImageGenerator';

interface StealthLandingProps {
  onImageSelect?: (imageUrl: string) => void;
}

export default function StealthLanding({ onImageSelect }: StealthLandingProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [currentTagline, setCurrentTagline] = useState(0);

  const taglines = [
    "Your Marketing Team's Secret Weapon",
    "Your In-House Design Studio, Powered by AI",
    "Design, Edit, Export - All in One Place",
    "Product Marketing at Startup Speed"
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSubmitted(true);
      setEmail('');
      setSubscriberCount(data.subscriberCount);

      setTimeout(() => {
        setSubmitted(false);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="max-w-4xl mx-auto space-y-12 p-6">
        {/* Company Name */}
        <div className="pt-4 flex items-center gap-2">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-1">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">createy.ai</h3>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer"
            onClick={() => setCurrentTagline((prev) => (prev + 1) % taglines.length)}
          >
            {taglines[currentTagline]}
          </h1>
          <p className="text-xl text-blue-900/70 max-w-2xl mx-auto">
            Transform product ideas into stunning marketing visuals in seconds. No design skills needed.
          </p>
        </div>

        {/* How It Works Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-blue-900">How It Works</h2>
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold">STEP 1: Describe Your Product</h3>
              <p>Type your product description or upload reference images. Our AI generates multiple professional variations in seconds.</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold">STEP 2: Perfect Your Visuals</h3>
              <p>Adjust everything with simple sliders. See changes instantly. No design skills needed.</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold">STEP 3: Export & Share</h3>
              <p>Download in any format you need. Organize files by project and share with your team.</p>
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-blue-900">Recent Projects</h2>
          {/* Carousel for recent projects will go here */}
        </div>

        {/* Join Our Community Section */}
        <Card className="p-8 bg-white/40 backdrop-blur">
          <CardContent className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-blue-900">Join Our Community</h2>
            <form onSubmit={handleSubmit} className="max-w-md mx-auto flex gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-900 placeholder-gray-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="submit"
                className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg transition-all flex items-center gap-2 ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                disabled={submitting}
              >
                {submitting ? 'Joining...' : 'Join Community'}
              </button>
            </form>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {submitted && <p className="text-blue-600 text-center">Welcome to the community! You're member #{subscriberCount}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

