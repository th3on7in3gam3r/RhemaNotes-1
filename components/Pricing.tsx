import React, { useState } from 'react';
import { Check, Sparkles, Heart, Church, User, ShieldCheck, HelpCircle, ArrowRight, Gift, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PricingProps {
  onGoHome: () => void;
  onSelectPlan: (plan: string, cycle: 'monthly' | 'annual') => void;
}

export const Pricing: React.FC<PricingProps> = ({ onGoHome, onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const plans = [
    {
      id: 'free',
      name: 'The Seed',
      price: '$0',
      description: 'Perfect for occasional listeners seeking a deeper focus.',
      features: [
        '3 Sermon Summaries per month',
        'Basic Scripture Linking',
        'Offline Local Storage',
        'Community Support'
      ],
      cta: 'Start Free',
      accent: 'indigo'
    },
    {
      id: 'pro',
      name: 'The Vine',
      price: billingCycle === 'monthly' ? '$7.99' : '$5.75',
      period: '/ month',
      description: 'For those dedicated to growing in the Word every day.',
      features: [
        'Unlimited Sermon Summaries',
        'YouTube & Audio File Processing',
        'Interactive Study Chat (AI)',
        'Full Bible Reader Integration',
        'Quiz & Flashcard Generation',
        'Cloud Sync Across Devices'
      ],
      cta: 'Choose Pro',
      featured: true,
      accent: 'gold'
    },
    {
      id: 'church',
      name: 'The Harvest',
      price: '$79',
      period: '/ month',
      description: 'Equip your entire congregation with spiritual study tools.',
      features: [
        'Everything in Pro for all members',
        'Private Shared Church Library',
        'Custom Church Branding',
        'Admin Insights Dashboard',
        'Priority Technical Support'
      ],
      cta: 'Contact Us',
      accent: 'indigo'
    }
  ];

  const faqs = [
    {
      q: "Is RhemaNotes a replacement for Bible study?",
      a: "Not at all. We believe RhemaNotes is a companion to your spiritual journey, designed to help you focus on the message and dive deeper into the scriptures mentioned during a sermon."
    },
    {
      q: "Can I cancel my subscription at any time?",
      a: "Yes. Your walk with God should be free of stress. You can manage or cancel your subscription easily from your account settings at any time."
    },
    {
      q: "Do you offer discounts for missionaries or students?",
      a: "We love to support those in full-time ministry. Please reach out to our team for special grace-based pricing."
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-12 animate-in fade-in duration-700">
      
      {/* ── Hero Section ── */}
      <div className="text-center mb-20 space-y-6">
        <div className="inline-flex items-center space-x-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-100 mb-4">
          <Heart className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-amber-900 tracking-wider uppercase">Built for Spiritual Growth</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-serif font-black text-indigo-950 tracking-tight leading-none">
          Invest in your<br />
          <span className="text-gradient-sacred italic">spiritual journey.</span>
        </h1>
        <p className="text-xl text-indigo-900/50 font-serif italic max-w-2xl mx-auto">
          Choose the path that best supports your walk with the Lord. 
          From personal reflection to congregational growth.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center pt-8">
          <div className="bg-indigo-50/50 p-1.5 rounded-2xl border border-indigo-100 flex items-center shadow-inner">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${billingCycle === 'monthly' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-900/40'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center space-x-2 ${billingCycle === 'annual' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-900/40'}`}
            >
              <span>Annual</span>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-md">Save 25%</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Pricing Tiers ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`
              relative flex flex-col p-10 rounded-[40px] transition-all duration-500
              ${plan.featured 
                ? 'bg-indigo-900 text-white shadow-2xl shadow-indigo-200 scale-105 z-10' 
                : 'bg-white border border-indigo-50 text-indigo-950 hover:shadow-xl'}
            `}
          >
            {plan.featured && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center space-x-1.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Most Blessed</span>
              </div>
            )}

            <div className="mb-8">
              <h3 className={`text-2xl font-serif font-black mb-2 ${plan.featured ? 'text-amber-200' : 'text-indigo-900'}`}>{plan.name}</h3>
              <div className="flex items-baseline space-x-1">
                <span className="text-5xl font-serif font-black">{plan.price}</span>
                {plan.period && <span className={`text-sm font-bold ${plan.featured ? 'text-amber-100/50' : 'text-indigo-900/30'}`}>{plan.period}</span>}
              </div>
              <p className={`text-sm mt-4 font-serif italic ${plan.featured ? 'text-indigo-100/70' : 'text-indigo-900/50'}`}>
                {plan.description}
              </p>
            </div>

            <div className="space-y-4 mb-10 flex-grow">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className={`mt-1 p-0.5 rounded-full ${plan.featured ? 'bg-amber-100/20' : 'bg-indigo-50'}`}>
                    <Check className={`w-3.5 h-3.5 ${plan.featured ? 'text-amber-400' : 'text-indigo-600'}`} />
                  </div>
                  <span className={`text-sm font-medium ${plan.featured ? 'text-indigo-50' : 'text-indigo-900/70'}`}>
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => onSelectPlan(plan.id, billingCycle)}
              className={`
                w-full py-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center space-x-2
                ${plan.featured 
                  ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' 
                  : 'bg-indigo-900 text-white hover:bg-indigo-800 shadow-lg shadow-indigo-100'}
              `}
            >
              <span>{plan.cta}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Comparison Table (Condensed for mobile) ── */}
      <div className="sacred-card p-12 mb-24 overflow-hidden">
        <h3 className="text-3xl font-serif font-black text-indigo-950 mb-12 text-center">Feature Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-indigo-50">
                <th className="pb-6 text-indigo-900/40 text-xs font-black uppercase tracking-widest">Service</th>
                <th className="pb-6 text-indigo-900/40 text-xs font-black uppercase tracking-widest text-center">The Seed</th>
                <th className="pb-6 text-indigo-900/40 text-xs font-black uppercase tracking-widest text-center">The Vine</th>
                <th className="pb-6 text-indigo-900/40 text-xs font-black uppercase tracking-widest text-center">The Harvest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {[
                ['AI Summaries', '3/mo', 'Unlimited', 'Unlimited'],
                ['Bible Reader', 'Basic', 'Full Access', 'Full Access'],
                ['YouTube Support', '—', '✅', '✅'],
                ['Study Chat', '—', '✅', '✅'],
                ['Cloud Sync', '—', '✅', '✅'],
                ['Church Library', '—', '—', '✅'],
                ['Member Management', '—', '—', '✅'],
              ].map(([feature, seed, vine, harvest]) => (
                <tr key={feature}>
                  <td className="py-6 font-serif font-bold text-indigo-950">{feature}</td>
                  <td className="py-6 text-center text-sm font-bold text-indigo-900/60">{seed}</td>
                  <td className="py-6 text-center text-sm font-black text-indigo-900">{vine}</td>
                  <td className="py-6 text-center text-sm font-black text-amber-600">{harvest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bless a Pastor & Testimonials ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">
        {/* Bless a Pastor */}
        <div className="sacred-card p-10 bg-amber-50/50 border-amber-200 flex flex-col">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
            <Gift className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-2xl font-serif font-black text-amber-950 mb-3">Bless a Pastor</h3>
          <p className="text-amber-900/60 font-serif italic mb-8">
            Many pastors spend hours transcribing their own sermons for study guides. 
            Gift a "The Vine" subscription to your shepherd and help them focus on their calling.
          </p>
          <button className="mt-auto btn-sacred-gold py-4 w-full">
            Purchase as a Gift
          </button>
        </div>

        {/* Testimonial */}
        <div className="sacred-card p-10 border-indigo-50 bg-white flex flex-col">
          <div className="flex space-x-1 mb-6">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
          </div>
          <blockquote className="text-xl font-serif font-bold italic text-indigo-950 mb-8">
            "RhemaNotes has transformed my commute. I can listen to last Sunday's sermon and immediately see all the scriptures linked in my Bible reader. It's like having a study partner with me at all times."
          </blockquote>
          <div className="mt-auto flex items-center space-x-4">
             <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-indigo-400" />
             </div>
             <div>
               <p className="font-black text-indigo-950">Sarah M.</p>
               <p className="text-xs text-indigo-900/40 uppercase font-bold tracking-widest">Home Group Leader</p>
             </div>
          </div>
        </div>
      </div>

      {/* ── FAQ Section ── */}
      <div className="max-w-3xl mx-auto mb-24">
        <h3 className="text-3xl font-serif font-black text-indigo-950 mb-12 text-center">Faithful Questions</h3>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="sacred-card p-8 border-indigo-50">
              <h4 className="text-lg font-serif font-black text-indigo-950 mb-3 flex items-center space-x-3">
                <HelpCircle className="w-5 h-5 text-indigo-300" />
                <span>{faq.q}</span>
              </h4>
              <p className="text-indigo-900/60 font-serif italic leading-relaxed pl-8">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trust Signals ── */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="flex items-center space-x-6 grayscale opacity-30">
           <div className="font-serif font-black text-2xl italic">KingdomTrust</div>
           <div className="font-sans font-black tracking-tighter text-2xl uppercase">FaithGuard</div>
           <div className="font-serif font-black text-2xl italic">ShepherdSoft</div>
        </div>
        <p className="text-xs text-indigo-900/30 font-bold uppercase tracking-[0.2em] flex items-center space-x-2">
           <ShieldCheck className="w-4 h-4" />
           <span>Secure & Respectful of Your Privacy</span>
        </p>
      </div>

      {/* ── Footer Link ── */}
      <div className="text-center mt-20">
        <button onClick={onGoHome} className="btn-sacred-ghost">
           ← Return to Home
        </button>
      </div>

    </div>
  );
};
